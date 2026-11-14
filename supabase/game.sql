-- game.sql: TODO el juego en un solo archivo. Sustituye a leagues.sql y v2.sql ... v8.sql (puedes borrarlos).
-- Orden en una base nueva: schema.sql, scoring.sql, seed.sql, game.sql.
-- Se puede volver a ejecutar sin perder datos. (Si vuelves a ejecutar scoring.sql, ejecuta game.sql otra vez después.)
--
-- FORMATO "SUPERMANAGER"
--  * Sin sorteo, sin pujas, sin clausulazos. Mercado con copias infinitas de cada jugador: fichar y vender es inmediato.
--  * Plantilla de 8 jugadores (máx. 3 imports). Cada día (sáb/dom/lun) se fija un equipo de 5 (máx. 2 imports).
--  * Fuera de posición puntúa la mitad. Mercado abierto miércoles-viernes (sáb-mar cerrado). Horas: Europe/Madrid.

-- 0) AJUSTES Y COLUMNAS ---------------------------------------------------------------
insert into settings values ('budget', 5000000) on conflict (key) do nothing;
insert into settings values ('testing_open', 0) on conflict (key) do nothing;
-- testing_open = 1: mercado siempre abierto y equipos siempre editables (solo para probar).
-- budget: dinero inicial de cada equipo (se cambia con: update settings set value = X where key = 'budget'; solo afecta a equipos nuevos).

alter table players add column if not exists rookie boolean not null default false;
alter table players add column if not exists is_import boolean not null default false;   -- import = jugador no europeo
alter table players add column if not exists base_price numeric;
update players set base_price = price where base_price is null;
alter table games add column if not exists series_id bigint;
alter table games add column if not exists scraped_at timestamptz;
alter table games add column if not exists calculated_at timestamptz;

-- 0b) MIGRACIÓN DEL FORMATO ANTIGUO (solo la primera vez) -------------------------------
-- Borra plantillas, equipos por día, pujas y mercado reducido; devuelve a cada equipo el presupuesto completo.
-- NO toca ligas, equipos de liga, puntos ya repartidos ni el historial de movimientos.
do $$ begin
  if not exists (select 1 from settings where key = 'format') then
    drop table if exists league_rosters cascade;
    drop table if exists league_lineups cascade;
    drop table if exists league_bids cascade;
    drop table if exists league_bid_results cascade;
    drop table if exists league_market cascade;
    update settings set value = 5000000 where key = 'budget';
    if to_regclass('league_teams') is not null then
      update league_teams set cash = 5000000;
    end if;
    update games g set scraped_at = coalesce(scraped_at, now()), calculated_at = coalesce(calculated_at, now())
    where exists (select 1 from player_game_points p where p.game_id = g.id);
    insert into settings values ('format', 2);
  end if;
end $$;

-- Funciones y tareas del formato antiguo
drop function if exists draw_league(int);
drop function if exists move_player(int, text, text);
drop function if exists set_starter(int, int, int, int);
drop function if exists init_lineup(int, int, int);
drop function if exists place_bid(int, int, numeric);
drop function if exists cancel_bid(int, int);
drop function if exists resolve_bids(int);
drop function if exists resolve_league_bids(int);
drop function if exists resolve_all_bids(boolean);
drop function if exists refill_market(int);
drop function if exists clause_player(int, int);
drop function if exists lineup_open(int);
drop function if exists sell_player(int, text);
do $$ declare j text; begin
  foreach j in array array['resolve-bids-a', 'resolve-bids-b', 'resolve-bids-mon-a', 'resolve-bids-mon-b'] loop
    begin perform cron.unschedule(j); exception when others then null; end;
  end loop;
exception when others then null;
end $$;

-- 1) PUNTOS POR SERIE Y POR DÍA ----------------------------------------------------------
-- games.series_id: mismo valor en todos los games de un BO3 (vacío = BO1).
-- Puntos de una serie = suma de sus games / mapas. Día: 1 sábado, 2 domingo, 3 lunes (otros días cuentan como 1).
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

create or replace view player_season_points as
select player_id, count(*)::int as series, sum(points) as points
from player_series_points group by player_id;

grant select on player_series_points, player_day_points, player_season_points to anon, authenticated;

