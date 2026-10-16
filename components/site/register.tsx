import type { ReactNode } from "react";

/** The small mono label that names a field. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="field-label">{children}</span>;
}

/*
  The prompt fragment is the part of each entry a reader can reuse.

  It used to be dressed as a terminal: monospace inside a recessed well with a
  coloured left stripe. That was the strongest "system prompt" signal on the
  page, and it told the reader they had left the explanation and arrived at some
  code. This is guidance, so it is set as guidance — the plain prose of the site
  under a hairline rule, carrying the same field label every other named part of
  an entry uses, one step larger than the paragraphs around it because it is the
  line a reader is meant to take away.
*/
export function PromptFragment({
  children,
  label = "what you would tell the AI",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <aside data-prompt-fragment className="mt-7 border-t border-rule pt-3.5">
      <FieldLabel>{label}</FieldLabel>
      <p className="mt-2 max-w-[72ch] text-[14.5px] leading-[1.75] text-ink">
        {children}
      </p>
    </aside>
  );
}

/** Bare identifiers and filenames, shown inline rather than as a code block. */
export function Specimen({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5">
      {items.map((item) => (
        <li key={item} className="font-mono text-[11.5px] text-ink-faint">
          {item}
        </li>
      ))}
    </ul>
  );
}

export type StatusTone = "live" | "planned";

const STATUS_TONES: Record<StatusTone, string> = {
  live: "border-accent/40 bg-accent-tint text-accent",
  planned: "border-marker/50 bg-marker-tint/60 text-marker",
};

/** Build state, stated plainly. Nothing on this site claims to be finished. */
export function StatusTag({
  tone,
  children,
}: {
  tone: StatusTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block border px-1.5 py-px align-middle font-mono text-[10px] tracking-[0.08em] uppercase ${STATUS_TONES[tone]}`}
    >
      {children}
    </span>
  );
}
