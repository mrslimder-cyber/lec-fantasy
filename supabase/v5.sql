-- v5: importación por scripts (scrapeado / calculado), cierre de jornada que abre el mercado,
--     precios hacia el valor teórico (media x valor del punto, ±15 % por jornada) y vistas para la web.
-- Ejecutar DESPUÉS de v4.sql. Se puede volver a ejecutar sin perder datos.
-- (Si vuelves a ejecutar v4.sql, ejecuta v5.sql otra vez después: v5 sustituye varias funciones de v4.)

-- 0) AJUSTES Y COLUMNAS --------------------------------------------------------------
insert into settings values ('market_open',0) on conflict (key) do nothing;

-- scraped_at: el scraper terminó de subir el game. calculated_at: ya tiene puntos calculados.
alter table games add column if not exists scraped_at timestamptz;
alter table games add column if not exists calculated_at timestamptz;
-- Lo que ya estuviera cargado y calculado antes de v5 se da por hecho.
update games g set scraped_at = coalesce(scraped_at, now()), calculated_at = coalesce(calculated_at, now())
where exists (select 1 from player_game_points p where p.game_id = g.id);

-- base_price: precio de salida (el de la jornada 0). Los precios se calculan siempre desde el de la jornada anterior.
-- Si cambias precios en seed.sql antes de empezar, ejecuta:  update players set base_price = price;
alter table players add column if not exists base_price numeric;
update players set base_price = price where base_price is null;

-- 1) VISTA PARA LA PÁGINA DE JUGADORES ------------------------------------------------
create or replace view player_season_points as
select player_id, count(*)::int as series, sum(points) as points
from player_series_points group by player_id;
grant select on player_season_points to anon, authenticated;

-- 2) CALCULAR SOLO LO PENDIENTE --------------------------------------------------------
create or replace function calculate_pending_games() returns int
language plpgsql security definer as $$
declare g record; n int := 0;
begin
  for g in select id from games where scraped_at is not null and calculated_at is null order by played_at, id loop
    perform recompute_game(g.id);
    update games set calculated_at = now() where id = g.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- 3) PRECIOS ----------------------------------------------------------------------------
-- Precio teórico = media de puntos por serie de la temporada * settings.point_value (lo fijas tú):
--   update settings set value = 50000 where key = 'point_value';
-- Tras cada jornada, SOLO los jugadores que han jugado en ella se mueven hacia su precio teórico:
-- como máximo un 15 % arriba o abajo respecto a su precio anterior (cualquier valor intermedio vale).
-- Quien no juega esa jornada mantiene su precio. En la jornada 1 todos parten de players.base_price.
drop function if exists calibrate_point_value(int);

create or replace function update_prices(p_matchday int) returns void
language plpgsql security definer as $$
declare pv numeric := coalesce((select value from settings where key = 'point_value'), 0);
begin
  if pv <= 0 then
    raise exception 'Fija el valor del punto antes de cerrar la jornada: update settings set value = <euros por punto de media> where key = ''point_value'';';
  end if;
  insert into player_prices(player_id, matchday, price)
  select p.id, p_matchday,
    greatest(1000, case when t.raw >= prev.price then floor(t.raw) else ceil(t.raw) end)
  from players p
  cross join lateral (select coalesce(
      (select pp.price from player_prices pp where pp.player_id = p.id and pp.matchday < p_matchday
       order by pp.matchday desc limit 1), p.base_price) as price) prev
  join lateral (select sum(x.points) / count(*) as av from player_series_points x
                where x.player_id = p.id and x.matchday <= p_matchday) a on a.av is not null
  cross join lateral (select prev.price * (1 + greatest(-0.15, least(0.15, pv * a.av / prev.price - 1))) as raw) t
  where prev.price > 0
    and exists (select 1 from player_series_points y where y.player_id = p.id and y.matchday = p_matchday)
  on conflict (player_id, matchday) do update set price = excluded.price;
  update players p set price = pp.price from player_prices pp
  where pp.player_id = p.id and pp.matchday = p_matchday;
end $$;

