import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Martian_Mono,
} from "next/font/google";
import "./globals.css";

/*
  Four jobs, four voices.

    Bricolage Grotesque — headings, nav and the wordmark. One confident display
               face, loaded as a variable weight, so the scale steps down by
               weight and size together. It is the one face on the site chosen
               to be noticed, and it only ever sets hierarchies, never prose.
    Plex Sans  — body. Meant for long explanatory prose at small sizes.
    Plex Mono  — labels, identifiers, units. The voice of the notebook.
    Martian Mono — numerals and readouts. The voice of the instrument:
               squarer, more mechanical digits than the text mono, so a counter
               reads as a measurement rather than as part of a sentence.
*/
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
});

/*
  The display face, replacing the serif this site used to wear. Bricolage
  Grotesque is a variable grotesque: its weight range lets one file serve a
  heavy page title and a nav label without switching families. It sets
  headings, the nav, and the wordmark — the whole display voice, where before
  three faces competed for it.
*/
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
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

export const metadata: Metadata = {
  title: {
    default: "Glassbox — how AI-built web apps actually work",
    template: "%s · Glassbox",
  },
  description:
    "A lab notebook for the parts of a web app you never see. Glassbox walks through the setup a project needs, the concepts behind the mechanism, and a running record of the prompts that built this site.",
};

/*
  The root layout keeps only what every route needs: the document, the font
  variables and the outer measure. The chrome differs by route — the homepage
  opens on a full-height hero, the content pages wear the masthead-and-rail
  frame — so each of those compositions lives in its own layout or page rather
  than here.
*/
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${bricolage.variable} ${plexMono.variable} ${martianMono.variable}`}
    >
      <body>
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:font-mono focus:text-[11px] focus:text-paper"
        >
          Skip to content
        </a>

        {/* Tighter gutters than before, and a wider measure: the content sits
            closer to the viewport edge on every screen, while the 14px on the
            smallest phones keeps text off the literal edge. */}
        <div className="mx-auto w-full max-w-[1280px] px-3.5 sm:px-5 md:px-6 lg:px-7">
          {children}
        </div>
      </body>
    </html>
  );
}
