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
            drawn small and picked up by the cursor. It is the header's one
            moving part, and it holds still under prefers-reduced-motion. The
            component's own box carries the room the drag needs, so the mark is
            never cut off by the row it sits in. */}
        <GlassCube size={26} behavior="track" />
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
