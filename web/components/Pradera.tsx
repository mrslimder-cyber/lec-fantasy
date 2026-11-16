/* Fondo del estilo "Pradera": colinas de césped oscuro peinado por el viento, como una fotografía.
   Capas (de atrás adelante):
   1. Dunas suaves en SVG, con degradados y sombras desenfocadas entre una y otra (volumen, sin contornos).
   2. Hebras de hierba: ruido fractal muy estirado (feTurbulence) en dos tonos, claras y oscuras, girado en diagonal.
      Se pinta UNA vez (el filtro va en un div hijo) y solo se mueve el contenedor, así que el viento es barato.
   3. Ráfagas: bandas de luz que cruzan despacio, y un poco de grano y viñeta.
   Animación: la capa de hebras se mece unos píxeles y pasan ráfagas de luz. Se paran con «reducir movimiento».
   Determinista (sin Math.random). Pon SHOW_FIGURE = false para quitar la figura roja. */

const SHOW_FIGURE = true;
const INK = "#031a09";

// Cresta de cada duna (la misma curva se reutiliza para el relleno, la sombra y la luz del borde).
const RIDGE = [
  "M-40,205 C260,120 700,50 1100,125 C1350,172 1500,150 1640,86",
  "M-40,430 C240,330 520,336 800,432 C1060,522 1360,566 1640,498",
  "M-40,650 C280,566 620,604 900,688 C1200,774 1450,742 1640,696",
  "M-40,868 C380,800 900,846 1640,790",
];
const FILL = ["url(#prD1)", "url(#prD2)", "url(#prD3)", "url(#prD4)"];

export function Pradera() {
  return (
    <div className="pradera" aria-hidden="true">
      <svg className="pradera-svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="prBase" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#082b10" />
            <stop offset="1" stopColor="#14491c" />
          </linearGradient>
          <linearGradient id="prD1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1d6026" />
            <stop offset="1" stopColor="#0c3314" />
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
        </defs>

        <rect width="1600" height="1000" fill="url(#prBase)" />

        {RIDGE.map((d, i) => (
          <g key={i}>
            {/* sombra que proyecta esta duna sobre la de detrás (justo encima de su cresta) */}
            {i > 0 && (
              <path d={d} fill="none" stroke={INK} strokeWidth="70" opacity=".55" filter="url(#prBlur)" transform="translate(0 -34)" />
            )}
            <path d={`${d} L1640,1000 L-40,1000 Z`} fill={FILL[i]} />
            {/* luz rasante en el borde de la cresta */}
            <path d={d} fill="none" stroke="#b6e68c" strokeWidth="16" opacity=".24" filter="url(#prBlurS)" transform="translate(0 16)" />
          </g>
        ))}

        {SHOW_FIGURE && (
          <g transform="translate(572 722)">
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

      {/* Hebras: el contenedor se mece, el hijo lleva el filtro (se rasteriza una sola vez) */}
      <div className="pradera-wind">
        <div className="pradera-blades" />
      </div>

      <div className="pradera-gust a" />
      <div className="pradera-gust b" />
      <div className="pradera-grain" />
      <div className="pradera-shade" />
    </div>
  );
}
