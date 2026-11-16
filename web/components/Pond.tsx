import type { CSSProperties } from "react";

/* Fondo del estilo "Koi", versión estudio de animación pintado a mano:
   un estanque visto desde arriba, agua turquesa con manchas de acuarela, nubes enormes que se reflejan y cruzan
   despacio, carpas nadando por debajo, nenúfares con lotos, pétalos a la deriva, lucecitas que suben
   y dos rocas con musgo y unas bolitas de polvo con ojos que saltan de vez en cuando.
   Todo es SVG/CSS (sin imágenes) y determinista (sin Math.random).
   Para cambiar colores, velocidades o rutas edita FISH, PADS, PETALS y ORBS más abajo.
   El CSS vive en koi.css; «reducir movimiento» oculta todo lo que se mueve (.swim). */

const v = (o: Record<string, string>) => o as unknown as CSSProperties;
const f = (x: number, d = 1) => x.toFixed(d);
function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

const FISH = [
  { // grande, crema con manchas naranjas
    d: "M -260,640 C -60,420 260,300 520,360 C 820,430 900,640 1180,600 C 1460,560 1560,300 1880,330 C 2000,560 1760,860 1420,880 C 1040,900 860,720 560,760 C 300,795 40,900 -160,820 C -330,750 -330,700 -260,640 Z",
    dur: 90, begin: -22, scale: 1.3, vars: v({ "--body": "#fbf0d8", "--patch": "#f2692b" }),
  },
  { // mediana, más naranja, en sentido contrario
    d: "M 1900,200 C 1650,380 1380,260 1130,330 C 880,400 760,150 480,220 C 200,290 160,560 -120,520 C -400,480 -340,860 -40,900 C 260,940 520,700 800,780 C 1080,860 1300,980 1600,900 C 1900,820 2150,260 1900,200 Z",
    dur: 110, begin: -61, scale: 1.05, vars: v({ "--body": "#f7e6c6", "--patch": "#ec5a22" }),
  },
  { // pequeña
    d: "M 1000,980 C 1240,860 1400,640 1500,420 C 1600,200 1380,120 1160,200 C 940,280 1000,520 780,560 C 560,600 420,420 260,500 C 100,580 220,860 440,940 C 640,1010 800,1060 1000,980 Z",
    dur: 72, begin: -9, scale: 0.8, vars: v({ "--body": "#fff4de", "--patch": "#f58a3c" }),
  },
];

// [x, y, radio, giro, tono (0 claro / 1 oscuro), flor (0 = sin flor, si no su tamaño)]
const PADS: [number, number, number, number, number, number][] = [
  [262, 430, 74, 20, 0, 1], [338, 520, 48, -40, 1, 0], [1296, 262, 66, 200, 0, 1], [1424, 366, 44, 120, 1, 0],
  [980, 822, 78, 80, 1, 1.1], [1092, 888, 50, -20, 0, 0], [522, 884, 58, 160, 0, 0], [706, 152, 54, 40, 1, 0.7],
  [1500, 644, 62, 260, 0, 0], [142, 704, 52, 300, 1, 0], [868, 520, 40, 10, 0, 0],
];

const PETALS = [
  { d: "M -120,180 C 300,260 700,110 1100,250 C 1400,350 1700,300 1760,440", dur: 150, begin: -50, s: 0.8, c: "#ffb7c9" },
  { d: "M 1760,760 C 1400,700 1100,820 760,740 C 420,660 100,760 -120,640", dur: 170, begin: -120, s: 0.65, c: "#ffc8d6" },
  { d: "M 400,1100 C 460,820 620,620 560,380 C 520,200 640,60 700,-120", dur: 130, begin: -30, s: 0.7, c: "#ffa9bf" },
  { d: "M -100,900 C 400,860 700,960 1000,880 C 1300,800 1500,860 1700,780", dur: 190, begin: -90, s: 0.6, c: "#ffd2dd" },
  { d: "M 1700,120 C 1300,180 1000,60 700,140 C 400,220 200,120 -100,200", dur: 160, begin: -140, s: 0.55, c: "#ffb7c9" },
];
const RIPPLES: [number, number, number][] = [[430, 250, -3], [1210, 560, -8], [820, 870, -5], [640, 640, -1]];