-- 2) CALENDARIO ---------------------------------------------------------------------------
--   insert into fixtures(matchday, kickoff, team_a, team_b, bo) values
--   (1, '2027-01-16 17:00+01', (select id from teams where name='G2'), (select id from teams where name='Fnatic'), 1);
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

-- Jornada en curso = la primera con partidos de hoy en adelante.
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
create or replace function fixture_day(t timestamptz) returns int language sql stable as $$
  select case extract(dow from t at time zone 'Europe/Madrid')::int when 6 then 1 when 0 then 2 when 1 then 3 else 1 end
$$;
-- ¿Ha empezado ya el primer partido de ese día? Entonces su equipo está cerrado (se fija solo).
create or replace function day_started(p_matchday int, p_day int) returns boolean language sql stable as $$
  select coalesce((select min(kickoff) from fixtures where matchday = p_matchday and fixture_day(kickoff) = p_day) <= now(), false)
     and coalesce((select value from settings where key = 'testing_open'), 0) <> 1
$$;

-- 3) TABLAS DE LIGA -----------------------------------------------------------------------
create table if not exists leagues(
  id serial primary key,
  name text not null,
  code text unique not null default upper(substr(md5(random()::text),1,6)),
  owner uuid not null references auth.users(id),
  drawn boolean not null default true,        -- ya no hay sorteo: se mantiene la columna, siempre true
  created_at timestamptz default now()
);
alter table leagues alter column drawn set default true;
update leagues set drawn = true where not drawn;

create table if not exists league_teams(
  id serial primary key,
  league_id int not null references leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  name text not null,
  cash numeric,
  unique(league_id, user_id),
  unique(league_id, name)
);
alter table league_teams add column if not exists cash numeric;

-- Plantilla: hasta 8 jugadores por equipo; el mismo jugador puede estar en todos los equipos (copias infinitas).
create table if not exists league_rosters(
  league_id int not null references leagues(id) on delete cascade,
  league_team_id int not null references league_teams(id) on delete cascade,
  player_id int not null references players(id),
  bought_price numeric not null,
  created_at timestamptz not null default now(),
  primary key (league_team_id, player_id)
);

create table if not exists league_moves(
  id serial primary key,
  league_id int not null references leagues(id) on delete cascade,
  league_team_id int not null references league_teams(id) on delete cascade,
  player_id int not null references players(id),
  kind text not null check (kind in ('compra','venta','clausulazo')),   -- clausulazo: solo historial antiguo
  amount numeric not null,
  other_team_id int references league_teams(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Puntos que quedan fijados al cerrar la jornada (un registro por jugador alineado y día).
create table if not exists league_matchday_points(
  league_id int not null references leagues(id) on delete cascade,
  league_team_id int not null references league_teams(id) on delete cascade,
  player_id int not null references players(id),
  matchday int not null,
  day int not null default 0,
  points numeric not null,
  primary key (league_team_id, player_id, matchday, day)
);

-- Equipo de 5 de cada día: slot = posición en la que juega (puede no ser la suya: puntúa la mitad).
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
-- «Fijar equipo»: el equipo de ese día queda bloqueado hasta que se desfije (o hasta que empiece el día).
create table if not exists league_lineup_locks(
  league_id int not null references leagues(id) on delete cascade,
  league_team_id int not null references league_teams(id) on delete cascade,
  matchday int not null,
  day int not null check (day between 1 and 3),
  locked_at timestamptz not null default now(),
  primary key (league_team_id, matchday, day)
);

-- 4) SEGURIDAD (RLS) ----------------------------------------------------------------------
create or replace function is_member(l int) returns boolean
language sql security definer stable as $$
  select exists(select 1 from league_teams where league_id = l and user_id = auth.uid())
$$;
create or replace function owns_team(t int) returns boolean
language sql security definer stable as $$
  select exists(select 1 from league_teams where id = t and user_id = auth.uid())
$$;

alter table leagues enable row level security;
alter table league_teams enable row level security;
alter table league_rosters enable row level security;
alter table league_moves enable row level security;
alter table league_matchday_points enable row level security;
alter table league_lineups enable row level security;
alter table league_lineup_locks enable row level security;

drop policy if exists "read leagues" on leagues;
drop policy if exists "read league_teams" on league_teams;
drop policy if exists "read league_rosters" on league_rosters;
drop policy if exists "read league_moves" on league_moves;
drop policy if exists "read league_matchday_points" on league_matchday_points;
drop policy if exists "read league_lineups" on league_lineups;
drop policy if exists "read league_lineup_locks" on league_lineup_locks;

create policy "read leagues" on leagues for select using (owner = auth.uid() or is_member(id));
create policy "read league_teams" on league_teams for select using (is_member(league_id));
create policy "read league_rosters" on league_rosters for select using (is_member(league_id));
create policy "read league_moves" on league_moves for select using (is_member(league_id));
create policy "read league_matchday_points" on league_matchday_points for select using (is_member(league_id));
-- El equipo de un día solo lo ven los demás cuando ese día ya ha empezado.
create policy "read league_lineups" on league_lineups for select
  using (is_member(league_id) and (owns_team(league_team_id) or day_started(matchday, day)));
create policy "read league_lineup_locks" on league_lineup_locks for select using (owns_team(league_team_id));

-- 5) CREAR LIGA Y UNIRSE ------------------------------------------------------------------
create or replace function create_league(p_name text, p_team text) returns int
language plpgsql security definer as $$
declare lid int; b numeric := coalesce((select value from settings where key = 'budget'), 0);
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  insert into leagues(name, owner) values (trim(p_name), auth.uid()) returning id into lid;
  insert into league_teams(league_id, user_id, name, cash) values (lid, auth.uid(), trim(p_team), b);
  return lid;
