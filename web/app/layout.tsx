import Link from "next/link";
import "./globals.css";
import { Nav } from "@/components/Nav";
export const metadata = { title: "LEC Fantasy" };
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es"><body>
      <header><div className="wrap">
        <Link href="/" className="logo">LEC <span>Fantasy</span></Link>
        <Nav />
      </div></header>
      <main className="wrap">{children}</main>
    </body></html>
  );
}
