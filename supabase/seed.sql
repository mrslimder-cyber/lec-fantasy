-- LEC Fantasy: carga de equipos y jugadores.
-- Se puede pegar ENTERO en Supabase > SQL Editor tantas veces como quieras: no duplica nada.
-- Cada temporada: edita los nombres de abajo y vuelve a ejecutarlo.
--
-- Qué hace:
--  * Crea los equipos que falten y deja en 'inactivo' a todos los jugadores, para reactivar
--    solo a los que aparezcan en la lista (los que ya no estén quedan con active = false).
--  * Si un jugador ya existe, actualiza su equipo, rol y rookie. NO toca price ni prior_avg.
--  * Si te equivocas con el nombre de un equipo, da error y no carga nada.
--
-- Si cargaste jugadores con una versión anterior y salen duplicados (y todavía NO hay partidos):
--   delete from players; delete from teams;     -- ejecútalo una vez antes de este archivo

-- 0) Preparación (idempotente) --------------------------------------------------------
alter table players add column if not exists rookie boolean not null default false;
create unique index if not exists teams_name_key on teams(name);
create unique index if not exists players_name_key on players(name);

-- 1) Equipos (añade o cambia nombres aquí) ----------------------------------------------
insert into teams(name) values
  ('MKOI'), ('Team Heretics'), ('Fnatic'), ('G2'), ('GIANTX'),
  ('SK'), ('Team Vitality'), ('Karmine Corp'), ('Shifters'), ('NAVI')
on conflict (name) do nothing;

-- 2) Función auxiliar (se borra al final) -----------------------------------------------
create or replace function seed_player(p_name text, p_team text, p_role text, p_rookie boolean default false)
returns void language plpgsql as $$
declare tid int;
begin
  select id into tid from teams where name = p_team;
  if tid is null then raise exception 'El equipo "%" no existe (revisa el nombre en la lista de equipos)', p_team; end if;
  insert into players(name, team_id, role, rookie)
  values (p_name, tid, p_role, p_rookie)
  on conflict (name) do update
    set team_id = excluded.team_id, role = excluded.role, rookie = excluded.rookie, active = true;
end $$;

-- 3) Jugadores ------------------------------------------------------------------------
-- Formato:  select seed_player('Nombre', 'Equipo', 'rol', rookie);
-- Roles: top, jng, mid, adc, sup.   Rookie: true o false (si lo omites, es false).
-- Para añadir un jugador: quita los "--" de la línea de su hueco y escribe el nombre.
update players set active = false;

-- Movistar KOI
select seed_player('BrokenBlade', 'MKOI', 'top');
select seed_player('Elyoya',      'MKOI', 'jng');
select seed_player('Jojopyun',    'MKOI', 'mid');
select seed_player('Carzzy',      'MKOI', 'adc');
select seed_player('Alvaro',      'MKOI', 'sup');

-- Team Heretics
select seed_player('Tracyn',  'Team Heretics', 'top');
select seed_player('Razork',  'Team Heretics', 'jng');
select seed_player('Jackies', 'Team Heretics', 'mid');
select seed_player('Hype',    'Team Heretics', 'adc');
select seed_player('Jun',     'Team Heretics', 'sup');

-- Fnatic
-- select seed_player('NOMBRE', 'Fnatic', 'top');
select seed_player('Yike', 'Fnatic', 'jng');
select seed_player('Vladi',  'Fnatic', 'mid');
-- select seed_player('NOMBRE', 'Fnatic', 'adc');
select seed_player('Labrov', 'Fnatic', 'sup');

-- G2 Esports
-- select seed_player('NOMBRE', 'G2', 'top');
select seed_player('Lyncas', 'G2', 'jng');
select seed_player('Caps',   'G2', 'mid');
select seed_player('Hans Sama', 'G2', 'adc');
select seed_player('Mikyx',  'G2', 'sup');

-- GIANTX
select seed_player('Myrwn', 'GIANTX', 'top');
select seed_player('Thayger', 'GIANTX', 'jng', true);
select seed_player('Feisty',  'GIANTX', 'mid');
-- select seed_player('NOMBRE', 'GIANTX', 'adc');
select seed_player('Piero',   'GIANTX', 'sup', true);

-- SK Gaming
select seed_player('Kryze', 'SK', 'top', true);
select seed_player('Zicssi', 'SK', 'jng', true);
select seed_player('SlowQ',  'SK', 'mid');   -- verificar: solo lo vi en Rostermania
select seed_player('3XA',    'SK', 'adc', true);
select seed_player('Lospa',  'SK', 'sup');

-- Team Vitality
-- select seed_player('NOMBRE', 'Team Vitality', 'top');
-- select seed_player('NOMBRE', 'Team Vitality', 'jng');
-- select seed_player('NOMBRE', 'Team Vitality', 'mid');
-- select seed_player('NOMBRE', 'Team Vitality', 'adc');
-- select seed_player('NOMBRE', 'Team Vitality', 'sup');

-- Karmine Corp
select seed_player('Canna', 'Karmine Corp', 'top');
-- select seed_player('NOMBRE', 'Karmine Corp', 'jng');
select seed_player('Kyeahoo', 'Karmine Corp', 'mid');
select seed_player('Caliste', 'Karmine Corp', 'adc');
select seed_player('Busio', 'Karmine Corp', 'sup');

-- Shifters
-- select seed_player('NOMBRE', 'Shifters', 'top');
-- select seed_player('NOMBRE', 'Shifters', 'jng');
-- select seed_player('NOMBRE', 'Shifters', 'mid');
-- select seed_player('NOMBRE', 'Shifters', 'adc');
-- select seed_player('NOMBRE', 'Shifters', 'sup');

-- Natus Vincere
-- select seed_player('NOMBRE', 'NAVI', 'top');
select seed_player('Rilech', 'NAVI', 'jng');
-- select seed_player('NOMBRE', 'NAVI', 'mid');
select seed_player('Supa', 'NAVI', 'adc');
-- select seed_player('NOMBRE', 'NAVI', 'sup');


-- Actualización de precios de jugadores LEC 2027
-- Precio base de la tabla + 100.000

UPDATE players AS p
SET price = v.price
FROM (VALUES
    ('BrokenBlade', 625000),
    ('Elyoya',      745000),
    ('Jojopyun',    690000),
    ('Carzzy',      700000),
    ('Alvaro',      750000),

    ('Tracyn',      450000),
    ('Razork',      590000),
    ('Jackies',     640000),
    ('Hype',        790000),
    ('Jun',         720000),

    ('Yike',        715000),
    ('Vladi',       660000),
    ('Labrov',      775000),

    ('Lyncas',      650000),
    ('Caps',        820000),
    ('Hans Sama',   850000),
    ('Mikyx',       680000),

    ('Myrwn',       600000),
    ('Feisty',      450000),
    ('Thayger',     450000),
    ('Piero',       450000),

    ('Canna',       625000),
    ('Kyeahoo',     665000),
    ('Caliste',     820000),
    ('Busio',       800000),

    ('Kryze',       550000),
    ('Zicssi',      450000),
    ('SlowQ',       450000),
    ('3XA',         450000),
    ('Lospa',       685000),

    ('Rilech',      725000),
    ('Supa',        770000)
) AS v(name, price)
WHERE p.name = v.name;

-- 4) Limpieza ------------------------------------------------------------------------
drop function seed_player(text, text, text, boolean);
