"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type P = { id: number; name: string; role: string; price: number };

export default function Home() {
  const [rows, setRows] = useState<P[]>([]);
  useEffect(() => {
    supabase.from("players").select("id,name,role,price").order("price", { ascending: false })
      .then(({ data }) => setRows((data as P[]) ?? []));
  }, []);
  return (
    <main>
      <h1>LEC Fantasy</h1>
      <table><tbody>
        {rows.map((p) => (<tr key={p.id}><td>{p.name}</td><td>{p.role}</td><td>{Math.round(p.price).toLocaleString("es-ES")} €</td></tr>))}
      </tbody></table>
    </main>
  );
}
