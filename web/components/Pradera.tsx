/* Fondo del estilo "Pradera" (ilustración de nubes enormes sobre una pradera).
   Estética: cel-shading plano, contornos de tinta azul pizarra muy finos sobre los lóbulos de las nubes,
   sombras planas azul grisáceo, hierba en bandas con trazos peinados por el viento, árboles diminutos
   en el horizonte y un hueco de cielo azul arriba a la derecha.
   Animación: SOLO las nubes de atrás avanzan despacio (tres capas con distinta velocidad) y su sombra
   cruza la pradera. Cada capa es un div que se mueve con transform (barato, sin repintar el SVG).
   Determinista (sin Math.random) para que no haya desajustes de hidratación. */

function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}
const R = (n: number) => Math.round(n);
const INK = "#3b4e64";

type Tone = { pale: string[]; shade: string };
type B = { x: number; y: number; rx: number; ry: number; k: number };

// Arco de elipse entre dos ángulos (0° = derecha, -90° = arriba).
const arc = (x: number, y: number, rx: number, ry: number, a0: number, a1: number) => {
  const p = (a: number) => `${R(x + rx * Math.cos((a * Math.PI) / 180))},${R(y + ry * Math.sin((a * Math.PI) / 180))}`;
  return `M${p(a0)}A${R(rx)},${R(ry)} 0 0 1 ${p(a1)}`;
};

/* La capa mide 1600 y se repite: los lóbulos que se salen por la derecha se copian por la izquierda. */
function wrap(list: B[]): B[] {
  const extra = list.filter((b) => b.x + b.rx > 1600).map((b) => ({ ...b, x: b.x - 1600 }));
  return [...list, ...extra].sort((a, b) => a.y - b.y);
}

/* ---------- Nubes ---------- */
const T1: Tone = { pale: ["#d6dfe4", "#cbd6de", "#dfe6ea"], shade: "#a9b9c9" };   // masa lejana, más gris y con parches
const T2: Tone = { pale: ["#e6edf0", "#dde6eb", "#eef3f4"], shade: "#bfcdd9" };   // nubes cercanas al horizonte, más claras
const T3: Tone = { pale: ["#eaf0f2", "#e2eaee"], shade: "#b6c5d2" };               // estratos largos de arriba

// Borde superior de la masa: periódico; llega arriba a la izquierda y deja hueco de cielo a la derecha.
const top1 = (x: number) => 150 - 150 * Math.cos((2 * Math.PI * (x - 300)) / 1600);
const BASE1 = (() => {
  let d = "";
  for (let x = 0; x <= 1600; x += 100) d += `${x ? "L" : "M"}${x},${R(top1(x) + 150)}`;
  return d + "L1600,720L0,720Z";
})();
// Lóbulos anchos y bajos apilados en tiers, como las olas de nube de la ilustración.
const bank = (seed: number, n: number, top: (x: number) => number, depth: number, rMin: number, rMax: number): B[] => {
  const r = rng(seed), out: B[] = [];
  for (let i = 0; i < n; i++) {
    const x = r() * 1600, rad = rMin + r() * (rMax - rMin);
    const rx = rad * (1.15 + r() * 0.55), ry = rad * (0.68 + r() * 0.16);
    out.push({ x, y: top(x) + ry * 0.8 + r() * depth, rx, ry, k: Math.floor(r() * 3) });
  }
  return out;
};
const BANK1 = wrap([...bank(5, 24, top1, 330, 120, 250), ...bank(9, 30, top1, 90, 50, 95)]);
const BANK2 = wrap([...bank(41, 26, () => 400, 250, 80, 150), ...bank(43, 20, () => 380, 60, 40, 70)]);
const STREAKS = [
  { x: 700, y: 88, len: 1000, th: 64 },
  { x: 1330, y: 230, len: 540, th: 40 },
  { x: 160, y: 170, len: 620, th: 46 },
];

