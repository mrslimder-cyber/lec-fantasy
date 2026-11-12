# LEC Fantasy
Fantasy de la LEC Winter 2027. Datos y login en Supabase, web Next.js en `web/`, alojada en Vercel.

## Puesta en marcha
1. Supabase: crea proyecto; en SQL Editor ejecuta, por este orden: `supabase/schema.sql`, `supabase/scoring.sql`, `supabase/seed.sql` y `supabase/leagues.sql`.
   (`leagues.sql` se puede volver a ejecutar cuando cambie: no borra datos.)
2. Supabase > Authentication > Providers > Email: para probar rápido, desactiva "Confirm email".
3. `web/.env.example` -> `web/.env.local` con la URL y la anon key.
4. `cd web && npm install && npm run dev`.
5. Importar un partido: insertar filas en `games`, `team_game_stats`, `player_game_stats` y llamar `select recompute_game(<id>);`.
   Tras cerrar la jornada: `select update_prices(<n>);` (antes, fija `settings.point_value`).

## Flujo de la app
Registro/login -> crear liga o unirse con código (con nombre de equipo) -> el creador pulsa "Sortear jugadores"
(7 por equipo: 5 titulares + 2 reservas, dentro de `settings.budget` = 800.000 €; lo que sobra queda como dinero).

Dentro de cada liga hay tres secciones (barra de pestañas en la propia liga):
- **Clasificación**: equipos por puntos (solo puntúan los 5 titulares). Tocar un equipo muestra su alineación.
- **Mi equipo**: mapa de la grieta. Toca un jugador y luego otro hueco para intercambiarlos (titular <-> reserva) o para venderlo.
- **Mercado**: agentes libres (los que no tiene ningún equipo de la liga). Fichar cuesta el precio actual; vender lo ingresa.
  Un fichaje va a su hueco de titular si está libre; si no, a una reserva libre. Si no hay hueco, hay que vender antes.

## Despliegue en Vercel
1. Sube el repo a GitHub.
2. vercel.com > Add New > Project > importa el repo.
3. Root Directory: `web`. Framework: Next.js (se detecta solo). No toques build ni output.
4. Environment Variables: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Deploy. Después, en Supabase > Authentication > URL Configuration: Site URL = tu dominio de Vercel
   y añade `https://tu-dominio.vercel.app/**` a Redirect URLs.
Cada `git push` a main redespliega solo.

## Supuestos de redondeo (revisar)
- CS diff: -1 por cada 15 completos de desventaja. CSD@15: ±1 por cada 10 completos.
- DPM y shutdown: ceil(floor(valor/100)/2); el shutdown resta ese valor.
- KP%: tramos no acumulables (100 -> 4, >85 -> 2, >75 -> 1).
- Larvas: 2 -> +1, 3 o más -> +2. Los objetivos de jungla son los del equipo, acreditados a su jungla.
- Visión: round(VSPM) al entero más cercano.
- Curas y escudos: una sola estadística, round((heal_pm + shield_pm) / 30).
- En la clasificación de equipos puntúan solo los 5 titulares; las reservas no suman.
