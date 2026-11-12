-- Ligas, equipos de liga, plantillas, sorteo y mercado. Ejecutar DESPUÉS de schema.sql, scoring.sql y seed.sql.
-- Se puede volver a ejecutar entero sin perder datos.
insert into settings values ('budget',800000) on conflict (key) do update set value = excluded.value;

-- Precios provisionales: 100.000 ±15% (solo a los que aún están a 0; se puede re-ejecutar)
update players set price = round(100000 * (0.85 + random()*0.3), -2) where price = 0;

create table if not exists leagues(
  id serial primary key, name text not null,
  code text unique not null default upper(substr(md5(random()::text),1,6)),
  owner uuid not null references auth.users(id),
  drawn boolean not null default false, created_at timestamptz default now());
create table if not exists league_teams(
  id serial primary key, league_id int not null references leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id), name text not null,
  unique(league_id, user_id), unique(league_id, name));
-- Dinero disponible de cada equipo (null hasta que se hace el sorteo)
alter table league_teams add column if not exists cash numeric;
create table if not exists league_rosters(
  league_id int not null references leagues(id) on delete cascade,
  league_team_id int not null references league_teams(id) on delete cascade,
  slot text not null check (slot in ('top','jng','mid','adc','sup','res1','res2')),
  player_id int not null references players(id), draft_price numeric not null,
  primary key (league_team_id, slot), unique (league_id, player_id));

-- Ligas ya sorteadas antes de existir el mercado: dinero = presupuesto - lo gastado
update league_teams x
set cash = (select value from settings where key = 'budget')
           - coalesce((select sum(draft_price) from league_rosters r where r.league_team_id = x.id), 0)
where x.cash is null and exists (select 1 from leagues l where l.id = x.league_id and l.drawn);

create or replace function is_member(l int) returns boolean
language sql security definer stable as $$
  select exists(select 1 from league_teams where league_id = l and user_id = auth.uid()) $$;

alter table leagues enable row level security;
alter table league_teams enable row level security;
alter table league_rosters enable row level security;
drop policy if exists "read leagues" on leagues;
drop policy if exists "read league_teams" on league_teams;
drop policy if exists "read league_rosters" on league_rosters;
create policy "read leagues" on leagues for select using (owner = auth.uid() or is_member(id));
create policy "read league_teams" on league_teams for select using (is_member(league_id));
create policy "read league_rosters" on league_rosters for select using (is_member(league_id));

create or replace function create_league(p_name text, p_team text) returns int
language plpgsql security definer as $$
declare lid int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  insert into leagues(name, owner) values (trim(p_name), auth.uid()) returning id into lid;
  insert into league_teams(league_id, user_id, name) values (lid, auth.uid(), trim(p_team));
  return lid;
end $$;

create or replace function join_league(p_code text, p_team text) returns int
language plpgsql security definer as $$
declare lg leagues;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into lg from leagues where code = upper(trim(p_code));
  if lg.id is null then raise exception 'Código de liga no válido'; end if;
  if lg.drawn then raise exception 'Esa liga ya hizo el sorteo'; end if;
  if exists(select 1 from league_teams where league_id = lg.id and user_id = auth.uid())
    then raise exception 'Ya estás en esa liga'; end if;
  insert into league_teams(league_id, user_id, name) values (lg.id, auth.uid(), trim(p_team));
  return lg.id;
end $$;

-- Sorteo: solo el creador. Rondas: top, jng, mid, adc, sup, reserva 1, reserva 2.
create or replace function draw_league(p_league int) returns void
language plpgsql security definer as $$
declare
  budget numeric := (select value from settings where key = 'budget');
  slots text[] := array['top','jng','mid','adc','sup','res1','res2'];
  lg leagues; n int; attempt int := 0; ok boolean; k int; lt int;
  spent numeric; minp numeric; pid int; pprice numeric; r text;
begin
  select * into lg from leagues where id = p_league;
  if lg.id is null or lg.owner <> auth.uid() then raise exception 'Solo el creador puede sortear'; end if;
  if lg.drawn then raise exception 'La liga ya está sorteada'; end if;
  select count(*) into n from league_teams where league_id = p_league;
  if n < 1 then raise exception 'No hay equipos en la liga'; end if;
  foreach r in array slots[1:5] loop
    if (select count(*) from players where active and role = r) < n then
      raise exception 'No hay suficientes jugadores de % para % equipos', r, n; end if;
  end loop;
  if (select count(*) from players where active) < 7*n then
    raise exception 'La pool tiene menos de % jugadores', 7*n; end if;

  loop
    attempt := attempt + 1;
    if attempt > 300 then
      raise exception 'No se encontró un reparto dentro del presupuesto (prueba de nuevo o amplía la pool)'; end if;
    delete from league_rosters where league_id = p_league;
    ok := true;
    for k in 1..7 loop
      exit when not ok;
      for lt in select id from league_teams where league_id = p_league order by random() loop
        select coalesce(sum(draft_price),0) into spent from league_rosters where league_team_id = lt;
        select min(p.price) into minp from players p where p.active
          and not exists (select 1 from league_rosters x where x.league_id = p_league and x.player_id = p.id);
        select p.id, p.price into pid, pprice from players p
        where p.active and (k > 5 or p.role = slots[k])
          and not exists (select 1 from league_rosters x where x.league_id = p_league and x.player_id = p.id)
          and spent + p.price + (7-k) * minp <= budget
        order by random() limit 1;
        if pid is null then ok := false; exit; end if;
        insert into league_rosters(league_id, league_team_id, slot, player_id, draft_price)
        values (p_league, lt, slots[k], pid, pprice);
      end loop;
    end loop;
    exit when ok;
  end loop;
  update league_teams set cash = budget - coalesce((select sum(draft_price) from league_rosters r2
                                                    where r2.league_team_id = league_teams.id), 0)
  where league_id = p_league;
  update leagues set drawn = true where id = p_league;
