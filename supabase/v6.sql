-- v6: mercado de pretemporada (2 mercados por semana mientras no haya calendario) y
--     mercado abierto la semana del primer partido. Se puede volver a ejecutar sin perder datos.
-- (Si vuelves a ejecutar v4.sql o v5.sql, ejecuta v6.sql otra vez después.)

create or replace function market_status() returns jsonb language plpgsql stable as $$
declare cm int := current_matchday(); dow int;
  testing boolean := coalesce((select value from settings where key='testing_open'),0) = 1;
  flag boolean := coalesce((select value from settings where key='market_open'),0) = 1;
  mult numeric := coalesce((select value from settings where key='clause_multiplier'),1.5);
  pre boolean := not exists (select 1 from fixtures);                       -- pretemporada
  first_week boolean := not exists (select 1 from closed_matchdays)         -- semana previa al 1.er partido
                        and now() < coalesce((select min(kickoff) from fixtures), '-infinity'::timestamptz);
  o boolean := true; why text := ''; res text;
begin
  dow := extract(dow from now() at time zone 'Europe/Madrid')::int;
  res := case when pre and dow in (6,0,1) then 'el lunes a las 23:59' else 'el viernes a las 23:59' end;
  if not testing and not pre then
    if not (flag or first_week) then
      o := false; why := 'El mercado está cerrado. Se abre al cerrar la jornada y cierra el viernes a las 23:59.';
    elsif dow not in (2,3,4,5) then
      o := false; why := 'El mercado está cerrado. Solo abre de martes a viernes.';
    end if;
  end if;
  return jsonb_build_object('open', o, 'reason', why, 'matchday', cm,
                            'lineup_open', lineup_open(cm), 'clause_multiplier', mult,
                            'preseason', pre, 'resolves', res);
end $$;

-- Resolución de pujas: viernes 23:59 siempre; lunes 23:59 solo en pretemporada.
create or replace function resolve_all_bids(p_force boolean default false) returns int
language plpgsql security definer as $$
declare t timestamp := now() at time zone 'Europe/Madrid'; lg record; n int := 0;
  pre boolean := not exists (select 1 from fixtures);
begin
  if not p_force
     and coalesce((select value from settings where key='testing_open'),0) <> 1
     and not ((extract(dow from t) = 5 or (pre and extract(dow from t) = 1))
              and extract(hour from t) = 23 and extract(minute from t) >= 58) then
    return 0;
  end if;
  for lg in select id from leagues where drawn loop
    n := n + resolve_league_bids(lg.id);   -- repone el mercado
  end loop;
  if not pre then
    update settings set value = 0 where key = 'market_open';   -- visible pero cerrado
  end if;
  return n;
end $$;

-- pg_cron: añade los avisos del lunes (la función solo actúa en pretemporada).
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('resolve-bids-mon-a', '59 21 * * 1', 'select resolve_all_bids()');
  perform cron.schedule('resolve-bids-mon-b', '59 22 * * 1', 'select resolve_all_bids()');
exception when others then
  raise notice 'No se pudo programar pg_cron: %', sqlerrm;
end $$;

revoke execute on function resolve_all_bids(boolean) from public, anon, authenticated;