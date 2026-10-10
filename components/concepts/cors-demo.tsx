"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ALLOW,
  allowOf,
  ORIGINS,
  originOf,
  PAYLOAD,
  read,
  respond,
  type AllowId,
  type OriginId,
  type ReadDecision,
  type ServerResponse,
} from "@/lib/cors";

/** The site's one soft curve, shared with the CSS theme. */
const EASE_SOFT: [number, number, number, number] = [0.22, 1, 0.36, 1];

type NodeState = "idle" | "active" | "ok";
type Tone = "idle" | "ok" | "warn" | "bad";
type Note = { tone: Tone; text: string };

const TONE_CLASS: Record<Tone, string> = {
  idle: "text-ink-soft",
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
};

const TONE_DOT: Record<Tone, string> = {
  idle: "bg-ink-faint/60",
  ok: "bg-ok",
  warn: "bg-warn",
  bad: "bg-bad",
};

const NODE_CLASS: Record<NodeState, string> = {
  idle: "border-rule-strong bg-paper-raised",
  active: "border-accent bg-accent-tint/40",
  ok: "border-ok bg-ok-tint/30",
};

const INITIAL_NOTE: Note = {
  tone: "idle",
  text: "Nothing sent yet. Pick which origin is making the call and what the server's header says, then press Send request. Watch the request arrive and the server answer, whatever you picked.",
};

const BTN_PRIMARY =
  "border border-accent bg-accent px-3.5 py-2 font-mono text-[11px] tracking-[0.06em] uppercase text-paper transition-colors hover:border-ink hover:bg-ink active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45";
const BTN_QUIET =
  "border border-rule-strong px-3 py-1.5 font-mono text-[10.5px] tracking-[0.06em] uppercase text-ink-faint transition-colors hover:border-ink-faint hover:text-ink-soft active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45";

