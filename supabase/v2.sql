-- v2: puntos por jornada (solo mientras está en plantilla), pujas de mercado y sorteo aleatorio.
-- Ejecutar DESPUÉS de leagues.sql. Se puede volver a ejecutar sin perder datos.
-- IMPORTANTE: si vuelves a ejecutar leagues.sql, ejecuta v2.sql otra vez después
-- (leagues.sql restauraría el sorteo por posiciones y buy_player).

-- 1) SERIES Y PUNTOS POR JORNADA ------------------------------------------------------
-- games.series_id: pon el mismo valor en todos los games de un mismo BO3. Si lo dejas vacío,
-- el game cuenta como una serie propia (BO1).
alter table games add column if not exists series_id bigint;

-- Puntos de un jugador en una serie = suma de sus games / mapas jugados de la serie.
create or replace view player_series_points as
with s as (
  select matchday, coalesce(series_id, id) as sid, count(*) as maps
  from games group by 1, 2)
select pgp.player_id, g.matchday, s.sid as series_id, max(s.maps)::int as maps,
       sum(pgp.points) / max(s.maps) as points
from player_game_points pgp
join games g on g.id = pgp.game_id
join s on s.matchday = g.matchday and s.sid = coalesce(g.series_id, g.id)
group by pgp.player_id, g.matchday, s.sid;

-- Puntos de un jugador en una jornada = suma de sus series.
create or replace view player_matchday_points as
select player_id, matchday, sum(points) as points
from player_series_points group by player_id, matchday;

grant select on player_series_points, player_matchday_points to anon, authenticated;

-- Puntos que se quedan fijados para cada equipo de liga (solo titulares en el momento del cierre).
create table if not exists league_matchday_points(
  league_id int not null references leagues(id) on delete cascade,
  league_team_id int not null references league_teams(id) on delete cascade,
  player_id int not null references players(id),
  matchday int not null,
  points numeric not null,
  primary key (league_team_id, player_id, matchday)
);
alter table league_matchday_points enable row level security;
drop policy if exists "read league_matchday_points" on league_matchday_points;
create policy "read league_matchday_points" on league_matchday_points
  for select using (is_member(league_id));

-- Cerrar jornada: ejecutar UNA vez cuando acabe la jornada y ANTES de que nadie mueva la plantilla.
--   select close_matchday(<n>);
-- Reparte los puntos de la jornada a los equipos que tenían a ese jugador de titular en ese momento.
create or replace function close_matchday(p_matchday int) returns void
language plpgsql security definer as $$
begin
  delete from league_matchday_points where matchday = p_matchday;
  insert into league_matchday_points(league_id, league_team_id, player_id, matchday, points)
  select r.league_id, r.league_team_id, r.player_id, p_matchday, m.points
  from league_rosters r
  join player_matchday_points m on m.player_id = r.player_id and m.matchday = p_matchday
  where r.slot in ('top','jng','mid','adc','sup');
end $$;
revoke execute on function close_matchday(int) from public, anon, authenticated;

-- 2) MERCADO CON PUJAS ----------------------------------------------------------------
drop function if exists buy_player(int, int);

create table if not exists league_bids(
  id serial primary key,
  league_id int not null references leagues(id) on delete cascade,
  league_team_id int not null references league_teams(id) on delete cascade,
  player_id int not null references players(id),
  amount numeric not null,
  created_at timestamptz default now(),
  unique (league_team_id, player_id)
);
create table if not exists league_bid_results(
  id serial primary key,
  league_id int not null references leagues(id) on delete cascade,
  player_id int not null references players(id),
  league_team_id int not null references league_teams(id) on delete cascade,
  amount numeric not null,
  created_at timestamptz default now()
);
alter table league_bids enable row level security;
alter table league_bid_results enable row level security;
drop policy if exists "read league_bids" on league_bids;
drop policy if exists "read league_bid_results" on league_bid_results;
-- Las pujas son secretas: cada uno solo ve las suyas.
create policy "read league_bids" on league_bids for select using (
  exists (select 1 from league_teams t where t.id = league_team_id and t.user_id = auth.uid()));
create policy "read league_bid_results" on league_bid_results for select using (is_member(league_id));

create or replace function place_bid(p_league int, p_player int, p_amount numeric) returns void
language plpgsql security definer as $$
declare lg leagues; lt int; c numeric; pl players;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into lg from leagues where id = p_league;
  if lg.id is null or not lg.drawn then raise exception 'La liga aún no se ha sorteado'; end if;
  select id, cash into lt, c from league_teams where league_id = p_league and user_id = auth.uid();
  if lt is null then raise exception 'No estás en esta liga'; end if;
  select * into pl from players where id = p_player and active;
  if pl.id is null then raise exception 'Jugador no disponible'; end if;
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
  delete from league_bids b using league_teams t
  where b.league_team_id = t.id and t.user_id = auth.uid()
    and b.league_id = p_league and b.player_id = p_player;
end $$;

-- Resolver pujas (botón del creador): por cada jugador gana la puja más alta (empate: la más antigua).
-- El ganador paga lo que pujó y el jugador va a su hueco de titular si está libre, o a una reserva.
-- Se salta la puja si ya no tiene dinero o no tiene hueco. Al terminar se borran todas las pujas.
create or replace function resolve_bids(p_league int) returns int
language plpgsql security definer as $$
declare lg leagues; b record; c numeric; s text; n int := 0; pl players;
begin
  select * into lg from leagues where id = p_league;
  if lg.id is null or lg.owner <> auth.uid() then raise exception 'Solo el creador puede resolver las pujas'; end if;
  if not lg.drawn then raise exception 'La liga aún no se ha sorteado'; end if;

  for b in select * from league_bids where league_id = p_league order by amount desc, created_at, id loop
    continue when exists (select 1 from league_rosters where league_id = p_league and player_id = b.player_id);
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
    insert into league_bid_results(league_id, player_id, league_team_id, amount)
    values (p_league, pl.id, b.league_team_id, b.amount);
    n := n + 1;
  end loop;

  delete from league_bids where league_id = p_league;
  return n;
end $$;

-- 3) SORTEO ALEATORIO -----------------------------------------------------------------
-- Rondas aleatorias: cada equipo recibe jugadores al azar de cualquier rol, pero entre sus 5 primeros
-- no puede repetir rol (si le sale un medio, no le sale otro). El sexto (reserva) es de cualquier rol.
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
end $$;
