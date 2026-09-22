import type { Metadata } from "next";
import { PageHead } from "@/components/site/page-head";
import { StepRegister } from "@/components/steps/step-register";
import { STEPS } from "@/lib/getting-started";

export const metadata: Metadata = {
  title: "Getting started",
  description:
    "What a project needs in place before the first prompt: a folder, version control, a list of things that must never be committed, and a sketch of the architecture.",
};

export default function GettingStartedPage() {
  return (
    <>
      <PageHead
        layer="00"
        layerNote="the bench"
        title="Before the first prompt"
        lede="Five things to put in place before you ask a tool to build anything. Four of them guard against a mistake you cannot take back later, and the fifth changes the quality of everything that comes after it. They are written to be done in order."
        meta={[
          { label: "steps", value: STEPS.length },
          { label: "reading time", value: "about 12 minutes" },
          { label: "prerequisites", value: "none" },
        ]}
      />

      <div className="mt-10 max-w-[70ch] space-y-4 text-ink-soft">
        <p>
          None of this is about writing code. It is the setup that decides
          whether a project stays recoverable when something goes wrong, and
          with an AI in the loop things go wrong faster and in more files at
          once than they do by hand.
        </p>
        <p>
          Steps 0.03 and 0.04 come before the first commit on purpose. A file
          that was never tracked is invisible to git and stays that way. A file
          that was committed once is in the history for good, and the only real
          remedy is to rotate whatever was in it.
        </p>
      </div>

      <div className="mt-11">
        <StepRegister />
      </div>

      <p className="mt-9 max-w-[70ch] text-[13.5px] leading-[1.7] text-ink-soft">
        Once these five are in place, the next layer is what happens when a
        request actually arrives somewhere. That is layer{" "}
        <span className="font-mono text-[12px] text-ink-faint">01</span>, and its
        first entry is the boundary the other nine depend on.
      </p>
    </>
  );
}
