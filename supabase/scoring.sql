-- Puntuación v2 (la definitiva del juego). Se puede volver a ejecutar. Después ejecuta game.sql (trae la bonificación de serie).
-- Por game, sin redondeos (los redondeos de la hoja eran orientativos):
--   kill +1 · muerte -1 · asistencia +1 · CS/min x0,4 (ADC x0,3) · DPM x0,003 · VSPM x1 (SUP x0,7)
--   CSD@15 x0,05 (negativo resta) · KP (0-100) x0,02 · multikills 1/2/3/5 (solo el máximo de cada secuencia)
--   robo de dragón +2, de barón/anciano +4 (solo si están identificados: dragons_stolen / barons_stolen)
--   SUP: (curas+escudos)/min x0,01 y tiempo de CC/min x0,25
-- Serie (BO3/BO5): media de los mapas, y al ganador +10 % de esa media (está en game.sql, vista player_series_points).

alter table player_game_stats add column if not exists cc_pm numeric;                      -- segundos de CC a rivales por minuto
alter table player_game_stats add column if not exists dragons_stolen int not null default 0;
alter table player_game_stats add column if not exists barons_stolen int not null default 0; -- barón o anciano

create or replace function game_points(s player_game_stats, r text, t team_game_stats)
returns jsonb language plpgsql immutable as $$
declare b jsonb; d int; tr int; q int; p int; mk int;
begin
  d := coalesce(s.doubles, 0); tr := coalesce(s.triples, 0); q := coalesce(s.quadras, 0); p := coalesce(s.pentas, 0);
  -- Si el contador de gol.gg es acumulativo (una penta cuenta también como doble, triple y quadra), solo vale el máximo.
  mk := greatest(d - tr, 0) + 2 * greatest(tr - q, 0) + 3 * greatest(q - p, 0) + 5 * p;
  b := jsonb_build_object(
    'kills', coalesce(s.kills, 0), 'deaths', -1 * coalesce(s.deaths, 0), 'assists', coalesce(s.assists, 0),
    'csm', coalesce(s.csm, 0) * case when r = 'adc' then 0.3 else 0.4 end,
    'dpm', 0.003 * coalesce(s.dpm, 0),
    'vspm', coalesce(s.vspm, 0) * case when r = 'sup' then 0.7 else 1.0 end,
    'csd15', 0.05 * coalesce(s.csd15, 0),
    'kp', 0.02 * coalesce(s.kp, 0),
    'multikills', mk,
    'obj_stolen', 2 * coalesce(s.dragons_stolen, 0) + 4 * coalesce(s.barons_stolen, 0));
  if r = 'sup' then
    b := b || jsonb_build_object(
      'heal_shield', 0.01 * (coalesce(s.heal_pm, 0) + coalesce(s.shield_pm, 0)),
      'Control (CC)', 0.25 * coalesce(s.cc_pm, 0));
  end if;
  return jsonb_build_object('total', (select sum(value::numeric) from jsonb_each_text(b)), 'breakdown', b);
end $$;

create or replace function recompute_game(p_game bigint) returns void
language sql security definer as $$
  insert into player_game_points(game_id, player_id, points, breakdown)
  select s.game_id, s.player_id, (g->>'total')::numeric, g->'breakdown'
  from player_game_stats s
  join players p on p.id = s.player_id
  left join team_game_stats t on t.game_id = s.game_id and t.team_id = s.team_id
  cross join lateral (select game_points(s, p.role, t) as g) x
  where s.game_id = p_game
  on conflict (game_id, player_id) do update set points = excluded.points, breakdown = excluded.breakdown;
$$;

-- Identificar un robo de objetivo (el scraper avisa de los robos, pero gol.gg no dice cuál fue):
--   select set_steals(<id del game>, 'Knight', <dragones robados>, <barones/ancianos robados>);
create or replace function set_steals(p_game bigint, p_player text, p_dragons int, p_barons int) returns void
language plpgsql security definer as $$
declare pid int := (select id from players where name = p_player);
begin
  if pid is null then raise exception 'No existe el jugador %', p_player; end if;
  update player_game_stats set dragons_stolen = p_dragons, barons_stolen = p_barons
  where game_id = p_game and player_id = pid;
  if not found then raise exception 'Ese jugador no tiene stats en el game %', p_game; end if;
  perform recompute_game(p_game);
end $$;
revoke execute on function set_steals(bigint, text, int, int) from public, anon, authenticated;

-- (update_prices vive en game.sql.)
