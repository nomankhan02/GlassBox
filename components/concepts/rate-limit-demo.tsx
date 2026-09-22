"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  decide,
  elapsed,
  expire,
  identityOf,
  IDENTITIES,
  INITIAL_STATE,
  LIMIT,
  remainingMs,
  WINDOW_MS,
  type IdentityId,
  type State,
} from "@/lib/rate-limiter";

/** The site's one soft curve, shared with the CSS theme. */
const EASE_SOFT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Simulated round trip, so a request is visibly a round trip. */
const LATENCY_MS = 430;
/** Gap between the requests in a burst, so they arrive as separate requests. */
const BURST_GAP_MS = 240;
/** Gap inside a flood, tight enough to overflow the limit while you watch. */
const FLOOD_GAP_MS = 110;

const TONE_CLASS: Record<State["note"]["tone"], string> = {
  idle: "text-ink-soft",
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
};

const TONE_DOT: Record<State["note"]["tone"], string> = {
  idle: "bg-ink-faint/60",
  ok: "bg-ok",
  warn: "bg-warn",
  bad: "bg-bad",
};

/** One colour per key, reused in the log, the meters and the identity chips. */
const KEY_DOT: Record<IdentityId, string> = {
  anon: "bg-ink-faint",
  user: "bg-accent",
  service: "bg-marker",
};

const BTN_PRIMARY =
  "border border-accent bg-accent px-3.5 py-2 font-mono text-[11px] tracking-[0.06em] uppercase text-paper transition-colors hover:border-ink hover:bg-ink active:translate-y-px";
const BTN_SECONDARY =
  "border border-rule-strong bg-paper-raised px-3.5 py-2 font-mono text-[11px] tracking-[0.06em] uppercase text-ink-soft transition-colors hover:border-ink-faint hover:text-ink active:translate-y-px";
const BTN_QUIET =
  "border border-rule-strong px-3 py-1.5 font-mono text-[10.5px] tracking-[0.06em] uppercase text-ink-faint transition-colors hover:border-ink-faint hover:text-ink-soft active:translate-y-px";

