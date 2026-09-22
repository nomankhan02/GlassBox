/*
  Demos are built one at a time, so most concepts show this instead. It stays
  visually quiet on purpose: a placeholder that looks finished would be worse
  than an empty one.
*/
export function PlannedDemo({ code, note }: { code: string; note: string }) {
  return (
    <div className="mt-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t-2 border-ink/85 pt-3">
        <span className="field-label">fig. {code}</span>
        <span className="font-mono text-[10.5px] tracking-[0.08em] text-ink-faint uppercase">
          not built yet
        </span>
      </div>

      <div className="mt-4 border border-dashed border-rule-strong bg-paper-sunk/50 px-5 py-6 shadow-panel" style={{ boxShadow: "var(--shadow-panel)" }}>
        <p className="max-w-[64ch] text-[13.5px] leading-[1.7] text-ink-soft">
          {note}
        </p>
        <p className="mt-4 font-mono text-[10.5px] text-ink-faint">
          the explanation above is written; the demo that shows it happening is
          built one at a time
        </p>
      </div>
    </div>
  );
}
