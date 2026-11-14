import Link from "next/link";
import { Outfit, Cormorant_Garamond, Jost, Playfair_Display, Fraunces } from "next/font/google";
import "./globals.css";
import "./themes.css";
import "./extra.css";
import { Nav } from "@/components/Nav";
import { Pond } from "@/components/Pond";
import { Court } from "@/components/Court";
import { Harbor } from "@/components/Harbor";
import { Park } from "@/components/Park";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
// Montecarlo
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"], variable: "--font-cormorant", display: "swap" });
const jost = Jost({ subsets: ["latin"], variable: "--font-jost", display: "swap" });
// Portofino
const playfair = Playfair_Display({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-playfair", display: "swap" });

// Otoño
const fraunces = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-fraunces", display: "swap" });

export const metadata = { title: "LEC Fantasy" };

// Pone el estilo guardado antes de pintar (evita el parpadeo). Añade aquí los ids de estilos nuevos.
const THEME_SCRIPT = `try{var t=localStorage.getItem("lec-theme");if(["koi","clay","riviera","park"].indexOf(t)>-1)document.documentElement.dataset.theme=t}catch(e){}`;

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="koi" suppressHydrationWarning
      className={`${outfit.variable} ${cormorant.variable} ${jost.variable} ${playfair.variable} ${fraunces.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <Pond />
        <Court />
        <Harbor />
        <Park />
        <header><div className="wrap">
          <Link href="/" className="logo">LEC <span>Fantasy</span></Link>
          <Nav />
        </div></header>
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
