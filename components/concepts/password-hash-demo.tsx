"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ACCOUNTS,
  deriveStore,
  hasDuplicateHashes,
  hashPassword,
  HASH_ALGORITHM,
  SALT_BYTES,
  type AccountId,
  type Avalanche,
  type Store,
} from "@/lib/password-hashing";

/** The site's one soft curve, shared with the CSS theme. */
const EASE_SOFT: [number, number, number, number] = [0.22, 1, 0.36, 1];

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

const INITIAL_NOTE: Note = {
  tone: "idle",
  text: "Nothing is stored yet. Type a password, press Sign up, and the hash is computed in this tab; no request is made and nothing is written down anywhere you cannot see.",
};

/** One log-in attempt, computed exactly as the server would. */
type LoginRun = {
  account: AccountId;
  attempt: string;
  salt: string | null;
  hash: string;
  storedHash: string;
  match: boolean;
};

const BTN_PRIMARY =
  "border border-accent bg-accent px-3.5 py-2 font-mono text-[11px] tracking-[0.06em] uppercase text-paper transition-colors hover:border-ink hover:bg-ink active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45";
const BTN_SECONDARY =
  "border border-rule-strong bg-paper-raised px-3.5 py-2 font-mono text-[11px] tracking-[0.06em] uppercase text-ink-soft transition-colors hover:border-ink-faint hover:text-ink active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45";
const BTN_QUIET =
  "border border-rule-strong px-3 py-1.5 font-mono text-[10.5px] tracking-[0.06em] uppercase text-ink-faint transition-colors hover:border-ink-faint hover:text-ink-soft active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45";
const INPUT =
  "w-full min-w-0 border border-rule-strong bg-paper-raised px-2.5 py-1.5 font-mono text-[12px] text-ink placeholder:text-ink-faint/70";

