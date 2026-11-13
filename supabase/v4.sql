-- v4: horario del mercado, mercado reducido (2 por posición), clausulazos,
--     equipos por día (sáb/dom/lun), calendario de partidos y resolución automática de pujas.
-- Ejecutar DESPUÉS de leagues.sql, v2.sql y v3.sql. Se puede volver a ejecutar sin perder datos.
-- (Si vuelves a ejecutar leagues.sql, v2.sql o v3.sql, ejecuta v4.sql otra vez al final.)
-- Todas las horas se interpretan en hora de España peninsular (Europe/Madrid).

-- 0) AJUSTES -------------------------------------------------------------------------
-- clause_multiplier: el clausulazo cuesta  precio_actual * clause_multiplier  (se paga al dueño).
-- testing_open: pon 1 para probar fuera de horario (mercado y creación de equipos siempre abiertos).
insert into settings values ('clause_multiplier',1.5),('testing_open',0) on conflict (key) do nothing;

-- 1) CALENDARIO ----------------------------------------------------------------------
-- Un partido (serie) por fila. Ejemplo:
--   insert into fixtures(matchday, kickoff, team_a, team_b, bo) values
--   (1, '2027-01-16 17:00+01', (select id from teams where name='G2'), (select id from teams where name='Fnatic'), 1);
-- El día se deduce de la fecha: sábado = día 1, domingo = día 2, lunes = día 3.
create table if not exists fixtures(
  id serial primary key,
  matchday int not null,
  kickoff timestamptz not null,
  team_a int not null references teams(id),
  team_b int not null references teams(id),
  bo int not null default 1 check (bo in (1,3))
);
create table if not exists closed_matchdays(matchday int primary key, closed_at timestamptz default now());
alter table fixtures enable row level security;
alter table closed_matchdays enable row level security;
drop policy if exists "read fixtures" on fixtures;
drop policy if exists "read closed_matchdays" on closed_matchdays;
create policy "read fixtures" on fixtures for select using (true);
create policy "read closed_matchdays" on closed_matchdays for select using (true);

-- Jornada en curso = la primera con partidos de hoy en adelante (de martes a viernes, la próxima).
create or replace function current_matchday() returns int language sql stable as $$
  select min(matchday) from fixtures
  where (kickoff at time zone 'Europe/Madrid')::date >= (now() at time zone 'Europe/Madrid')::date
$$;
-- Jornada ya jugada que todavía no se ha cerrado (close_matchday).
create or replace function unclosed_matchday() returns int language sql stable as $$
  select min(f.matchday) from fixtures f
  where (f.kickoff at time zone 'Europe/Madrid')::date < (now() at time zone 'Europe/Madrid')::date
    and not exists (select 1 from closed_matchdays c where c.matchday = f.matchday)
$$;
-- Los equipos se crean el sábado, hasta el primer partido de la jornada.
create or replace function lineup_open(p_matchday int) returns boolean language sql stable as $$
  select coalesce((select value from settings where key='testing_open'),0) = 1
    or (p_matchday is not null
        and extract(dow from now() at time zone 'Europe/Madrid') = 6
        and now() < coalesce((select min(kickoff) from fixtures where matchday = p_matchday), 'infinity'::timestamptz))
$$;
-- Mercado: abierto de martes a viernes (00:00-23:59), y solo si la jornada anterior ya está cerrada.
create or replace function market_status() returns jsonb language plpgsql stable as $$
declare cm int := current_matchday(); u int := unclosed_matchday(); dow int;
  testing boolean := coalesce((select value from settings where key='testing_open'),0) = 1;
  mult numeric := coalesce((select value from settings where key='clause_multiplier'),1.5);
  o boolean := true; why text := '';
