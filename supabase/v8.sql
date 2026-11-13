-- v8: en pretemporada (sin calendario) los titulares se cambian moviendo huecos de la plantilla.
-- Con calendario cargado, move_player se bloquea: los equipos se crean el sábado (set_starter).
-- (Si vuelves a ejecutar leagues.sql, ejecuta v8.sql otra vez después.)
create or replace function move_player(p_league int,p_from text,p_to text) returns void
language plpgsql security definer as $$
declare
  lg leagues; lt int; pa int; da numeric; pb int; db numeric; ra text; rb text;
  starters text[] := array['top','jng','mid','adc','sup'];
  allslots text[] := array['top','jng','mid','adc','sup','res1','res2'];
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if exists (select 1 from fixtures) then
    raise exception 'Los equipos se crean el sábado, antes del primer partido de la jornada';
  end if;
  if not (p_from = any(allslots)) or not (p_to = any(allslots)) then raise exception 'Hueco no válido'; end if;
  if p_from = p_to then return; end if;
  select * into lg from leagues where id = p_league;
  if lg.id is null or not lg.drawn then raise exception 'La liga aún no se ha sorteado'; end if;
  select id into lt from league_teams where league_id = p_league and user_id = auth.uid() for update;
  if lt is null then raise exception 'No estás en esta liga'; end if;

  select player_id,draft_price into pa,da from league_rosters where league_team_id = lt and slot = p_from;
  select player_id,draft_price into pb,db from league_rosters where league_team_id = lt and slot = p_to;
  if pa is null then raise exception 'El hueco de origen está vacío'; end if;
  select role into ra from players where id = pa;

  if p_to = any(starters) and ra <> p_to then
    raise exception 'Ese hueco es para un jugador de %',upper(p_to);
  end if;

  if pb is not null then
    select role into rb from players where id = pb;
    if p_from = any(starters) and rb <> p_from then
      raise exception 'Ese cambio dejaría a un jugador fuera de su rol';
    end if;
  end if;

  delete from league_rosters where league_team_id = lt and slot in (p_from,p_to);
  insert into league_rosters(league_id,league_team_id,slot,player_id,draft_price)
  values (p_league,lt,p_to,pa,da);
  if pb is not null then
    insert into league_rosters(league_id,league_team_id,slot,player_id,draft_price)
    values (p_league,lt,p_from,pb,db);
  end if;
end $$;