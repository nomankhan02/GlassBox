import type { ReactNode } from "react";

/*
  Demos are figures, numbered and captioned like specimens in a notebook. The
  heavier rule above the caption is the site's one strong horizontal mark: it
  means "what follows is a thing to look at", not "here is another section".
*/
export function Figure({
  id,
  caption,
  children,
  reading,
  whyItMatters,
}: {
  id: string;
  caption: string;
  children: ReactNode;
  /** What to look at, and which controls to try. */
  reading?: ReactNode;
  /** What the mechanism means when you are the one writing prompts. */
  whyItMatters?: ReactNode;
}) {
  return (
    <figure className="mt-7">
      <figcaption className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t-2 border-ink/85 pt-3">
        <span className="field-label">fig. {id}</span>
        <span className="font-mono text-[11.5px] text-ink-soft">{caption}</span>
      </figcaption>

      <div
        className="mt-4 border border-rule bg-paper-raised shadow-panel"
        style={{ boxShadow: "var(--shadow-panel)" }}
      >
        {children}
      </div>

      {reading || whyItMatters ? (
        <div className="mt-4 grid gap-x-10 gap-y-3 md:grid-cols-2">
          {reading ? (
            <div>
              <span className="field-label">how to read it</span>
              <p className="mt-1.5 text-[13px] leading-[1.7] text-ink-soft">
                {reading}
              </p>
            </div>
          ) : null}
          {whyItMatters ? (
            <div>
              <span className="field-label">why it matters when you prompt</span>
              <p className="mt-1.5 text-[13px] leading-[1.7] text-ink-soft">
                {whyItMatters}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </figure>
  );
}