end $$;

create or replace function join_league(p_code text, p_team text) returns int
language plpgsql security definer as $$
declare lg leagues; b numeric := coalesce((select value from settings where key = 'budget'), 0);
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into lg from leagues where code = upper(trim(p_code));
  if lg.id is null then raise exception 'Código de liga no válido'; end if;
  if exists(select 1 from league_teams where league_id = lg.id and user_id = auth.uid())
    then raise exception 'Ya estás en esa liga'; end if;
  insert into league_teams(league_id, user_id, name, cash) values (lg.id, auth.uid(), trim(p_team), b);
  return lg.id;
end $$;

-- 6) MERCADO ------------------------------------------------------------------------------
-- Abierto: miércoles a viernes (00:00-23:59), y solo si la jornada anterior ya está cerrada.
-- Cerrado de sábado a martes (partidos, puntuaciones y cierre de jornada).
-- Pretemporada (sin calendario) y semana previa al primer partido: abierto siempre.
create or replace function market_status() returns jsonb language plpgsql stable as $$
declare cm int := current_matchday(); u int := unclosed_matchday(); dow int;
  testing boolean := coalesce((select value from settings where key = 'testing_open'), 0) = 1;
  pre boolean := not exists (select 1 from fixtures);
  first_week boolean := not exists (select 1 from closed_matchdays)
                        and now() < coalesce((select min(kickoff) from fixtures), '-infinity'::timestamptz);
  o boolean := true; why text := '';
begin
  dow := extract(dow from now() at time zone 'Europe/Madrid')::int;
  if not testing and not pre then
    if u is not null then
      o := false; why := 'El mercado abrirá cuando se cierre la jornada ' || u || '.';
    elsif not first_week and dow not in (3,4,5) then
      o := false; why := 'El mercado está cerrado de sábado a martes. Abre el miércoles a las 00:00 y cierra el viernes a las 23:59.';
    end if;
  end if;
  return jsonb_build_object('open', o, 'reason', why, 'matchday', cm, 'lineup_open', cm is not null,
                            'preseason', pre, 'testing', testing);
end $$;

create or replace function assert_market_open() returns void language plpgsql stable as $$
declare s jsonb := market_status();
begin
  if not (s->>'open')::boolean then raise exception '%', s->>'reason'; end if;
end $$;

