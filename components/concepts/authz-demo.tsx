"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  evaluate,
  identityOf,
  IDENTITIES,
  RECORD,
  type GateId,
  type IdentityId,
} from "@/lib/auth-gates";

/** The site's one soft curve, shared with the CSS theme. */
const EASE_SOFT: [number, number, number, number] = [0.22, 1, 0.36, 1];

type NodeState = "idle" | "active" | "ok" | "bad" | "reached";
type Tone = "plain" | "ok" | "bad";

type NodeKey = "request" | "authn" | "authz" | "record";
type NodeStates = Record<NodeKey, NodeState>;

const IDLE_NODES: NodeStates = {
  request: "idle",
  authn: "idle",
  authz: "idle",
  record: "idle",
};

const NODES: { key: NodeKey; title: string; sub: string }[] = [
  { key: "request", title: "a request", sub: "with an identity claim" },
  { key: "authn", title: "gate 1", sub: "authentication" },
  { key: "authz", title: "gate 2", sub: "authorization" },
  { key: "record", title: `record ${RECORD.id}`, sub: `owned by ${RECORD.ownerLabel}` },
];

type Outcome = { status: 200 | 401 | 403; stopGate: GateId | null; reason: string };

const NODE_CLASS: Record<NodeState, string> = {
  idle: "border-rule-strong bg-paper-raised",
  active: "border-accent bg-accent-tint/40",
  ok: "border-ok bg-ok-tint/30",
  bad: "border-bad bg-bad-tint/30",
  reached: "border-ok bg-ok-tint/50",
};

const BTN_PRIMARY =
  "border border-accent bg-accent px-3.5 py-2 font-mono text-[11px] tracking-[0.06em] uppercase text-paper transition-colors hover:border-ink hover:bg-ink active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45";

