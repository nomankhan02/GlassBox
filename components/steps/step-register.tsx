"use client";

import { useMemo } from "react";
import { STEPS } from "@/lib/getting-started";
import {
  RegisterList,
  type RegisterItem,
} from "@/components/site/register-list";
import { PromptFragment, Specimen } from "@/components/site/register";

/*
  Layer 0 is a sequence, so the register is used in strict order and each row is
  written to be finished before the next one starts. The self-check at the bottom
  of each entry exists because "I did that" and "that is actually in place" are
  different states, and the whole layer is about the second one.
*/
export function StepRegister() {
  const items: RegisterItem[] = useMemo(
    () =>
      STEPS.map((step) => ({
        id: step.id,
        code: step.code,
        title: step.title,
        asks: step.purpose,
        marginalia: step.marginalia,
        panel: <StepPanel step={step} />,
      })),
    [],
  );

  return <RegisterList items={items} />;
}

function StepPanel({ step }: { step: (typeof STEPS)[number] }) {
  return (
    <div>
      <div className="max-w-[70ch] space-y-4">
        {/* Static content, so positional keys are stable and correct here. */}
        {step.plain.map((paragraph, index) => (
          <p key={index} className="text-ink-soft">
            {paragraph}
          </p>
        ))}
      </div>

      {step.specimen ? <Specimen items={step.specimen} /> : null}

      <PromptFragment>{step.tell}</PromptFragment>

      <div className="mt-6 border-t border-rule pt-3">
        <span className="field-label">how to know it is actually done</span>
        <p className="mt-1.5 max-w-[64ch] text-[13.5px] leading-[1.7] text-ink-soft">
          {step.check}
        </p>
      </div>
    </div>
  );
}