function Billow({ b, t }: { b: B; t: Tone }) {
  const { x, y, rx, ry } = b;
  // Media luna de sombra pegada al borde inferior del lóbulo (no un aro completo).
  const moon = `M${R(x - rx)},${R(y)}A${R(rx)},${R(ry)} 0 0 0 ${R(x + rx)},${R(y)}A${R(rx)},${R(ry * 0.5)} 0 0 1 ${R(x - rx)},${R(y)}Z`;
  return (
    <g>
      <ellipse cx={R(x)} cy={R(y)} rx={R(rx)} ry={R(ry)} fill={t.pale[b.k % t.pale.length]} />
      <path d={moon} fill={t.shade} opacity=".85" />
      <path d={arc(x, y, rx, ry, -172, -24)} fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" opacity=".5" />
      <path d={arc(x - rx * 0.2, y + ry * 0.1, rx * 0.55, ry * 0.55, -160, -50)} fill="none" stroke={INK} strokeWidth="1.3" strokeLinecap="round" opacity=".28" />
    </g>
  );
}

function Streak({ x, y, len, th, t }: { x: number; y: number; len: number; th: number; t: Tone }) {
  const n = Math.max(4, Math.round(len / 70)), step = len / n;
  const pts = Array.from({ length: n }, (_, i) => {
    const cx = x - len / 2 + (i + 0.5) * step;
    return { cx, ry: th * (0.18 + 0.62 * Math.sin((Math.PI * (i + 0.5)) / n) * (0.8 + 0.2 * Math.sin(i * 1.9))) };
  });
  // Contorno superior continuo (curva suave por los puntos más altos).
  const top = pts.map((p) => [p.cx, y - p.ry * 0.95]);
  let d = `M${R(x - len / 2)},${R(y)}L${R(top[0][0])},${R(top[0][1])}`;
  for (let i = 1; i < top.length; i++)
    d += `Q${R(top[i - 1][0])},${R(top[i - 1][1])} ${R((top[i - 1][0] + top[i][0]) / 2)},${R((top[i - 1][1] + top[i][1]) / 2)}`;
  d += `L${R(x + len / 2)},${R(y)}`;
  return (
    <g>
      <ellipse cx={R(x)} cy={R(y + th * 0.22)} rx={R(len / 2)} ry={R(th * 0.26)} fill={t.shade} />
      {pts.map((p, i) => (
        <ellipse key={i} cx={R(p.cx)} cy={R(y)} rx={R(step * 1.05)} ry={R(p.ry)} fill={t.pale[i % t.pale.length]} />
      ))}
      <path d={d} fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity=".5" />
    </g>
  );
}

/* Una capa = SVG de 3200 de ancho con el mismo dibujo dos veces: al desplazarla la mitad, vuelve al principio sin salto. */
function Layer({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 3200 1000">
      <defs><g id={id}>{children}</g></defs>
      <use href={`#${id}`} />
      <use href={`#${id}`} x="1600" />
    </svg>
  );
}

/* ---------- Pradera ---------- */
const TREES: [number, number, number][] = [
  [1175, 566, 1], [1212, 562, 0.8], [1262, 572, 0.7], [1440, 552, 0.9], [236, 632, 0.8], [286, 634, 0.7], [330, 630, 0.55],
];
const SWOOSH: [number, number, number, number][] = [
  [400, 760, 420, 28], [1100, 720, 500, 24], [700, 880, 600, 36], [1300, 900, 420, 30], [200, 950, 380, 30],
];
const COMB = Array.from({ length: 16 }, (_, k) => {
  const r = rng(200 + k), y0 = 670 + k * 21;
  return `M-20,${y0}C${R(400 + r() * 100)},${R(y0 - 22 + r() * 14)} ${R(900 + r() * 100)},${R(y0 + 12 + r() * 10)} 1620,${R(y0 - 38 - k * 0.6)}`;
});
// Vetas largas de hierba peinada hacia la derecha; más largas y gruesas cuanto más cerca.
const GRASS = (() => {
  const r = rng(77);
  const ds: string[][] = [["", "", ""], ["", "", ""]];
  for (let i = 0; i < 520; i++) {
    const y = 610 + Math.pow(r(), 0.7) * 390, x = r() * 1700 - 100;
    if (y < 664 - (100 * x) / 1600) continue;
    const s = 0.5 + ((y - 600) / 400) * 1.3, len = (70 + r() * 150) * s;
    ds[y > 800 ? 1 : 0][Math.floor(r() * 3)] +=
      `M${R(x)},${R(y)}q${R(len * 0.5)},${-R(s * (4 + r() * 6))} ${R(len)},${-R(s * (1 + r() * 5))}`;
  }
  return ds;
})();
const GRASS_STYLE = [{ c: "#2f7d2e", o: 0.4 }, { c: "#a6d974", o: 0.6 }, { c: "#4c9f39", o: 0.45 }];

