"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CONCEPTS, getConcept, type Concept } from "@/lib/concepts";
import {
  RegisterList,
  type RegisterItem,
} from "@/components/site/register-list";
import { PromptFragment, StatusTag } from "@/components/site/register";
import { RateLimitFigure } from "./rate-limit-figure";
import { PlannedDemo } from "./planned-demo";

/*
  Layer 1 as a register. Each concept is a closed case: the title and the
  question it answers are visible, and everything else is behind one click. The
  rows are numbered because the order is deliberate: later concepts assume the
  earlier ones, and the two authentication entries sit together because they are
  routinely treated as one thing.
*/
export function ConceptRegister() {
  const items: RegisterItem[] = useMemo(
    () =>
      CONCEPTS.map((concept) => ({
        id: concept.id,
        code: concept.code,
        title: concept.title,
        asks: concept.asks,
        marginalia: concept.marginalia,
        status: concept.demoId ? (
          <StatusTag tone="live">demo live</StatusTag>
        ) : (
          <StatusTag tone="planned">demo to come</StatusTag>
        ),
        panel: <ConceptPanel concept={concept} />,
      })),
    [],
  );

  return <RegisterList items={items} />;
}

function ConceptPanel({ concept }: { concept: Concept }) {
  const related = concept.related ? getConcept(concept.related) : undefined;

  return (
    <div>
      <div className="max-w-[70ch] space-y-4">
        {/* Static content, so positional keys are stable and correct here. */}
        {concept.plain.map((paragraph, index) => (
          <p key={index} className="text-ink-soft">
            {paragraph}
          </p>
        ))}
      </div>

      <PromptFragment>{concept.tell}</PromptFragment>

      {concept.demoId === "rate-limiting" ? (
        <RateLimitFigure />
      ) : (
        <PlannedDemo code={concept.code} note={concept.demoNote} />
      )}

      {related ? (
        <p className="mt-7 font-mono text-[11px] text-ink-faint">
          related:{" "}
          <Link
            href={`#${related.id}`}
            className="text-accent underline decoration-rule-strong underline-offset-[3px] hover:decoration-accent"
          >
            {related.code} {related.title}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
