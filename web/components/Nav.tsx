"use client";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth";

export function Nav() {
  const { session } = useSession();
  const router = useRouter();
  const out = async () => { await supabase.auth.signOut(); router.push("/"); };
  return (
    <nav>
      {session && <button className="btn out" onClick={out}>Cerrar sesión</button>}
    </nav>
  );
}