-- 4) CERRAR JORNADA --------------------------------------------------------------------
--   select close_matchday(<n>);   (lo lanza cerrar_jornada.py)
-- Reparte los puntos a las ligas, recalcula precios y ABRE el mercado.
create or replace function close_matchday(p_matchday int) returns void
language plpgsql security definer as $$
declare pending int;
begin
  if not exists (select 1 from games where matchday = p_matchday) then
    raise exception 'La jornada % no tiene partidos cargados', p_matchday;
  end if;
  select count(*) into pending from games where matchday = p_matchday and calculated_at is null;
  if pending > 0 then
    raise exception 'Hay % games de la jornada % sin calcular: ejecuta calcular.py primero', pending, p_matchday;
  end if;

  delete from league_matchday_points where matchday = p_matchday;
  insert into league_matchday_points(league_id, league_team_id, player_id, matchday, day, points)
  select lt.league_id, lt.id, l.player_id, p_matchday, d.day, m.points
  from league_teams lt
  cross join (values (1),(2),(3)) as d(day)
  cross join lateral (
    select x.player_id from league_lineups x
      where x.league_team_id = lt.id and x.matchday = p_matchday and x.day = d.day
        and exists (select 1 from league_rosters r where r.league_team_id = lt.id and r.player_id = x.player_id)
    union all
    select r.player_id from league_rosters r
      where r.league_team_id = lt.id and r.slot in ('top','jng','mid','adc','sup')
        and not exists (select 1 from league_lineups y
                        where y.league_team_id = lt.id and y.matchday = p_matchday and y.day = d.day)
  ) l
  join player_day_points m on m.player_id = l.player_id and m.matchday = p_matchday and m.day = d.day
  where exists (select 1 from leagues g where g.id = lt.league_id and g.drawn);

  perform update_prices(p_matchday);
  insert into closed_matchdays(matchday) values (p_matchday) on conflict do nothing;
  update settings set value = 1 where key = 'market_open';   -- mercado abierto hasta el viernes 23:59
end $$;

-- 5) MERCADO: lo abre el cierre de jornada y lo cierra el viernes a las 23:59 -----------
create or replace function market_status() returns jsonb language plpgsql stable as $$
declare cm int := current_matchday(); dow int;
  testing boolean := coalesce((select value from settings where key='testing_open'),0) = 1;
  flag boolean := coalesce((select value from settings where key='market_open'),0) = 1;
  mult numeric := coalesce((select value from settings where key='clause_multiplier'),1.5);
  o boolean := true; why text := '';
begin
  dow := extract(dow from now() at time zone 'Europe/Madrid')::int;
  if not testing then
    if not flag then
      o := false; why := 'El mercado está cerrado. Se abre al cerrar la jornada y cierra el viernes a las 23:59.';
    elsif dow not in (2,3,4,5) then
      o := false; why := 'El mercado está cerrado. Solo abre de martes a viernes.';
    end if;
  end if;
  return jsonb_build_object('open', o, 'reason', why, 'matchday', cm,
                            'lineup_open', lineup_open(cm), 'clause_multiplier', mult);
end $$;

create or replace function resolve_all_bids(p_force boolean default false) returns int
language plpgsql security definer as $$
declare t timestamp := now() at time zone 'Europe/Madrid'; lg record; n int := 0;
begin
  if not p_force
     and coalesce((select value from settings where key='testing_open'),0) <> 1
     and not (extract(dow from t) = 5 and extract(hour from t) = 23 and extract(minute from t) >= 58) then
    return 0;
  end if;
  for lg in select id from leagues where drawn loop
    n := n + resolve_league_bids(lg.id);   -- también repone el mercado de la semana siguiente
  end loop;
  update settings set value = 0 where key = 'market_open';   -- el mercado queda visible pero cerrado
  return n;
end $$;

-- 6) SEGURIDAD: solo tu clave service_role (scripts) o el SQL Editor pueden ejecutarlas -
revoke execute on function recompute_game(bigint), update_prices(int),
  calculate_pending_games(), close_matchday(int), resolve_all_bids(boolean)
  from public, anon, authenticated;
