"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createSession,
  DEMO_USER,
  encodeToken,
  SESSION_TTL_LABEL,
  SIGNING_KEY_NOTE,
  TOKEN_TTL_MS,
  TOKEN_TTL_REAL_LABEL,
  verifyToken,
  type Claims,
  type SessionRow,
  type VerifyResult,
} from "@/lib/sessions-tokens";

/** The site's one soft curve, shared with the CSS theme. */
const EASE_SOFT: [number, number, number, number] = [0.22, 1, 0.36, 1];
/** How often the readout clock advances, so the countdown is live. */
const CLOCK_TICK_MS = 250;
/** One press of the bench control moves the clock this far. */
const CLOCK_STEP_MS = 30_000;

type Mode = "session" | "token";
type Tone = "idle" | "ok" | "warn" | "bad";
type Note = { tone: Tone; text: string };
/** The connector and tag tones: the neutral structure ink, or a state pair. */
type EdgeTone = "plain" | "ok" | "bad";

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

/** What the client is holding. Nothing, a session id, or the token itself. */
type Held =
  | { kind: "none" }
  | { kind: "session"; sessionId: string }
  | { kind: "token"; token: string; claims: Claims };

type Outcome = { status: 200 | 401; reason: string };

const INITIAL_NOTE: Note = {
  tone: "idle",
  text: "Nothing has happened yet. Pick Session or Token, then press Log in and watch where the state ends up.",
};

const BTN_PRIMARY =
  "border border-accent bg-accent px-3.5 py-2 font-mono text-[11px] tracking-[0.06em] uppercase text-paper transition-colors hover:border-ink hover:bg-ink active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45";
const BTN_SECONDARY =
  "border border-rule-strong bg-paper-raised px-3.5 py-2 font-mono text-[11px] tracking-[0.06em] uppercase text-ink-soft transition-colors hover:border-ink-faint hover:text-ink active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45";
const BTN_QUIET =
  "border border-rule-strong px-3 py-1.5 font-mono text-[10.5px] tracking-[0.06em] uppercase text-ink-faint transition-colors hover:border-ink-faint hover:text-ink-soft active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45";

