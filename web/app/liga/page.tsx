"use client";
import { eur } from "@/lib/game";
import { useLeague } from "@/lib/league";

export default function Clasificacion() {
  const { teams, me, value, points } = useLeague();
  const rows = teams
    .map((t) => ({ t, pts: points(t.id), val: value(t.id) }))
    .sort((a, b) => b.pts - a.pts || a.t.name.localeCompare(b.t.name));
  return (
    <>
      <table className="tbl">
        <thead><tr><th>#</th><th>Equipo</th><th>Valor</th><th>Puntos</th></tr></thead>
        <tbody>
          {rows.map((x, i) => (
            <tr key={x.t.id}>
              <td>{i + 1}</td>
              <td><b>{x.t.name}</b>{x.t.id === me?.id && " (tú)"}</td>
              <td>{eur(x.val)}</td><td><b>{x.pts}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">Los equipos son secretos: solo tú ves tu plantilla y tus alineaciones. De los demás solo se conoce su valor y sus puntos.</p>
    </>
  );
}
