import type { CSSProperties } from "react";

/* Fondo vivo: estanque de azulejos con carpas koi nadando, hojas de arce a la deriva y ondas.
   Todo es SVG/CSS (sin imágenes). Las carpas miran hacia +x y siguen un camino con rotate="auto".
   Para cambiar colores, velocidad o rutas, edita FISH / LEAVES más abajo. */

const v = (o: Record<string, string>) => o as unknown as CSSProperties;

const FISH = [
  { // grande, crema con manchas naranjas
    d: "M -260,640 C -60,420 260,300 520,360 C 820,430 900,640 1180,600 C 1460,560 1560,300 1880,330 C 2000,560 1760,860 1420,880 C 1040,900 860,720 560,760 C 300,795 40,900 -160,820 C -330,750 -330,700 -260,640 Z",
    dur: 84, begin: -22, scale: 1.3, vars: v({ "--body": "#f4ead6", "--patch": "#ee5524" }),
  },
  { // mediana, más naranja, en sentido contrario
    d: "M 1900,200 C 1650,380 1380,260 1130,330 C 880,400 760,150 480,220 C 200,290 160,560 -120,520 C -400,480 -340,860 -40,900 C 260,940 520,700 800,780 C 1080,860 1300,980 1600,900 C 1900,820 2150,260 1900,200 Z",
    dur: 104, begin: -61, scale: 1.05, vars: v({ "--body": "#f1e3c8", "--patch": "#e8481f" }),
  },
  { // pequeña
    d: "M 1000,980 C 1240,860 1400,640 1500,420 C 1600,200 1380,120 1160,200 C 940,280 1000,520 780,560 C 560,600 420,420 260,500 C 100,580 220,860 440,940 C 640,1010 800,1060 1000,980 Z",
    dur: 66, begin: -9, scale: 0.8, vars: v({ "--body": "#f6eddb", "--patch": "#f0662b" }),
  },
];

const LEAVES = [
  { d: "M -120,180 C 300,260 700,110 1100,250 C 1400,350 1700,300 1760,440", dur: 150, begin: -50, s: 0.5, c: "#ee5524" },
  { d: "M 1760,760 C 1400,700 1100,820 760,740 C 420,660 100,760 -120,640", dur: 170, begin: -120, s: 0.4, c: "#d2421a" },
  { d: "M 400,1100 C 460,820 620,620 560,380 C 520,200 640,60 700,-120", dur: 130, begin: -30, s: 0.45, c: "#f2702d" },
];

const RIPPLES: [number, number, number][] = [[430, 250, -3], [1210, 560, -8], [820, 870, -5]];

function Leaf({ x, y, r, s, c }: { x: number; y: number; r: number; s: number; c: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <use href="#maple" transform={`translate(-14 18) rotate(${r}) scale(${s})`} style={{ fill: "#0b1f52", opacity: 0.28 }} />
      <use href="#maple" transform={`rotate(${r}) scale(${s})`} style={{ fill: c }} />
    </g>
  );
}