begin
  dow := extract(dow from now() at time zone 'Europe/Madrid')::int;
  if not testing then
    if dow not in (2,3,4,5) then
      o := false; why := 'El mercado está cerrado. Abre el martes a las 00:00 y cierra el viernes a las 23:59.';
    elsif u is not null then
      o := false; why := 'El mercado abrirá cuando se cierre la jornada ' || u || '.';
    end if;
  end if;
  return jsonb_build_object('open', o, 'reason', why, 'matchday', cm,
                            'lineup_open', lineup_open(cm), 'clause_multiplier', mult);
end $$;
create or replace function assert_market_open() returns void language plpgsql stable as $$
declare s jsonb := market_status();
begin
  if not (s->>'open')::boolean then raise exception '%', s->>'reason'; end if;
end $$;

-- 2) PUNTOS POR DÍA ------------------------------------------------------------------
-- La vista de series gana la columna "day" (1 sáb, 2 dom, 3 lun; otros días cuentan como 1).
create or replace view player_series_points as
with s as (
  select matchday, coalesce(series_id, id) as sid, count(*) as maps, min(played_at) as first_at
  from games group by 1, 2)
select pgp.player_id, g.matchday, s.sid as series_id, max(s.maps)::int as maps,
       sum(pgp.points) / max(s.maps) as points,
       max(case extract(dow from s.first_at at time zone 'Europe/Madrid')
             when 6 then 1 when 0 then 2 when 1 then 3 else 1 end)::int as day
from player_game_points pgp
join games g on g.id = pgp.game_id
join s on s.matchday = g.matchday and s.sid = coalesce(g.series_id, g.id)
group by pgp.player_id, g.matchday, s.sid;

create or replace view player_day_points as
select player_id, matchday, day, sum(points) as points
from player_series_points group by player_id, matchday, day;
grant select on player_series_points, player_day_points to anon, authenticated;

alter table league_matchday_points add column if not exists day int not null default 0;
alter table league_matchday_points drop constraint if exists league_matchday_points_pkey;
alter table league_matchday_points add constraint league_matchday_points_pkey
  primary key (league_team_id, player_id, matchday, day);

-- 3) EQUIPOS POR DÍA -----------------------------------------------------------------
create table if not exists league_lineups(
  league_id int not null references leagues(id) on delete cascade,
  league_team_id int not null references league_teams(id) on delete cascade,
  matchday int not null,
  day int not null check (day between 1 and 3),
  slot text not null check (slot in ('top','jng','mid','adc','sup')),
  player_id int not null references players(id),
  primary key (league_team_id, matchday, day, slot),
  unique (league_team_id, matchday, day, player_id)
);
alter table league_lineups enable row level security;
drop policy if exists "read league_lineups" on league_lineups;
create policy "read league_lineups" on league_lineups for select using (is_member(league_id));

-- Si no se ha guardado equipo para un día, se parte de los 5 titulares de la plantilla.
create or replace function init_lineup(p_team int, p_matchday int, p_day int) returns void
language plpgsql security definer as $$
begin
  if exists (select 1 from league_lineups where league_team_id = p_team and matchday = p_matchday and day = p_day) then return; end if;
  insert into league_lineups(league_id, league_team_id, matchday, day, slot, player_id)
  select r.league_id, r.league_team_id, p_matchday, p_day, r.slot, r.player_id
  from league_rosters r where r.league_team_id = p_team and r.slot in ('top','jng','mid','adc','sup');
end $$;

-- Pone a un jugador de titular en su posición ese día (el que estaba pasa al banquillo).
create or replace function set_starter(p_league int, p_matchday int, p_day int, p_player int) returns void
language plpgsql security definer as $$
declare lt int; pr text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select id into lt from league_teams where league_id = p_league and user_id = auth.uid();
  if lt is null then raise exception 'No estás en esta liga'; end if;
  if p_matchday is distinct from current_matchday() then raise exception 'Jornada no válida'; end if;
  if not lineup_open(p_matchday) then
    raise exception 'Los equipos solo se pueden crear el sábado, antes del primer partido de la jornada';
  end if;
  if p_day not between 1 and 3 then raise exception 'Día no válido'; end if;
  select p.role into pr from league_rosters r join players p on p.id = r.player_id
    where r.league_team_id = lt and r.player_id = p_player;
  if pr is null then raise exception 'Ese jugador no está en tu plantilla'; end if;
  perform init_lineup(lt, p_matchday, p_day);
  insert into league_lineups(league_id, league_team_id, matchday, day, slot, player_id)
  values (p_league, lt, p_matchday, p_day, pr, p_player)
  on conflict (league_team_id, matchday, day, slot) do update set player_id = excluded.player_id;
