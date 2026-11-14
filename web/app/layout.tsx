import Link from "next/link";
import { Outfit } from "next/font/google";
import "./globals.css";
import "./themes.css";
import "./extra.css";
import { Nav } from "@/components/Nav";
import { Pond } from "@/components/Pond";
import { Court } from "@/components/Court";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });

export const metadata = { title: "LEC Fantasy" };
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={outfit.variable} data-theme="koi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html:
          `try{var t=localStorage.getItem("lec-theme");if(t==="koi"||t==="clay")document.documentElement.dataset.theme=t}catch(e){}`
        }} />
      </head>
      <body>
        <Pond />
        <Court />
        <header><div className="wrap">
          <Link href="/" className="logo">LEC <span>Fantasy</span></Link>
          <Nav />
        </div></header>
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}