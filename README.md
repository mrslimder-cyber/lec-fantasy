# LEC Fantasy
Fantasy de la LEC Winter 2027. Datos en Supabase, web estática en `web/`.

## Puesta en marcha
1. Supabase: crea proyecto; en SQL Editor ejecuta `supabase/schema.sql` y luego `supabase/scoring.sql`.
2. `web/.env.example` -> `.env.local` con la URL y la anon key.
3. `cd web && npm install && npm run dev`.
4. Importar un partido: insertar filas en `games`, `team_game_stats`, `player_game_stats` y llamar `select recompute_game(<id>);`.
   Tras cerrar la jornada: `select update_prices(<n>);` (antes, fija `settings.point_value`).

## Despliegue (gratis)
Cloudflare Pages: repo de GitHub, directorio raíz `web`, build `npm run build`, salida `out`, y las dos variables NEXT_PUBLIC_*.

## Supuestos de redondeo (revisar)
- CS diff: -1 por cada 15 completos de desventaja. CSD@15: ±1 por cada 10 completos.
- DPM y shutdown: ceil(floor(valor/100)/2); el shutdown resta ese valor.
- KP%: tramos no acumulables (100 -> 4, >85 -> 2, >75 -> 1).
- Larvas: 2 -> +1, 3 o más -> +2. Los objetivos de jungla son los del equipo, acreditados a su jungla.
- Visión: round(VSPM) al entero más cercano.
- Curas y escudos: una sola estadística, round((heal_pm + shield_pm) / 30).
