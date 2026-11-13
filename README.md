# LEC Fantasy
Fantasy de la LEC Winter 2027. Datos y login en Supabase, web Next.js en `web/`, alojada en Vercel.

## Flujo de la app
Registro/login -> crear liga o unirse con código (con nombre de equipo) -> el creador pulsa "Sortear jugadores"
(7 por equipo: 5 titulares + 2 reservas, dentro de `settings.budget` = 3.500.000 €; lo que sobra queda como dinero).

Dentro de cada liga hay tres secciones (barra de pestañas en la propia liga):
- **Clasificación**: equipos por puntos (solo puntúan los 5 titulares). Tocar un equipo muestra su alineación.
- **Mi equipo**: mapa de la grieta. Toca un jugador y luego otro hueco para intercambiarlos (titular <-> reserva) o para venderlo.
- **Mercado**: agentes libres (los que no tiene ningún equipo de la liga). Fichar cuesta el precio actual; vender lo ingresa.
  Un fichaje va a su hueco de titular si está libre; si no, a una reserva libre. Si no hay hueco, hay que vender antes.

## Supuestos de redondeo (revisar)
- CS diff: -1 por cada 15 completos de desventaja. CSD@15: ±1 por cada 10 completos.
- DPM y shutdown: ceil(floor(valor/100)/2); el shutdown resta ese valor.
- KP%: tramos no acumulables (100 -> 4, >85 -> 2, >75 -> 1).
- Larvas: 2 -> +1, 3 o más -> +2. Los objetivos de jungla son los del equipo, acreditados a su jungla.
- Visión: round(VSPM) al entero más cercano.
- Curas y escudos: una sola estadística, round((heal_pm + shield_pm) / 30).
- En la clasificación de equipos puntúan solo los 5 titulares; las reservas no suman.

🚀 LEC FANTASY · VERSIONES

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