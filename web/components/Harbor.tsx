/* Fondo vivo del estilo "Portofino": bahía italiana con casas de colores, terrazas con luces,
   barcas que se mecen, reflejos que ondulan y una esquina de mesa de desayuno.
   Server component y determinista (sin Math.random) para que no haya desajustes de hidratación. */

function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

const BASE = 400; // línea de muelle de las casas
const BUILDINGS = [
  { x: 600, w: 110, h: 200, c: "#f0e0a8" },
  { x: 710, w: 120, h: 250, c: "#d63f2b" },
  { x: 830, w: 130, h: 230, c: "#e7733a" },
  { x: 960, w: 120, h: 210, c: "#e9b24a" },
  { x: 1080, w: 150, h: 300, c: "#e0562a" },
  { x: 1230, w: 130, h: 240, c: "#f0b9a0" },
  { x: 1360, w: 140, h: 280, c: "#d63f2b" },
  { x: 1500, w: 130, h: 320, c: "#e7733a" },
];

function Facades({ detail }: { detail: boolean }) {
  const r = rng(7);
  return (
    <>
      {BUILDINGS.map((b, i) => {
        const top = BASE - b.h;
        const cols = Math.max(2, Math.floor(b.w / 44));
        const rows = Math.max(2, Math.floor((b.h - 50) / 64));
        const gx = b.w / cols;
        return (
          <g key={i}>
            <rect x={b.x} y={top} width={b.w} height={b.h} fill={b.c} />
            <rect x={b.x - 3} y={top - 8} width={b.w + 6} height={11} fill="#9c4a2a" />
            {detail && <rect x={b.x} y={top} width={4} height={b.h} fill="#3a1a08" opacity=".12" />}
            {detail && Array.from({ length: rows * cols }, (_, k) => {
              const col = k % cols, row = Math.floor(k / cols);
              const cx = b.x + gx * col + gx / 2, cy = top + 30 + row * 64;
              const lit = r() < 0.15;
              const shut = r() < 0.5 ? "#3f8f6b" : "#5aa58a";
              return (
                <g key={k}>
                  <rect x={cx - 18} y={cy} width={8} height={30} fill={shut} />
                  <rect x={cx + 10} y={cy} width={8} height={30} fill={shut} />
                  <rect x={cx - 9} y={cy} width={18} height={30} fill={lit ? "#f6d98a" : "#2a3a52"} />
                  <rect x={cx - 12} y={cy + 30} width={24} height={4} fill="#fff6e0" opacity=".7" />
                </g>
              );
            })}
          </g>
        );
      })}
    </>
  );
}