function Pad({ x, y, r, rot, tone, flower, i }: { x: number; y: number; r: number; rot: number; tone: number; flower: number; i: number }) {
  const a = 0.24, ex = r * Math.cos(a), ey = r * Math.sin(a);
  const d = `M0,0 L${f(ex)},${f(-ey)} A${r},${r} 0 1 0 ${f(ex)},${f(ey)} Z`;
  const veins = Array.from({ length: 9 }, (_, k) => {
    const t = a + ((2 * Math.PI - 2 * a) * (k + 0.5)) / 9;
    return `M0,0 L${f(r * 0.9 * Math.cos(t))},${f(r * 0.9 * Math.sin(t))}`;
  }).join("");
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="pond-bob" style={v({ animationDelay: `-${i * 1.7}s`, animationDuration: `${6 + (i % 4)}s` })}>
        <g transform={`rotate(${rot})`}>
          <path d={d} fill="#0b4a50" opacity=".32" transform="translate(7 10)" />
          <path d={d} fill={tone ? "url(#pPadD)" : "url(#pPadL)"} />
          <path d={veins} stroke="#2f7d3f" strokeWidth="1.4" opacity=".4" fill="none" />
          <ellipse cx={-r * 0.25} cy={-r * 0.3} rx={r * 0.42} ry={r * 0.2} fill="#d9f5a8" opacity=".38" transform="rotate(-25)" />
          <path d={d} fill="none" stroke="#2f7d3f" strokeWidth="1.6" opacity=".45" />
        </g>
        {flower > 0 && (
          <g transform={`scale(${flower})`}>
            <g>{Array.from({ length: 8 }, (_, k) => (
              <ellipse key={k} cy="-20" rx="11" ry="25" fill="url(#pPetal)" stroke="#ef8aa6" strokeWidth=".8" transform={`rotate(${k * 45})`} />
            ))}</g>
            <g>{Array.from({ length: 6 }, (_, k) => (
              <ellipse key={k} cy="-13" rx="8" ry="18" fill="#ffd9e3" stroke="#f4a3ba" strokeWidth=".7" transform={`rotate(${k * 60 + 20})`} />
            ))}</g>
            <circle r="8" fill="#ffd34d" />
            <circle r="4" fill="#f4a31c" />
          </g>
        )}
      </g>
    </g>
  );
}

function Sprite({ x, y, s = 1, i = 0 }: { x: number; y: number; s?: number; i?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="pond-hop" style={v({ animationDelay: `-${i * 1.9}s` })}>
        {Array.from({ length: 16 }, (_, k) => {
          const t = (k / 16) * Math.PI * 2, len = 19 + (k % 3) * 2.2;
          return <line key={k} x1={f(13 * Math.cos(t))} y1={f(13 * Math.sin(t))} x2={f(len * Math.cos(t))} y2={f(len * Math.sin(t))}
            stroke="#24222c" strokeWidth="3.2" strokeLinecap="round" />;
        })}
        <circle r="15.5" fill="#2b2933" />
        <circle cx="-5.6" cy="-2" r="5" fill="#fff" />
        <circle cx="5.6" cy="-2" r="5" fill="#fff" />
        <circle cx="-5" cy="-1.6" r="2" fill="#1a1820" />
        <circle cx="6.2" cy="-1.6" r="2" fill="#1a1820" />
      </g>
    </g>
  );
}

function Rock({ x, y, rx, ry }: { x: number; y: number; rx: number; ry: number }) {
  const tufts = [[-0.55, -0.3], [-0.1, -0.7], [0.4, -0.55], [0.7, -0.1], [-0.8, 0.05]];
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse rx={rx + 26} ry={ry + 20} fill="none" stroke="#e3fbf3" strokeWidth="6" opacity=".35" />
      <ellipse cx="-16" cy="24" rx={rx} ry={ry} fill="#0b4a50" opacity=".38" />
      <ellipse rx={rx} ry={ry} fill="url(#pRock)" />
      <ellipse cx={-rx * 0.25} cy={-ry * 0.28} rx={rx * 0.5} ry={ry * 0.34} fill="#cdd8cb" opacity=".45" />
      <ellipse cx={rx * 0.05} cy={-ry * 0.4} rx={rx * 0.74} ry={ry * 0.46} fill="url(#pMoss)" />
      {tufts.map(([tx, ty], k) => (
        <path key={k} transform={`translate(${f(rx * tx)} ${f(ry * ty)}) scale(${0.9 + (k % 3) * 0.25})`}
          d="M0,0 C-4,-14 -10,-22 -16,-28 M0,0 C0,-16 2,-26 6,-34 M0,0 C4,-12 10,-18 18,-22"
          stroke="#6db451" strokeWidth="3" strokeLinecap="round" fill="none" />
      ))}
    </g>
  );
}