/*
  The 1.08 diagram, made to move: two origins on the left, one server on the
  right, the boundary between them.

  The demo is built so the nuance cannot be missed. The request always reaches
  the server and the server always answers, with whatever header is configured —
  the response panel fills in on every run. What changes is the second panel:
  whether the browser lets the page's script read what came back. The wildcard
  is shown succeeding for the other origin on purpose, so it reads as protection
  removed rather than an error fixed.
*/
export function CorsDemo() {
  const [origin, setOrigin] = useState<OriginId>("mine");
  const [allow, setAllow] = useState<AllowId>("specific");
  const [originStates, setOriginStates] = useState<Record<OriginId, NodeState>>({
    mine: "idle",
    attacker: "idle",
  });
  const [serverState, setServerState] = useState<NodeState>("idle");
  const [response, setResponse] = useState<ServerResponse | null>(null);
  const [result, setResult] = useState<ReadDecision | null>(null);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<Note>(INITIAL_NOTE);

  const timersRef = useRef<number[]>([]);
  const reduceMotion = useReducedMotion();

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const clearRun = useCallback(() => {
    clearTimers();
    setOriginStates({ mine: "idle", attacker: "idle" });
    setServerState("idle");
    setResponse(null);
    setResult(null);
    setRunning(false);
  }, [clearTimers]);

  const chooseOrigin = useCallback(
    (next: OriginId) => {
      setOrigin(next);
      clearRun();
      setNote({
        tone: "idle",
        text: `${originOf(next).label} will make the call. Send a request to see where it stops.`,
      });
    },
    [clearRun],
  );

  const chooseAllow = useCallback(
    (next: AllowId) => {
      setAllow(next);
      clearRun();
      setNote({ tone: "idle", text: `The server will now answer with ${allowOf(next).label}. Send a request.` });
    },
    [clearRun],
  );

  const send = useCallback(() => {
    clearTimers();
    const caller = originOf(origin);
    const config = allowOf(allow);
    const answer = respond(config);
    const decision = read(caller, answer);
    const step = reduceMotion ? 0 : 1;

    setRunning(true);
    setResponse(null);
    setResult(null);
    setServerState("idle");
    setOriginStates({
      mine: origin === "mine" ? "active" : "idle",
      attacker: origin === "attacker" ? "active" : "idle",
    });
    setNote({
      tone: "idle",
      text: `The request left ${caller.host} for the server. This leg always happens, whatever the origin.`,
    });

    const at = (ms: number, run: () => void) => {
      timersRef.current.push(window.setTimeout(run, ms));
    };

    at(320 * step, () => {
      setOriginStates((prev) => ({ ...prev, [origin]: "ok" }));
      setServerState("active");
      setNote({
        tone: "idle",
        text: "The request reached the server. It arrives regardless of origin — CORS is not the server refusing traffic.",
      });
    });

    at(660 * step, () => {
      setServerState("ok");
      setResponse(answer);
      setNote({
        tone: "idle",
        text: `The server answered 200 with Access-Control-Allow-Origin: ${config.header}. The server always answers; it does not enforce CORS itself.`,
      });
    });

    at(1020 * step, () => {
      setResult(decision);
      setRunning(false);
      setNote(
        decision.readable
          ? { tone: "ok", text: decision.reason }
          : { tone: "bad", text: decision.reason },
      );
    });
  }, [allow, clearTimers, origin, reduceMotion]);

  const reset = useCallback(() => {
    clearRun();
    setOrigin("mine");
    setAllow("specific");
    setNote(INITIAL_NOTE);
  }, [clearRun]);

  const blocked = result !== null && !result.readable;
  /* A wildcard makes a read possible, not safe: it is marked apart from a real allow. */
  const wildcard = result !== null && result.readable && response?.header === "*";
  const readTone: Tone = result
    ? result.readable
      ? wildcard
        ? "warn"
        : "ok"
      : "bad"
    : "idle";
  const connectorTone: Tone =
    result !== null
      ? readTone
      : serverState !== "idle"
        ? "ok"
        : "idle";

  const transition = { duration: reduceMotion ? 0 : 0.28, ease: EASE_SOFT };

  return (
    <div aria-label="CORS simulation">
      {/* The client half. Choosing an origin and a header is all it can do. */}
      <div className="border-b border-rule bg-accent-tint/40 px-5 pt-4 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 max-w-[50ch]">
            <span className="field-label">client · the browser</span>
            <p className="mt-1 text-[12px] leading-[1.55] text-ink-faint">
              You are here. Pick the origin making the call and the header the
              server sends, then send one request and see what the page is
              allowed to read.
            </p>
          </div>
          <span className="font-mono text-[10.5px] text-ink-faint">
            the browser enforces this · the server does not
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <span className="field-label block">the page&rsquo;s origin</span>
            <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="origin">
              {ORIGINS.map((option) => {
                const active = origin === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => chooseOrigin(option.id)}
                    className={`flex items-start gap-2 border px-3 py-1.5 text-left ${
                      active
                        ? "border-accent bg-paper-raised"
                        : "border-rule-strong bg-paper-raised/60 hover:border-ink-faint"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`mt-[5px] size-[6px] shrink-0 ${
                        option.onList ? "bg-accent" : "bg-bad"
                      } ${active ? "" : "opacity-40"}`}
                    />
                    <span>
                      <span
                        className={`block font-mono text-[11.5px] ${
                          active ? "text-ink" : "text-ink-soft"
                        }`}
                      >
                        {option.label}
                      </span>
                      <span className="mt-0.5 block font-mono text-[9.5px] whitespace-nowrap text-ink-faint">
                        {option.note}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="field-label block">server config</span>
            <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="server config">
              {ALLOW.map((option) => {
                const active = allow === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => chooseAllow(option.id)}
                    className={`border px-3 py-1.5 font-mono text-[11px] ${
                      active
                        ? "border-accent bg-paper-raised text-ink"
                        : "border-rule-strong bg-paper-raised/60 text-ink-faint hover:text-ink-soft"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            className={BTN_PRIMARY}
            onClick={send}
            disabled={running}
          >
            Send request
          </button>
        </div>
      </div>

      {/* The boundary. The browser sits here, on the client's side of the wire. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-dashed border-rule-strong bg-paper-sunk/60 px-5 py-1.5">
        <span className="field-label">the browser boundary</span>
        <span className="font-mono text-[10px] text-ink-faint">
          requests cross it · responses are checked here, not at the server
        </span>
      </div>

      <div className="px-5 py-6">
        {/* The diagram: two origins, one server, the boundary between. */}
        <div className="flex flex-col items-stretch md:flex-row md:items-stretch">
          <div className="flex min-w-0 flex-col gap-3 md:flex-1">
            {ORIGINS.map((option) => {
              const state = originStates[option.id];
              const selected = origin === option.id;
              return (
                <div
                  key={option.id}
                  className={`min-w-0 border px-3 py-2.5 ${NODE_CLASS[state]}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-ink">
                      {option.label}
                    </span>
                    <NodeMark
                      state={state}
                      reduceMotion={!!reduceMotion}
                    />
                  </div>
                  <span className="mt-0.5 block font-mono text-[9.5px] text-ink-faint">
                    {option.onList ? "on the allow-list" : "not on the allow-list"}
                  </span>
                  <span className="mt-1.5 block font-mono text-[9.5px] text-ink-faint">
                    {selected
                      ? "making this request"
                      : "not the caller this time"}
                  </span>
                </div>
              );
            })}
          </div>

          <Connector
            label={
              blocked
                ? "response withheld at the boundary"
                : result
                  ? "request · response readable"
                  : "the request"
            }
            tone={connectorTone}
          />

          <div className="min-w-0 md:flex-1">
            <div
              className={`h-full min-w-0 border px-3 py-2.5 ${NODE_CLASS[serverState]}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-ink">the server</span>
                <NodeMark state={serverState} reduceMotion={!!reduceMotion} />
              </div>
              <span className="mt-0.5 block font-mono text-[9.5px] text-ink-faint">
                answers every origin
              </span>
              <span className="mt-1.5 block font-mono text-[9.5px] leading-[1.5] text-ink-faint">
                it has no idea CORS exists. It sets a header and returns the
                data; the browser decides who may read it.
              </span>
            </div>
          </div>
        </div>

        {/* The two panels that carry the whole distinction. */}
        <div className="mt-4 grid gap-px bg-rule md:grid-cols-2">
          <Panel
            label="the server's response"
            aside={
              response ? (
                <span className="readout text-[11px] text-ok">
                  {response.status}
                </span>
              ) : (
                <span className="font-mono text-[10px] text-ink-faint">
                  awaiting a request
                </span>
              )
            }
          >
            {response ? (
              <>
                <p className="mt-2 break-all font-mono text-[10.5px] leading-[1.5] text-ink-soft">
                  <span className="text-ink-faint">Access-Control-Allow-Origin: </span>
                  {response.header}
                </p>
                <p className="mt-2 break-all border border-rule bg-paper-sunk/50 px-2.5 py-2 font-mono text-[10px] leading-[1.5] text-ink-soft">
                  {response.body}
                </p>
                <p className="mt-2 font-mono text-[10.5px] leading-[1.5] text-ink-faint">
                  this arrived and this was answered on every run. The server
                  never blocks a request; that is not what CORS is.
                </p>
              </>
            ) : (
              <p className="mt-3 border border-dashed border-rule-strong px-3 py-6 text-center font-mono text-[11px] text-ink-faint">
                nothing sent yet
              </p>
            )}
          </Panel>

          <Panel
            label="what the page's script can read"
            aside={<span className="font-mono text-[10px] text-ink-faint">the browser decides</span>}
          >
            {result ? (
              result.readable ? (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={transition}
                  className={`mt-2 border px-3 py-3 ${
                    wildcard
                      ? "border-warn/50 bg-warn-tint/30"
                      : "border-ok/50 bg-ok-tint/30"
                  }`}
                >
                  <span
                    className={`field-label ${
                      wildcard ? "text-warn" : "text-ok"
                    }`}
                  >
                    {wildcard ? "readable · wildcard" : "readable"}
                  </span>
                  {wildcard ? (
                    <p className="mt-2 font-mono text-[10.5px] leading-[1.6] text-warn">
                      the body rendered, and that is the problem: Access-Control-Allow-Origin: *
                      lets every origin read it, so this is the protection removed
                      rather than an error fixed.
                    </p>
                  ) : null}
                  <dl className="mt-2 space-y-1">
                    {PAYLOAD.map((field) => (
                      <div
                        key={field.label}
                        className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-rule/60 py-0.5 last:border-b-0"
                      >
                        <dt className="font-mono text-[10px] text-ink-faint">
                          {field.label}
                        </dt>
                        <dd className="break-all text-right font-mono text-[11px] text-ink-soft">
                          {field.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </motion.div>
              ) : (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={transition}
                  className="mt-2 border border-bad/50 bg-bad-tint/30 px-3 py-3"
                >
                  <span className="field-label text-bad">blocked by CORS policy</span>
                  <p className="mt-2 font-mono text-[10.5px] leading-[1.6] text-bad">
                    the response arrived with Allow-Origin: {response?.header},
                    which does not match this page&rsquo;s origin. The browser
                    will not hand the body to this page&rsquo;s script, so there
                    is nothing to read here — not because the server refused,
                    but because the browser did.
                  </p>
                </motion.div>
              )
            ) : (
              <p className="mt-3 border border-dashed border-rule-strong px-3 py-6 text-center font-mono text-[11px] text-ink-faint">
                no response to read yet
              </p>
            )}
          </Panel>
        </div>
      </div>

      {/* The readout: one sentence, rewritten every time state changes. */}
      <div className="border-t border-rule bg-paper-sunk/40 px-5 py-4">
        <span className="field-label">what just changed</span>
        <p
          aria-live="polite"
          className={`mt-2 flex items-start gap-2.5 text-[13.5px] leading-[1.7] ${TONE_CLASS[note.tone]}`}
        >
          {response ? (
            <span
              className={`readout mt-[1px] shrink-0 ${
                blocked
                  ? "text-bad"
                  : wildcard
                    ? "text-warn"
                    : "text-ok"
              }`}
            >
              {response.status}
            </span>
          ) : (
            <span
              aria-hidden
              className={`mt-[9px] size-[6px] shrink-0 ${TONE_DOT[note.tone]}`}
            />
          )}
          <span className="max-w-[76ch]">{note.text}</span>
        </p>
      </div>

      {/* The bench control. This moves the simulation, not the app. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-dashed border-rule px-5 py-3">
        <span className="field-label">simulation controls</span>
        <button type="button" className={BTN_QUIET} onClick={reset}>
          Reset
        </button>
        <p className="max-w-[56ch] font-mono text-[10.5px] leading-[1.5] text-ink-faint">
          allow-origin: * is not a fix for a CORS error. It is the same data,
          readable by every site, in the visitor&rsquo;s browser.
        </p>
      </div>
    </div>
  );
}

function Panel({
  label,
  aside,
  children,
}: {
  label: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bg-paper-raised px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="field-label">{label}</span>
        {aside}
      </div>
      {children}
    </div>
  );
}

function NodeMark({
  state,
  reduceMotion,
}: {
  state: NodeState;
  reduceMotion: boolean;
}) {
  if (state === "active") {
    return (
      <motion.span
        aria-hidden
        className="size-[6px] shrink-0 bg-accent"
        animate={reduceMotion ? { opacity: 1 } : { opacity: [1, 0.3, 1] }}
        transition={{ duration: 1, repeat: reduceMotion ? 0 : Infinity }}
      />
    );
  }
  if (state === "ok") {
    return <span aria-hidden className="size-[6px] shrink-0 bg-ok" />;
  }
  return (
    <span
      aria-hidden
      className="size-[6px] shrink-0 border border-rule-strong bg-transparent"
    />
  );
}

/** The exchange between the origins and the server. */
function Connector({ label, tone }: { label: string; tone: Tone }) {
  const color =
    tone === "ok"
      ? "var(--color-ok)"
      : tone === "warn"
        ? "var(--color-warn)"
        : tone === "bad"
          ? "var(--color-bad)"
          : "var(--color-rule-strong)";

  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-1 px-2 md:w-[156px]">
      <span className="hidden max-w-[156px] text-center font-mono text-[9px] leading-[1.35] text-ink-faint md:block">
        {label}
      </span>
      <svg viewBox="0 0 34 12" aria-hidden className="hidden h-3 w-[34px] md:block">
        <line x1="0" y1="6" x2="26" y2="6" stroke={color} strokeWidth="1" />
        {tone === "bad" ? (
          <line x1="26" y1="1.5" x2="26" y2="10.5" stroke={color} strokeWidth="1" />
        ) : (
          <path d="M 26 2 L 32 6 L 26 10" fill="none" stroke={color} strokeWidth="1" />
        )}
      </svg>
      <svg viewBox="0 0 12 34" aria-hidden className="block h-[34px] w-3 md:hidden">
        <line x1="6" y1="0" x2="6" y2="26" stroke={color} strokeWidth="1" />
        {tone === "bad" ? (
          <line x1="1.5" y1="26" x2="10.5" y2="26" stroke={color} strokeWidth="1" />
        ) : (
          <path d="M 2 26 L 6 32 L 10 26" fill="none" stroke={color} strokeWidth="1" />
        )}
      </svg>
      <span className="block max-w-[200px] text-center font-mono text-[9px] leading-[1.35] text-ink-faint md:hidden">
        {label}
      </span>
    </div>
  );
}
