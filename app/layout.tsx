import type { Metadata } from "next";
import {
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  IBM_Plex_Serif,
  Spline_Sans_Mono,
} from "next/font/google";
import { Masthead } from "@/components/site/masthead";
import { LayerRail } from "@/components/site/layer-rail";
import { Colophon } from "@/components/site/colophon";
import "./globals.css";

/*
  Type, chosen for a reason: IBM Plex is a technical superfamily, drawn for
  instrument panels and documentation rather than for marketing pages. It gives
  three distinct jobs from one voice:

    Plex Serif — headings. Reads as a printed field report, not a product page.
    Plex Sans  — body. Meant for long explanatory prose at small sizes.
    Plex Mono       — labels, identifiers, units. The voice of the notebook.
    Spline Sans Mono— numerals and readouts. The voice of the instrument:
                      boxier, more instrument-like digits, so a counter reads
                      as a measurement rather than as part of a sentence.
*/
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
});

const plexSerif = IBM_Plex_Serif({
  variable: "--font-plex-serif",
  weight: ["400", "500"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

/* The numeric readout face. Tabular by construction; see globals.css. */
const splineMono = Spline_Sans_Mono({
  variable: "--font-spline-mono",
  weight: ["400", "500", "600", "700"],
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
      className={`${plexSans.variable} ${plexSerif.variable} ${plexMono.variable} ${splineMono.variable}`}
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