end $$;

-- Mercado ------------------------------------------------------------------------------
-- Fichar: el jugador va a su hueco de titular si está libre; si no, a una reserva libre.
create or replace function buy_player(p_league int, p_player int) returns void
language plpgsql security definer as $$
declare lg leagues; lt int; c numeric; pl players; s text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into lg from leagues where id = p_league;
  if lg.id is null or not lg.drawn then raise exception 'La liga aún no se ha sorteado'; end if;
  select id, cash into lt, c from league_teams where league_id = p_league and user_id = auth.uid() for update;
  if lt is null then raise exception 'No estás en esta liga'; end if;
  select * into pl from players where id = p_player and active;
  if pl.id is null then raise exception 'Jugador no disponible'; end if;
  if exists(select 1 from league_rosters where league_id = p_league and player_id = p_player)
    then raise exception 'Ese jugador ya tiene dueño en esta liga'; end if;
  if coalesce(c,0) < pl.price then raise exception 'No tienes dinero suficiente'; end if;
  if not exists(select 1 from league_rosters where league_team_id = lt and slot = pl.role) then s := pl.role;
  elsif not exists(select 1 from league_rosters where league_team_id = lt and slot = 'res1') then s := 'res1';
  elsif not exists(select 1 from league_rosters where league_team_id = lt and slot = 'res2') then s := 'res2';
  else raise exception 'Plantilla completa: vende a un jugador antes de fichar'; end if;
  insert into league_rosters(league_id, league_team_id, slot, player_id, draft_price)
  values (p_league, lt, s, pl.id, pl.price);
  update league_teams set cash = coalesce(c,0) - pl.price where id = lt;
end $$;

-- Vender: se cobra el precio actual del jugador.
create or replace function sell_player(p_league int, p_slot text) returns void
language plpgsql security definer as $$
declare lg leagues; lt int; c numeric; pid int; pr numeric;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into lg from leagues where id = p_league;
  if lg.id is null or not lg.drawn then raise exception 'La liga aún no se ha sorteado'; end if;
  select id, cash into lt, c from league_teams where league_id = p_league and user_id = auth.uid() for update;
  if lt is null then raise exception 'No estás en esta liga'; end if;
  select player_id into pid from league_rosters where league_team_id = lt and slot = p_slot;
  if pid is null then raise exception 'Ese hueco está vacío'; end if;
  select price into pr from players where id = pid;
  delete from league_rosters where league_team_id = lt and slot = p_slot;
  update league_teams set cash = coalesce(c,0) + coalesce(pr,0) where id = lt;
end $$;

-- Mover / intercambiar dos huecos de tu plantilla (un titular solo puede ocupar su rol).
create or replace function move_player(p_league int, p_from text, p_to text) returns void
language plpgsql security definer as $$
declare lg leagues; lt int; pa int; da numeric; pb int; db numeric; ra text; rb text;
        starters text[] := array['top','jng','mid','adc','sup'];
        allslots text[] := array['top','jng','mid','adc','sup','res1','res2'];
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if not (p_from = any(allslots)) or not (p_to = any(allslots)) then raise exception 'Hueco no válido'; end if;
  if p_from = p_to then return; end if;
  select * into lg from leagues where id = p_league;
  if lg.id is null or not lg.drawn then raise exception 'La liga aún no se ha sorteado'; end if;
  select id into lt from league_teams where league_id = p_league and user_id = auth.uid() for update;
  if lt is null then raise exception 'No estás en esta liga'; end if;
  select player_id, draft_price into pa, da from league_rosters where league_team_id = lt and slot = p_from;
  select player_id, draft_price into pb, db from league_rosters where league_team_id = lt and slot = p_to;
  if pa is null then raise exception 'El hueco de origen está vacío'; end if;
  select role into ra from players where id = pa;
  if p_to = any(starters) and ra <> p_to then
    raise exception 'Ese hueco es para un jugador de %', upper(p_to); end if;
  if pb is not null then
    select role into rb from players where id = pb;
    if p_from = any(starters) and rb <> p_from then
      raise exception 'Ese cambio dejaría a un jugador fuera de su rol'; end if;
  end if;
  delete from league_rosters where league_team_id = lt and slot in (p_from, p_to);
  insert into league_rosters(league_id, league_team_id, slot, player_id, draft_price)
  values (p_league, lt, p_to, pa, da);
  if pb is not null then
    insert into league_rosters(league_id, league_team_id, slot, player_id, draft_price)
    values (p_league, lt, p_from, pb, db);
  end if;
end $$;
