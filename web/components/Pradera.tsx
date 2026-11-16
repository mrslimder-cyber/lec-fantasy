/* Fondo del estilo "Pradera": colinas de césped oscuro peinado por el viento bajo un cielo con nubes que avanzan.
   Capas (de atrás adelante):
   1. Cielo: degradado azul -> bruma clara en el horizonte.
   2. Nubes: ruido fractal estirado en horizontal (feTurbulence), dos capas a distinta velocidad.
      Cada capa son DOS mosaicos pegados que se desplazan la mitad y vuelven al inicio sin salto (stitchTiles).
      El filtro va en los mosaicos y se pinta una sola vez; solo se mueve el contenedor, así que es barato.
   3. Lejanías y dunas en SVG: una loma lejana azulada, dunas con degradados y sombras desenfocadas entre una y otra.
   4. Hebras de hierba (la textura de siempre), con una máscara que las oculta en el cielo y las lejanías
      y las deja ir apareciendo hacia abajo (así la hierba cercana se ve más nítida que la lejana).
   5. Ráfagas de luz, sombra de las nubes cruzando la hierba, grano y viñeta.
   Se paran con «reducir movimiento». Determinista (sin Math.random). SHOW_FIGURE = false quita la figura roja. */

const SHOW_FIGURE = true;
const INK = "#031a09";

// Crestas de cada capa. La primera es la loma lejana (sin sombras ni luz de borde).
const RIDGE = [
  "M-40,404 C200,390 420,412 640,398 C900,382 1160,406 1380,394 C1500,388 1580,394 1640,390",
  "M-40,444 C260,408 700,384 1100,424 C1350,448 1500,434 1640,406",
  "M-40,566 C240,506 520,506 800,566 C1060,622 1360,646 1640,596",
  "M-40,744 C280,676 620,700 900,764 C1200,830 1450,804 1640,768",
  "M-40,904 C380,850 900,888 1640,838",
];
const FILL = ["url(#prFar)", "url(#prD1)", "url(#prD2)", "url(#prD3)", "url(#prD4)"];

export function Pradera() {
  return (
    <div className="pradera" aria-hidden="true">
      {/* Cielo y nubes */}
      <div className="pradera-sky" />
      <div className="pradera-clouds">
        <div className="pradera-cl l1"><div className="pc-tile" /><div className="pc-tile" /></div>
        <div className="pradera-cl l2"><div className="pc-tile" /><div className="pc-tile" /></div>
      </div>

      <svg className="pradera-svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="prFar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8fb3b0" />
            <stop offset="1" stopColor="#5f8f78" />
          </linearGradient>
          <linearGradient id="prD1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b7d46" />
            <stop offset="1" stopColor="#14461d" />
          </linearGradient>
          <linearGradient id="prD2" x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor="#38903a" />
            <stop offset=".55" stopColor="#1f6a27" />
            <stop offset="1" stopColor="#10401a" />
          </linearGradient>
          <linearGradient id="prD3" x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0" stopColor="#4ba246" />
            <stop offset=".5" stopColor="#2c7a30" />
            <stop offset="1" stopColor="#16511f" />
          </linearGradient>
          <linearGradient id="prD4" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#58b04e" />
            <stop offset="1" stopColor="#1d6626" />
          </linearGradient>
          {/* Bruma que sube desde el horizonte sobre las lomas lejanas */}
          <linearGradient id="prMist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#dbe9ee" stopOpacity="0" />
            <stop offset=".45" stopColor="#dbe9ee" stopOpacity=".5" />
            <stop offset="1" stopColor="#dbe9ee" stopOpacity="0" />
          </linearGradient>
          <filter id="prBlur" x="-10%" y="-30%" width="120%" height="160%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
          <filter id="prBlurS" x="-10%" y="-30%" width="120%" height="160%">
            <feGaussianBlur stdDeviation="9" />
          </filter>

          {/* Hebras de hierba: ruido estirado en horizontal (se gira luego con CSS). Oscuras + claras. */}
          <filter id="prGrass" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.011 0.52" numOctaves="3" seed="4" result="a" />
            <feColorMatrix in="a" type="matrix"
              values="0 0 0 0 .01  0 0 0 0 .09  0 0 0 0 .03  -3.2 0 0 0 1.3" result="dark" />
            <feTurbulence type="fractalNoise" baseFrequency="0.008 0.85" numOctaves="2" seed="11" result="b" />
            <feColorMatrix in="b" type="matrix"
              values="0 0 0 0 .74  0 0 0 0 .96  0 0 0 0 .46  3.2 0 0 0 -1.6" result="light" />
            <feMerge>
              <feMergeNode in="dark" />
              <feMergeNode in="light" />
            </feMerge>
          </filter>

          {/* Nubes: la densidad sale del ruido, el sombreado del color. stitch = el mosaico encaja consigo mismo. */}
          <filter id="prCloudFar" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.0028 0.0075" numOctaves="4" seed="3" stitchTiles="stitch" />
            <feColorMatrix type="matrix" values="0 -.22 0 0 .96  0 -.2 0 0 .975  0 -.1 0 0 1.02  3 0 0 0 -1.3" />
          </filter>
          <filter id="prCloudNear" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.0046 0.012" numOctaves="4" seed="8" stitchTiles="stitch" />
            <feColorMatrix type="matrix" values="0 -.26 0 0 .98  0 -.24 0 0 .99  0 -.12 0 0 1.03  3.4 0 0 0 -1.5" />
          </filter>
        </defs>

        {RIDGE.map((d, i) => (
          <g key={i}>
            {/* sombra que proyecta esta duna sobre la de detrás (justo encima de su cresta) */}
            {i > 1 && (
              <path d={d} fill="none" stroke={INK} strokeWidth="70" opacity=".55" filter="url(#prBlur)" transform="translate(0 -34)" />
            )}
            <path d={`${d} L1640,1000 L-40,1000 Z`} fill={FILL[i]} />
            {/* luz rasante en el borde de la cresta */}
            {i > 1 && (
              <path d={d} fill="none" stroke="#b6e68c" strokeWidth="16" opacity=".24" filter="url(#prBlurS)" transform="translate(0 16)" />
            )}
            {i === 1 && <rect x="-40" y="360" width="1700" height="130" fill="url(#prMist)" />}
          </g>
        ))}

        {SHOW_FIGURE && (
          <g transform="translate(572 770)">
            <ellipse cx="2" cy="31" rx="13" ry="3" fill={INK} opacity=".4" />
            <rect x="-5" y="15" width="4" height="15" rx="1.5" fill="#e9efe6" />
            <rect x="1" y="15" width="4" height="15" rx="1.5" fill="#dfe7dc" />
            <rect x="-6.5" y="0" width="13" height="18" rx="3" fill="#d8271a" />
            <rect x="-8.5" y="2" width="3.5" height="12" rx="1.7" fill="#c42217" />
            <rect x="5" y="2" width="3.5" height="12" rx="1.7" fill="#c42217" />
            <circle cx="0" cy="-5" r="4.6" fill="#251a14" />
          </g>
        )}
      </svg>

      {/* Hierba: la máscara (estática) la oculta en el cielo y las lejanías */}
      <div className="pradera-grass">
        <div className="pradera-wind">
          <div className="pradera-blades" />
        </div>
        <div className="pradera-gust a" />
        <div className="pradera-gust b" />
        <div className="pradera-cshade" />
      </div>

      <div className="pradera-grain" />
      <div className="pradera-shade" />
    </div>
  );
}
