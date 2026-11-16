import type { CSSProperties } from "react";

/* Fondos animados SOLO de la portada (crear / unirme / mis ligas) para los temas Ventana, Río y Bahía.
   Cada tema tiene el suyo; el CSS (pintados.css) muestra únicamente el del tema activo.
   Server-friendly y determinista (sin Math.random) para que no haya desajustes de hidratación. */

const v = (o: Record<string, string | number>) => o as unknown as CSSProperties;

function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}
const f = (x: number, d = 1) => x.toFixed(d);

/* ---------- VENTANA: viento, cortinas que ondean y pétalos ---------- */
function Ventana() {
  const r = rng(3);
  const petals = Array.from({ length: 28 }, () => ({
    y: f(r() * 92 - 6) + "vh", dy: f((r() - 0.35) * 34) + "vh",
    d: f(15 + r() * 16) + "s", dl: "-" + f(r() * 30) + "s",
    s: f(9 + r() * 13) + "px", sw: f(14 + r() * 34, 0) + "px",
    sd: f(2.2 + r() * 2.6) + "s", fd: f(3 + r() * 4) + "s", w: r() < 0.3,
  }));
  const gusts = Array.from({ length: 7 }, (_, i) => ({
    y: 70 + i * 125 + Math.round(r() * 30), d: f(5 + r() * 5) + "s", dl: "-" + f(r() * 9) + "s",
  }));
  const petal = (p: (typeof petals)[number], i: number) => (
    <div key={i} className={"pt" + (p.w ? " w" : "")}
      style={v({ "--y": p.y, "--dy": p.dy, "--d": p.d, "--dl": p.dl, "--s": p.s, "--sw": p.sw, "--sd": p.sd, "--fd": p.fd })}>
      <span><i /></span>
    </div>
  );
  return (
    <>
      <div className="sc sc-v" aria-hidden="true">
        <div className="cur l" />
        <div className="cur r" />
        <svg className="gust" viewBox="0 0 1600 900" preserveAspectRatio="none">
          {gusts.map((g, i) => (
            <path key={i} pathLength={1000} style={v({ "--d": g.d, "--dl": g.dl })}
              d={`M-100 ${g.y} C 300 ${g.y - 70}, 600 ${g.y + 80}, 900 ${g.y - 10} S 1400 ${g.y + 60}, 1700 ${g.y - 40}`} />
          ))}
        </svg>
        {/* Todo va por detrás de los recuadros */}
        {petals.map(petal)}
      </div>
    </>
  );
}

/* ---------- RÍO: agua que corre, ondas, luciérnagas y hojas a la deriva ---------- */
function Rio() {
  const r = rng(11);
  const flows = Array.from({ length: 7 }, (_, i) => ({
    b: f(3 + i * 6.2) + "%", o: f(0.18 + (i % 3) * 0.1, 2), d: f(14 + i * 5) + "s",
  }));
  const ripples = [[22, 72], [58, 82], [80, 66], [38, 60], [70, 90], [12, 88]].map(([x, y], i) => ({
    x: x + "%", y: y + "%", d: f(7 + (i % 3) * 1.5) + "s", dl: "-" + f(i * 1.7) + "s",
  }));
  const flies = Array.from({ length: 24 }, () => ({
    x: f(r() * 100) + "%", y: f(30 + r() * 65) + "%", dx: f((r() - 0.5) * 120, 0) + "px", dy: f(-20 - r() * 90, 0) + "px",
    d: f(6 + r() * 7) + "s", b: f(2 + r() * 3) + "s", dl: "-" + f(r() * 9) + "s", l: r() < 0.35,
  }));
  const leaves = Array.from({ length: 8 }, (_, i) => ({
    y: f(60 + r() * 32) + "%", s: f(14 + r() * 14, 0) + "px", d: f(55 + r() * 45, 0) + "s",
    dl: "-" + f(r() * 90, 0) + "s", c: ["#c8b0da", "#7ba56e", "#f3e3c8", "#b79bd1"][i % 4],
  }));
  return (
    <div className="sc sc-r" aria-hidden="true">
      {[12, 38].map((t, i) => (
        <div key={i} className="mist" style={v({ top: t + "%", "--d": 34 + i * 18 + "s" })} />
      ))}
      {flows.map((x, i) => (
        <div key={i} className="flow" style={v({ bottom: x.b, "--o": x.o, "--d": x.d })} />
      ))}
      {ripples.map((p, i) => (
        <div key={i} className="rpl" style={v({ left: p.x, top: p.y, "--d": p.d, "--dl": p.dl })} />
      ))}
      {leaves.map((l, i) => (
        <div key={i} className="lf" style={v({ "--y": l.y, "--d": l.d, "--dl": l.dl, "--s": l.s, "--c": l.c })}><i /></div>
      ))}
      {flies.map((x, i) => (
        <div key={i} className={"ff" + (x.l ? " l" : "")}
          style={v({ "--x": x.x, "--y": x.y, "--dx": x.dx, "--dy": x.dy, "--d": x.d, "--b": x.b, "--dl": x.dl })} />
      ))}
    </div>
  );
}