function Lights() {
  const r = rng(33);
  return (
    <>
      {Array.from({ length: 52 }, (_, i) => (
        <circle key={i} cx={574 + i * 20} cy={410 + (i % 2) * 3} r="2.8" fill="#ffd37a">
          <animate attributeName="opacity" values=".45;1;.45" dur={`${(2 + r() * 3).toFixed(2)}s`}
            begin={`-${(r() * 4).toFixed(2)}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </>
  );
}

function Glints() {
  const r = rng(11);
  return (
    <>
      {Array.from({ length: 46 }, (_, i) => {
        const x = r() * 1600, y = 450 + r() * 540, w = 20 + r() * 60;
        return (
          <line key={i} x1={x} y1={y} x2={x + w} y2={y} stroke="#e9f6ff" strokeWidth={2 + (y - 450) / 200} strokeLinecap="round" opacity="0">
            <animate attributeName="opacity" values="0;.55;0" dur={`${(3 + r() * 5).toFixed(1)}s`}
              begin={`-${(r() * 8).toFixed(1)}s`} repeatCount="indefinite" />
          </line>
        );
      })}
    </>
  );
}

function Boat({ x, y, s = 1, flip = false, kind, dur = 6, delay = 0 }: {
  x: number; y: number; s?: number; flip?: boolean; kind: "sail" | "row"; dur?: number; delay?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx="0" cy="16" rx={kind === "sail" ? 84 : 52} ry="7" fill="#0d3a5a" opacity=".35" />
      <g className="harbor-bob" style={{ animationDuration: `${dur}s`, animationDelay: `-${delay}s` }}>
        <use href={kind === "sail" ? "#h-sail" : "#h-row"} />
      </g>
    </g>
  );
}

export function Harbor() {
  return (
    <div className="harbor" aria-hidden="true">
      <svg className="harbor-svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="h-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7fbfdc" />
            <stop offset=".6" stopColor="#c9e4e8" />
            <stop offset="1" stopColor="#f3ecd8" />
          </linearGradient>
          <linearGradient id="h-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2f93b4" />
            <stop offset=".45" stopColor="#1f6f98" />
            <stop offset="1" stopColor="#154b74" />
          </linearGradient>
          <linearGradient id="h-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2f93b4" stopOpacity="0" />
            <stop offset="1" stopColor="#2a86a6" stopOpacity=".95" />
          </linearGradient>
          <pattern id="h-awn" width="40" height="18" patternUnits="userSpaceOnUse">
            <rect width="20" height="18" fill="#f6efdc" />
            <rect x="20" width="20" height="18" fill="#e7d3a4" />
          </pattern>
          <clipPath id="h-wclip"><rect x="0" y="430" width="1600" height="240" /></clipPath>
          <filter id="h-wobble" filterUnits="userSpaceOnUse" x="0" y="0" width="1600" height="1000">
            <feTurbulence type="fractalNoise" baseFrequency="0.004 0.05" numOctaves="2" seed="4" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="22" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="h-soft" x="-30%" y="-100%" width="160%" height="300%">
            <feGaussianBlur stdDeviation="10" />
          </filter>

          {/* Velero fondeado */}
          <g id="h-sail">
            <path d="M-76,0 L76,0 C66,20 -56,20 -76,0 Z" fill="#f6f1e4" />
            <path d="M-72,6 L72,6" stroke="#2b4a6e" strokeWidth="3" fill="none" />
            <rect x="-22" y="-14" width="44" height="14" fill="#e8dfc8" />
            <line x1="0" y1="0" x2="0" y2="-200" stroke="#d9d0bb" strokeWidth="3.5" />
            <line x1="-8" y1="-24" x2="60" y2="-24" stroke="#d9d0bb" strokeWidth="3" />
            <path d="M0,-200 L28,-191 L0,-182 Z" fill="#e0562a" />
          </g>
          {/* Barca de remos */}
          <g id="h-row">
            <path d="M-48,0 L48,0 C40,15 -38,15 -48,0 Z" fill="#f6f1e4" />
            <path d="M-46,5 L46,5" stroke="#d9472f" strokeWidth="3.5" fill="none" />
            <rect x="-8" y="-6" width="16" height="6" fill="#c9a46a" />
          </g>
        </defs>

        {/* Cielo y nubes */}
        <rect x="0" y="0" width="1600" height="440" fill="url(#h-sky)" />
        <g className="swim">
          <g>
            <animateTransform attributeName="transform" type="translate" values="-300 0;1900 0" dur="240s" begin="-90s" repeatCount="indefinite" />
            <ellipse cx="0" cy="90" rx="190" ry="24" fill="#fff" opacity=".6" filter="url(#h-soft)" />
            <ellipse cx="80" cy="76" rx="110" ry="22" fill="#fff" opacity=".55" filter="url(#h-soft)" />
          </g>
          <g>
            <animateTransform attributeName="transform" type="translate" values="-300 0;1900 0" dur="320s" begin="-230s" repeatCount="indefinite" />
            <ellipse cx="0" cy="170" rx="150" ry="18" fill="#fff" opacity=".45" filter="url(#h-soft)" />
          </g>
        </g>

        {/* Colinas */}
        <path d="M0,260 C120,190 240,130 380,190 C470,225 560,180 700,200 L700,430 L0,430 Z" fill="#8fbaa6" />
        <path d="M560,210 C800,120 1100,90 1350,130 C1480,150 1560,110 1600,100 L1600,430 L560,430 Z" fill="#7fae95" />
        <path d="M0,300 C140,230 300,210 430,250 C520,276 600,250 700,270 L700,430 L0,430 Z" fill="#4c8a63" />
        <path d="M640,250 C900,190 1150,170 1400,200 C1500,212 1560,190 1600,180 L1600,430 L640,430 Z" fill="#3d7a55" />

        {/* Promontorio con la capilla */}
        <path d="M0,430 L0,330 L90,326 L150,296 L330,300 L440,356 L540,404 L580,430 Z" fill="#6b5b4e" />
        <path d="M40,360 L150,322 L330,330 L420,380 L500,420 L40,420 Z" fill="#8a7765" opacity=".6" />
        <rect x="120" y="190" width="190" height="112" fill="#e3b9a3" />
        <path d="M110,190 C150,150 280,150 320,190 Z" fill="#d9a48c" />
        <rect x="150" y="96" width="62" height="100" fill="#e8c1ab" />
        <path d="M144,98 L181,56 L218,98 Z" fill="#4f6a78" />
        <circle cx="181" cy="50" r="7" fill="#4f6a78" />
        <rect x="170" y="116" width="22" height="34" rx="11" fill="#6a4a40" />
        <rect x="232" y="224" width="26" height="40" rx="13" fill="#6a4a40" />
        <rect x="170" y="238" width="22" height="30" fill="#6a4a40" />

        {/* Casas de colores */}
        <Facades detail />

        {/* Toldos, luces y muelle */}
        <rect x="560" y="398" width="1040" height="18" fill="url(#h-awn)" />
        <rect x="560" y="416" width="1040" height="6" fill="#3a1a08" opacity=".32" />
        <rect x="560" y="422" width="1040" height="10" fill="#b98f5e" />
        <g className="swim"><Lights /></g>

        {/* Agua */}
        <rect x="0" y="430" width="1600" height="570" fill="url(#h-water)" />
        <g clipPath="url(#h-wclip)" opacity=".42">
          <g transform="translate(0 850) scale(1 -1)" filter="url(#h-wobble)">
            <Facades detail={false} />
          </g>
        </g>
        <rect x="0" y="430" width="1600" height="240" fill="url(#h-fade)" />
        <g className="swim"><Glints /></g>

        {/* Barcas y boya */}
        <Boat kind="sail" x={470} y={640} s={1.15} dur={7} delay={1} />
        <Boat kind="row" x={900} y={560} s={0.8} dur={5} delay={3} />
        <Boat kind="row" x={1190} y={650} s={1} flip dur={6} delay={2} />
        <Boat kind="row" x={760} y={740} s={1.25} dur={5.5} delay={4} />
        <g transform="translate(610 800)">
          <g className="harbor-bob" style={{ animationDuration: "4s" }}>
            <circle r="11" fill="#e8742a" />
            <circle cx="-4" cy="-4" r="3.5" fill="#fff" opacity=".5" />
          </g>
        </g>
        <g className="swim">
          <g>
            <animateMotion path="M-120,880 L1720,830" dur="230s" begin="-80s" repeatCount="indefinite" />
            <use href="#h-row" transform="scale(1.1)" />
          </g>
        </g>

        {/* Esquina de mesa: mantel, café, zumo y galletas */}
        <g>
          <ellipse cx="120" cy="985" rx="360" ry="190" fill="#000" opacity=".2" transform="translate(14 -6)" />
          <ellipse cx="120" cy="985" rx="360" ry="190" fill="#f7f1e2" />
          <ellipse cx="120" cy="985" rx="330" ry="166" fill="none" stroke="#e6dcc4" strokeWidth="3" />
          <circle cx="200" cy="885" r="52" fill="#fbf8ee" stroke="#e0d6bf" strokeWidth="3" />
          <circle cx="182" cy="880" r="22" fill="#d9a45a" />
          <circle cx="220" cy="892" r="20" fill="#cf9a4e" />
          <circle cx="70" cy="870" r="40" fill="#fbf8ee" stroke="#e0d6bf" strokeWidth="3" />
          <circle cx="70" cy="870" r="27" fill="#fff" />
          <circle cx="70" cy="870" r="19" fill="#7a4a2a" />
          <circle cx="64" cy="864" r="6" fill="#fff" opacity=".35" />
          <rect x="98" y="864" width="24" height="11" rx="5" fill="#fff" stroke="#e0d6bf" strokeWidth="2" />
          <circle cx="300" cy="848" r="20" fill="#f08a24" stroke="#e6dcc4" strokeWidth="3" />
          <circle cx="293" cy="841" r="6" fill="#fff" opacity=".5" />
        </g>

        {/* Silla de rejilla dorada */}
        <g fill="none" strokeLinecap="round">
          <path d="M1600,770 C1500,752 1420,812 1400,910 C1392,950 1384,990 1382,1010" stroke="#3a1a08" strokeWidth="20" opacity=".25" transform="translate(8 8)" />
          <path d="M1600,770 C1500,752 1420,812 1400,910 C1392,950 1384,990 1382,1010" stroke="#e0a030" strokeWidth="18" />
          <path d="M1600,812 C1522,796 1462,846 1446,926 C1440,960 1434,990 1432,1010" stroke="#c98a1c" strokeWidth="14" />
        </g>
      </svg>

      <div className="harbor-vignette" />
    </div>
  );
}
