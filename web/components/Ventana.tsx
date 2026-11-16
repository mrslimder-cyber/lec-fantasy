import type { CSSProperties } from "react";

/* Fondo del estilo "Ventana": ventana abierta pintada a gouache sobre una pared azul cobalto.
   Por el hueco se ve el cielo con nubes que cruzan despacio, dos gaviotas planeando, la montaña,
   las colinas, un tejado de terracota y una maceta de margaritas en el alféizar.
   Es SVG puro (sin imágenes, así que no puede "perderse" un archivo) y determinista (sin Math.random).
   Las animaciones son CSS (ventana.css) y se paran con «reducir movimiento». */

const v = (o: Record<string, string | number>) => o as unknown as CSSProperties;

/* Hoja de ventana en perspectiva: x0 = borde exterior (alto), x1 = borde junto al hueco (más bajo). */
type Sash = { x0: number; x1: number; t0: number; t1: number; b0: number; b1: number };
const LEFT: Sash = { x0: 28, x1: 150, t0: 110, t1: 190, b0: 700, b1: 600 };
const RIGHT: Sash = { ...LEFT, x0: 732, x1: 610 };

const pt = (c: Sash, u: number, w: number) => {
  const x = c.x0 + (c.x1 - c.x0) * u;
  const t = c.t0 + (c.t1 - c.t0) * u;
  const b = c.b0 + (c.b1 - c.b0) * u;
  return `${x.toFixed(1)},${(t + (b - t) * w).toFixed(1)}`;
};
const quad = (c: Sash, u0: number, u1: number, w0: number, w1: number) =>
  [pt(c, u0, w0), pt(c, u1, w0), pt(c, u1, w1), pt(c, u0, w1)].join(" ");

const PANES: [number, number][] = [[0.07, 0.31], [0.36, 0.66], [0.71, 0.94]];

function Casement({ c }: { c: Sash }) {
  return (
    <g>
      <polygon points={quad(c, 0, 1, 0, 1)} fill="url(#vCream)" stroke="#b9ad8f" strokeWidth="2" strokeLinejoin="round" />
      <polygon points={quad(c, 0.9, 1, 0, 1)} fill="#cfc4a6" opacity=".7" />
      {PANES.map(([a, b], i) => (
        <g key={i}>
          <polygon points={quad(c, 0.2, 0.8, a, b)} fill="url(#vGlass)" stroke="#bfb496" strokeWidth="2" />
          <polygon points={quad(c, 0.28, 0.46, a + 0.02, b - 0.03)} fill="#fff" opacity=".26" />
        </g>
      ))}
    </g>
  );
}

function Cloud() {
  return (
    <g>
      <ellipse cx="6" cy="26" rx="118" ry="13" fill="#d3e5f6" opacity=".9" />
      <circle cx="-72" cy="4" r="32" fill="#fff" />
      <circle cx="-26" cy="-16" r="44" fill="#fff" />
      <circle cx="32" cy="-24" r="50" fill="#fff" />
      <circle cx="84" cy="-2" r="36" fill="#fff" />
      <circle cx="2" cy="8" r="38" fill="#fff" />
      <ellipse cx="14" cy="20" rx="96" ry="10" fill="#dbeaf7" opacity=".85" />
    </g>
  );
}

function Gull() {
  return (
    <g>
      <path d="M-40,0 Q-20,-15 0,-2 Q20,-15 40,0 Q20,-5 0,5 Q-20,-5 -40,0 Z" fill="#f6f3ec" stroke="#6b7686" strokeWidth="1" strokeLinejoin="round" />
      <ellipse cx="-38" cy="0" rx="5" ry="2" fill="#4a5568" />
      <ellipse cx="38" cy="0" rx="5" ry="2" fill="#4a5568" />
    </g>
  );
}

function Daisy({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {Array.from({ length: 8 }, (_, i) => (
        <ellipse key={i} cx="0" cy={-r * 0.62} rx={r * 0.3} ry={r * 0.52} fill="#fffdf5" stroke="#e9e1c8" strokeWidth=".6"
          transform={`rotate(${i * 45})`} />
      ))}
      <circle r={r * 0.3} fill="#f2b632" />
    </g>
  );
}

const CLOUDS = [
  { y: 330, s: 1.25, d: 150, dl: -40 },
  { y: 255, s: 0.85, d: 190, dl: -120 },
  { y: 395, s: 0.95, d: 230, dl: -170 },
];
const GULLS = [
  { y: 300, s: 0.9, d: 70, dl: -22, bd: 5 },
  { y: 262, s: 0.6, d: 95, dl: -61, bd: 6.5 },
];

