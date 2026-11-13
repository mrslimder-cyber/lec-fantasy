-- v7: las pujas reservan dinero. Se puede volver a ejecutar sin perder datos.
-- (Si vuelves a ejecutar v2.sql o v4.sql, ejecuta v7.sql otra vez después.)

create or replace function place_bid(p_league int, p_player int, p_amount numeric) returns void
language plpgsql security definer as $$
declare lg leagues; lt int; c numeric; pl players; committed numeric;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  perform assert_market_open();
  select * into lg from leagues where id = p_league;
  if lg.id is null or not lg.drawn then raise exception 'La liga aún no se ha sorteado'; end if;
  select id, cash into lt, c from league_teams where league_id = p_league and user_id = auth.uid() for update;
  if lt is null then raise exception 'No estás en esta liga'; end if;
  select * into pl from players where id = p_player and active;
  if pl.id is null then raise exception 'Jugador no disponible'; end if;
  if not exists (select 1 from league_market where league_id = p_league and player_id = p_player)
    then raise exception 'Ese jugador no está en el mercado'; end if;
  if exists (select 1 from league_rosters where league_id = p_league and player_id = p_player)
    then raise exception 'Ese jugador ya tiene dueño en esta liga'; end if;
  if p_amount < pl.price then raise exception 'La puja mínima es %', ceil(pl.price); end if;

  -- Dinero ya comprometido en tus OTRAS pujas (la de este jugador se sustituye).
  select coalesce(sum(amount), 0) into committed
    from league_bids where league_team_id = lt and player_id <> p_player;
  if p_amount > coalesce(c, 0) - committed then
    raise exception 'No tienes dinero libre suficiente: te quedan % € tras tus otras pujas', floor(greatest(coalesce(c, 0) - committed, 0));
  end if;

  insert into league_bids(league_id, league_team_id, player_id, amount)
  values (p_league, lt, p_player, p_amount)
  on conflict (league_team_id, player_id) do update set amount = excluded.amount, created_at = now();
end $$;

-- Clausulazo: solo con dinero libre (lo reservado en pujas no cuenta).
create or replace function clause_player(p_league int, p_player int) returns void
language plpgsql security definer as $$
declare lg leagues; lt int; ot int; c numeric; pl players; amt numeric; s text; committed numeric;
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

  select coalesce(sum(amount), 0) into committed from league_bids where league_team_id = lt;
  if coalesce(c,0) - committed < amt then
    raise exception 'No tienes dinero libre suficiente: la cláusula es de % € y tienes % € libres (el resto está en pujas)',
      amt, floor(greatest(coalesce(c,0) - committed, 0));
  end if;

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