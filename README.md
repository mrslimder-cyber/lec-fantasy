# LEC Fantasy
Fantasy de la LEC Winter 2027. Datos y login en Supabase, web Next.js en `web/`, alojada en Vercel.

## Flujo de la app (formato supermanager)
Registro/login -> crear liga o unirse con código (con nombre de equipo). No hay sorteo: cada equipo empieza con
`settings.budget` (5.000.000 €) y se monta su plantilla en el mercado.

- **Mercado**: están todos los jugadores, con copias infinitas (que fiches a uno no se lo quita a nadie). Fichar y vender es
  inmediato, al precio actual. Abierto de miércoles a viernes (00:00-23:59, hora de Madrid); cerrado de sábado a martes
  (partidos, puntuaciones y cierre de jornada). No abre hasta que se cierra la jornada anterior.
- **Plantilla**: 8 jugadores (las 5 posiciones + 3 reservas de cualquier posición). Máx. 3 imports (no europeos).
- **Equipo**: cada jornada se forma un equipo de 5 para cada día (sábado, domingo, lunes) con los 8 jugadores. Máx. 2 imports
  alineados. Se puede alinear a un jugador fuera de su posición: puntúa la mitad. El botón **Fijar equipo** lo bloquea
  (se puede desfijar). Al empezar el primer partido de cada día, el equipo de ese día se cierra solo; los otros días siguen
  editables. Un día sin equipo guardado no puntúa. Los rivales ven tu equipo de un día cuando ese día empieza.
- **Clasificación**: suma de los puntos de los equipos de cada día, repartidos al cerrar la jornada.
- Ya no hay sorteo, pujas, subastas ni clausulazos.

## Base de datos
Orden en Supabase > SQL Editor: `schema.sql`, `scoring.sql`, `seed.sql`, `game.sql`.
`game.sql` contiene todo el juego (sustituye a `leagues.sql` y `v2.sql`...`v8.sql`) y se puede volver a ejecutar.
Si vuelves a ejecutar `scoring.sql`, ejecuta `game.sql` otra vez después.
`players.is_import` se marca en `seed.sql` (último parámetro de `seed_player`).

## Supuestos de redondeo (revisar)
- CS diff: -1 por cada 15 completos de desventaja. CSD@15: ±1 por cada 10 completos.
- DPM y shutdown: ceil(floor(valor/100)/2); el shutdown resta ese valor.
- KP%: tramos no acumulables (100 -> 4, >85 -> 2, >75 -> 1).
- Larvas: 2 -> +1, 3 o más -> +2. Los objetivos de jungla son los del equipo, acreditados a su jungla.
- Visión: round(VSPM) al entero más cercano.
- Curas y escudos: una sola estadística, round((heal_pm + shield_pm) / 30).
- Fuera de posición: la mitad de los puntos que haga el jugador en ese día.

## 🚀 LEC FANTASY · VERSIONES

v0.0.1 · Movimientos y menú
📜 Pestaña MOVIMIENTOS · 🎨 Menú rediseñado

v0.0.2 · Calendario y clausulazos
📅 Calendario de partidos
👥 Equipo distinto para sáb/dom/lun
💥 Clausulazos (precio × 1,5)
🛒 Mercado de 2 jugadores por posición
⏰ Pujas resueltas solas el viernes 23:59

v0.0.3 · Datos y precios
🤖 Scripts para subir partidos de gol.gg
📈 Precios dinámicos (±15 %)
🧑‍🎮 Pestaña JUGADORES y gráfico de VALOR

v0.0.4 · 🔧 Arreglos del scraper

v0.0.5 · 📸 Fotos nuevas (6 jugadores)

v0.0.6 · Mercado de pretemporada
🛒 Dos mercados por semana sin calendario
🔨 Pujas resueltas viernes y lunes

v0.0.7 · Pujas con dinero reservado
💶 Lo pujado queda reservado
🚫 Clausulazo solo con dinero libre

v0.0.8 · ✏️ Retoque del mercado

v0.0.9 · Botón de pujar
🐞 Botón de pujar arreglado
🔄 En pretemporada, titulares cambiables

v0.0.10 · 🚑 Arreglo del deploy en Vercel

v0.1.0 · Formato supermanager
🛒 Mercado con todos los jugadores y copias infinitas; fichar y vender al instante
👥 Plantilla de 8 (5 + 3 reservas), máx. 3 imports (2 en el equipo)
🔒 Botón «Fijar equipo»; se fija solo al empezar el primer partido de cada día
↔️ Jugadores fuera de posición puntúan la mitad
🗓️ Mercado abierto miércoles-viernes
🧹 Eliminados sorteo, pujas y clausulazos; todo el SQL unificado en game.sql

v0.1.1 · Fichajes desde Equipo
🗺️ Titulares: se fichan pulsando el hueco del mapa
🪑 Suplentes: huecos libres a la derecha
🔒 Imports no disponibles en gris
🛒 Mercado solo para consultar
💸 Botón Vender y Cambiar (banquillo)