-- Fichar: al instante, al precio actual. Máx. 8 jugadores y 3 imports.
create or replace function buy_player(p_league int, p_player int) returns void
language plpgsql security definer as $$
declare lt int; c numeric; pl players; n int; imps int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  perform assert_market_open();
  select id, cash into lt, c from league_teams where league_id = p_league and user_id = auth.uid() for update;
  if lt is null then raise exception 'No estás en esta liga'; end if;
  select * into pl from players where id = p_player and active;
  if pl.id is null then raise exception 'Jugador no disponible'; end if;
  if exists (select 1 from league_rosters where league_team_id = lt and player_id = p_player)
    then raise exception 'Ya tienes a ese jugador'; end if;
  select count(*), count(*) filter (where p.is_import) into n, imps
    from league_rosters r join players p on p.id = r.player_id where r.league_team_id = lt;
  if n >= 8 then raise exception 'Plantilla completa (8 jugadores): vende a alguien antes de fichar'; end if;
  if pl.is_import and imps >= 3 then raise exception 'Solo puedes tener 3 imports en la plantilla'; end if;
  if coalesce(c, 0) < pl.price then raise exception 'No tienes dinero suficiente'; end if;

  insert into league_rosters(league_id, league_team_id, player_id, bought_price)
  values (p_league, lt, pl.id, pl.price);
  update league_teams set cash = coalesce(c, 0) - pl.price where id = lt;
  insert into league_moves(league_id, league_team_id, player_id, kind, amount)
  values (p_league, lt, pl.id, 'compra', pl.price);
end $$;

-- Vender: al instante, al precio actual. Si estaba alineado, sale de los equipos aún no jugados (y se desfijan).
create or replace function sell_player(p_league int, p_player int) returns void
language plpgsql security definer as $$
declare lt int; c numeric; pr numeric;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  perform assert_market_open();
  select id, cash into lt, c from league_teams where league_id = p_league and user_id = auth.uid() for update;
  if lt is null then raise exception 'No estás en esta liga'; end if;
  if not exists (select 1 from league_rosters where league_team_id = lt and player_id = p_player)
    then raise exception 'Ese jugador no está en tu plantilla'; end if;
  select price into pr from players where id = p_player;

  delete from league_lineup_locks k
  where k.league_team_id = lt
    and k.matchday not in (select matchday from closed_matchdays)
    and exists (select 1 from league_lineups x where x.league_team_id = lt and x.player_id = p_player
                and x.matchday = k.matchday and x.day = k.day);
  delete from league_lineups
  where league_team_id = lt and player_id = p_player
    and matchday not in (select matchday from closed_matchdays);
  delete from league_rosters where league_team_id = lt and player_id = p_player;
  update league_teams set cash = coalesce(c, 0) + coalesce(pr, 0) where id = lt;
  insert into league_moves(league_id, league_team_id, player_id, kind, amount)
  values (p_league, lt, p_player, 'venta', coalesce(pr, 0));
end $$;

-- 7) EQUIPOS POR DÍA ----------------------------------------------------------------------
-- p_slots: {"top": 12, "jng": 7, "mid": null, ...} (id de jugador o null por hueco). Guarda el equipo entero.
create or replace function save_lineup(p_league int, p_matchday int, p_day int, p_slots jsonb) returns void
language plpgsql security definer as $$
declare lt int; k text; v text; ids int[] := '{}'; imps int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select id into lt from league_teams where league_id = p_league and user_id = auth.uid() for update;
  if lt is null then raise exception 'No estás en esta liga'; end if;
  if p_matchday is distinct from current_matchday() then raise exception 'Jornada no válida'; end if;
  if p_day not between 1 and 3 then raise exception 'Día no válido'; end if;
  if day_started(p_matchday, p_day) then raise exception 'Ese día ya ha empezado: su equipo está cerrado'; end if;
  if exists (select 1 from league_lineup_locks where league_team_id = lt and matchday = p_matchday and day = p_day)
    then raise exception 'Ese equipo está fijado: desfíjalo para cambiarlo'; end if;

  for k, v in select key, value from jsonb_each_text(coalesce(p_slots, '{}'::jsonb)) loop
    if not (k = any(array['top','jng','mid','adc','sup'])) then raise exception 'Posición no válida'; end if;
    if v is not null then ids := ids || v::int; end if;
  end loop;
  if (select count(distinct x) from unnest(ids) x) <> coalesce(array_length(ids, 1), 0)
    then raise exception 'Un jugador no puede ocupar dos huecos'; end if;
  if exists (select 1 from unnest(ids) x
             where not exists (select 1 from league_rosters r where r.league_team_id = lt and r.player_id = x))
    then raise exception 'Hay jugadores que no están en tu plantilla'; end if;
  select count(*) into imps from players where id = any(ids) and is_import;
  if imps > 2 then raise exception 'Solo puedes alinear 2 imports'; end if;

  delete from league_lineups where league_team_id = lt and matchday = p_matchday and day = p_day;
  for k, v in select key, value from jsonb_each_text(coalesce(p_slots, '{}'::jsonb)) loop
    if v is not null then
      insert into league_lineups(league_id, league_team_id, matchday, day, slot, player_id)
      values (p_league, lt, p_matchday, p_day, k, v::int);
    end if;
  end loop;
