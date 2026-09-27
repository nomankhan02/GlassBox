import type { Break, BreakSide } from "@/lib/breaks";

/*
  One hairline above, a field label, then the content. Deliberately lighter than
  a figure, which carries the site's heavy rule: a figure is something to look
  at, a break is something to read beside the text. No icons, no cards, no
  colour beyond the six-pixel state square the demos already use.
*/
function BreakFrame({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="mt-7 border-t border-rule pt-3">
      <span className="field-label">{label}</span>
      {children}
    </aside>
  );
}

const TONE_DOT: Record<NonNullable<BreakSide["tone"]>, string> = {
  plain: "bg-rule-strong",
  ok: "bg-ok",
  bad: "bg-bad",
};

export function Break(props: Break) {
  if (props.kind === "stats") {
    return (
      <BreakFrame label={props.label}>
        <dl className="mt-4 grid gap-px bg-rule sm:grid-cols-3">
          {props.stats.map((stat) => (
            <div key={stat.label} className="bg-paper-raised px-4 py-3.5">
              <dd className="readout text-[21px] leading-none text-ink">
                {stat.value}
                {stat.unit ? (
                  <span className="ml-1 text-[11px] text-ink-faint">
                    {stat.unit}
                  </span>
                ) : null}
              </dd>
              <dt className="mt-2 text-[12px] leading-[1.55] text-ink-soft">
                {stat.label}
              </dt>
            </div>
          ))}
        </dl>
        {props.note ? (
          <p className="mt-2.5 max-w-[70ch] font-mono text-[10.5px] leading-[1.6] text-ink-faint">
            {props.note}
          </p>
        ) : null}
      </BreakFrame>
    );
  }

  if (props.kind === "compare") {
    const sides: BreakSide[] = [props.left, props.right];

    return (
      <BreakFrame label={props.label}>
        <div className="mt-4 grid gap-px bg-rule md:grid-cols-2">
          {sides.map((side) => (
            <div key={side.title} className="bg-paper-raised px-4 py-4">
              <p className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`size-[6px] shrink-0 ${TONE_DOT[side.tone ?? "plain"]}`}
                />
                <span className="font-mono text-[11px] tracking-[0.04em] text-ink">
                  {side.title}
                </span>
              </p>

              <ul className="mt-3 space-y-2">
                {side.points.map((point) => (
                  <li key={point} className="flex gap-2.5">
                    <span
                      aria-hidden
                      className="mt-[8px] size-[4px] shrink-0 border border-ink-faint"
                    />
                    <span className="text-[12.5px] leading-[1.6] text-ink-soft">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>

              {side.note ? (
                <p className="mt-3.5 border-t border-rule pt-2 font-mono text-[10.5px] text-ink-faint">
                  {side.note}
                </p>
              ) : null}
            </div>
          ))}
        </div>

        {props.verdict ? (
          <p className="mt-3 max-w-[70ch] text-[13px] leading-[1.65] text-ink-soft">
            {props.verdict}
          </p>
        ) : null}
      </BreakFrame>
    );
  }

  return (
    <BreakFrame label={props.label}>
      <ol className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-2">
        {props.steps.map((step, index) => (
          <li key={step} className="flex items-center gap-2.5">
            <span className="border border-rule-strong bg-paper-raised px-3 py-1.5 font-mono text-[11px] text-ink-soft">
              {step}
            </span>
            {index < props.steps.length - 1 ? (
              <span aria-hidden className="font-mono text-[11px] text-rule-strong">
                &rarr;
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      {props.note ? (
        <p className="mt-2.5 max-w-[70ch] font-mono text-[10.5px] leading-[1.6] text-ink-faint">
          {props.note}
        </p>
      ) : null}
    </BreakFrame>
  );
}