/*
  The 1.04 schematic, made to move: a request enters gate 1, resolves, and only
  then reaches gate 2. The identity selector decides which gate says no, and the
  record content appears only when both gates have let the request through.

  The gates run on the server side of the dashed line. The client can choose an
  identity and press send; it cannot decide the outcome, which is the point the
  concept is making.
*/
export function AuthzDemo() {
  const [selected, setSelected] = useState<IdentityId>("anonymous");
  const [nodes, setNodes] = useState<NodeStates>(IDLE_NODES);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [running, setRunning] = useState(false);

  const timersRef = useRef<number[]>([]);
  const reduceMotion = useReducedMotion();

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const send = useCallback(() => {
    clearTimers();
    const identity = identityOf(selected);
    const result = evaluate(identity);
    const step = reduceMotion ? 0 : 1;

    setRunning(true);
    setOutcome(null);
    setNodes({ request: "active", authn: "idle", authz: "idle", record: "idle" });

    const at = (ms: number, run: () => void) => {
      timersRef.current.push(window.setTimeout(run, ms));
    };

    at(280 * step, () => {
      setNodes((prev) => ({ ...prev, request: "ok", authn: "active" }));
    });

    at(640 * step, () => {
      if (!result.passedAuthn) {
        setNodes((prev) => ({ ...prev, authn: "bad" }));
        setOutcome({
          status: result.status,
          stopGate: result.stopGate,
          reason: result.reason,
        });
        setRunning(false);
        return;
      }
      setNodes((prev) => ({ ...prev, authn: "ok", authz: "active" }));
    });

    at(1040 * step, () => {
      if (!result.passedAuthn) return;
      if (!result.passedAuthz) {
        setNodes((prev) => ({ ...prev, authz: "bad" }));
        setOutcome({
          status: result.status,
          stopGate: result.stopGate,
          reason: result.reason,
        });
        setRunning(false);
        return;
      }
      setNodes((prev) => ({ ...prev, authz: "ok", record: "active" }));
    });

    at(1400 * step, () => {
      if (!result.passedAuthz) return;
      setNodes((prev) => ({ ...prev, record: "reached" }));
      setOutcome({
        status: result.status,
        stopGate: result.stopGate,
        reason: result.reason,
      });
      setRunning(false);
    });
  }, [clearTimers, reduceMotion, selected]);

  const reset = useCallback(() => {
    clearTimers();
    setNodes(IDLE_NODES);
    setOutcome(null);
    setRunning(false);
  }, [clearTimers]);

  const connectorTone = (from: NodeKey): Tone => {
    const state = nodes[from];
    if (state === "ok" || state === "reached") return "ok";
    if (state === "bad") return "bad";
    return "plain";
  };

  const recordReached = nodes.record === "reached";

  return (
    <div aria-label="authentication and authorization simulation">
      {/* The client half. Choosing an identity and pressing send is all it can do. */}
      <div className="border-b border-rule bg-accent-tint/40 px-5 pt-4 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 max-w-[50ch]">
            <span className="field-label">client · the browser</span>
            <p className="mt-1 text-[12px] leading-[1.55] text-ink-faint">
              Pick who is making the request, then send it. The client can
              choose an identity; it cannot decide what the gates do with it.
            </p>
          </div>
          <span className="font-mono text-[10.5px] text-ink-faint">
            target · record {RECORD.id} — owned by {RECORD.ownerLabel}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <span className="field-label block">identity</span>
            <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="identity">
              {IDENTITIES.map((identity) => {
                const active = selected === identity.id;
                return (
                  <button
                    key={identity.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelected(identity.id)}
                    className={`flex items-start gap-2 border px-3 py-1.5 text-left ${
                      active
                        ? "border-accent bg-paper-raised"
                        : "border-rule-strong bg-paper-raised/60 hover:border-ink-faint"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`mt-[5px] size-[6px] shrink-0 ${
                        identity.isAdmin
                          ? "bg-marker"
                          : identity.signedIn
                            ? "bg-accent"
                            : "bg-ink-faint"
                      } ${active ? "" : "opacity-40"}`}
                    />
                    <span>
                      <span
                        className={`block font-mono text-[11.5px] ${
                          active ? "text-ink" : "text-ink-soft"
                        }`}
                      >
                        {identity.label}
                      </span>
                      <span className="mt-0.5 block font-mono text-[9.5px] whitespace-nowrap text-ink-faint">
                        {identity.sub}
                      </span>
                    </span>
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

        <p className="mt-3 max-w-[78ch] font-mono text-[10.5px] leading-[1.6] text-ink-faint">
          policy, stated rather than hidden: the admin role may read any record.
          Everyone else is checked against the row they asked for.
        </p>
      </div>

      {/* The boundary. Both gates are on the server's side of this line. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-dashed border-rule-strong bg-paper-sunk/60 px-5 py-1.5">
        <span className="field-label">the network boundary</span>
        <span className="font-mono text-[10px] text-ink-faint">
          both gates run here, per request, on the server
        </span>
      </div>

      {/* The chain: the 1.04 diagram, alive. */}
      <div className="px-5 py-6">
        <div
          role="group"
          aria-label="a request passing through authentication, then authorization, to the record"
          className="flex flex-col items-stretch md:flex-row md:items-stretch"
        >
          {NODES.map((node, index) => (
            <div key={node.key} className="contents">
              <div
                className={`min-w-0 md:flex-1 border px-3 py-2.5 ${NODE_CLASS[nodes[node.key]]}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-ink">
                    {node.title}
                  </span>
                  <NodeMark state={nodes[node.key]} reduceMotion={!!reduceMotion} />
                </div>
                <span className="mt-0.5 block font-mono text-[9.5px] text-ink-faint">
                  {node.sub}
                </span>
                <NodeVerdict nodeKey={node.key} nodes={nodes} outcome={outcome} />
              </div>

              {index < NODES.length - 1 ? (
                <Connector tone={connectorTone(node.key)} />
              ) : null}
            </div>
          ))}
        </div>

        <AnimatePresence>
          {recordReached ? (
            <motion.div
              key="content"
              initial={reduceMotion ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.28, ease: EASE_SOFT }}
              className="mt-4 border border-ok/50 bg-ok-tint/30 px-4 py-3.5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="field-label">record {RECORD.id} · content returned</span>
                <span className="readout text-[11px] text-ok">200</span>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {RECORD.fields.map((field) => (
                  <div
                    key={field.label}
                    className="flex items-baseline justify-between gap-3 border-b border-rule/60 py-1 last:border-b-0"
                  >
                    <dt className="font-mono text-[10px] text-ink-faint">
                      {field.label}
                    </dt>
                    <dd className="text-right text-[12px] text-ink-soft">
                      {field.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </motion.div>
          ) : (
            <motion.p
              key="withheld"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 border border-dashed border-rule-strong px-4 py-3 font-mono text-[10.5px] leading-[1.6] text-ink-faint"
            >
              record content stays withheld until the request has passed both
              gates
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* The readout: one sentence, rewritten every time a gate resolves. */}
      <div className="border-t border-rule bg-paper-sunk/40 px-5 py-4">
        <span className="field-label">what just changed</span>
        <p
          aria-live="polite"
          className="mt-2 flex items-start gap-2.5 text-[13.5px] leading-[1.7] text-ink-soft"
        >
          {outcome ? (
            <span
              className={`readout mt-[1px] shrink-0 ${
                outcome.status === 200 ? "text-ok" : "text-bad"
              }`}
            >
              {outcome.status}
            </span>
          ) : (
            <span aria-hidden className="mt-[9px] size-[6px] shrink-0 bg-ink-faint/60" />
          )}
          <span className="max-w-[76ch]">
            {outcome
              ? outcome.reason
              : running
                ? "The request is moving through the gates. Each one resolves before the next is considered."
                : "Nothing sent yet. Choose an identity and press Send request; watch which gate decides the outcome."}
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-dashed border-rule px-5 py-3">
        <span className="field-label">simulation controls</span>
        <button
          type="button"
          className="border border-rule-strong px-3 py-1.5 font-mono text-[10.5px] tracking-[0.06em] uppercase text-ink-faint transition-colors hover:border-ink-faint hover:text-ink-soft active:translate-y-px"
          onClick={reset}
        >
          Reset
        </button>
        <p className="max-w-[54ch] font-mono text-[10.5px] leading-[1.5] text-ink-faint">
          sign-in opens gate 1. Gate 2 is the check that gets left out, and the
          one that stops one account reading another&rsquo;s record.
        </p>
      </div>
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
  if (state === "ok" || state === "reached") {
    return <span aria-hidden className="size-[6px] shrink-0 bg-ok" />;
  }
  if (state === "bad") {
    return <span aria-hidden className="size-[6px] shrink-0 bg-bad" />;
  }
  return (
    <span
      aria-hidden
      className="size-[6px] shrink-0 border border-rule-strong bg-transparent"
    />
  );
}

function NodeVerdict({
  nodeKey,
  nodes,
  outcome,
}: {
  nodeKey: NodeKey;
  nodes: NodeStates;
  outcome: Outcome | null;
}) {
  if (nodeKey === "request") return null;

  const state = nodes[nodeKey];
  if (state === "idle" || state === "active") return null;

  let text: string;
  let tone: Tone;
  if (nodeKey === "authn") {
    tone = state === "bad" ? "bad" : "ok";
    text = state === "bad" ? "401 · not signed in" : "signed in";
  } else if (nodeKey === "authz") {
    tone = state === "bad" ? "bad" : "ok";
    text = state === "bad" ? "403 · not allowed" : "allowed for this row";
  } else {
    tone = "ok";
    text = outcome ? `${outcome.status} · reached` : "reached";
  }

  return (
    <span
      className={`readout mt-1.5 block text-[10px] ${
        tone === "ok" ? "text-ok" : "text-bad"
      }`}
    >
      {text}
    </span>
  );
}

/**
 * The connector between two nodes, drawn in the schematic's voice: a hairline
 * with an arrowhead, or a stop bar where the request ended.
 */
function Connector({ tone }: { tone: Tone }) {
  const color =
    tone === "ok"
      ? "var(--color-ok)"
      : tone === "bad"
        ? "var(--color-bad)"
        : "var(--color-rule-strong)";

  return (
    <span aria-hidden className="flex items-center justify-center">
      {/* Horizontal, on md and up. */}
      <svg viewBox="0 0 34 12" className="hidden h-3 w-[34px] md:block">
        <line x1="0" y1="6" x2="26" y2="6" stroke={color} strokeWidth="1" />
        {tone === "bad" ? (
          <line x1="26" y1="1.5" x2="26" y2="10.5" stroke={color} strokeWidth="1" />
        ) : (
          <path d="M 26 2 L 32 6 L 26 10" fill="none" stroke={color} strokeWidth="1" />
        )}
      </svg>
      {/* Vertical, below md. */}
      <svg viewBox="0 0 12 34" className="block h-[34px] w-3 md:hidden">
        <line x1="6" y1="0" x2="6" y2="26" stroke={color} strokeWidth="1" />
        {tone === "bad" ? (
          <line x1="1.5" y1="26" x2="10.5" y2="26" stroke={color} strokeWidth="1" />
        ) : (
          <path d="M 2 26 L 6 32 L 10 26" fill="none" stroke={color} strokeWidth="1" />
        )}
      </svg>
    </span>
  );
}