end $$;

-- Fijar / desfijar el equipo de un día (para fijar hacen falta los 5 huecos).
create or replace function lock_lineup(p_league int, p_matchday int, p_day int, p_lock boolean) returns void
language plpgsql security definer as $$
declare lt int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select id into lt from league_teams where league_id = p_league and user_id = auth.uid() for update;
  if lt is null then raise exception 'No estás en esta liga'; end if;
  if p_matchday is distinct from current_matchday() then raise exception 'Jornada no válida'; end if;
  if p_day not between 1 and 3 then raise exception 'Día no válido'; end if;
  if day_started(p_matchday, p_day) then raise exception 'Ese día ya ha empezado: su equipo está cerrado'; end if;
  if p_lock then
    if (select count(*) from league_lineups where league_team_id = lt and matchday = p_matchday and day = p_day) < 5
      then raise exception 'Para fijar el equipo necesitas los 5 huecos completos'; end if;
    insert into league_lineup_locks(league_id, league_team_id, matchday, day)
    values (p_league, lt, p_matchday, p_day) on conflict do nothing;
  else
    delete from league_lineup_locks where league_team_id = lt and matchday = p_matchday and day = p_day;
  end if;
end $$;

-- Copia el equipo de un día a los otros días que no estén fijados ni hayan empezado.
create or replace function copy_lineup(p_league int, p_matchday int, p_day int) returns void
language plpgsql security definer as $$
declare lt int; d int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select id into lt from league_teams where league_id = p_league and user_id = auth.uid() for update;
  if lt is null then raise exception 'No estás en esta liga'; end if;
  if p_matchday is distinct from current_matchday() then raise exception 'Jornada no válida'; end if;
  if p_day not between 1 and 3 then raise exception 'Día no válido'; end if;
  if not exists (select 1 from league_lineups where league_team_id = lt and matchday = p_matchday and day = p_day)
    then raise exception 'Primero arma el equipo de este día'; end if;
  for d in 1..3 loop
    continue when d = p_day or day_started(p_matchday, d)
      or exists (select 1 from league_lineup_locks where league_team_id = lt and matchday = p_matchday and day = d);
    delete from league_lineups where league_team_id = lt and matchday = p_matchday and day = d;
    insert into league_lineups(league_id, league_team_id, matchday, day, slot, player_id)
    select p_league, lt, p_matchday, d, slot, player_id
    from league_lineups where league_team_id = lt and matchday = p_matchday and day = p_day;
  end loop;
end $$;

-- 8) CÁLCULO, PRECIOS Y CIERRE DE JORNADA (los lanzan los scripts de tools/) ------------------
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

-- Precio teórico = media de puntos por serie * settings.point_value. Tras cada jornada, SOLO los que han jugado
-- se mueven hacia él: como máximo ±15 % respecto a su precio anterior. Quien no juega mantiene su precio.
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

-- Cierra la jornada: cada equipo puntúa, día a día, con su equipo de ese día (los 5 alineados).
-- Fuera de su posición, el jugador suma la mitad. Un día sin equipo guardado no puntúa.
--   select close_matchday(<n>);   (lo lanza cerrar_jornada.py)
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
  select l.league_id, l.league_team_id, l.player_id, p_matchday, l.day,
         m.points * case when p.role = l.slot then 1 else 0.5 end
  from league_lineups l
  join players p on p.id = l.player_id
  join player_day_points m on m.player_id = l.player_id and m.matchday = p_matchday and m.day = l.day
  where l.matchday = p_matchday;

  perform update_prices(p_matchday);
  insert into closed_matchdays(matchday) values (p_matchday) on conflict do nothing;
end $$;

-- Solo tu clave service_role (scripts) o el SQL Editor pueden ejecutarlas.
revoke execute on function recompute_game(bigint), update_prices(int),
  calculate_pending_games(), close_matchday(int) from public, anon, authenticated;