end $$;

-- Copia el equipo de un día a los otros dos.
create or replace function copy_lineup(p_league int, p_matchday int, p_day int) returns void
language plpgsql security definer as $$
declare lt int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select id into lt from league_teams where league_id = p_league and user_id = auth.uid();
  if lt is null then raise exception 'No estás en esta liga'; end if;
  if p_matchday is distinct from current_matchday() then raise exception 'Jornada no válida'; end if;
  if not lineup_open(p_matchday) then
    raise exception 'Los equipos solo se pueden crear el sábado, antes del primer partido de la jornada';
  end if;
  if p_day not between 1 and 3 then raise exception 'Día no válido'; end if;
  perform init_lineup(lt, p_matchday, p_day);
  delete from league_lineups where league_team_id = lt and matchday = p_matchday and day <> p_day;
  insert into league_lineups(league_id, league_team_id, matchday, day, slot, player_id)
  select p_league, lt, p_matchday, d, l.slot, l.player_id
  from league_lineups l cross join generate_series(1,3) d
  where l.league_team_id = lt and l.matchday = p_matchday and l.day = p_day and d <> p_day;
end $$;

-- Cerrar jornada (UNA vez, cuando estén cargados todos los partidos):  select close_matchday(<n>);
-- Cada equipo puntúa, día por día, con los 5 de su equipo de ese día (o con sus 5 titulares si no lo creó).
create or replace function close_matchday(p_matchday int) returns void
language plpgsql security definer as $$
begin
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
  insert into closed_matchdays(matchday) values (p_matchday) on conflict do nothing;
end $$;

-- 4) MERCADO REDUCIDO ----------------------------------------------------------------
-- En cada liga solo se puede pujar por los jugadores que estén en league_market:
-- como norma, 2 de cada posición, elegidos al azar entre los que no tiene nadie.
create table if not exists league_market(
  league_id int not null references leagues(id) on delete cascade,
  player_id int not null references players(id),
  added_at timestamptz default now(),
  primary key (league_id, player_id)
);
alter table league_market enable row level security;
drop policy if exists "read league_market" on league_market;
create policy "read league_market" on league_market for select using (is_member(league_id));

create or replace function refill_market(p_league int) returns void
language plpgsql security definer as $$
declare r text; have int;
begin
  delete from league_market m where m.league_id = p_league
    and exists (select 1 from league_rosters x where x.league_id = p_league and x.player_id = m.player_id);
  delete from league_market m where m.league_id = p_league
    and not exists (select 1 from players p where p.id = m.player_id and p.active);
  foreach r in array array['top','jng','mid','adc','sup'] loop
    select count(*) into have from league_market m join players p on p.id = m.player_id
      where m.league_id = p_league and p.role = r;
    if have < 2 then
      insert into league_market(league_id, player_id)
      select p_league, p.id from players p
      where p.active and p.role = r
        and not exists (select 1 from league_rosters x where x.league_id = p_league and x.player_id = p.id)
        and not exists (select 1 from league_market m where m.league_id = p_league and m.player_id = p.id)
      order by random() limit 2 - have;
    end if;
  end loop;
end $$;

