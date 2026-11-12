-- Puntuación v1 (pesos iguales para todos los roles; solo los umbrales de CSM dependen del rol).
-- Visión: round(vspm). Curas+escudos: round((heal_pm + shield_pm)/30). Supuestos de redondeo en README.
create or replace function game_points(s player_game_stats, r text, t team_game_stats)
returns jsonb language plpgsql immutable as $$
declare b jsonb; th numeric[]; n int; gr int;
begin
  th := (case r when 'top' then '{8,9,10,11}' when 'jng' then '{8,9,10,11}'
                when 'mid' then '{9,10,11,12}' when 'adc' then '{10,11,12,13}'
                else '{}' end)::numeric[];
  select count(*) into n from unnest(th) u where coalesce(s.csm,0) > u;
  b := jsonb_build_object(
    'kills', s.kills, 'deaths', -1*s.deaths, 'assists', s.assists, 'csm', n,
    'cs_diff', case when coalesce(s.cs_diff,0) < 0 then -floor(-s.cs_diff/15.0) else 0 end,
    'csd15', coalesce(s.csd15,0)/10,                       -- división entera (trunca a 0)
    'dpm', ceil(floor(coalesce(s.dpm,0)/100)/2.0),
    'kp', case when s.kp >= 100 then 4 when s.kp > 85 then 2 when s.kp > 75 then 1 else 0 end,
    'multikills', s.doubles + 2*s.triples + 3*s.quadras + 5*s.pentas,
    'obj_stolen', 2*s.obj_stolen,
    'shutdown', -ceil(floor(coalesce(s.shutdown_lost,0)/100)/2.0),
    'vspm', round(coalesce(s.vspm,0)),
    'heal_shield', round((coalesce(s.heal_pm,0) + coalesce(s.shield_pm,0)) / 30.0),
    'first_tower', case when coalesce(t.first_tower,false) then 1 else 0 end);
  if r = 'jng' then
    gr := case when coalesce(t.grubs,0) >= 3 then 2 when t.grubs = 2 then 1 else 0 end;
    b := b || jsonb_build_object('objectives',
      coalesce(t.dragons,0) + gr + coalesce(t.heralds,0) + 2*coalesce(t.barons,0) + 3*coalesce(t.elders,0));
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

-- Precio tras cada jornada: va hacia valor_punto * media ajustada, con tope ±15% del precio actual.
create or replace function update_prices(p_matchday int) returns void
language plpgsql security definer as $$
declare pv numeric := (select value from settings where key='point_value');
        m numeric := (select value from settings where key='prior_weight');
begin
  if pv is null or pv <= 0 then raise exception 'Fija settings.point_value antes de actualizar precios'; end if;
  insert into player_prices(player_id, matchday, price)
  select p.id, p_matchday,
    p.price * (1 + greatest(-0.15, least(0.15, (pv * (a.sum_pts + m*p.prior_avg)/(a.n + m)) / p.price - 1)))
  from players p
  join (select pgp.player_id, sum(points) sum_pts, count(*) n
        from player_game_points pgp group by pgp.player_id) a on a.player_id = p.id
  where p.price > 0 and exists (select 1 from player_game_points x join games g on g.id = x.game_id
                                where x.player_id = p.id and g.matchday = p_matchday)
  on conflict (player_id, matchday) do update set price = excluded.price;
  update players p set price = pp.price from player_prices pp
  where pp.player_id = p.id and pp.matchday = p_matchday;
end $$;