export function Pradera() {
  return (
    <div className="pradera" aria-hidden="true">
      <div className="pradera-stage">
        {/* Cielo */}
        <svg className="pradera-fill" viewBox="0 0 1600 1000">
          <defs>
            <linearGradient id="prSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#5a93d0" />
              <stop offset=".45" stopColor="#6ea4da" />
              <stop offset=".62" stopColor="#cddde8" />
            </linearGradient>
          </defs>
          <rect width="1600" height="1000" fill="url(#prSky)" />
        </svg>

        {/* Nubes de atrás: tres capas a distinta velocidad */}
        <div className="pradera-lyr l1">
          <Layer id="prc1">
            <path d={BASE1} fill={T1.pale[0]} />
            {BANK1.map((b, i) => <Billow key={i} b={b} t={T1} />)}
            <rect x="0" y="600" width="1600" height="200" fill={T1.pale[0]} />
          </Layer>
        </div>
        <div className="pradera-lyr l3">
          <Layer id="prc3">
            {STREAKS.map((s, i) => <Streak key={i} {...s} t={T3} />)}
          </Layer>
        </div>
        <div className="pradera-lyr l2">
          <Layer id="prc2">
            {BANK2.map((b, i) => <Billow key={i} b={b} t={T2} />)}
            <rect x="0" y="650" width="1600" height="200" fill={T2.pale[0]} />
          </Layer>
        </div>

        {/* Pradera */}
        <svg className="pradera-fill" viewBox="0 0 1600 1000">
          <path d="M0,640C200,622 380,632 560,614C760,598 900,590 1100,574C1300,562 1450,570 1600,540L1600,1000L0,1000Z" fill="#7dbc5a" />
          <path d="M0,640C200,622 380,632 560,614C760,598 900,590 1100,574C1300,562 1450,570 1600,540" fill="none" stroke={INK} strokeWidth="1.6" opacity=".45" />
          {TREES.map(([x, y, s], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
              <ellipse cx="0" cy="-10" rx="22" ry="13" fill="#2f6f33" />
              <ellipse cx="-4" cy="-17" rx="14" ry="8" fill="#4d9340" />
            </g>
          ))}
          <path d="M0,690C260,656 520,664 760,650C1040,634 1300,640 1600,596L1600,1000L0,1000Z" fill="#66b04a" />
          <path d="M0,690C260,656 520,664 760,650C1040,634 1300,640 1600,596" fill="none" stroke={INK} strokeWidth="1.6" opacity=".35" />
          <path d="M0,770C300,728 650,740 980,716C1250,696 1450,688 1600,666L1600,1000L0,1000Z" fill="#5aa941" />
          <path d="M0,770C300,728 650,740 980,716C1250,696 1450,688 1600,666" fill="none" stroke={INK} strokeWidth="1.6" opacity=".3" />

          {SWOOSH.map(([cx, cy, rx, ry], i) => (
            <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill="#b5e08a" opacity=".28" transform={`rotate(-7 ${cx} ${cy})`} />
          ))}
          {COMB.map((d, i) => <path key={i} d={d} fill="none" stroke="#3f9234" strokeWidth="2" opacity=".3" />)}

          {/* Calle de tractor: banda clara con su pliegue oscuro */}
          <path d="M0,850C400,800 900,800 1600,720L1600,770C880,850 380,860 0,930Z" fill="#86cb5e" />
          <path d="M0,930C380,860 880,850 1600,770L1600,782C900,874 400,904 0,952Z" fill="#2d7a2d" opacity=".85" />
          <path d="M240,1000C700,952 1200,930 1600,884L1600,1000Z" fill="#8fd065" />
          <path d="M240,1000C700,952 1200,930 1600,884" fill="none" stroke="#2d7a2d" strokeWidth="5" />

          {GRASS.map((cats, depth) => cats.map((d, k) => (
            <path key={`${depth}-${k}`} d={d} fill="none" stroke={GRASS_STYLE[k].c} opacity={GRASS_STYLE[k].o}
              strokeWidth={depth ? 2.6 : 1.4} strokeLinecap="round" />
          )))}
        </svg>

        {/* Sombra de las nubes cruzando la pradera */}
        <div className="pradera-cshade" />
      </div>
      <div className="pradera-shade" />
    </div>
  );
}