-- 5) MOVIMIENTOS: nuevo tipo "clausulazo" --------------------------------------------
alter table league_moves add column if not exists other_team_id int references league_teams(id) on delete set null;
alter table league_moves drop constraint if exists league_moves_kind_check;
alter table league_moves add constraint league_moves_kind_check check (kind in ('compra','venta','clausulazo'));

-- 6) COMPRAR, VENDER, CLAUSULAZO -----------------------------------------------------
create or replace function place_bid(p_league int, p_player int, p_amount numeric) returns void
language plpgsql security definer as $$
declare lg leagues; lt int; c numeric; pl players;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  perform assert_market_open();
  select * into lg from leagues where id = p_league;
  if lg.id is null or not lg.drawn then raise exception 'La liga aún no se ha sorteado'; end if;
  select id, cash into lt, c from league_teams where league_id = p_league and user_id = auth.uid();
  if lt is null then raise exception 'No estás en esta liga'; end if;
  select * into pl from players where id = p_player and active;
  if pl.id is null then raise exception 'Jugador no disponible'; end if;
  if not exists (select 1 from league_market where league_id = p_league and player_id = p_player)
    then raise exception 'Ese jugador no está en el mercado'; end if;
  if exists (select 1 from league_rosters where league_id = p_league and player_id = p_player)
    then raise exception 'Ese jugador ya tiene dueño en esta liga'; end if;
  if p_amount < pl.price then raise exception 'La puja mínima es %', ceil(pl.price); end if;
  if p_amount > coalesce(c, 0) then raise exception 'No tienes dinero suficiente para esa puja'; end if;
  insert into league_bids(league_id, league_team_id, player_id, amount)
  values (p_league, lt, p_player, p_amount)
  on conflict (league_team_id, player_id) do update set amount = excluded.amount, created_at = now();
end $$;

create or replace function cancel_bid(p_league int, p_player int) returns void
language plpgsql security definer as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  perform assert_market_open();
  delete from league_bids b using league_teams t
  where b.league_team_id = t.id and t.user_id = auth.uid()
    and b.league_id = p_league and b.player_id = p_player;
end $$;

-- Vender: inmediato, solo con el mercado abierto; el jugador entra directamente en el mercado.
create or replace function sell_player(p_league int,p_slot text) returns void
language plpgsql security definer as $$
declare lg leagues; lt int; c numeric; pid int; pr numeric;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  perform assert_market_open();
  select * into lg from leagues where id = p_league;
  if lg.id is null or not lg.drawn then raise exception 'La liga aún no se ha sorteado'; end if;
  select id,cash into lt,c from league_teams where league_id = p_league and user_id = auth.uid() for update;
  if lt is null then raise exception 'No estás en esta liga'; end if;
  select player_id into pid from league_rosters where league_team_id = lt and slot = p_slot;
  if pid is null then raise exception 'Ese hueco está vacío'; end if;
  select price into pr from players where id = pid;
  delete from league_rosters where league_team_id = lt and slot = p_slot;
  update league_teams set cash = coalesce(c,0)+coalesce(pr,0) where id = lt;
  insert into league_market(league_id, player_id) values (p_league, pid) on conflict do nothing;
  insert into league_moves(league_id, league_team_id, player_id, kind, amount)
  values (p_league, lt, pid, 'venta', coalesce(pr,0));
end $$;

