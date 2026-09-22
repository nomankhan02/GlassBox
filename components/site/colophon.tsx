import Link from "next/link";
import { LAYERS } from "@/lib/layers";
import { BUILD_LOG } from "@/lib/build-log";

export function Colophon() {
  const latest = BUILD_LOG[BUILD_LOG.length - 1];

  return (
    <footer className="border-t border-rule py-9">
      <div className="flex flex-wrap items-start justify-between gap-x-12 gap-y-6">
        <p className="max-w-[54ch] font-mono text-[11px] leading-[1.75] text-ink-faint">
          <span className="block">
            Glassbox. Frontend only for now: every request, counter and state
            change on this site is simulated in the browser, and nothing leaves
            the page.
          </span>
          <span className="mt-2 block tnum">
            last entry {latest.id} · {latest.dateLabel}
          </span>
        </p>

        <nav aria-label="Layers" className="flex flex-wrap gap-x-6 gap-y-2">
          {LAYERS.map((layer) => (
            <Link
              key={layer.href}
              href={layer.href}
              className="font-mono text-[11px] text-ink-soft transition-colors hover:text-accent"
            >
              <span className="tnum text-ink-faint">{layer.code}</span>{" "}
              {layer.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
