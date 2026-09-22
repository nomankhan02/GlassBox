"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";

export type RegisterItem = {
  id: string;
  /** Ordinal, set in mono. */
  code: string;
  title: string;
  /** The question or purpose line, always visible. */
  asks: string;
  /** Margin note, shown beside the row on wide screens. */
  marginalia: string;
  status?: ReactNode;
  /** Revealed when the row is opened. */
  panel: ReactNode;
};

/*
  The register is the site's central interaction and the whole "glassbox" idea in
  a layout: a list of closed cases. Each one shows only its label and the
  question it answers, and clicking it opens the casing to reveal the mechanism
  underneath. Only one case is open at a time, so the page keeps its shape.

  There is no blur, no overlay and no transparency effect. What makes it feel
  see-through is that the workings are actually there when you open it.
*/
export function RegisterList({ items }: { items: RegisterItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  /*
    Support deep links such as /concepts#rate-limiting, and in-page links from
    one entry to another. The effect is keyed on the joined ids rather than on
    the array, so it does not re-run (and re-open a closed row) on every render.
  */
  const itemIdKey = items.map((item) => item.id).join("|");

  useEffect(() => {
    const registry = itemIdKey.split("|");

    const openFromHash = () => {
      const hash = window.location.hash.slice(1);
      if (hash && registry.includes(hash)) setOpenId(hash);
    };

    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [itemIdKey]);

  const transition = {
    duration: reduceMotion ? 0 : 0.3,
    ease: "easeOut" as const,
  };

  return (
    <ol className="border-t border-rule">
      {items.map((item) => {
        const open = openId === item.id;
        const panelId = `${item.id}-panel`;

        return (
          <li key={item.id} id={item.id} className="border-b border-rule">
            <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_184px] xl:gap-x-8">
              <div className="min-w-0">
                <h3 className="font-normal">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : item.id)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    className="flex w-full items-start gap-4 py-5 text-left"
                  >
                    <span className="mt-[7px] w-7 shrink-0 font-mono text-[11px] tnum text-ink-faint">
                      {item.code}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                        <span className="font-serif text-[19px] leading-[1.3] tracking-[-0.01em]">
                          {item.title}
                        </span>
                        {item.status}
                      </span>
                      <span className="mt-1 block max-w-[62ch] text-[13.5px] leading-[1.6] text-ink-soft">
                        {item.asks}
                      </span>
                    </span>

                    <DisclosureMark open={open} transition={transition} />
                  </button>
                </h3>

                <AnimatePresence initial={false}>
                  {open ? (
                    <motion.div
                      id={panelId}
                      key="panel"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={transition}
                      className="overflow-hidden"
                    >
                      <div className="pb-9 xl:pl-11">{item.panel}</div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <p className="hidden font-mono text-[11px] leading-[1.6] text-ink-faint xl:block xl:border-l xl:border-rule xl:py-6 xl:pl-6">
                {item.marginalia}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/*
  A plus that loses its upright stroke when the case is open. It is drawn from
  two divs rather than imported, and it does not rotate.
*/
function DisclosureMark({
  open,
  transition,
}: {
  open: boolean;
  transition: { duration: number; ease: "easeOut" };
}) {
  return (
    <span aria-hidden className="relative mt-2 size-[13px] shrink-0">
      <span className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-ink-faint" />
      <motion.span
        className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-ink-faint"
        animate={{ scaleY: open ? 0 : 1 }}
        transition={transition}
      />
    </span>
  );
}
