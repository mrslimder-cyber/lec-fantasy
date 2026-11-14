/* Fondo vivo del estilo "Montecarlo": pista de tierra batida vista desde arriba con un peloteo,
   sombras de nubes que cruzan y una grada de espectadores con sombrero abajo.
   Server component, determinista (sin Math.random) para que no haya desajustes de hidratación. */

const HAT = ["#e9ddc2", "#25395e", "#2b6b52", "#c8571e", "#7b2d3a", "#7fb0d8", "#d9c18a", "#8fa3b8", "#1a1612", "#b79a6a"];
const SHIRT = ["#d9cdb0", "#2f4a73", "#38785e", "#b8502a", "#8a3a48", "#9ec3e0", "#c9b58a", "#6f8296", "#2a2420"];
const HAIR = ["#2a1a12", "#4a3020", "#8a8d92", "#b8793a", "#161210"];

function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

function Crowd() {
  const r = rng(21);
  const rows = [
    { y: 112, step: 34, rad: 13, off: 0, op: 0.85 },
    { y: 148, step: 42, rad: 18, off: 21, op: 1 },
  ];
  return (
    <svg className="court-crowd" viewBox="0 0 1600 160" preserveAspectRatio="xMidYMax slice">
      {rows.map((row, ri) =>
        Array.from({ length: Math.ceil(1700 / row.step) }, (_, i) => {
          const x = row.off + i * row.step - 30 + (r() - 0.5) * 10;
          const hat = r() < 0.6;
          const hatC = HAT[Math.floor(r() * HAT.length)];
          const shirt = SHIRT[Math.floor(r() * SHIRT.length)];
          const hair = HAIR[Math.floor(r() * HAIR.length)];
          const dur = (4 + r() * 3).toFixed(2);
          const del = (r() * 6).toFixed(2);
          const k = row.rad;
          return (
            <g key={`${ri}-${i}`} transform={`translate(${x.toFixed(1)} ${row.y})`} opacity={row.op}>
              <g className="bob" style={{ animationDuration: `${dur}s`, animationDelay: `-${del}s` }}>
                <ellipse cy={k * 1.25} rx={k * 1.55} ry={k * 1.1} fill={shirt} />
                <circle r={k} fill={hair} />
                {hat && (
                  <>
                    <ellipse cy={-k * 0.15} rx={k * 1.4} ry={k * 0.62} fill={hatC} />
                    <circle cy={-k * 0.35} r={k * 0.8} fill={hatC} />
                  </>
                )}
              </g>
            </g>
          );
        })
      )}
    </svg>
  );
}

function Player({ shirt, flip }: { shirt: string; flip?: boolean }) {
  return (
    <g transform={flip ? "scale(-1 1)" : undefined}>
      <ellipse cx="6" cy="8" rx="9" ry="17" fill="#1a0b04" opacity=".25" />
      <ellipse rx="8" ry="17" fill={shirt} />
      <circle r="7" fill="#3a2418" />
      <line x1="4" y1="10" x2="26" y2="16" stroke="#3a2418" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="33" cy="17" rx="8" ry="11" fill="none" stroke="#f1e7d0" strokeWidth="2.5" />
    </g>
  );
}

const BOARD = "LEC FANTASY · WINTER 2027 · LEC FANTASY · WINTER 2027 · LEC FANTASY · WINTER 2027";
const boardFont = { fontFamily: "var(--font-jost), sans-serif", fontWeight: 500 } as const;

export function Court() {
  return (
    <div className="court" aria-hidden="true">
      <div className="court-clay" />

      <svg className="court-svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        {/* Vallas verdes con rotulación */}
        <g>
          <rect x="40" y="96" width="1520" height="46" fill="#173f31" />
          <rect x="40" y="140" width="1520" height="3" fill="#c9a24d" />
          <text x="800" y="127" textAnchor="middle" fill="#f1e7d0" fontSize="20" letterSpacing="9" style={boardFont}>{BOARD}</text>
          <rect x="40" y="858" width="1520" height="46" fill="#173f31" />
          <rect x="40" y="858" width="1520" height="3" fill="#c9a24d" />
          <text x="800" y="889" textAnchor="middle" fill="#f1e7d0" fontSize="20" letterSpacing="9" style={boardFont}>{BOARD}</text>
        </g>

        {/* Líneas de la pista */}
        <g stroke="#f1e7d0" strokeWidth="5" fill="none" opacity=".85" strokeLinecap="square">
          <rect x="87" y="171" width="1426" height="658" />
          <line x1="87" y1="253" x2="1513" y2="253" />
          <line x1="87" y1="747" x2="1513" y2="747" />
          <line x1="416" y1="253" x2="416" y2="747" />
          <line x1="1184" y1="253" x2="1184" y2="747" />
          <line x1="416" y1="500" x2="1184" y2="500" />
          <line x1="87" y1="500" x2="106" y2="500" />
          <line x1="1494" y1="500" x2="1513" y2="500" />
        </g>

        {/* Red */}
        <rect x="808" y="156" width="26" height="688" fill="#000" opacity=".16" />
        <rect x="794" y="152" width="12" height="696" fill="#1a1410" opacity=".5" />
        <rect x="797" y="152" width="6" height="696" fill="#f1e7d0" opacity=".9" />
        <circle cx="800" cy="150" r="9" fill="#c9a24d" />
        <circle cx="800" cy="850" r="9" fill="#c9a24d" />

        {/* Peloteo (se oculta con «reducir movimiento») */}
        <g className="swim">
          <g transform="translate(118 0)">
            <g>
              <animateTransform attributeName="transform" type="translate" dur="15.6s" repeatCount="indefinite"
                values="0 430;0 480;0 520;0 510;0 580;0 500;0 430" keyTimes="0;.1667;.3333;.5;.6667;.8333;1" />
              <Player shirt="#f1e7d0" />
            </g>
          </g>
          <g transform="translate(1482 0)">
            <g>
              <animateTransform attributeName="transform" type="translate" dur="15.6s" repeatCount="indefinite"
                values="0 500;0 570;0 500;0 430;0 500;0 500;0 500" keyTimes="0;.1667;.3333;.5;.6667;.8333;1" />
              <Player shirt="#c4372b" flip />
            </g>
          </g>

          <g>
            <animateMotion dur="15.6s" repeatCount="indefinite" calcMode="linear"
              path="M140,430 L1460,570 L150,520 L1450,430 L140,580 L1460,500 L140,430"
              keyPoints="0;.1679;.3338;.4987;.6654;.8328;1" keyTimes="0;.1667;.3333;.5;.6667;.8333;1" />
            <ellipse rx="9" ry="4" fill="#1a0b04" opacity=".3">
              <animate attributeName="rx" values="9;6;7;9;8;9" keyTimes="0;.35;.5;.72;.9;1" dur="2.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values=".34;.16;.22;.38;.3;.34" keyTimes="0;.35;.5;.72;.9;1" dur="2.6s" repeatCount="indefinite" />
            </ellipse>
            <circle r="8" fill="#d9e84c" stroke="#f1e7d0" strokeWidth="1.2">
              <animate attributeName="cy" values="-30;-95;-58;0;-46;-30" keyTimes="0;.35;.5;.72;.9;1" dur="2.6s" repeatCount="indefinite" />
            </circle>
          </g>
        </g>
      </svg>

      <div className="court-cloudshadow a" />
      <div className="court-cloudshadow b" />
      <Crowd />
      <div className="court-vignette" />
    </div>
  );
}