export function Ventana() {
  return (
    <div className="ventana" aria-hidden="true">
      <svg className="ventana-svg" viewBox="0 0 760 760" preserveAspectRatio="xMidYMax meet">
        <defs>
          <linearGradient id="vSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5ea4e4" />
            <stop offset=".65" stopColor="#a8d2f0" />
            <stop offset="1" stopColor="#d3e8f4" />
          </linearGradient>
          <linearGradient id="vGlass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8fc0ee" stopOpacity=".8" />
            <stop offset="1" stopColor="#c7e0f5" stopOpacity=".7" />
          </linearGradient>
          <linearGradient id="vCream" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f4ecd8" />
            <stop offset="1" stopColor="#dcd2b6" />
          </linearGradient>
          <clipPath id="vOpen"><rect x="150" y="190" width="460" height="392" /></clipPath>
          <filter id="vWobble" filterUnits="userSpaceOnUse" x="-100" y="0" width="960" height="800">
            <feTurbulence type="fractalNoise" baseFrequency="0.018 0.03" numOctaves="2" seed="5" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>

        {/* Borde irregular de pintura sobre el hueco */}
        <path filter="url(#vWobble)" fill="#4a86d8" opacity=".85"
          d="M132,208 L158,178 C220,170 300,184 380,176 C460,168 540,182 622,176 L640,206 L612,198 C540,190 460,200 380,194 C300,200 220,192 150,198 Z" />

        {/* Lo que se ve por el hueco */}
        <g clipPath="url(#vOpen)">
          <rect x="150" y="190" width="460" height="392" fill="url(#vSky)" />

          {CLOUDS.map((c, i) => (
            <g key={i} transform={`translate(380 ${c.y}) scale(${c.s})`}>
              <g className="vcl" style={v({ "--d": c.d + "s", "--dl": c.dl + "s" })}><Cloud /></g>
            </g>
          ))}

          {/* Montaña y colinas */}
          <path d="M150,500 L150,432 C200,420 250,382 310,346 C350,324 382,320 412,340 C462,372 520,420 610,426 L610,540 L150,540 Z" fill="#5b88cf" />
          <path d="M262,404 C290,376 330,350 372,344 C350,372 330,420 360,470 C320,456 290,440 262,404 Z" fill="#7ea6e2" opacity=".85" />
          <path d="M150,474 C230,456 300,442 380,464 C450,480 520,450 610,452 L610,560 L150,560 Z" fill="#4f9a86" />
          <path d="M150,526 C250,494 350,508 450,498 C520,490 570,482 610,480 L610,580 L150,580 Z" fill="#5fa56a" />

          {/* Tejado de terracota y casitas */}
          <polygon points="150,520 304,538 336,568 150,604" fill="#d8664a" />
          <path d="M150,540 L316,554 M150,560 L324,566 M150,580 L330,578" stroke="#b8503a" strokeWidth="3" fill="none" />
          <rect x="344" y="540" width="26" height="40" fill="#eef0f2" />
          <rect x="378" y="552" width="18" height="28" fill="#f3e9d6" />
          <ellipse cx="412" cy="556" rx="9" ry="24" fill="#3f7d52" />

          {GULLS.map((g, i) => (
            <g key={i} transform={`translate(380 ${g.y}) scale(${g.s})`}>
              <g className="vgl" style={v({ "--d": g.d + "s", "--dl": g.dl + "s" })}>
                <g className="vbob" style={v({ "--bd": g.bd + "s" })}><Gull /></g>
              </g>
            </g>
          ))}
        </g>

        {/* Hojas abiertas */}
        <g filter="url(#vWobble)">
          <Casement c={LEFT} />
          <Casement c={RIGHT} />
        </g>

        {/* Alféizar pintado de blanco con sombras azules */}
        <g filter="url(#vWobble)">
          <polygon points="70,578 690,578 724,660 36,660" fill="#fbf8f1" />
          <polygon points="36,660 724,660 724,692 36,692" fill="#dfe6f2" />
          <path d="M150,582 L176,660 L112,660 Z" fill="#7fa6e6" opacity=".5" />
          <path d="M610,582 L584,660 L650,660 Z" fill="#7fa6e6" opacity=".5" />
          <ellipse cx="500" cy="652" rx="58" ry="9" fill="#7fa6e6" opacity=".55" />
        </g>

        {/* Maceta de margaritas */}
        <g>
          <path d="M464,598 L536,598 L528,652 L472,652 Z" fill="#2b2f55" />
          <ellipse cx="500" cy="598" rx="38" ry="7" fill="#3b4070" />
          <g className="vsway">
            <ellipse cx="470" cy="574" rx="30" ry="12" fill="#4d9a4a" transform="rotate(-24 470 574)" />
            <ellipse cx="532" cy="572" rx="30" ry="12" fill="#5da84f" transform="rotate(24 532 572)" />
            <ellipse cx="500" cy="560" rx="26" ry="14" fill="#7db446" transform="rotate(-80 500 560)" />
            <ellipse cx="448" cy="556" rx="24" ry="9" fill="#9ac23a" transform="rotate(-48 448 556)" />
            <ellipse cx="556" cy="554" rx="24" ry="9" fill="#8bbb3d" transform="rotate(46 556 554)" />
            <ellipse cx="500" cy="590" rx="34" ry="10" fill="#3f8a45" />
            <Daisy x={470} y={534} r={15} />
            <Daisy x={520} y={518} r={17} />
            <Daisy x={562} y={548} r={13} />
            <Daisy x={440} y={566} r={11} />
            <Daisy x={498} y={494} r={12} />
            <Daisy x={548} y={584} r={10} />
          </g>
        </g>
      </svg>
      <div className="ventana-shade" />
    </div>
  );
}
