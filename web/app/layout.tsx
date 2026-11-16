import Link from "next/link";
import { Outfit, Cormorant_Garamond, Jost, Playfair_Display, Fraunces, Syne, Manrope } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import "./themes.css";
import "./extra.css";
import "./pintados.css";
import "./ventana.css";
import "./pradera.css";
import { Nav } from "@/components/Nav";
import { Pond } from "@/components/Pond";
import { Court } from "@/components/Court";
import { Harbor } from "@/components/Harbor";
import { Park } from "@/components/Park";
import { Ventana } from "@/components/Ventana";
import { Pradera } from "@/components/Pradera";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
// Montecarlo
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"], variable: "--font-cormorant", display: "swap" });
const jost = Jost({ subsets: ["latin"], variable: "--font-jost", display: "swap" });
// Portofino
const playfair = Playfair_Display({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-playfair", display: "swap" });

// Otoño
const fraunces = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-fraunces", display: "swap" });

// Pradera: Syne (títulos, ancha y con carácter) + Manrope (texto)
const syne = Syne({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-syne", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-manrope", display: "swap" });

export const metadata = { title: "LEC Fantasy" };

// Pone el estilo guardado antes de pintar (evita el parpadeo). Añade aquí los ids de estilos nuevos.
const THEME_SCRIPT = `try{var t=localStorage.getItem("lec-theme");if(["koi","clay","riviera","park","ventana","rio","bahia","pradera"].indexOf(t)>-1)document.documentElement.dataset.theme=t}catch(e){}`;

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="koi" suppressHydrationWarning
      className={`${outfit.variable} ${cormorant.variable} ${jost.variable} ${playfair.variable} ${fraunces.variable} ${syne.variable} ${manrope.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <Pond />
        <Court />
        <Harbor />
        <Park />
        <Ventana />
        <Pradera />
        <header><div className="wrap">
          <Link href="/" className="logo">LEC <span>Fantasy</span></Link>
          <Nav />
        </div></header>
        <main className="wrap">{children}</main>
        <Analytics />
      </body>
    </html>
  );
}
