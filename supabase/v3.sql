-- v3: registro de movimientos (compras y ventas). Ejecutar DESPUÉS de leagues.sql y v2.sql.
-- Se puede volver a ejecutar sin perder datos.
-- (Si vuelves a ejecutar leagues.sql o v2.sql, ejecuta v3.sql otra vez después.)

create table if not exists league_moves(
  id serial primary key,
  league_id int not null references leagues(id) on delete cascade,
  league_team_id int not null references league_teams(id) on delete cascade,
  player_id int not null references players(id),
  kind text not null check (kind in ('compra','venta')),
  amount numeric not null,
  created_at timestamptz not null default now()
);
alter table league_moves enable row level security;
drop policy if exists "read league_moves" on league_moves;
create policy "read league_moves" on league_moves for select using (is_member(league_id));

-- Vender: igual que antes, pero deja constancia.
create or replace function sell_player(p_league int,p_slot text) returns void
language plpgsql security definer as $$
declare lg leagues; lt int; c numeric; pid int; pr numeric;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into lg from leagues where id = p_league;
  if lg.id is null or not lg.drawn then raise exception 'La liga aún no se ha sorteado'; end if;
  select id,cash into lt,c from league_teams where league_id = p_league and user_id = auth.uid() for update;
  if lt is null then raise exception 'No estás en esta liga'; end if;
  select player_id into pid from league_rosters where league_team_id = lt and slot = p_slot;
  if pid is null then raise exception 'Ese hueco está vacío'; end if;
  select price into pr from players where id = pid;
  delete from league_rosters where league_team_id = lt and slot = p_slot;
  update league_teams set cash = coalesce(c,0)+coalesce(pr,0) where id = lt;
  insert into league_moves(league_id, league_team_id, player_id, kind, amount)
  values (p_league, lt, pid, 'venta', coalesce(pr,0));
end $$;

-- Resolver pujas: igual que en v2, pero registra cada fichaje en league_moves.
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
    insert into league_moves(league_id, league_team_id, player_id, kind, amount)
    values (p_league, b.league_team_id, pl.id, 'compra', b.amount);
    n := n + 1;
  end loop;

  delete from league_bids where league_id = p_league;
  return n;
end $$;
