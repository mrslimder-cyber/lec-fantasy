import Link from "next/link";
import "./globals.css";
export const metadata = { title: "LEC Fantasy" };
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es"><body>
      <header><div className="wrap">
        <Link href="/" className="logo">LEC <span>Fantasy</span></Link>
        <nav><Link href="/">Mercado</Link><Link href="/equipo">Equipo</Link><Link href="/clasificacion">Clasificación</Link></nav>
      </div></header>
      <main className="wrap">{children}</main>
    </body></html>
  );
}
