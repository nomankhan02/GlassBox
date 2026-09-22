import type { ReactNode } from "react";

/** The small mono label that names a field. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="field-label">{children}</span>;
}

/*
  The prompt fragment is the part of each entry a reader can reuse. It is set in
  mono inside a recessed well with an accent edge, because it is a specimen of
  wording rather than a paragraph of explanation.
*/
export function PromptFragment({
  children,
  label = "what you would tell the AI",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div className="mt-5 border-l-2 border-accent bg-paper-sunk/70 py-3.5 pr-5 pl-4">
      <FieldLabel>{label}</FieldLabel>
      <p className="mt-2 font-mono text-[12.5px] leading-[1.7] text-ink">
        {children}
      </p>
    </div>
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
