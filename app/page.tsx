import type { Metadata } from "next";
import Link from "next/link";
import { PageHead } from "@/components/site/page-head";
import { Break } from "@/components/site/break";
import { PromptFragment } from "@/components/site/register";
import { LAYERS } from "@/lib/layers";
import { CONCEPTS } from "@/lib/concepts";
import { STEPS } from "@/lib/getting-started";
import { BUILD_LOG } from "@/lib/build-log";

export const metadata: Metadata = {
  title: "Glassbox — how AI-built web apps actually work",
};

export default function Home() {
  const demosBuilt = CONCEPTS.filter((concept) => concept.demoId).length;

  const status = [
    { label: "layer 00 · getting started", value: `${STEPS.length} steps` },
    {
      label: "layer 01 · concepts",
      value: `${CONCEPTS.length} concepts · ${demosBuilt} demo built`,
    },
    { label: "layer 02 · build log", value: `${BUILD_LOG.length} entries` },
    { label: "backend", value: "none yet · all state simulated in the browser" },
  ];

  return (
    <>
      <PageHead
        layer="—"
        layerNote="why this exists"
        title="What the tool built while you were typing"
        lede="You can describe an app well enough to get a working one, and still have no idea what is running underneath it. Glassbox is a short course in that underneath: the setup a project needs before the first prompt, the mechanisms that decide whether it holds up, and a running record of building this site."
      />

      <section className="mt-14">
        <h2 className="type-section">The three layers</h2>
        <p className="mt-3 max-w-[68ch] text-ink-soft">
          The site goes one level deeper at a time. Layer 0 is the bench you set
          up before building. Layer 1 is the mechanism inside a running app.
          Layer 2 is the record of how this particular app was made, including
          the parts that went wrong. Read them in order, or jump to whichever
          one answers the question you have right now.
        </p>

        {/*
          The page's one motion moment: the index prints itself on load. Each
          row's rule draws left to right and its label settles in behind the
          rule, top to bottom. Nothing here is scroll-triggered and nothing else
          on the page moves.
        */}
        <ol className="mt-7 border-t border-rule">
          {LAYERS.map((layer, index) => (
            <li key={layer.href} className="relative">
              <Link
                href={layer.href}
                className="group grid gap-x-8 gap-y-1.5 py-5 md:grid-cols-[56px_minmax(0,1fr)] xl:grid-cols-[56px_minmax(0,1fr)_236px]"
              >
                <span className="font-mono text-[11px] tnum text-ink-faint">
                  {layer.code}
                </span>
                <span className="min-w-0">
                  <span
                    className="type-entry settle-in block transition-colors group-hover:text-accent"
                    style={{ animationDelay: `${index * 90 + 130}ms` }}
                  >
                    {layer.label}
                  </span>
                  <span className="mt-1 block max-w-[62ch] text-[13.5px] leading-[1.65] text-ink-soft">
                    {layer.summary}
                  </span>
                </span>
                <span className="hidden font-mono text-[10.5px] leading-[1.6] text-ink-faint xl:block">
                  {layer.contents}
                </span>
              </Link>
              <span
                aria-hidden
                className="draw-rule absolute bottom-0 left-0 h-px w-full bg-rule"
                style={{ animationDelay: `${index * 90}ms` }}
              />
            </li>
          ))}
        </ol>

        <PromptFragment label="which one first">
          If you are about to start something, read layer 00 in order, before you
          prompt. If something is already running and you want to know what it is
          doing, layer 01 stands on its own. Layer 02 is the record of this
          site&rsquo;s own build, and its second entry is the demo sitting on
          layer 01.
        </PromptFragment>
      </section>

      <section className="mt-14">
        <h2 className="type-section">Where this is up to</h2>
        <p className="mt-3 max-w-[68ch] text-ink-soft">
          Stated plainly, because a site about how things actually work should
          not be vague about its own state. One interactive demo is built so
          far. It is the proof of concept for every demo that follows, and it is
          worth opening first if you only have two minutes.
        </p>

        <dl className="mt-6 border-t border-rule">
          {status.map((row) => (
            <div
              key={row.label}
              className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1 border-b border-rule py-2.5"
            >
              <dt className="font-mono text-[11px] text-ink-faint">
                {row.label}
              </dt>
              <dd className="readout text-[11px] text-ink-soft">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-6 max-w-[68ch] text-[13.5px] leading-[1.7] text-ink-soft">
          There is no server yet, which is deliberate: this first pass exists to
          get the explanations and the interactions right. Every request,
          counter and state change you click through is simulated in the browser
          and nothing leaves the page.
        </p>

        <Break
          kind="flow"
          label="the path layer 01 follows, one click at a time"
          steps={[
            "browser asks",
            "request travels",
            "server decides",
            "response returns",
            "page updates",
          ]}
          note="Ten mechanisms sit along this path. 1.07 is the one built to watch happen live."
        />

        <p className="mt-4 font-mono text-[11px] text-ink-faint">
          start here:{" "}
          <Link
            href="/concepts#rate-limiting"
            className="text-accent underline decoration-rule-strong underline-offset-[3px] hover:decoration-accent"
          >
            1.07 rate limiting
          </Link>
        </p>
      </section>
    </>
  );
}