-- Clausulazo: pagas precio_actual * clause_multiplier al dueño y el jugador es tuyo al instante.
create or replace function clause_player(p_league int, p_player int) returns void
language plpgsql security definer as $$
declare lg leagues; lt int; ot int; c numeric; pl players; amt numeric; s text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  perform assert_market_open();
  select * into lg from leagues where id = p_league;
  if lg.id is null or not lg.drawn then raise exception 'La liga aún no se ha sorteado'; end if;
  select id, cash into lt, c from league_teams where league_id = p_league and user_id = auth.uid() for update;
  if lt is null then raise exception 'No estás en esta liga'; end if;
  select * into pl from players where id = p_player and active;
  if pl.id is null then raise exception 'Jugador no disponible'; end if;
  select league_team_id into ot from league_rosters where league_id = p_league and player_id = p_player;
  if ot is null then raise exception 'Ese jugador está libre: puja por él en el mercado'; end if;
  if ot = lt then raise exception 'Ese jugador ya es tuyo'; end if;
  amt := ceil(pl.price * coalesce((select value from settings where key='clause_multiplier'),1.5));
  if coalesce(c,0) < amt then raise exception 'No tienes dinero suficiente: la cláusula es de % €', amt; end if;

  if not exists (select 1 from league_rosters where league_team_id = lt and slot = pl.role) then s := pl.role;
  elsif not exists (select 1 from league_rosters where league_team_id = lt and slot = 'res1') then s := 'res1';
  elsif not exists (select 1 from league_rosters where league_team_id = lt and slot = 'res2') then s := 'res2';
  else raise exception 'Plantilla completa: vende a un jugador antes de hacer el clausulazo'; end if;

  perform 1 from league_teams where id = ot for update;
  delete from league_rosters where league_team_id = ot and player_id = p_player;
  insert into league_rosters(league_id, league_team_id, slot, player_id, draft_price)
  values (p_league, lt, s, p_player, pl.price);
  update league_teams set cash = coalesce(c,0) - amt where id = lt;
  update league_teams set cash = coalesce(cash,0) + amt where id = ot;
  delete from league_bids where league_id = p_league and player_id = p_player;
  insert into league_moves(league_id, league_team_id, player_id, kind, amount, other_team_id)
  values (p_league, lt, p_player, 'clausulazo', amt, ot);
end $$;

-- 7) PUJAS: RESOLUCIÓN AUTOMÁTICA ----------------------------------------------------
drop function if exists resolve_bids(int);

create or replace function resolve_league_bids(p_league int) returns int
language plpgsql security definer as $$
declare b record; c numeric; s text; n int := 0; pl players;
begin
  for b in select * from league_bids where league_id = p_league order by amount desc, created_at, id loop
    continue when exists (select 1 from league_rosters where league_id = p_league and player_id = b.player_id);
    continue when not exists (select 1 from league_market where league_id = p_league and player_id = b.player_id);
    select * into pl from players where id = b.player_id and active;
    continue when pl.id is null;
    select cash into c from league_teams where id = b.league_team_id for update;
    continue when coalesce(c, 0) < b.amount;

    s := null;
    if not exists (select 1 from league_rosters where league_team_id = b.league_team_id and slot = pl.role) then s := pl.role;
    elsif not exists (select 1 from league_rosters where league_team_id = b.league_team_id and slot = 'res1') then s := 'res1';
    elsif not exists (select 1 from league_rosters where league_team_id = b.league_team_id and slot = 'res2') then s := 'res2';
    end if;
    continue when s is null;

    insert into league_rosters(league_id, league_team_id, slot, player_id, draft_price)
    values (p_league, b.league_team_id, s, pl.id, pl.price);
    update league_teams set cash = c - b.amount where id = b.league_team_id;
    insert into league_moves(league_id, league_team_id, player_id, kind, amount)
    values (p_league, b.league_team_id, pl.id, 'compra', b.amount);
    n := n + 1;
  end loop;

  delete from league_bids where league_id = p_league;
  perform refill_market(p_league);   -- quita los fichados y repone hasta 2 por posición
  return n;
end $$;

-- Lo ejecuta pg_cron el viernes a las 23:59 (hora de Madrid). Con p_force = true se ejecuta ya (pruebas):
--   select resolve_all_bids(true);
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
    n := n + resolve_league_bids(lg.id);
  end loop;
  return n;
end $$;

revoke execute on function close_matchday(int), resolve_league_bids(int), resolve_all_bids(boolean),
  refill_market(int), init_lineup(int,int,int) from public, anon, authenticated;