/*
  The demo is a view onto lib/password-hashing.ts. The inputs and the buttons are
  the browser's side; the hashes and the records are the server's side of the
  dashed line. The component can ask for a hash and read it back, which is
  exactly the real asymmetry being taught: the browser runs the calculation, but
  the value that is kept lives where the visitor cannot reach it.

  Three steps, in the order they happen: store, leak, log in. Nothing auto-plays;
  every hash on screen was produced by a click.
*/
export function PasswordHashDemo() {
  const [passwordInput, setPasswordInput] = useState("");
  const [salted, setSalted] = useState(true);
  const [store, setStore] = useState<Store | null>(null);
  const [avalanche, setAvalanche] = useState<Avalanche | null>(null);
  const [leaked, setLeaked] = useState(false);
  const [loginAccount, setLoginAccount] = useState<AccountId>("alex");
  const [loginInput, setLoginInput] = useState("");
  const [loginRun, setLoginRun] = useState<LoginRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(INITIAL_NOTE);

  const runRef = useRef(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => () => {
    runRef.current += 1;
  }, []);

  const derive = useCallback(
    async (password: string, nextSalted: boolean, message: (dup: boolean) => Note) => {
      const run = (runRef.current += 1);
      setBusy(true);
      try {
        const result = await deriveStore(password, nextSalted);
        if (runRef.current !== run) return;
        setStore(result.store);
        setAvalanche(result.avalanche);
        setLeaked(false);
        setLoginRun(null);
        setNote(message(hasDuplicateHashes(result.store)));
      } finally {
        if (runRef.current === run) setBusy(false);
      }
    },
    [],
  );

  const signUp = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const password = passwordInput;
      if (password.length === 0) {
        setNote({
          tone: "warn",
          text: "Type a password first. The field shows it because the whole subject is what gets stored; in a real sign-up it would be masked.",
        });
        return;
      }
      void derive(password, salted, (duplicate) =>
        duplicate
          ? {
              tone: "bad",
              text: `Salt is off, so both accounts hashed the same input with nothing added and the two rows are identical. Same password in, same ${HASH_ALGORITHM} hash out, and an attacker sees at a glance that Alex and Jordan share one.`,
            }
          : {
              tone: "ok",
              text: `Stored. Alex and Jordan chose the same password, but each row got its own random ${SALT_BYTES}-byte salt before hashing, so the two hashes are unrelated. Only the hashes and their salts were written down; the password was not.`,
            },
      );
    },
    [derive, passwordInput, salted],
  );

  const toggleSalt = useCallback(
    (next: boolean) => {
      setSalted(next);
      if (!store) {
        setNote({
          tone: "idle",
          text: next
            ? "Salt on. Each sign-up will add a fresh random salt before hashing."
            : "Salt off. The password will be hashed on its own, so identical passwords produce identical rows.",
        });
        return;
      }
      void derive(store.password, next, (duplicate) =>
        next
          ? {
              tone: "ok",
              text: "Salt switched on and the rows were re-derived: two fresh salts, two unrelated hashes. The stored password did not change; only the value written down did.",
            }
          : duplicate
            ? {
                tone: "bad",
                text: "Salt switched off. With nothing added before hashing, both accounts now store the exact same hash, which leaks that they chose the same password.",
              }
            : { tone: "idle", text: "Salt switched off." },
      );
    },
    [derive, store],
  );

  const leak = useCallback(() => {
    if (!store) return;
    setLeaked(true);
    const duplicate = hasDuplicateHashes(store);
    setNote(
      duplicate
        ? {
            tone: "bad",
            text: "Leaked, with salt off. The password column is plain text, and because both rows carry the same hash the attacker also learns that Alex and Jordan share a password, then attacks one guess against two accounts.",
          }
        : {
            tone: "warn",
            text: "Leaked. The password column is readable, but the stored hashes are not reversible in any practical sense, and each row has its own salt, so every account has to be attacked separately.",
          },
    );
  }, [store]);

  const logIn = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!store) {
        setNote({
          tone: "warn",
          text: "Nothing is stored yet, so there is no hash to compare against. Sign up first.",
        });
        return;
      }
      const attempt = loginInput;
      if (attempt.length === 0) {
        setNote({ tone: "warn", text: "Type an attempt to log in." });
        return;
      }
      const record = store.records.find((row) => row.account === loginAccount);
      if (!record) return;
      const run = (runRef.current += 1);
      void hashPassword(attempt, record.salt).then((hash) => {
        if (runRef.current !== run) return;
        const match = hash === record.hash;
        setLoginRun({
          account: loginAccount,
          attempt,
          salt: record.salt,
          hash,
          storedHash: record.hash,
          match,
        });
        setNote(
          match
            ? {
                tone: "ok",
                text: "The attempt hashed to exactly the stored value, so the comparison matched. The password was only ever compared after hashing; it was never stored and never reversed.",
              }
            : {
                tone: "bad",
                text: "The attempt hashed to a different value, so it failed at the compare step, the last of the four. The server never holds the password itself, only the hash it is checked against.",
              },
        );
      });
    },
    [loginAccount, loginInput, store],
  );

  const reset = useCallback(() => {
    runRef.current += 1;
    setPasswordInput("");
    setSalted(true);
    setStore(null);
    setAvalanche(null);
    setLeaked(false);
    setLoginAccount("alex");
    setLoginInput("");
    setLoginRun(null);
    setBusy(false);
    setNote(INITIAL_NOTE);
  }, []);

  const duplicate = store ? hasDuplicateHashes(store) : false;
  const transition = { duration: reduceMotion ? 0 : 0.28, ease: EASE_SOFT };

  return (
    <div aria-label="password hashing simulation">
      {/* The client half. Both the sign-up and the log-in start here. */}
      <div className="border-b border-rule bg-accent-tint/40 px-5 pt-4 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 max-w-[48ch]">
            <span className="field-label">client · the browser</span>
            <p className="mt-1 text-[12px] leading-[1.55] text-ink-faint">
              You are here. The hashing runs in this tab, so you can watch it
              happen; the record it produces belongs to the server, below the
              line.
            </p>
          </div>
          <span className="readout text-[10.5px] text-ink-faint">
            {HASH_ALGORITHM} · {SALT_BYTES}-byte salt
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-start gap-x-8 gap-y-4">
          <form onSubmit={signUp} className="min-w-[210px] flex-1">
            <label
              htmlFor="ph-password"
              className="field-label block"
            >
              step 1 · choose a password
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="ph-password"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={passwordInput}
                onChange={(event) => setPasswordInput(event.target.value)}
                placeholder="type one — it is shown here on purpose"
                className={INPUT}
              />
              <button type="submit" className={BTN_PRIMARY} disabled={busy}>
                Sign up
              </button>
            </div>
          </form>

          <form onSubmit={logIn} className="min-w-[230px] flex-1">
            <span className="field-label block">step 3 · log in</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <div className="flex" role="group" aria-label="log in as">
                {ACCOUNTS.map((account) => {
                  const active = loginAccount === account.id;
                  return (
                    <button
                      key={account.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setLoginAccount(account.id)}
                      className={`border px-2.5 py-1.5 font-mono text-[11px] ${
                        active
                          ? "border-accent bg-paper-raised text-ink"
                          : "border-rule-strong bg-paper-raised/60 text-ink-faint hover:text-ink-soft"
                      }`}
                    >
                      {account.name}
                    </button>
                  );
                })}
              </div>
              <input
                aria-label="password attempt"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={loginInput}
                onChange={(event) => setLoginInput(event.target.value)}
                placeholder="your attempt"
                className={`${INPUT} min-w-[120px] flex-1`}
              />
              <button type="submit" className={BTN_SECONDARY}>
                Log in
              </button>
            </div>
          </form>
        </div>

        <p className="mt-3 max-w-[78ch] font-mono text-[10.5px] leading-[1.6] text-ink-faint">
          no network calls, no localStorage or sessionStorage, no logging. This
          is not a real sign-up and nothing you type is kept after you leave the
          page.
        </p>
      </div>

      {/* The boundary. Below this line, everything is the server's side. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-dashed border-rule-strong bg-paper-sunk/60 px-5 py-1.5">
        <span className="field-label">the network boundary</span>
        <span className="font-mono text-[10px] text-ink-faint">
          the hash is computed in the tab · the record is what the server would
          keep
        </span>
      </div>

      <div className="grid gap-px bg-rule lg:grid-cols-[minmax(0,1fr)_326px]">
        <Cell
          label="the database · what is stored"
          aside={
            <span className="readout text-[10.5px] text-ink-faint">
              {store ? `${store.records.length} accounts` : "empty"}
            </span>
          }
        >
          <p className="mt-1 max-w-[54ch] text-[12px] leading-[1.6] text-ink-faint">
            Each account has one row. The left half is what the password would
            be if it were stored as typed; the right half is what is actually
            written down.
          </p>

          {store ? (
            <div className="mt-4 space-y-4">
              {store.records.map((record) => {
                const account = ACCOUNTS.find((a) => a.id === record.account)!;
                return (
                  <div key={record.account}>
                    <div className="flex items-baseline justify-between gap-x-2">
                      <span className="font-mono text-[11px] text-ink">
                        {account.name}
                      </span>
                      <span className="font-mono text-[9.5px] text-ink-faint">
                        {account.sub}
                      </span>
                    </div>
                    <div className="mt-1.5 grid gap-px border border-rule bg-rule sm:grid-cols-2">
                      <div className="bg-paper-raised px-3 py-2.5">
                        <span
                          className={`field-label ${
                            leaked ? "text-bad" : ""
                          }`}
                        >
                          as typed · plaintext
                        </span>
                        <p className="mt-1.5 break-all font-mono text-[11px] leading-[1.5] text-ink-soft">
                          {store.password}
                        </p>
                        <p className="mt-1 font-mono text-[9.5px] text-ink-faint">
                          never stored
                        </p>
                      </div>
                      <div className="bg-paper-raised px-3 py-2.5">
                        <span className="field-label">stored · salted hash</span>
                        <p className="mt-1.5 break-all font-mono text-[10px] leading-[1.45] text-ink-soft">
                          {record.hash}
                        </p>
                        <p className="mt-1 break-all font-mono text-[9.5px] text-ink-faint">
                          salt {record.salt ? record.salt : "— none —"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {duplicate ? (
                <p className="border-l-2 border-bad bg-bad-tint/40 py-2 pr-3 pl-3 font-mono text-[10.5px] leading-[1.6] text-bad">
                  both rows hash to the same value, so the table reveals that
                  these two accounts share a password
                </p>
              ) : null}

              <AnimatePresence>
                {leaked ? (
                  <motion.div
                    key="leak"
                    initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={transition}
                    className="border border-bad/50 bg-bad-tint/30 px-3.5 py-3"
                  >
                    <span className="field-label text-bad">
                      attacker&rsquo;s view
                    </span>
                    <p className="mt-1.5 max-w-[58ch] text-[12px] leading-[1.6] text-ink-soft">
                      The password column reads in clear, so a careless store
                      would hand over every password directly. The hash column
                      is what is actually there: opaque strings with their
                      salts, and the only way forward is guessing.
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ) : (
            <p className="mt-4 border border-dashed border-rule-strong px-3 py-6 text-center font-mono text-[11px] text-ink-faint">
              no rows yet — sign up to write some
            </p>
          )}
        </Cell>

        <Cell
          label="the server · log-in check"
          aside={
            <span className="font-mono text-[10px] text-ink-faint">
              server state
            </span>
          }
        >
          <p className="mt-1 text-[12px] leading-[1.6] text-ink-faint">
            At log-in the same calculation runs again and the results are
            compared. The four steps, in order:
          </p>

          {loginRun ? (
            <ol className="mt-4 space-y-2.5">
              {(
                [
                  {
                    label: "take the attempt",
                    value: `"${loginRun.attempt}"`,
                    tone: "plain" as const,
                  },
                  {
                    label: "add the stored salt",
                    value: loginRun.salt ?? "— no salt —",
                    tone: "plain" as const,
                  },
                  {
                    label: `hash it · ${HASH_ALGORITHM}`,
                    value: loginRun.hash,
                    tone: "plain" as const,
                  },
                  {
                    label: "compare with the stored hash",
                    value: loginRun.match ? "match" : "no match",
                    tone: loginRun.match ? ("ok" as const) : ("bad" as const),
                  },
                ]
              ).map((step, index) => (
                <motion.li
                  key={step.label}
                  initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.24,
                    ease: EASE_SOFT,
                    delay: reduceMotion ? 0 : index * 0.09,
                  }}
                  className="flex gap-2.5"
                >
                  <span className="readout mt-[2px] w-4 shrink-0 text-[10.5px] text-ink-faint">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-mono text-[10.5px] text-ink-faint">
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
                </motion.li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 border border-dashed border-rule-strong px-3 py-6 text-center font-mono text-[11px] text-ink-faint">
              no attempt yet
            </p>
          )}

          {avalanche ? (
            <div className="mt-5 border-t border-rule pt-3">
              <span className="field-label">one character changed</span>
              <p className="mt-1 text-[11.5px] leading-[1.55] text-ink-faint">
                Same salt, one character different in the password:
              </p>
              <p className="mt-2 break-all font-mono text-[10px] leading-[1.45] text-ink-soft">
                {avalanche.originalHash}
              </p>
              <p className="mt-1.5 break-all font-mono text-[10px] leading-[1.45] text-ink-soft">
                {avalanche.mutatedHash}
              </p>
              <p className="mt-2 readout text-[11px] text-warn">
                {avalanche.differing} of {avalanche.originalHash.length}
                <span className="ml-1 font-sans text-[10.5px] tracking-normal text-ink-faint">
                  hex characters differ
                </span>
              </p>
            </div>
          ) : null}
        </Cell>
      </div>

      {/* The readout: one sentence, rewritten every time state changes. */}
      <div className="border-t border-rule bg-paper-sunk/40 px-5 py-4">
        <span className="field-label">what just changed</span>
        <p
          aria-live="polite"
          className={`mt-2 flex items-start gap-2.5 text-[13.5px] leading-[1.7] ${TONE_CLASS[note.tone]}`}
        >
          <span
            aria-hidden
            className={`mt-[9px] size-[6px] shrink-0 ${TONE_DOT[note.tone]}`}
          />
          <span className="max-w-[76ch]">{note.text}</span>
        </p>
      </div>

      {/* The bench controls. These move the simulation, not the app. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-dashed border-rule px-5 py-3">
        <span className="field-label">step 2 · simulation controls</span>
        <button
          type="button"
          className={BTN_QUIET}
          aria-pressed={salted}
          onClick={() => toggleSalt(!salted)}
        >
          Salt: {salted ? "on" : "off"}
        </button>
        <button
          type="button"
          className={BTN_QUIET}
          onClick={leak}
          disabled={!store}
        >
          Simulate a database leak
        </button>
        <button type="button" className={BTN_QUIET} onClick={reset}>
          Reset
        </button>
        <p className="max-w-[52ch] font-mono text-[10.5px] leading-[1.5] text-ink-faint">
          salt — random extra text added before hashing, so identical passwords
          do not produce identical hashes
        </p>
      </div>

      <p className="border-t border-rule px-5 py-2.5 font-mono text-[10.5px] leading-[1.5] text-ink-faint">
        This demo hashes with {HASH_ALGORITHM} so the step is fast enough to
        watch happen. Real apps use a deliberately slow algorithm such as
        bcrypt, scrypt or argon2, and tune a cost factor so every guess costs
        the attacker.
      </p>
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
