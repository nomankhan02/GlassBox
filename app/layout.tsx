import type { Metadata } from "next";
import {
  Cinzel,
  Fraunces,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Martian_Mono,
} from "next/font/google";
import { Masthead } from "@/components/site/masthead";
import { LayerRail } from "@/components/site/layer-rail";
import { Colophon } from "@/components/site/colophon";
import "./globals.css";

/*
  Five jobs, five voices, one of them deliberately strange.

    Fraunces — headings only. A display serif with real character: its optical
               size, SOFT and WONK axes let the letterforms tighten and splay
               at page-title size like a printed specimen plate, and relax
               back to something legible in the nav. It is the one face on the
               site chosen to be noticed, and it only ever sets hierarchies,
               never prose.
    Plex Sans  — body. Meant for long explanatory prose at small sizes.
    Plex Mono  — labels, identifiers, units. The voice of the notebook.
    Martian Mono — numerals and readouts. The voice of the instrument:
               squarer, more mechanical digits than the text mono, so a counter
               reads as a measurement rather than as part of a sentence.
    Cinzel     — the wordmark and nothing else. A capitals-only Roman
               inscriptional serif, the one place on the site allowed to be
               ornamental; it never sets a heading or a line of prose.
*/
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
});

/*
  The display face. All three extra axes are pulled in on purpose: opsz so the
  same file serves a 46px page title and a 13px nav label, SOFT pinned to 0 and
  WONK on so display sizes take the sharper, more mechanical cut rather than the
  soft one. Weight reaches 100–900, which is what lets the scale step down by
  weight and not only by size.
*/
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

/*
  The numeric readout face. Martian Mono is drawn for instruments: flat-sided,
  tabular figures that read as a measurement and not as a sentence. See
  globals.css for where it is allowed to appear.
*/
const martianMono = Martian_Mono({
  variable: "--font-martian-mono",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

/*
  The wordmark face, and only the wordmark. Cinzel is a capitals-only Roman
  inscriptional serif; it is the one ornamental, deliberately bold moment on the
  site, and it is scoped to .type-wordmark so it cannot bleed anywhere else.
*/
const cinzel = Cinzel({
  variable: "--font-cinzel",
  weight: ["400", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Glassbox — how AI-built web apps actually work",
    template: "%s · Glassbox",
  },
  description:
    "A lab notebook for the parts of a web app you never see. Glassbox walks through the setup a project needs, the concepts behind the mechanism, and a running record of the prompts that built this site.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${fraunces.variable} ${plexMono.variable} ${martianMono.variable} ${cinzel.variable}`}
    >
      <body>
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:font-mono focus:text-[11px] focus:text-paper"
        >
          Skip to content
        </a>

        <div className="mx-auto w-full max-w-[1180px] px-5 md:px-8">
          <Masthead />

          <div className="lg:grid lg:grid-cols-[164px_minmax(0,1fr)] xl:grid-cols-[184px_minmax(0,1fr)]">
            <LayerRail />
            {/* The rule on this edge is the only vertical line on the site: it
                separates the layer index from the layer's contents. */}
            <main
              id="content"
              className="min-w-0 pt-8 pb-20 lg:border-l lg:border-rule lg:pt-12 lg:pl-10 xl:pl-14"
            >
              {children}
            </main>
          </div>

          <Colophon />
        </div>
      </body>
    </html>
  );
}