/*
  The 1.05 diagram, made to move: two rows, one per way of being remembered. In
  the session row the client holds a random id and the server holds the details;
  in the token row the client holds the claims and the server holds nothing.

  The session table is deliberately a single object on screen. In session mode a
  log-in writes a row into it; in token mode a log-in writes nothing, and the
  table is left visible and empty so the contrast is something you watch rather
  than something the copy claims.
*/
export function SessionsTokenDemo() {
  const [mode, setMode] = useState<Mode>("session");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [held, setHeld] = useState<Held>({ kind: "none" });
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [tableFlash, setTableFlash] = useState(0);
  const [busy, setBusy] = useState(false);
  /* Zero until mounted. The clock is a readout, never a decision input. */
  const [now, setNow] = useState(0);
  const [note, setNote] = useState<Note>(INITIAL_NOTE);

  const offsetRef = useRef(0);
  /* Guards async signing and verification against a stale run. */
  const runRef = useRef(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now() + offsetRef.current);
    }, CLOCK_TICK_MS);
    return () => {
      window.clearInterval(timer);
      runRef.current += 1;
    };
  }, []);

  const logIn = useCallback(() => {
    const at = Date.now() + offsetRef.current;
    setOutcome(null);
    setVerify(null);

    if (mode === "session") {
      const row = createSession(at);
      setSessions([row]);
      setHeld({ kind: "session", sessionId: row.id });
      setNote({
        tone: "ok",
        text: `Signed in. The server wrote one row into its sessions table and handed the client nothing but the random id ${row.id}. That id means nothing on its own: it is a lookup key, and the identity behind it stays on the server.`,
      });
      return;
    }

    const run = (runRef.current += 1);
    setBusy(true);
    const claims: Claims = {
      sub: DEMO_USER.id,
      name: DEMO_USER.name,
      iat: Math.floor(at / 1000),
      exp: Math.floor((at + TOKEN_TTL_MS) / 1000),
    };
    void encodeToken(claims)
      .then((token) => {
        if (runRef.current !== run) return;
        setHeld({ kind: "token", token, claims });
        setTableFlash((key) => key + 1);
        setNote({
          tone: "ok",
          text: "Signed in. The server signed a token containing the claims and handed it over. The sessions table stayed empty: there is no row to write, because the token carries the state itself. Watch the table — nothing was added to it.",
        });
      })
      .finally(() => {
        if (runRef.current === run) setBusy(false);
      });
  }, [mode]);

  const makeRequest = useCallback(() => {
    if (held.kind === "none") {
      setOutcome({
        status: 401,
        reason:
          "401 · no credential was attached, so the server has no way to know who sent the request. Log in first.",
      });
      setNote({
        tone: "warn",
        text: "Nothing to send. A session would attach its id to the request; a token would attach the token. With neither, the request arrives as a stranger.",
      });
      return;
    }

    const at = Date.now() + offsetRef.current;

    if (held.kind === "session") {
      const found = sessions.find((row) => row.id === held.sessionId);
      if (found) {
        setOutcome({
          status: 200,
          reason: `200 · the server looked the id ${held.sessionId} up in its sessions table and found the row for ${found.user}. The client never held the identity; it held a key to it.`,
        });
        setNote({
          tone: "ok",
          text: "Allowed. The server did a lookup: the id matched a row. Deleting that row is the whole of a logout — which is why a session can be ended instantly, and everywhere at once.",
        });
      } else {
        setOutcome({
          status: 401,
          reason: `401 · the id ${held.sessionId} is not in the table. It was deleted, so the key now opens nothing. The client still holds it, and it is already worthless.`,
        });
        setNote({
          tone: "bad",
          text: "Refused. The row was revoked, so the lookup found nothing. The client's cookie never changed and never needed to — revocation was a single delete on the server.",
        });
      }
      return;
    }

    const run = (runRef.current += 1);
    setBusy(true);
    void verifyToken(held.token, at)
      .then((result) => {
        if (runRef.current !== run) return;
        setVerify(result);
        if (result.valid) {
          setOutcome({
            status: 200,
            reason:
              "200 · the server recomputed the signature, it matched, and the claims were read straight off the token. No lookup, and no per-login record to consult.",
          });
          setNote({
            tone: "ok",
            text: "Allowed. The signature checked out and the claims came out of the token itself. The server held no row for this login, which is what lets a token scale without shared state — and what makes it impossible to revoke early.",
          });
        } else {
          setOutcome({
            status: 401,
            reason: result.expired
              ? "401 · the token's exp claim has passed. Nothing revoked it; it simply ran out, which is the only lever a plain token system has."
              : "401 · the recomputed signature did not match, so this token is not one the server issued.",
          });
          setNote({
            tone: "bad",
            text: result.expired
              ? "Refused. The token expired. Nobody invalidated it — time is the only thing that ends it, and it ends it for every device at once, not for one."
              : "Refused. The signature did not match, so the server treated the token as forged.",
          });
        }
      })
      .finally(() => {
        if (runRef.current === run) setBusy(false);
      });
  }, [held, sessions]);

  const revoke = useCallback(() => {
    if (mode === "session") {
      if (held.kind !== "session" || sessions.length === 0) {
        setNote({ tone: "warn", text: "Nothing to revoke. Log in first." });
        return;
      }
      const id = held.sessionId;
      setSessions([]);
      setOutcome(null);
      setVerify(null);
      setNote({
        tone: "bad",
        text: `Revoked. The row for id ${id} was deleted — one delete on the server, and the login is over everywhere at once. Press Make a request: it fails immediately, and the client's cookie never had to change.`,
      });
      return;
    }

    if (held.kind !== "token") {
      setNote({ tone: "warn", text: "Nothing to revoke. Log in first." });
      return;
    }

    setOutcome(null);
    setVerify(null);
    setTableFlash((key) => key + 1);
    setNote({
      tone: "bad",
      text: "This is the honest part: revoking did nothing. There is no server-side row for this login to delete, so the token stays valid until its exp passes. The only way to end it early is to keep a denylist of revoked tokens somewhere — which puts the server state back, and that state is the thing a token was meant to avoid.",
    });
  }, [held, mode, sessions.length]);

  const switchMode = useCallback((next: Mode) => {
    runRef.current += 1;
    offsetRef.current = 0;
    setMode(next);
    setSessions([]);
    setHeld({ kind: "none" });
    setOutcome(null);
    setVerify(null);
    setBusy(false);
    setNow(Date.now());
    setNote({
      tone: "idle",
      text:
        next === "session"
          ? "Session mode. Press Log in: the server writes a row and the client receives only its id. Reset so the two modes start from the same place."
          : "Token mode. Press Log in: the client receives a signed token and the server keeps nothing. The sessions table on the left stays empty — watch it.",
    });
  }, []);

  const advance = useCallback(() => {
    offsetRef.current += CLOCK_STEP_MS;
    setNow(Date.now() + offsetRef.current);
    setNote((prev) =>
      held.kind === "token"
        ? {
            tone: "idle",
            text: "The clock moved forward. Advance it past the exp claim and then press Make a request: the token has not been deleted, it has simply run out of time.",
          }
        : prev,
    );
  }, [held.kind]);

  const reset = useCallback(() => {
    runRef.current += 1;
    offsetRef.current = 0;
    setSessions([]);
    setHeld({ kind: "none" });
    setOutcome(null);
    setVerify(null);
    setBusy(false);
    setNow(Date.now());
    setNote(INITIAL_NOTE);
  }, []);

  const expiresAtMs = held.kind === "token" ? held.claims.exp * 1000 : 0;
  const remainingSec = expiresAtMs
    ? Math.max(0, Math.ceil((expiresAtMs - now) / 1000))
    : 0;
  const tokenExpired = Boolean(expiresAtMs) && now >= expiresAtMs;

  const sessionActive = mode === "session";
  const transition = { duration: reduceMotion ? 0 : 0.28, ease: EASE_SOFT };

  return (
    <div aria-label="sessions versus tokens simulation">
      {/* The client half. Choosing a mode and pressing the buttons is all it can do. */}
      <div className="border-b border-rule bg-accent-tint/40 px-5 pt-4 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 max-w-[48ch]">
            <span className="field-label">client · the browser</span>
            <p className="mt-1 text-[12px] leading-[1.55] text-ink-faint">
              You are here. Choose how the server will remember you, then log in,
              make a request, and try to revoke it. Nothing below the dashed line
              belongs to the client.
            </p>
          </div>
          <span className="readout text-[10.5px] text-ink-faint">
            {sessionActive ? SESSION_TTL_LABEL : TOKEN_TTL_REAL_LABEL}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <span className="field-label block">how the server remembers you</span>
            <div className="mt-1.5 flex" role="group" aria-label="mode">
              {(["session", "token"] as Mode[]).map((option) => {
                const active = mode === option;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={active}
                    onClick={() => switchMode(option)}
                    className={`border px-3 py-1.5 font-mono text-[11px] ${
                      active
                        ? "border-accent bg-paper-raised text-ink"
                        : "border-rule-strong bg-paper-raised/60 text-ink-faint hover:text-ink-soft"
                    } ${option === "token" ? "border-l-0" : ""}`}
                  >
                    {option === "session" ? "Session" : "Token"}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={BTN_PRIMARY}
              onClick={logIn}
              disabled={busy}
            >
              Log in
            </button>
            <button
              type="button"
              className={BTN_SECONDARY}
              onClick={makeRequest}
              disabled={busy}
            >
              Make a request
            </button>
            <button
              type="button"
              className={BTN_QUIET}
              onClick={revoke}
              disabled={busy}
            >
              Revoke this login
            </button>
          </div>
        </div>

        <p className="mt-3 max-w-[78ch] font-mono text-[10.5px] leading-[1.6] text-ink-faint">
          no network calls. The token is signed in this tab with a real
          {" "}HMAC-SHA256, so the signature check is genuine; in a real app the
          signing key stays on the server and never reaches the page.
        </p>
      </div>

      {/* The boundary. Below this line, everything is the server's side. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-dashed border-rule-strong bg-paper-sunk/60 px-5 py-1.5">
        <span className="field-label">the network boundary</span>
        <span className="font-mono text-[10px] text-ink-faint">
          a session keeps state here · a token keeps nothing to look up
        </span>
      </div>

      <div className="space-y-6 px-5 py-6">
        <ChainRow
          title="session · state on the server"
          active={sessionActive}
          connectorLabel="an id travels · the details are looked up"
          tone={sessionActive && held.kind === "session" ? "ok" : "plain"}
          left={
            <NodeBox
              title="client"
              sub="holds a random id"
              tag={held.kind === "session" ? "not the identity" : undefined}
              tagTone="plain"
            >
              {held.kind === "session" ? (
                <span className="block break-all font-mono text-[10.5px] leading-[1.5] text-ink-soft">
                  {held.sessionId}
                </span>
              ) : (
                <span className="block font-mono text-[10.5px] text-ink-faint">
                  — holding nothing —
                </span>
              )}
            </NodeBox>
          }
          right={
            <NodeBox
              title="server"
              sub="holds the session"
              tag="server state"
              tagTone="plain"
            >
              <div className="flex items-baseline justify-between gap-x-3">
                <span className="field-label">server-side sessions</span>
                <span className="readout text-[10.5px] text-ink-faint">
                  {sessions.length === 0 ? "empty" : `${sessions.length} row`}
                </span>
              </div>

              <div className="mt-2 border border-rule bg-paper-raised">
                <div className="flex items-baseline justify-between gap-x-3 border-b border-rule px-2.5 py-1">
                  <span className="field-label">id</span>
                  <span className="field-label">user</span>
                </div>
                {sessions.length === 0 ? (
                  <p className="px-2.5 py-3 text-center font-mono text-[10.5px] text-ink-faint">
                    no rows
                  </p>
                ) : (
                  <ul aria-live="polite">
                    {sessions.map((row) => (
                      <motion.li
                        key={row.id}
                        initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={transition}
                        className="flex items-baseline justify-between gap-x-3 px-2.5 py-1.5"
                      >
                        <span className="min-w-0 break-all font-mono text-[10.5px] text-ink-soft">
                          {row.id}
                        </span>
                        <span className="shrink-0 font-mono text-[10.5px] text-ink-faint">
                          {row.user}
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </div>

              <AnimatePresence>
                {!sessionActive && tableFlash > 0 ? (
                  <motion.p
                    key={tableFlash}
                    initial={reduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={transition}
                    className="mt-2 border-l-2 border-bad bg-bad-tint/40 py-1.5 pr-2 pl-2 font-mono text-[10px] leading-[1.5] text-bad"
                  >
                    a token log-in wrote nothing here — the table is still empty,
                    because there is nothing to store
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </NodeBox>
          }
        />

        <ChainRow
          title="token · state on the client"
          active={!sessionActive}
          connectorLabel="the token carries the claims · verified, not looked up"
          tone={
            !sessionActive && verify
              ? verify.valid
                ? "ok"
                : "bad"
              : "plain"
          }
          left={
            <NodeBox
              title="client"
              sub="holds the claims"
              tag={held.kind === "token" ? "the whole credential" : undefined}
              tagTone="plain"
            >
              {held.kind === "token" ? (
                <div>
                  <span className="field-label">signed token</span>
                  <p className="mt-1 break-all font-mono text-[9.5px] leading-[1.5] text-ink-soft">
                    {held.token}
                  </p>
                  <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
                    <dt className="font-mono text-[10px] text-ink-faint">sub</dt>
                    <dd className="break-all font-mono text-[10px] text-ink-soft">
                      {held.claims.sub}
                    </dd>
                    <dt className="font-mono text-[10px] text-ink-faint">name</dt>
                    <dd className="break-all font-mono text-[10px] text-ink-soft">
                      {held.claims.name}
                    </dd>
                    <dt className="font-mono text-[10px] text-ink-faint">exp</dt>
                    <dd
                      className={`readout text-[10.5px] ${
                        tokenExpired ? "text-bad" : "text-warn"
                      }`}
                    >
                      {tokenExpired ? "expired" : `${remainingSec}s left`}
                    </dd>
                  </dl>
                </div>
              ) : (
                <span className="block font-mono text-[10.5px] text-ink-faint">
                  — holding nothing —
                </span>
              )}
            </NodeBox>
          }
          right={
            <NodeBox
              title="server"
              sub="holds nothing"
              tag="hollow on purpose"
              tagTone="plain"
              hollow
            >
              {verify ? (
                <ol className="space-y-2">
                  {verify.steps.map((step, index) => (
                    <li key={step.label} className="flex gap-2.5">
                      <span className="readout mt-[2px] w-4 shrink-0 text-[10.5px] text-ink-faint">
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-mono text-[10px] leading-[1.4] text-ink-faint">
                          {step.label}
                        </span>
                        <span
                          className={`mt-0.5 block break-all font-mono text-[10.5px] leading-[1.5] ${
                            step.tone === "ok"
                              ? "text-ok"
                              : step.tone === "bad"
                                ? "text-bad"
                                : "text-ink-soft"
                          }`}
                        >
                          {step.value}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="font-mono text-[10.5px] leading-[1.5] text-ink-faint">
                  nothing is stored for this login. The server keeps a signing
                  key and trusts anything signed with it — there is no record of
                  who logged in, or of when this should end.
                </p>
              )}
            </NodeBox>
          }
        />
      </div>

      {/* The readout: one sentence, rewritten every time state changes. */}
      <div className="border-t border-rule bg-paper-sunk/40 px-5 py-4">
        <span className="field-label">what just changed</span>
        <p
          aria-live="polite"
          className={`mt-2 flex items-start gap-2.5 text-[13.5px] leading-[1.7] ${TONE_CLASS[note.tone]}`}
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
            <span
              aria-hidden
              className={`mt-[9px] size-[6px] shrink-0 ${TONE_DOT[note.tone]}`}
            />
          )}
          <span className="max-w-[76ch]">
            {outcome ? outcome.reason : note.text}
          </span>
        </p>
      </div>

      {/* The bench controls. These move the simulation, not the app. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-dashed border-rule px-5 py-3">
        <span className="field-label">simulation controls</span>
        <button
          type="button"
          className={BTN_QUIET}
          onClick={advance}
          disabled={held.kind !== "token"}
        >
          Advance the clock 30 s
        </button>
        <button type="button" className={BTN_QUIET} onClick={reset}>
          Reset
        </button>
        <p className="max-w-[52ch] font-mono text-[10.5px] leading-[1.5] text-ink-faint">
          {SIGNING_KEY_NOTE} — a session table is a shared store you can delete a
          row from; a signature is not.
        </p>
      </div>
    </div>
  );
}

/** One row of the diagram: a client box, the exchange, a server box. */
function ChainRow({
  title,
  active,
  connectorLabel,
  tone,
  left,
  right,
}: {
  title: string;
  active: boolean;
  connectorLabel: string;
  tone: EdgeTone;
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className={`border-l-2 pl-3 ${active ? "border-l-accent" : "border-l-transparent"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="field-label">{title}</span>
        {active ? (
          <span className="font-mono text-[9.5px] tracking-[0.08em] text-accent uppercase">
            in play
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-col items-stretch md:flex-row md:items-stretch">
        <div className="min-w-0 md:flex-1">{left}</div>
        <Connector label={connectorLabel} tone={tone} />
        <div className="min-w-0 md:flex-1">{right}</div>
      </div>
    </div>
  );
}

/** A box on the diagram. `hollow` is the server that deliberately keeps nothing. */
function NodeBox({
  title,
  sub,
  tag,
  tagTone,
  hollow,
  children,
}: {
  title: string;
  sub: string;
  tag?: string;
  tagTone?: EdgeTone;
  hollow?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`min-w-0 bg-paper-raised px-3 py-2.5 ${
        hollow
          ? "border border-dashed border-rule-strong"
          : "border border-rule-strong"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-ink">{title}</span>
        {tag ? (
          <span
            className={`font-mono text-[9.5px] ${
              tagTone === "bad" ? "text-bad" : "text-ink-faint"
            }`}
          >
            {tag}
          </span>
        ) : null}
      </div>
      <span className="mt-0.5 block font-mono text-[9.5px] text-ink-faint">
        {sub}
      </span>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

/** The exchange between the two boxes, drawn in the schematic's voice. */
function Connector({ label, tone }: { label: string; tone: EdgeTone }) {
  const color =
    tone === "ok"
      ? "var(--color-ok)"
      : tone === "bad"
        ? "var(--color-bad)"
        : "var(--color-rule-strong)";

  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-1 px-2 md:w-[148px]">
      <span className="hidden max-w-[148px] text-center font-mono text-[9px] leading-[1.35] text-ink-faint md:block">
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
