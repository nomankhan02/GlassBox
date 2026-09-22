import type { ReactNode } from "react";

export type PageHeadMeta = { label: string; value: ReactNode };

/*
  Every page opens the same way: which layer you are in, what the layer is for,
  then the readings for that layer. The kicker is the only place the layer
  numbers appear large, so the rail stays quiet.
*/
export function PageHead({
  layer,
  layerNote,
  title,
  lede,
  meta,
}: {
  layer: string;
  layerNote: string;
  title: string;
  lede: string;
  meta?: PageHeadMeta[];
}) {
  return (
    <header>
      <p className="flex items-center gap-3">
        <span className="field-label">layer {layer}</span>
        <span aria-hidden className="h-px w-7 bg-rule-strong" />
        <span className="field-label">{layerNote}</span>
      </p>

      <h1 className="mt-6 max-w-[24ch] text-[31px] md:text-[40px]">
        {title}
      </h1>
      <span
        aria-hidden
        className="mt-5 block h-[3px] w-14 bg-marker"
      />

      <p className="mt-5 max-w-[66ch] text-ink-soft">{lede}</p>

      {meta && meta.length > 0 ? (
        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-3 border-t border-rule pt-4">
          {meta.map((item) => (
            <div key={item.label} className="flex items-baseline gap-2.5">
              <dt className="field-label">{item.label}</dt>
              <dd className="readout text-[12px] text-ink-soft">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  );
}
