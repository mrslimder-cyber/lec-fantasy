"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth";

function Hero() {
  return (
    <div className="hero">
      <div className="eyebrow">LEC · WINTER 2027</div>
      <h1>LEC Fantasy</h1>
      <p>Sortea tu plantilla, puja en el mercado y demuestra en tu liga de amigos quién sabe más de la Grieta.</p>
    </div>
  );
}

function AuthForm() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const go = async () => {
    setMsg("");
    const { data, error } = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password: pw })
      : await supabase.auth.signUp({ email, password: pw });
    if (error) setMsg(error.message);
    else if (!data.session) setMsg("Revisa tu correo para confirmar la cuenta.");
  };
  return (
    <>
      <Hero />
      <div className="panel">
        <h2>{mode === "in" ? "Identifícate" : "Crea tu cuenta"}</h2>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Contraseña (mín. 6)" value={pw} onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()} />
        <button className="btn" onClick={go}>{mode === "in" ? "Entrar" : "Registrarme"}</button>
        <button className="btn out" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "No tengo cuenta" : "Ya tengo cuenta"}
        </button>
        {msg && <p className="err">{msg}</p>}
      </div>
    </>
  );
}

function Menu({ uid }: { uid: string }) {
  const router = useRouter();
  const [view, setView] = useState<"menu" | "crear" | "unirse" | "ligas">("menu");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [err, setErr] = useState("");
  const [mine, setMine] = useState<any[] | null>(null);
  useEffect(() => {
    if (view === "ligas")
      supabase.from("league_teams").select("name,leagues(id,name,drawn)").eq("user_id", uid)
        .then(({ data }) => setMine(data ?? []));
  }, [view, uid]);
  const submit = async () => {
    setErr("");
    if (!a.trim() || !b.trim()) return setErr("Rellena los dos campos.");
    const { data, error } = view === "crear"
      ? await supabase.rpc("create_league", { p_name: a, p_team: b })
      : await supabase.rpc("join_league", { p_code: a, p_team: b });
    if (error) setErr(error.message); else router.push(`/liga/equipo?id=${data}`);
  };
  const back = <button className="btn out" onClick={() => { setView("menu"); setErr(""); }}>← Volver</button>;

  if (view === "menu") return (
    <>
      <Hero />
      <div className="menu3">
        <button className="mtile" data-k="crear" onClick={() => setView("crear")}>
          <span className="ico">🏆</span><b>Crear liga</b>
          <small>Monta tu propia liga e invita a tus amigos con un código.</small>
          <span className="go">EMPEZAR →</span>
        </button>
        <button className="mtile" data-k="unirse" onClick={() => setView("unirse")}>
          <span className="ico">🔑</span><b>Unirme a una liga</b>
          <small>¿Te han pasado un código? Ponle nombre a tu equipo y entra.</small>
          <span className="go">ENTRAR →</span>
        </button>
        <button className="mtile" data-k="ligas" onClick={() => setView("ligas")}>
          <span className="ico">📋</span><b>Mis ligas</b>
          <small>Vuelve a las ligas en las que ya compites.</small>
          <span className="go">VER →</span>
        </button>
      </div>
    </>
  );
  if (view === "ligas") return (
    <div className="lgwrap">
      <h1 style={{ textAlign: "center" }}>Mis ligas</h1>
      <div className="lglist">
        {mine === null && <p className="sub" style={{ textAlign: "center" }}>Cargando…</p>}
        {mine?.length === 0 && <p className="sub" style={{ textAlign: "center" }}>Todavía no estás en ninguna liga.</p>}
        {mine?.map((m) => (
          <Link key={m.leagues.id} href={`/liga/equipo?id=${m.leagues.id}`} className="mtile lgitem" data-k="ligas">
            <div><b>{m.leagues.name}</b><small>Tu equipo: {m.name}</small></div>
            <span className={m.leagues.drawn ? "badge live" : "badge"}>{m.leagues.drawn ? "EN JUEGO" : "PENDIENTE DE SORTEO"}</span>
          </Link>
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 20 }}>{back}</div>
    </div>
  );
  return (
    <div className="panel">
      <h2>{view === "crear" ? "Crear liga" : "Unirme a una liga"}</h2>
      <input placeholder={view === "crear" ? "Nombre de la liga" : "Código de la liga"} value={a} onChange={(e) => setA(e.target.value)} />
      <input placeholder="Nombre de tu equipo" value={b} onChange={(e) => setB(e.target.value)} />
      <button className="btn" onClick={submit}>{view === "crear" ? "Crear" : "Unirme"}</button>
      {back}
      {err && <p className="err">{err}</p>}
    </div>
  );
}

export default function Home() {
  const { session, ready } = useSession();
  if (!ready) return <p className="sub">Cargando…</p>;
  return session ? <Menu uid={session.user.id} /> : <AuthForm />;
}
