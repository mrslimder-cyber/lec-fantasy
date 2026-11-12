"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth";

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
    <div className="form">
      <h1>{mode === "in" ? "Identifícate" : "Crea tu cuenta"}</h1>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="Contraseña (mín. 6)" value={pw} onChange={(e) => setPw(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && go()} />
      <button className="btn" onClick={go}>{mode === "in" ? "Entrar" : "Registrarme"}</button>
      <button className="btn out" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "No tengo cuenta" : "Ya tengo cuenta"}
      </button>
      {msg && <p className="err">{msg}</p>}
    </div>
  );
}

function Menu({ uid }: { uid: string }) {
  const router = useRouter();
  const [view, setView] = useState<"menu" | "crear" | "unirse" | "ligas">("menu");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [err, setErr] = useState("");
  const [mine, setMine] = useState<any[]>([]);
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
    if (error) setErr(error.message); else router.push(`/liga?id=${data}`);
  };
  const back = <button className="btn out" onClick={() => { setView("menu"); setErr(""); }}>← Volver</button>;

  if (view === "menu") return (
    <>
      <h1>LEC Fantasy</h1>
      <p className="sub">¿Qué quieres hacer?</p>
      <div className="grid">
        <button className="card tile" onClick={() => setView("crear")}><b>Crear liga</b><small>Invita a tus amigos con un código</small></button>
        <button className="card tile" onClick={() => setView("unirse")}><b>Unirme a una liga</b><small>Con el código que te pasen</small></button>
        <button className="card tile" onClick={() => setView("ligas")}><b>Mis ligas</b><small>Ligas en las que ya compites</small></button>
      </div>
    </>
  );
  if (view === "ligas") return (
    <>
      <h1>Mis ligas</h1>{back}
      <div className="grid" style={{ marginTop: 16 }}>
        {mine.length === 0 && <p className="sub">Todavía no estás en ninguna liga.</p>}
        {mine.map((m) => (
          <Link key={m.leagues.id} href={`/liga?id=${m.leagues.id}`} className="card tile">
            <b>{m.leagues.name}</b><small>Tu equipo: {m.name} · {m.leagues.drawn ? "sorteada" : "pendiente de sorteo"}</small>
          </Link>
        ))}
      </div>
    </>
  );
  return (
    <div className="form">
      <h1>{view === "crear" ? "Crear liga" : "Unirme a una liga"}</h1>
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