export function Pond() {
  return (
    <div className="pond" aria-hidden="true">
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <filter id="pondWobble" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.0045 0.006" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="26" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      <div className="pond-tiles" />
      <div className="pond-caustic a" />
      <div className="pond-caustic b" />

      <svg className="pond-svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <path id="kBody" d="M132,0 C124,-22 80,-36 24,-34 C -30,-32 -82,-18 -112,-5 L-118,-4 L-118,4 L-112,5 C -82,18 -30,32 24,34 C 80,36 124,22 132,0 Z" />
          <path id="kTail" d="M0,0 C -22,-10 -52,-34 -76,-38 C -66,-16 -68,-6 -58,0 C -68,6 -66,16 -76,38 C -52,34 -22,10 0,0 Z" />
          <path id="kFin" d="M0,0 C -6,10 -22,28 -34,44 C -14,40 4,24 10,0 Z" />
          <clipPath id="kClip"><use href="#kBody" /></clipPath>
          <path id="maple" d="M0,-50 L9,-32 L22,-38 L19,-16 L42,-22 L32,-3 L50,5 L26,16 L30,30 L8,24 L2,36 L2,58 L-2,58 L-2,36 L-8,24 L-30,30 L-26,16 L-50,5 L-32,-3 L-42,-22 L-19,-16 L-22,-38 L-9,-32 Z" strokeLinejoin="round" />
          <radialGradient id="stone" cx="40%" cy="35%" r="75%">
            <stop offset="0" stopColor="#f2e8d0" />
            <stop offset="1" stopColor="#cdbd9a" />
          </radialGradient>
          <pattern id="dots" width="9" height="9" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.1" fill="#2f7d78" opacity=".35" />
            <circle cx="6.5" cy="6" r=".9" fill="#2f7d78" opacity=".25" />
          </pattern>

          {/* Carpa: cola que ondea, aletas, cuerpo, manchas y ojos */}
          <g id="koi">
            <g style={{ fill: "var(--body)" }}>
              <g transform="translate(-116 0)">
                <animateTransform attributeName="transform" type="rotate" additive="sum"
                  values="-13 0 0;13 0 0;-13 0 0" keyTimes="0;.5;1" calcMode="spline"
                  keySplines=".45 0 .55 1;.45 0 .55 1" dur="1.5s" repeatCount="indefinite" />
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
            <circle cx="106" cy="-15" r="2.8" fill="#14234a" />
            <circle cx="106" cy="15" r="2.8" fill="#14234a" />
          </g>
          <g id="koiShadow" style={{ fill: "#0b1f52", opacity: 0.34 }}>
            <use href="#kTail" transform="translate(-116 0)" />
            <use href="#kFin" transform="translate(58 26)" />
            <use href="#kFin" transform="translate(58 -26) scale(1 -1)" />
            <use href="#kBody" />
          </g>
        </defs>

        {/* Piedras y hojas de las esquinas */}
        <g>
          <ellipse cx="120" cy="200" rx="190" ry="150" fill="#2f7d78" opacity=".55" transform="translate(-26 30)" />
          <ellipse cx="120" cy="200" rx="190" ry="150" fill="url(#stone)" />
          <ellipse cx="120" cy="200" rx="190" ry="150" fill="url(#dots)" />
          <Leaf x={70} y={50} r={-20} s={1.7} c="#ee5524" />
          <Leaf x={210} y={130} r={25} s={1.3} c="#d2421a" />
          <Leaf x={30} y={210} r={70} s={1.5} c="#f2702d" />
          <Leaf x={290} y={20} r={-50} s={1.1} c="#e8481f" />
        </g>
        <g>
          <ellipse cx="1520" cy="940" rx="250" ry="170" fill="#2f7d78" opacity=".55" transform="translate(-30 -22)" />
          <ellipse cx="1520" cy="940" rx="250" ry="170" fill="url(#stone)" />
          <ellipse cx="1520" cy="940" rx="250" ry="170" fill="url(#dots)" />
          <Leaf x={1560} y={850} r={30} s={1.6} c="#ee5524" />
          <Leaf x={1420} y={920} r={-35} s={1.2} c="#d2421a" />
          <Leaf x={1590} y={960} r={110} s={1.4} c="#f2702d" />
        </g>
        <g>
          <ellipse cx="40" cy="1000" rx="170" ry="110" fill="#2f7d78" opacity=".5" transform="translate(24 -18)" />
          <ellipse cx="40" cy="1000" rx="170" ry="110" fill="url(#stone)" />
          <ellipse cx="40" cy="1000" rx="170" ry="110" fill="url(#dots)" />
        </g>

        {/* Todo lo que se mueve (se oculta con «reducir movimiento») */}
        <g className="swim">
          {RIPPLES.map(([cx, cy, b], i) => [0, 1.1].map((off, j) => (
            <circle key={`${i}-${j}`} cx={cx} cy={cy} r="0" fill="none" stroke="#d3e4ff" strokeWidth="2.5">
              <animate attributeName="r" from="0" to="130" dur="9s" begin={`${b + off}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;.45;0" keyTimes="0;.15;1" dur="9s" begin={`${b + off}s`} repeatCount="indefinite" />
            </circle>
          )))}

          {LEAVES.map((l, i) => (
            <g key={i}>
              <g transform="translate(-16 20)">
                <g>
                  <animateMotion path={l.d} dur={`${l.dur}s`} begin={`${l.begin}s`} repeatCount="indefinite" />
                  <g transform={`scale(${l.s})`}><use href="#maple" style={{ fill: "#0b1f52", opacity: 0.28 }} /></g>
                </g>
              </g>
              <g>
                <animateMotion path={l.d} dur={`${l.dur}s`} begin={`${l.begin}s`} repeatCount="indefinite" />
                <g transform={`scale(${l.s})`}>
                  <g>
                    <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="70s" repeatCount="indefinite" />
                    <use href="#maple" style={{ fill: l.c }} />
                  </g>
                </g>
              </g>
            </g>
          ))}

          {FISH.map((f, i) => (
            <g key={i}>
              <g transform="translate(-40 50)">
                <g>
                  <animateMotion path={f.d} dur={`${f.dur}s`} begin={`${f.begin}s`} repeatCount="indefinite" rotate="auto" />
                  <g transform={`scale(${f.scale})`}><use href="#koiShadow" /></g>
                </g>
              </g>
              <g>
                <animateMotion path={f.d} dur={`${f.dur}s`} begin={`${f.begin}s`} repeatCount="indefinite" rotate="auto" />
                <g transform={`scale(${f.scale})`}><use href="#koi" style={f.vars} /></g>
              </g>
            </g>
          ))}
        </g>
      </svg>

      <div className="pond-vignette" />
    </div>
  );
}
