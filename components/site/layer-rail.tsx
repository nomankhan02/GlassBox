"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LAYERS } from "@/lib/layers";

/*
  Navigation is a layer index, not a menu bar. It sits in the left margin like
  the tab strip of a lab notebook and stays put while you read, so you always
  know which layer you are standing in and how far down it is.

  A layer is marked active by a filled square and an accent label. No pills, no
  underline sweep, no animated indicator.
*/
export function LayerRail() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Layers"
      className="border-b border-rule lg:sticky lg:top-8 lg:self-start lg:border-b-0 lg:pt-12 lg:pr-8"
    >
      <p className="hidden pb-3 field-label lg:block">layers</p>
      <ul className="flex gap-x-7 overflow-x-auto lg:flex-col lg:gap-x-0">
        {LAYERS.map((layer) => {
          const active =
            layer.href === "/"
              ? pathname === "/"
              : pathname.startsWith(layer.href);

          return (
            <li
              key={layer.href}
              className="shrink-0 lg:border-b lg:border-rule lg:last:border-b-0"
            >
              <Link
                href={layer.href}
                aria-current={active ? "page" : undefined}
                className="flex items-center gap-2.5 py-3 lg:items-start lg:gap-2"
              >
                <span
                  aria-hidden
                  className={`mt-[7px] size-[6px] shrink-0 transition-all duration-200 ease-soft ${
                    active
                      ? "scale-110 border-accent bg-accent shadow-[0_0_0_3px_var(--color-accent-tint)]"
                      : "border-rule-strong bg-transparent"
                  }`}
                />
                <span className="min-w-0">
                  <span className="flex items-baseline gap-2 whitespace-nowrap">
                    <span
                      className={`font-mono text-[11px] tnum ${
                        active ? "text-accent" : "text-ink-faint"
                      }`}
                    >
                      {layer.code}
                    </span>
                    <span
                      className={`type-nav ${
                        active ? "text-accent" : "text-ink-soft"
                      }`}
                    >
                      {layer.label}
                    </span>
                  </span>
                  <span className="mt-0.5 hidden font-mono text-[10.5px] text-ink-faint lg:block">
                    {layer.note}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
