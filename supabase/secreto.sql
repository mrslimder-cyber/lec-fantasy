-- secreto.sql: EQUIPOS SECRETOS. Ejecutar DESPUÉS de game.sql. Se puede repetir sin perder datos.
-- Si vuelves a ejecutar game.sql (recrea las políticas), ejecuta este archivo otra vez al final.
--
-- Qué cambia:
--  * Plantilla, alineaciones, fijados, movimientos y puntos por jugador: cada usuario SOLO ve los suyos.
--  * Dinero (cash): solo el tuyo, con my_cash(liga). El resto de columnas de league_teams siguen siendo visibles.
--  * De los demás equipos solo se conoce nombre, valor y puntos totales: función league_standings(liga).

drop policy if exists "read league_rosters" on league_rosters;
drop policy if exists "read league_lineups" on league_lineups;
drop policy if exists "read league_lineup_locks" on league_lineup_locks;
drop policy if exists "read league_moves" on league_moves;
drop policy if exists "read league_matchday_points" on league_matchday_points;
create policy "read league_rosters" on league_rosters for select using (owns_team(league_team_id));
create policy "read league_lineups" on league_lineups for select using (owns_team(league_team_id));
create policy "read league_lineup_locks" on league_lineup_locks for select using (owns_team(league_team_id));
create policy "read league_moves" on league_moves for select using (owns_team(league_team_id));
create policy "read league_matchday_points" on league_matchday_points for select using (owns_team(league_team_id));

-- El dinero de cada equipo también es secreto (permisos por columna).
revoke select on league_teams from anon, authenticated;
grant select (id, league_id, user_id, name) on league_teams to anon, authenticated;

create or replace function my_cash(p_league int) returns numeric
language sql stable security definer as $$
  select cash from league_teams where league_id = p_league and user_id = auth.uid()
$$;

-- Clasificación: valor de la plantilla y puntos de cada equipo, sin revelar jugadores. Solo para miembros de la liga.
create or replace function league_standings(p_league int)
returns table(league_team_id int, value numeric, points numeric)
language sql stable security definer as $$
  select t.id,
    coalesce((select sum(p.price) from league_rosters r join players p on p.id = r.player_id
              where r.league_team_id = t.id), 0),
    coalesce((select sum(m.points) from league_matchday_points m where m.league_team_id = t.id), 0)
  from league_teams t
  where t.league_id = p_league and is_member(p_league)
$$;

revoke execute on function my_cash(int), league_standings(int) from public, anon;
grant execute on function my_cash(int), league_standings(int) to authenticated;
