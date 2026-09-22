import type { Metadata } from "next";
import { PageHead } from "@/components/site/page-head";
import { ConceptRegister } from "@/components/concepts/concept-register";
import { CONCEPTS } from "@/lib/concepts";

export const metadata: Metadata = {
  title: "Concepts",
  description:
    "Ten mechanisms that decide whether a web app holds up, written in plain language with the wording you could hand to an AI and a demo you click through yourself.",
};

export default function ConceptsPage() {
  const demosBuilt = CONCEPTS.filter((concept) => concept.demoId).length;

  return (
    <>
      <PageHead
        layer="01"
        layerNote="the mechanism"
        title="The mechanism underneath"
        lede="Ten mechanisms sitting between a request and a response. Each entry explains what it is in plain language, ends with the wording you could hand to a tool, and opens to show the mechanism happening rather than describing it."
        meta={[
          { label: "concepts", value: CONCEPTS.length },
          {
            label: "demos live",
            value: `${demosBuilt} of ${CONCEPTS.length}`,
          },
          { label: "order", value: "sequential" },
        ]}
      />

      <div className="mt-10 max-w-[70ch] space-y-4 text-ink-soft">
        <p>
          The order matters. Each mechanism assumes the ones before it: you
          cannot make sense of sessions without knowing where the boundary
          between browser and server sits, and rate limiting is a strange answer
          until you know that a request is a round trip with a cost attached.
        </p>
        <p>
          Every entry opens in place. Only one is written up with a working demo
          so far, marked on the row, and the rest will be built one at a time
          rather than all at once. The demo that exists is the model for the
          others: state on screen, moved by clicking, explained as it changes.
        </p>
      </div>

      <div className="mt-11">
        <ConceptRegister />
      </div>
    </>
  );
}
