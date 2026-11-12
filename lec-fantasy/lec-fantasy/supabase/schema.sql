-- LEC Fantasy: esquema núcleo. Pegar en Supabase > SQL Editor, luego scoring.sql
create table settings(key text primary key, value numeric not null);
insert into settings values ('point_value',0),('prior_weight',3); -- point_value: fijarlo tras calibrar

create table teams(id serial primary key, name text not null, logo_path text);
create table players(
  id serial primary key, name text not null, team_id int references teams(id),
  role text not null check (role in ('top','jng','mid','adc','sup')),
  photo_path text, active boolean default true,
  prior_avg numeric default 0,      -- media de puntos del año/split pasado
  price numeric not null default 0);
create table games(
  id bigint primary key,            -- id de partida en gol.gg
  matchday int not null, played_at timestamptz not null,
  winner_team_id int references teams(id));
create table team_game_stats(
  game_id bigint references games(id) on delete cascade, team_id int references teams(id),
  first_tower boolean default false, dragons int default 0, grubs int default 0,
  heralds int default 0, barons int default 0, elders int default 0,
  primary key (game_id, team_id));
create table player_game_stats(
  game_id bigint references games(id) on delete cascade, player_id int references players(id),
  team_id int references teams(id),
  kills int default 0, deaths int default 0, assists int default 0,
  csm numeric, cs_diff int, csd15 int, dpm numeric, kp numeric,   -- kp en 0-100
  doubles int default 0, triples int default 0, quadras int default 0, pentas int default 0,
  obj_stolen int default 0, shutdown_lost int default 0,
  vspm numeric, heal_pm numeric, shield_pm numeric,               -- por definir
  primary key (game_id, player_id));
create table player_game_points(
  game_id bigint, player_id int, points numeric not null, breakdown jsonb,
  primary key (game_id, player_id));
create table player_prices(
  player_id int references players(id), matchday int, price numeric not null,
  primary key (player_id, matchday));

-- Lectura pública; sin escritura directa desde la web (solo funciones SECURITY DEFINER)
do $$ declare t text; begin
  foreach t in array array['settings','teams','players','games','team_game_stats',
    'player_game_stats','player_game_points','player_prices'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "read %1$s" on %1$I for select using (true)', t);
  end loop; end $$;
