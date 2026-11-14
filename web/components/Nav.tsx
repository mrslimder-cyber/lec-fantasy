"use client";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth";
import { ThemeSwitch } from "@/components/ThemeSwitch";

export function Nav() {
  const { session } = useSession();
  const router = useRouter();
  const out = async () => { await supabase.auth.signOut(); router.push("/"); };
  return (
    <nav>
      <ThemeSwitch />
      {session && <button className="btn out" onClick={out}>Cerrar sesión</button>}
    </nav>
  );
}
