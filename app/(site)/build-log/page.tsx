import type { Metadata } from "next";
import { PageHead } from "@/components/site/page-head";
import { Break } from "@/components/site/break";
import { BUILD_LOG, FAULT_LEGEND, QUEUED } from "@/lib/build-log";

export const metadata: Metadata = {
  title: "Build log",
  description:
    "The prompts that built this site, what came back wrong, and how it was corrected. Kept because the corrections are the useful part.",
};

export default function BuildLogPage() {
  const first = BUILD_LOG[0];
  const latest = BUILD_LOG[BUILD_LOG.length - 1];

  const totalFaults = BUILD_LOG.reduce(
    (total, entry) => total + entry.faults.length,
    0,
  );
  const promptFaults = BUILD_LOG.reduce(
    (total, entry) =>
      total + entry.faults.filter((fault) => fault.source === "prompt").length,
    0,
  );

  return (
    <>
      <PageHead
        layer="02"
        layerNote="the record"
        title="Prompts, faults, and corrections"
        lede="The prompts that built this site, recorded as they were sent. What is kept here is not the output. It is the three things around it: the wording that went in, what was wrong with what came back, and what changed as a result."
        meta={[
          { label: "entries", value: BUILD_LOG.length },
          { label: "first", value: first.dateLabel },
          { label: "latest", value: latest.dateLabel },
        ]}
      />

      <section className="mt-10 max-w-[70ch]">
        <h2 className="type-section">How this log works</h2>
        <div className="mt-3 space-y-4 text-ink-soft">
          <p>
            Each entry has the same three parts, and the faults are labelled by
            where they came from. That label matters more than it looks. A fault
            in the output is fixed by asking again. A fault in the prompt gets
            fixed only after you notice it, and by then several files have been
            built on top of the decision. Most of the faults below were in the
            prompt.
          </p>
          <p>
            Prompts are transcribed, not tidied up. Where the useful part of a
            prompt was a constraint rather than a description, the constraint is
            quoted as it was given.
          </p>
        </div>

        {/*
          The page's one motion moment: the fault legend stamps in row by row
          on load. These four labels are the page's vocabulary, and it is the
          only thing on the page that moves.
        */}
        <dl className="mt-6 border-t border-rule pt-4">
          {Object.entries(FAULT_LEGEND).map(([source, meaning], index) => (
            <div
              key={source}
              className="settle-in flex flex-wrap gap-x-4 gap-y-1 border-b border-rule/70 py-2 last:border-b-0 md:flex-nowrap"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <dt className="w-[82px] shrink-0 font-mono text-[10.5px] text-ink-soft">
                [{source}]
              </dt>
              <dd className="font-mono text-[10.5px] leading-[1.6] text-ink-faint">
                {meaning}
              </dd>
            </div>
          ))}
        </dl>

        <Break
          kind="stats"
          label="what the record contains so far"
          stats={[
            {
              value: String(BUILD_LOG.length),
              label: "entries, transcribed as they were sent",
            },
            {
              value: String(totalFaults),
              label: "faults recorded across them",
            },
            {
              value: String(promptFaults),
              label: "where the fault was in the prompt, not the output",
            },
          ]}
          note="Counted from the entries below, so it cannot drift from them."
        />
      </section>

      {BUILD_LOG.map((entry) => (
        <article key={entry.id} className="mt-16">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t-2 border-ink/85 pt-3">
            <span className="field-label">entry {entry.id}</span>
            <span className="field-label">{entry.dateLabel}</span>
          </div>

          <h2 className="mt-4 text-[21px] md:text-[24px]">{entry.title}</h2>
          <p className="mt-3 max-w-[70ch] text-ink-soft">{entry.context}</p>

          <div className="mt-6 border-l-2 border-accent bg-paper-sunk/70 py-3.5 pr-5 pl-4">
            <span className="field-label">the prompt, as sent</span>
            <p className="mt-2 max-w-[72ch] font-mono text-[12.5px] leading-[1.7] text-ink">
              {entry.prompt}
            </p>
            {entry.promptNote ? (
              <p className="mt-3 max-w-[72ch] font-mono text-[11px] leading-[1.65] text-ink-faint">
                {entry.promptNote}
              </p>
            ) : null}
          </div>

          <div className="mt-8 grid gap-x-12 gap-y-8 lg:grid-cols-2">
            <section>
              <h3 className="field-label">what was wrong</h3>
              <ul className="mt-4 space-y-5">
                {entry.faults.map((fault, index) => (
                  <li key={index}>
                    <span className="inline-block border border-rule-strong px-1.5 py-px font-mono text-[10px] text-ink-soft">
                      [{fault.source}]
                    </span>
                    <p className="mt-2 text-[13.5px] leading-[1.7] text-ink-soft">
                      {fault.text}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="field-label">what changed</h3>
              <ol className="mt-4 space-y-3.5">
                {entry.correction.map((item, index) => (
                  <li key={index} className="flex gap-3">
                    <span
                      aria-hidden
                      className="mt-[9px] size-[5px] shrink-0 border border-ink-faint"
                    />
                    <span className="text-[13.5px] leading-[1.7] text-ink-soft">
                      {item}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <div className="mt-8 border-t border-rule pt-4">
            <span className="field-label">the part worth keeping</span>
            <p className="mt-2 max-w-[70ch] text-[14.5px] leading-[1.7]">
              {entry.lesson}
            </p>
          </div>
        </article>
      ))}

      <section className="mt-20">
        <h2 className="type-section">Queued, and deliberately not built</h2>
        <p className="mt-3 max-w-[70ch] text-ink-soft">
          A hardening pass belongs at the end of this project, once there is
          something real to harden. It is written down here rather than built,
          and most of these items are already described in layers 0 and 1. When
          they are built they will be woven into the entry they belong to, not
          gathered into a separate security section.
        </p>

        <dl className="mt-7 border-t border-rule">
          {QUEUED.map((item) => (
            <div
              key={item.label}
              className="grid gap-x-8 gap-y-1 border-b border-rule py-3.5 md:grid-cols-[minmax(0,1fr)_176px] xl:grid-cols-[minmax(0,1fr)_156px_minmax(0,1.15fr)]"
            >
              <dt className="text-[13.5px] text-ink">{item.label}</dt>
              <dd className="font-mono text-[10.5px] leading-[1.6] text-ink-faint">
                {item.where}
              </dd>
              <dd className="text-[12.5px] leading-[1.65] text-ink-soft">
                {item.note}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