/* ---------- BAHÍA: nubes, gaviotas, velero, olas y destellos ---------- */
function Bahia() {
  const r = rng(29);
  const clouds = Array.from({ length: 4 }, (_, i) => ({
    y: f(4 + i * 9 + r() * 5) + "%", w: f(260 + r() * 260, 0) + "px", d: f(110 + r() * 70, 0) + "s", dl: "-" + f(r() * 150, 0) + "s",
  }));
  const gulls = Array.from({ length: 5 }, () => ({
    y: f(8 + r() * 30) + "%", s: f(26 + r() * 22, 0) + "px", d: f(26 + r() * 22, 0) + "s", dl: "-" + f(r() * 40, 0) + "s",
    bd: f(3 + r() * 3) + "s", fl: f(0.5 + r() * 0.4, 2) + "s",
  }));
  const glints = Array.from({ length: 26 }, () => ({
    x: f(r() * 96) + "%", y: f(52 + r() * 44) + "%", w: f(14 + r() * 34, 0) + "px", d: f(2.4 + r() * 3) + "s", dl: "-" + f(r() * 6) + "s",
  }));
  return (
    <div className="sc sc-b" aria-hidden="true">
      {clouds.map((c, i) => (
        <div key={i} className="cl" style={v({ "--y": c.y, "--w": c.w, "--d": c.d, "--dl": c.dl })} />
      ))}
      {gulls.map((g, i) => (
        <div key={i} className="gl" style={v({ "--y": g.y, "--s": g.s, "--d": g.d, "--dl": g.dl, "--bd": g.bd, "--fl": g.fl })}>
          <span><svg viewBox="0 0 44 18"><path d="M2 14 Q12 -2 22 12 Q32 -2 42 14" /></svg></span>
        </div>
      ))}
      {glints.map((g, i) => (
        <div key={i} className="gn" style={v({ "--x": g.x, "--y": g.y, "--w": g.w, "--d": g.d, "--dl": g.dl })} />
      ))}
      <div className="boat" style={v({ "--b": "17%" })}>
        <svg viewBox="0 0 120 110">
          <line x1="58" y1="8" x2="58" y2="88" stroke="#e8dcc0" strokeWidth="3" />
          <path d="M58 12 L58 80 L20 80 Z" fill="#fff" />
          <path d="M62 24 L62 80 L100 80 Z" fill="#fdf2dc" />
          <path d="M58 8 L74 13 L58 18 Z" fill="#c9452c" />
          <path d="M6 86 H114 Q100 104 70 104 H30 Q12 104 6 86 Z" fill="#f7ecd2" />
          <path d="M10 92 H110" stroke="#c9452c" strokeWidth="3" fill="none" />
        </svg>
      </div>
      <div className="wv a" style={v({ "--b": "0px", "--h": "96px", "--d": "16s" })} />
      <div className="wv b rev" style={v({ "--b": "0px", "--h": "70px", "--d": "11s" })} />
      <div className="wv c" style={v({ "--b": "0px", "--h": "46px", "--d": "8s" })} />
    </div>
  );
}

export function HomeScene() {
  return (
    <>
      <Ventana />
      <Rio />
      <Bahia />
    </>
  );
}
