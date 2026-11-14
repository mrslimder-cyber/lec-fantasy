-- flash.sql: LIGA FLASH (reto global de un solo día). Ejecutar DESPUÉS de game.sql. Se puede repetir sin perder datos.
-- Hoy: final de Worlds 2026, Gen.G vs BLG. Todos los usuarios compiten en la misma liga: eligen 5 jugadores (uno por posición),
-- sin precio, sin presupuesto, sin suplentes, sin límite de imports/rookies.
-- Los jugadores flash se guardan en `players` con active = false, así que NO aparecen en el juego principal.
-- Los games de la final se guardan con matchday = flash_config.matchday (900), fuera del calendario normal.

alter table players add column if not exists flash boolean not null default false;

insert into teams(name) values ('Gen.G'), ('BLG') on conflict (name) do nothing;

insert into players(name, team_id, role, active, flash)
select v.n, t.id, v.r, false, true
from (values
  ('Kiin',   'Gen.G', 'top'), ('Canyon', 'Gen.G', 'jng'), ('Chovy', 'Gen.G', 'mid'), ('Ruler',  'Gen.G', 'adc'), ('Duro', 'Gen.G', 'sup'),
  ('Bin',    'BLG',   'top'), ('Xun',    'BLG',   'jng'), ('Knight','BLG',   'mid'), ('Viper',  'BLG',   'adc'), ('ON',   'BLG',   'sup')
) as v(n, tm, r)
join teams t on t.name = v.tm
on conflict (name) do update set team_id = excluded.team_id, role = excluded.role, flash = true, active = false;

-- Configuración: cierre de equipos 20:00 hora de Madrid (CET) del 14-nov-2026.
create table if not exists flash_config(
  id int primary key default 1 check (id = 1),
  name text not null,
  closes_at timestamptz not null,
  matchday int not null default 900
);
insert into flash_config(id, name, closes_at, matchday)
values (1, 'Final de Worlds 2026 · Gen.G vs BLG', '2026-11-14 20:00:00+01', 900)
on conflict (id) do update set name = excluded.name, closes_at = excluded.closes_at, matchday = excluded.matchday;

create table if not exists flash_entries(
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create table if not exists flash_picks(
  user_id uuid not null references flash_entries(user_id) on delete cascade,
  player_id int not null references players(id),
  primary key (user_id, player_id)
);

alter table flash_config enable row level security;
alter table flash_entries enable row level security;
alter table flash_picks enable row level security;
drop policy if exists "read flash_config" on flash_config;
drop policy if exists "read flash_entries" on flash_entries;
drop policy if exists "read flash_picks" on flash_picks;
create policy "read flash_config" on flash_config for select using (true);
create policy "read flash_entries" on flash_entries for select using (true);
-- El equipo de los demás no se ve hasta que se cierran los equipos.
create policy "read flash_picks" on flash_picks for select
  using (user_id = auth.uid() or now() >= (select closes_at from flash_config where id = 1));

-- Puntos de cada jugador en la final: TOTAL de la suma de sus mapas (no la media). Solo liga flash.
-- Si la serie tiene más de 1 mapa y su equipo la gana, se añade además el 10 % de su media por mapa (regla de la puntuación v2).
create or replace view flash_player_points as
with g as (
  select pgp.player_id, pgp.points, gm.winner_team_id, pgs.team_id
  from player_game_points pgp
  join games gm on gm.id = pgp.game_id
  join player_game_stats pgs on pgs.game_id = pgp.game_id and pgs.player_id = pgp.player_id
  where gm.matchday = (select matchday from flash_config where id = 1))
select player_id,
       sum(points) + case when count(*) > 1 and 2 * count(*) filter (where winner_team_id = team_id) > count(*)
                          then 0.1 * avg(points) else 0 end as points,
       count(*)::int as maps
from g group by player_id;
grant select on flash_player_points to anon, authenticated;

-- Guardar / cambiar tu equipo (solo hasta el cierre). Exactamente 5 jugadores de la lista flash, uno por posición.
create or replace function flash_save(p_name text, p_ids int[]) returns void
language plpgsql security definer as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if now() >= (select closes_at from flash_config where id = 1) then raise exception 'Los equipos ya están cerrados'; end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 30 then raise exception 'Pon un nombre de equipo (máx. 30 caracteres)'; end if;
  if coalesce(array_length(p_ids, 1), 0) <> 5 or (select count(distinct x) from unnest(p_ids) x) <> 5
    then raise exception 'Elige exactamente 5 jugadores distintos'; end if;
  if (select count(*) from players where id = any(p_ids) and flash) <> 5 then raise exception 'Hay jugadores no válidos'; end if;
  if (select count(distinct role) from players where id = any(p_ids)) <> 5
    then raise exception 'Elige un jugador en cada posición (top, jungla, medio, adc y support)'; end if;
  insert into flash_entries(user_id, name) values (auth.uid(), trim(p_name))
  on conflict (user_id) do update set name = excluded.name;
  delete from flash_picks where user_id = auth.uid();
  insert into flash_picks(user_id, player_id) select auth.uid(), unnest(p_ids);
end $$;

-- Clasificación: antes del cierre solo devuelve TU fila; después, todos (top 500).
create or replace function flash_standings() returns table(user_id uuid, name text, points numeric, picks int[])
language sql stable security definer as $$
  select e.user_id, e.name, coalesce(sum(fp.points), 0)::numeric, array_agg(k.player_id order by k.player_id)
  from flash_entries e
  join flash_picks k on k.user_id = e.user_id
  left join flash_player_points fp on fp.player_id = k.player_id
  where now() >= (select closes_at from flash_config where id = 1) or e.user_id = auth.uid()
  group by e.user_id, e.name
  order by 3 desc, e.name
  limit 500
$$;
