import Link from "next/link";
import { GlassCube } from "./glass-cube";

export function Masthead({ tagline = true }: { tagline?: boolean }) {
  return (
    <header className="flex items-baseline justify-between gap-8 border-b border-rule pt-9 pb-4">
      <Link
        href="/"
        className="group flex items-center gap-2.5 transition-colors hover:text-accent"
      >
        {/* The mark is the cube itself: the object the site is named after,
            small and tilting to follow the cursor. It is the header's one
            moving part, and it holds still under prefers-reduced-motion. */}
        <GlassCube size={26} behavior="track" tilt={12} reach={220} />
        {/* The wordmark is a masthead, not a label: one confident display face
            set tracked out, so the header reads as the title page of a printed
            report. */}
        <span className="type-wordmark">Glassbox</span>
      </Link>

      {tagline ? (
        <p className="hidden text-right font-mono text-[10.5px] leading-[1.5] text-ink-faint sm:block">
          a lab notebook for how the web actually works
        </p>
      ) : null}
    </header>
  );
}
