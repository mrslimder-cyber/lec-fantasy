"use client";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth";

export function Nav() {
  const { session } = useSession();
  return (
    <nav>
      <Link href="/">Inicio</Link><Link href="/jugadores">Jugadores</Link>
      {session && <a href="/" onClick={() => supabase.auth.signOut()}>Salir</a>}
    </nav>
  );
}
