# LEC Fantasy
Fantasy de la LEC Winter 2027. Datos en Supabase, web estática en `web/`.

## Supuestos de redondeo (revisar)
- CS diff: -1 por cada 15 completos de desventaja. CSD@15: ±1 por cada 10 completos.
- DPM y shutdown: ceil(floor(valor/100)/2); el shutdown resta ese valor.
- KP%: tramos no acumulables (100 -> 4, >85 -> 2, >75 -> 1).
- Larvas: 2 -> +1, 3 o más -> +2. Los objetivos de jungla son los del equipo, acreditados a su jungla.
- Visión: round(VSPM) al entero más cercano.
- Curas y escudos: una sola estadística, round((heal_pm + shield_pm) / 30).
