"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Los movimientos ya no se muestran: se redirige a tu equipo. Puedes borrar esta carpeta si quieres.
export default function Movimientos() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  useEffect(() => { router.replace(`/liga/equipo?id=${id ?? ""}`); }, [router, id]);
  return <p className="sub">Redirigiendo…</p>;
}
