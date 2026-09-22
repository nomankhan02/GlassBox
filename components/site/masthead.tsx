import Link from "next/link";

/*
  The mark is drawn in CSS rather than imported from an icon set: a case with a
  seam across it, and one filled square sitting inside the lower half. The whole
  project is that idea — a box you can see into.
*/
function GlassboxMark() {
  return (
    <span
      aria-hidden
      className="relative inline-block size-[18px] shrink-0 border border-ink/75 bg-paper-raised shadow-[inset_0_0_0_3px_var(--color-accent-tint)]"
    >
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-ink/30" />
      <span className="absolute bottom-[3px] left-1/2 size-[4px] -translate-x-1/2 bg-accent transition-transform duration-200 ease-soft group-hover:scale-125" />
    </span>
  );
}

export function Masthead() {
  return (
    <header className="flex items-baseline justify-between gap-8 border-b border-rule pt-9 pb-4">
      <Link
        href="/"
        className="group flex items-center gap-2.5 transition-colors hover:text-accent"
      >
        <GlassboxMark />
        <span className="font-mono text-[13px] font-medium tracking-[0.22em]">
          GLASSBOX
        </span>
      </Link>

      <p className="hidden text-right font-mono text-[10.5px] leading-[1.5] text-ink-faint sm:block">
        a lab notebook for how the web actually works
      </p>
    </header>
  );
}