-- 8) PROGRAMACIÓN (pg_cron) ----------------------------------------------------------
-- Dos avisos (21:59 y 22:59 UTC) para cubrir horario de verano e invierno; la función solo actúa
-- cuando en Madrid son las 23:59 del viernes. Si no puedes activar pg_cron (Database > Extensions),
-- ejecuta a mano  select resolve_all_bids(true);  el viernes a esa hora.
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('resolve-bids-a', '59 21 * * 5', 'select resolve_all_bids()');
  perform cron.schedule('resolve-bids-b', '59 22 * * 5', 'select resolve_all_bids()');
exception when others then
  raise notice 'No se pudo programar pg_cron: %', sqlerrm;
end $$;

-- 9) SORTEO: el mercado se rellena al sortear ----------------------------------------
create or replace function draw_league(p_league int) returns void
language plpgsql security definer as $$
declare
  budget numeric := (select value from settings where key = 'budget');
  reserve_cash numeric := coalesce((select value from settings where key = 'reserve_cash'),0);
  draft_budget numeric;
  lg leagues; n int; attempt int := 0; ok boolean; k int; lt int;
  spent numeric; minp numeric; pid int; pprice numeric; prole text; owned text[];
  r text;
begin
  select * into lg from leagues where id = p_league;
  if lg.id is null or lg.owner <> auth.uid() then raise exception 'Solo el creador puede sortear'; end if;
  if lg.drawn then raise exception 'La liga ya está sorteada'; end if;

  draft_budget := budget - reserve_cash;
  if draft_budget <= 0 then raise exception 'El presupuesto para el sorteo debe ser positivo'; end if;

  select count(*) into n from league_teams where league_id = p_league;
  if n < 1 then raise exception 'No hay equipos en la liga'; end if;

  foreach r in array array['top','jng','mid','adc','sup'] loop
    if (select count(*) from players where active and role = r) < n then
      raise exception 'No hay suficientes jugadores de % para % equipos',r,n;
    end if;
  end loop;
  if (select count(*) from players where active) < 6*n then
    raise exception 'La pool tiene menos de % jugadores',6*n;
  end if;

  loop
    attempt := attempt + 1;
    if attempt > 500 then raise exception 'No se encontró un reparto dentro del presupuesto (prueba de nuevo o amplía la pool)'; end if;
    delete from league_rosters where league_id = p_league;
    ok := true;

    for k in 1..6 loop
      exit when not ok;
      for lt in select id from league_teams where league_id = p_league order by random() loop
        select coalesce(sum(draft_price),0) into spent from league_rosters where league_team_id = lt;
        select coalesce(array_agg(p2.role), '{}') into owned
          from league_rosters x join players p2 on p2.id = x.player_id where x.league_team_id = lt;
        select min(p.price) into minp from players p where p.active
          and not exists (select 1 from league_rosters x where x.league_id = p_league and x.player_id = p.id);
        pid := null;
        select p.id, p.price, p.role into pid, pprice, prole from players p
        where p.active
          and (k > 5 or p.role <> all(owned))
          and not exists (select 1 from league_rosters x where x.league_id = p_league and x.player_id = p.id)
          and spent + p.price + (6-k)*coalesce(minp,0) <= draft_budget
        order by random() limit 1;
        if pid is null then ok := false; exit; end if;
        insert into league_rosters(league_id,league_team_id,slot,player_id,draft_price)
        values (p_league, lt, case when k > 5 then 'res1' else prole end, pid, pprice);
      end loop;
    end loop;
    exit when ok;
  end loop;

  update league_teams set cash = budget - coalesce(
    (select sum(draft_price) from league_rosters r2 where r2.league_team_id = league_teams.id),0
  ) where league_id = p_league;

  update leagues set drawn = true where id = p_league;
  perform refill_market(p_league);
end $$;

-- Rellena el mercado de las ligas que ya estaban sorteadas.
select refill_market(id) from leagues where drawn;