export function Pond() {
  const r = rng(17);
  const orbs = Array.from({ length: 18 }, () => ({
    x: r() * 1600, y: 700 + r() * 380, rise: 240 + r() * 340, d: f(14 + r() * 16), b: f(r() * 20),
    s: 4 + r() * 6, sw: f(16 + r() * 30, 0),
  }));
  return (
    <div className="pond" aria-hidden="true">
      <svg className="pond-svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          {/* Agua y pintura */}
          <radialGradient id="pWater" cx=".42" cy=".38" r=".9">
            <stop offset="0" stopColor="#6fcbbd" />
            <stop offset=".5" stopColor="#34949b" />
            <stop offset="1" stopColor="#1b5f72" />
          </radialGradient>
          <filter id="pBlob" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="38" />
          </filter>
          <filter id="pPaint" filterUnits="userSpaceOnUse" x="-50" y="-50" width="1700" height="1100">
            <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="34" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <radialGradient id="pCloudG">
            <stop offset="0" stopColor="#fff" stopOpacity=".9" />
            <stop offset=".55" stopColor="#f2fbff" stopOpacity=".5" />
            <stop offset="1" stopColor="#e6f6ff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="pRay" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fffbd6" stopOpacity=".7" />
            <stop offset="1" stopColor="#fffbd6" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="pOrb">
            <stop offset="0" stopColor="#fffbd0" stopOpacity="1" />
            <stop offset=".35" stopColor="#d9ff9a" stopOpacity=".7" />
            <stop offset="1" stopColor="#b6ff7a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="pPadL" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#b4e07a" />
            <stop offset="1" stopColor="#5fae4a" />
          </linearGradient>
          <linearGradient id="pPadD" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7fc45f" />
            <stop offset="1" stopColor="#3f8f45" />
          </linearGradient>
          <linearGradient id="pPetal" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ffe3ea" />
            <stop offset="1" stopColor="#ff8fb0" />
          </linearGradient>
          <linearGradient id="pRock" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#97a79d" />
            <stop offset="1" stopColor="#566a66" />
          </linearGradient>
          <radialGradient id="pMoss" cx=".4" cy=".3" r=".8">
            <stop offset="0" stopColor="#a6dc6c" />
            <stop offset="1" stopColor="#4d9444" />
          </radialGradient>
          <path id="pPetalP" d="M0,-14 C10,-12 14,-2 2,14 L0,9 L-2,14 C-14,-2 -10,-12 0,-14 Z" />

          {/* Nube grande (la reflejan las aguas) */}
          <g id="pCloud">
            <circle cx="-190" cy="22" r="92" fill="url(#pCloudG)" />
            <circle cx="-90" cy="-26" r="128" fill="url(#pCloudG)" />
            <circle cx="40" cy="-52" r="150" fill="url(#pCloudG)" />
            <circle cx="170" cy="-12" r="120" fill="url(#pCloudG)" />
            <circle cx="260" cy="28" r="88" fill="url(#pCloudG)" />
            <circle cx="0" cy="26" r="140" fill="url(#pCloudG)" />
          </g>

          {/* Carpa: cola que ondea, aletas, cuerpo, manchas y ojos */}
          <path id="kBody" d="M132,0 C124,-22 80,-36 24,-34 C -30,-32 -82,-18 -112,-5 L-118,-4 L-118,4 L-112,5 C -82,18 -30,32 24,34 C 80,36 124,22 132,0 Z" />
          <path id="kTail" d="M0,0 C -22,-10 -52,-34 -76,-38 C -66,-16 -68,-6 -58,0 C -68,6 -66,16 -76,38 C -52,34 -22,10 0,0 Z" />
          <path id="kFin" d="M0,0 C -6,10 -22,28 -34,44 C -14,40 4,24 10,0 Z" />
          <clipPath id="kClip"><use href="#kBody" /></clipPath>
          <g id="koi">
            <g style={{ fill: "var(--body)" }}>
              <g transform="translate(-116 0)">
                <animateTransform attributeName="transform" type="rotate" additive="sum"
                  values="-13 0 0;13 0 0;-13 0 0" keyTimes="0;.5;1" calcMode="spline"
                  keySplines=".45 0 .55 1;.45 0 .55 1" dur="1.6s" repeatCount="indefinite" />
                <use href="#kTail" opacity=".9" />
              </g>
              <use href="#kFin" transform="translate(58 26)" opacity=".9" />
              <use href="#kFin" transform="translate(58 -26) scale(1 -1)" opacity=".9" />
              <use href="#kBody" />
            </g>
            <g clipPath="url(#kClip)" style={{ fill: "var(--patch)" }}>
              <path d="M-6,-40 C20,-44 54,-30 48,-6 C42,14 6,18 -12,6 C -26,-4 -26,-34 -6,-40 Z" />
              <path d="M-84,-24 C -64,-26 -48,-12 -56,2 C -66,14 -92,6 -96,-6 C -98,-16 -92,-22 -84,-24 Z" />
              <path d="M96,-30 C118,-24 128,-6 118,8 C108,20 90,12 86,-4 C 83,-16 86,-28 96,-30 Z" />
            </g>
            <circle cx="106" cy="-15" r="2.8" fill="#14323a" />
            <circle cx="106" cy="15" r="2.8" fill="#14323a" />
          </g>
          <g id="koiShadow" style={{ fill: "#0b4a50", opacity: 0.3 }}>
            <use href="#kTail" transform="translate(-116 0)" />
            <use href="#kFin" transform="translate(58 26)" />
            <use href="#kFin" transform="translate(58 -26) scale(1 -1)" />
            <use href="#kBody" />
          </g>
        </defs>

        {/* Agua: base y manchas de acuarela con borde irregular */}
        <rect width="1600" height="1000" fill="url(#pWater)" />
        <g filter="url(#pPaint)">
          <g filter="url(#pBlob)">
            <ellipse cx="300" cy="260" rx="360" ry="200" fill="#9be6cf" opacity=".5" />
            <ellipse cx="1180" cy="700" rx="420" ry="220" fill="#1d6f80" opacity=".5" />
            <ellipse cx="760" cy="880" rx="360" ry="160" fill="#b8eaa0" opacity=".28" />
            <ellipse cx="1380" cy="180" rx="300" ry="170" fill="#8fdcd0" opacity=".4" />
            <ellipse cx="620" cy="520" rx="300" ry="150" fill="#2a7f8c" opacity=".35" />
          </g>
        </g>

        {/* Todo lo que se mueve (se oculta con «reducir movimiento») */}
        <g className="swim">
          {/* Carpas bajo el agua */}
          {FISH.map((fi, i) => (
            <g key={i}>
              <g transform="translate(-40 56)">
                <g>
                  <animateMotion path={fi.d} dur={`${fi.dur}s`} begin={`${fi.begin}s`} repeatCount="indefinite" rotate="auto" />
                  <g transform={`scale(${fi.scale})`}><use href="#koiShadow" /></g>
                </g>
              </g>
              <g opacity=".95">
                <animateMotion path={fi.d} dur={`${fi.dur}s`} begin={`${fi.begin}s`} repeatCount="indefinite" rotate="auto" />
                <g transform={`scale(${fi.scale})`}><use href="#koi" style={fi.vars} /></g>
              </g>
            </g>
          ))}

          {/* Reflejo de nubes en la superficie */}
          {[
            { y: 250, s: 1.25, d: 300, b: -80 },
            { y: 640, s: 1.55, d: 380, b: -230 },
            { y: 880, s: 1.0, d: 340, b: -40 },
          ].map((c, i) => (
            <g key={i} opacity=".55">
              <animateTransform attributeName="transform" type="translate" values="-700 0;2300 0" dur={`${c.d}s`} begin={`${c.b}s`} repeatCount="indefinite" />
              <g transform={`translate(0 ${c.y}) scale(${c.s})`}><use href="#pCloud" /></g>
            </g>
          ))}

          {RIPPLES.map(([cx, cy, b], i) => [0, 1.2].map((off, j) => (
            <circle key={`${i}-${j}`} cx={cx} cy={cy} r="0" fill="none" stroke="#e8fffa" strokeWidth="2.5">
              <animate attributeName="r" from="0" to="140" dur="10s" begin={`${b + off}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;.5;0" keyTimes="0;.15;1" dur="10s" begin={`${b + off}s`} repeatCount="indefinite" />
            </circle>
          )))}
        </g>

        {/* Nenúfares y lotos */}
        {PADS.map(([x, y, rad, rot, tone, fl], i) => (
          <Pad key={i} x={x} y={y} r={rad} rot={rot} tone={tone} flower={fl} i={i} />
        ))}

        {/* Rocas con musgo y bolitas de polvo */}
        <Rock x={120} y={190} rx={200} ry={150} />
        <Rock x={1520} y={940} rx={250} ry={170} />
        <Rock x={40} y={1000} rx={170} ry={110} />
        <Sprite x={150} y={72} s={1.25} i={0} />
        <Sprite x={78} y={116} s={0.9} i={2} />
        <Sprite x={1470} y={832} s={1.35} i={1} />
        <Sprite x={1560} y={868} s={0.85} i={3} />

        {/* Pétalos de cerezo a la deriva y lucecitas que suben */}
        <g className="swim">
          {PETALS.map((l, i) => (
            <g key={i}>
              <g transform="translate(-14 18)">
                <g>
                  <animateMotion path={l.d} dur={`${l.dur}s`} begin={`${l.begin}s`} repeatCount="indefinite" />
                  <g transform={`scale(${l.s * 1.6})`}><use href="#pPetalP" style={{ fill: "#0b4a50", opacity: 0.25 }} /></g>
                </g>
              </g>
              <g>
                <animateMotion path={l.d} dur={`${l.dur}s`} begin={`${l.begin}s`} repeatCount="indefinite" />
                <g transform={`scale(${l.s * 1.6})`}>
                  <g>
                    <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="60s" repeatCount="indefinite" />
                    <use href="#pPetalP" style={{ fill: l.c }} />
                  </g>
                </g>
              </g>
            </g>
          ))}

          {orbs.map((o, i) => (
            <circle key={i} cx={o.x} cy={o.y} r={o.s * 3} fill="url(#pOrb)" opacity="0">
              <animate attributeName="cy" from={f(o.y)} to={f(o.y - o.rise)} dur={`${o.d}s`} begin={`-${o.b}s`} repeatCount="indefinite" />
              <animate attributeName="cx" values={`${f(o.x)};${f(o.x + Number(o.sw))};${f(o.x - Number(o.sw) * 0.6)};${f(o.x)}`} dur={`${o.d}s`} begin={`-${o.b}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;.9;.9;0" keyTimes="0;.2;.8;1" dur={`${o.d}s`} begin={`-${o.b}s`} repeatCount="indefinite" />
            </circle>
          ))}

          {/* Rayos de sol entre las ramas */}
          {[
            "M-60,-40 L260,-40 L760,1040 L360,1040 Z",
            "M300,-40 L520,-40 L1120,1040 L840,1040 Z",
            "M640,-40 L760,-40 L1380,1040 L1200,1040 Z",
          ].map((d, i) => (
            <path key={i} d={d} fill="url(#pRay)" opacity=".1">
              <animate attributeName="opacity" values=".05;.16;.05" dur={`${12 + i * 5}s`} begin={`-${i * 4}s`} repeatCount="indefinite" />
            </path>
          ))}
        </g>
      </svg>

      <div className="pond-caustic a" />
      <div className="pond-caustic b" />
      <div className="pond-paper" />
      <div className="pond-vignette" />
    </div>
  );
}