/*
  The demo is a view onto the limiter in lib/rate-limiter.ts and nothing more.
  It can send a request, advance the clock, and read the state that comes back.
  It cannot set a counter, which is the whole point: in a real app that number
  is on a machine the visitor does not control.

  The frame is split into the two halves the concept is about: a client strip
  where the only power is to ask, a dashed boundary that is the network, and a
  server half where the counter actually lives.
*/
export function RateLimitDemo() {
  const [state, setState] = useState<State>(INITIAL_STATE);
  const [active, setActive] = useState<IdentityId>("anon");
  /* Zero until mounted. The clock is a readout, never a decision input. */
  const [clock, setClock] = useState(0);
  /* Windows that just closed, for a one-breath reset flash on the meters. */
  const [flash, setFlash] = useState<{ ids: IdentityId[]; key: number } | null>(
    null,
  );

  const offsetRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const prevWindowsRef = useRef(state.windows);
  const resettingRef = useRef(false);
  const reduceMotion = useReducedMotion();

  const transition = {
    duration: reduceMotion ? 0 : 0.28,
    ease: EASE_SOFT,
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now() + offsetRef.current;
      setClock(now);
      setState((prev) => expire(prev, now) ?? prev);
    }, 120);

    return () => {
      window.clearInterval(timer);
      for (const id of timersRef.current) window.clearTimeout(id);
      timersRef.current = [];
    };
  }, []);

  /* A window closing is worth one visible breath: the meter flashes and the
     note explains that the server did not announce anything. */
  useEffect(() => {
    const before = prevWindowsRef.current;
    prevWindowsRef.current = state.windows;

    if (resettingRef.current) {
      resettingRef.current = false;
      return;
    }

    const closed = IDENTITIES.filter(
      ({ id }) => before[id] && !state.windows[id],
    ).map(({ id }) => id);

    if (closed.length === 0) return;

    setFlash({ ids: closed, key: Date.now() });
    const timer = window.setTimeout(() => setFlash(null), 1100);
    return () => window.clearTimeout(timer);
  }, [state.windows]);

  /** Send one request, a burst, or a flood — each one a separate arrival. */
  const send = useCallback((identity: IdentityId, count: number, gap: number) => {
    for (let index = 0; index < count; index += 1) {
      const timer = window.setTimeout(
        () => {
          const now = Date.now() + offsetRef.current;
          setState((prev) => decide(prev, identity, now));
          setClock(now);
        },
        index * gap,
      );
      timersRef.current.push(timer);
    }
  }, []);

  const advance = useCallback(() => {
    offsetRef.current += WINDOW_MS + 250;
    setClock(Date.now() + offsetRef.current);
  }, []);

  const reset = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
    resettingRef.current = true;
    offsetRef.current = 0;
    setState(INITIAL_STATE);
    setClock(Date.now());
  }, []);

  const inFlight =
    clock > 0
      ? state.log.filter((entry) => clock < entry.arrival + LATENCY_MS).length
      : 0;

  return (
    <div aria-label="rate limiter simulation">
      {/* The client half. Everything in this strip can only result in a request. */}
      <div className="border-b border-rule bg-accent-tint/40 px-5 pt-4 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <span className="field-label">client · the browser</span>
            <p className="mt-1 max-w-[46ch] text-[12px] leading-[1.55] text-ink-faint">
              You are here. Nothing in this strip can touch the counter — the
              only power it has is to ask.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <div className="flex flex-wrap gap-2">
              {IDENTITIES.map((identity) => {
                const isActive = active === identity.id;
                return (
                  <button
                    key={identity.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setActive(identity.id)}
                    className={`flex items-start gap-2 border px-3 py-1.5 text-left ${
                      isActive
                        ? "border-accent bg-paper-raised"
                        : "border-rule-strong bg-paper-raised/60 hover:border-ink-faint"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`mt-[5px] size-[6px] shrink-0 ${KEY_DOT[identity.id]} ${
                        isActive ? "" : "opacity-40"
                      }`}
                    />
                    <span>
                      <span
                        className={`block font-mono text-[11.5px] ${
                          isActive ? "text-ink" : "text-ink-soft"
                        }`}
                      >
                        {identity.key}
                      </span>
                      <span className="mt-0.5 block font-mono text-[9.5px] whitespace-nowrap text-ink-faint">
                        {identity.sub}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={BTN_PRIMARY}
                onClick={() => send(active, 1, 0)}
              >
                Send request
              </button>
              <button
                type="button"
                className={BTN_SECONDARY}
                onClick={() => send(active, 3, BURST_GAP_MS)}
              >
                Send 3
              </button>
              <button
                type="button"
                className={BTN_SECONDARY}
                onClick={() => send(active, 8, FLOOD_GAP_MS)}
              >
                Flood 8
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* The boundary. Below this line, everything is the server's side. */}
      <div className="flex items-center justify-between gap-4 border-b border-dashed border-rule-strong bg-paper-sunk/60 px-5 py-1.5">
        <span className="field-label">the network boundary</span>
        <motion.span
          className={`font-mono text-[10px] whitespace-nowrap ${
            inFlight > 0 ? "text-warn" : "text-ink-faint"
          }`}
          animate={{ opacity: inFlight > 0 ? [1, 0.45, 1] : 1 }}
          transition={{
            duration: reduceMotion ? 0 : 0.9,
            repeat: inFlight > 0 ? Infinity : 0,
          }}
        >
          {inFlight > 0
            ? `${inFlight} request${inFlight === 1 ? "" : "s"} on the wire`
            : "wire idle · everything below runs where the counter lives"}
        </motion.span>
      </div>

      <div className="grid gap-px bg-rule lg:grid-cols-[minmax(0,1fr)_292px]">
        <LogCell
          state={state}
          clock={clock}
          transition={transition}
          reduceMotion={!!reduceMotion}
        />
        <MetersCell
          state={state}
          clock={clock}
          flash={flash}
          transition={transition}
        />
      </div>

      {/* The readout: one sentence, rewritten every time state changes. */}
      <div className="border-t border-rule bg-paper-sunk/40 px-5 py-4">
        <span className="field-label">what just changed</span>
        <p
          aria-live="polite"
          className={`mt-2 flex items-start gap-2.5 text-[13.5px] leading-[1.7] ${TONE_CLASS[state.note.tone]}`}
        >
          <span
            aria-hidden
            className={`mt-[9px] size-[6px] shrink-0 ${TONE_DOT[state.note.tone]}`}
          />
          <span className="max-w-[76ch]">{state.note.text}</span>
        </p>
      </div>

      {/* The bench controls. These move the simulation, not the app. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-dashed border-rule px-5 py-3">
        <span className="field-label">simulation controls</span>
        <button type="button" className={BTN_QUIET} onClick={advance}>
          Advance the clock 10 s
        </button>
        <button type="button" className={BTN_QUIET} onClick={reset}>
          Reset
        </button>
        <p className="font-mono text-[10.5px] text-ink-faint">
          the real window is ten seconds, so you would otherwise sit and wait
          for the reset
        </p>
      </div>
    </div>
  );
}

function Cell({
  label,
  aside,
  children,
}: {
  label: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bg-paper-raised px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="field-label">{label}</span>
        {aside}
      </div>
      {children}
    </div>
  );
}

function LogCell({
  state,
  clock,
  transition,
  reduceMotion,
}: {
  state: State;
  clock: number;
  transition: { duration: number; ease: [number, number, number, number] };
  reduceMotion: boolean;
}) {
  return (
    <Cell
      label="server log"
      aside={
        <span className="readout text-[10.5px] text-ink-faint">
          {state.seq} received
        </span>
      }
    >
      <p className="mt-1 max-w-[52ch] text-[12px] leading-[1.6] text-ink-faint">
        The server logs every request it receives, including the refused ones.
        The counter is a different thing, and it only moved for the allowed
        ones.
      </p>

      {state.log.length === 0 ? (
        <p className="mt-4 border border-dashed border-rule-strong px-3 py-6 text-center font-mono text-[11px] text-ink-faint">
          no requests yet
        </p>
      ) : (
        <ol className="mt-4">
          {state.log.map((entry) => {
            const identity = identityOf(entry.identity);
            const window = state.windows[entry.identity];
            const pending = clock > 0 && clock < entry.arrival + LATENCY_MS;
            const outsideWindow = !window || entry.arrival < window.startedAt;
            const allowed = entry.status === 200;

            return (
              <motion.li
                key={entry.seq}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={transition}
                className={`flex items-center gap-2.5 border-b border-rule/70 py-1.5 text-[11.5px] last:border-b-0 ${
                  outsideWindow ? "opacity-40" : ""
                }`}
              >
                <span
                  aria-hidden
                  className={`size-[6px] shrink-0 border ${
                    pending
                      ? "border-rule-strong bg-transparent"
                      : allowed
                        ? "border-ok bg-ok"
                        : "border-bad bg-bad"
                  }`}
                />
                <span className="w-9 shrink-0 readout text-[10.5px] text-ink-faint">
                  #{String(entry.seq).padStart(3, "0")}
                </span>
                <span
                  aria-hidden
                  className={`size-[6px] shrink-0 ${KEY_DOT[entry.identity]}`}
                />
                <span className="w-[92px] shrink-0 font-mono text-[11px] text-ink-soft">
                  {identity.key}
                </span>
                <span
                  className={`w-10 shrink-0 readout text-[11.5px] ${
                    pending
                      ? "text-ink-faint"
                      : allowed
                        ? "text-ok"
                        : "text-bad"
                  }`}
                >
                  {pending ? "····" : entry.status}
                </span>
                <span className="min-w-0 flex-1 font-mono text-[10.5px] text-ink-faint">
                  {pending
                    ? "in flight"
                    : allowed
                      ? "allowed"
                      : `refused · retry in ${entry.retryAfter}s`}
                </span>
              </motion.li>
            );
          })}
        </ol>
      )}

      <p className="mt-3 font-mono text-[10.5px] text-ink-faint">
        faded rows arrived before the current window opened, so they no longer
        count towards the limit
      </p>
    </Cell>
  );
}

function MetersCell({
  state,
  clock,
  flash,
  transition,
}: {
  state: State;
  clock: number;
  flash: { ids: IdentityId[]; key: number } | null;
  transition: { duration: number; ease: [number, number, number, number] };
}) {
  return (
    <Cell
      label="counter · per key"
      aside={<span className="font-mono text-[10px] text-ink-faint">server state</span>}
    >
      <p className="mt-1 text-[12px] leading-[1.6] text-ink-faint">
        Three keys, three allowances. Each is counted separately, on the server.
      </p>

      <div className="mt-4 space-y-5">
        {IDENTITIES.map((identity) => {
          const window = state.windows[identity.id];
          const used = window?.used ?? 0;
          const left = remainingMs(window, clock);
          const elapsedFraction = elapsed(window, clock);
          const full = used >= LIMIT;
          const flashing = flash?.ids.includes(identity.id) ?? false;
          const urgent = window !== null && left <= 3_000;

          return (
            <div key={identity.id} className="relative">
              <AnimatePresence>
                {flashing ? (
                  <motion.span
                    key={flash?.key}
                    aria-hidden
                    className="pointer-events-none absolute -inset-x-2 -inset-y-1.5 bg-marker-tint"
                    initial={{ opacity: 0.9 }}
                    animate={{ opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                ) : null}
              </AnimatePresence>

              <div className="relative flex items-baseline justify-between gap-x-2">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={`size-[6px] ${KEY_DOT[identity.id]}`}
                  />
                  <span className="font-mono text-[11.5px] text-ink">
                    {identity.key}
                  </span>
                </span>
                <span
                  className={`readout text-[12px] ${full ? "text-bad" : "text-ink-soft"}`}
                >
                  {used}
                  <span className="text-ink-faint"> / {LIMIT}</span>
                </span>
              </div>

              <div className="mt-2 flex gap-1" aria-hidden>
                {Array.from({ length: LIMIT }).map((_, index) => {
                  const filled = index < used;
                  return (
                    <span
                      key={index}
                      className={`relative block h-[17px] flex-1 border ${
                        full
                          ? "border-bad/50 bg-bad-tint"
                          : index === used
                            ? "border-warn/50 bg-paper-sunk"
                            : "border-rule-strong bg-paper-sunk"
                      }`}
                    >
                      <motion.span
                        className={`absolute inset-0 origin-bottom ${
                          full ? "bg-bad" : "bg-accent-bright"
                        }`}
                        animate={{
                          opacity: filled ? 1 : 0,
                          scaleY: filled ? 1 : 0.25,
                        }}
                        transition={transition}
                      />
                    </span>
                  );
                })}
              </div>

              <div className="mt-2.5 h-[4px] bg-paper-sunk">
                <div
                  className={`h-full transition-[width] duration-150 ease-linear ${
                    urgent ? "bg-warn" : "bg-accent-bright"
                  }`}
                  style={{ width: `${elapsedFraction * 100}%` }}
                />
              </div>

              <div className="mt-1.5 flex items-baseline justify-between font-mono text-[10.5px]">
                <span className="text-ink-faint">
                  {window ? "window open" : "no window"}
                </span>
                <span
                  className={`readout text-[11px] ${
                    urgent ? "text-warn" : "text-ink-faint"
                  }`}
                >
                  {window ? `${(left / 1000).toFixed(1)}s left` : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Cell>
  );
}
