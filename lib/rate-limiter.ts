/**
 * The limiter, as server-side logic.
 *
 * There is no React and no browser in this file, on purpose. Everything here
 * would run on the server in a real implementation, and that is the point the
 * demo makes: the demo component can call these functions and read the state
 * they return, and it has no way to write to a counter directly.
 *
 * `decide` and `expire` are pure, so the same input always produces the same
 * next state, which is what makes the mechanism testable. The one thing this
 * file does not contain is a clock: `now` is always handed in by the caller.
 */

export const LIMIT = 5;
export const WINDOW_MS = 10_000;
export const LOG_CAP = 14;

export type IdentityId = "anon" | "user" | "service";

export type Identity = {
  id: IdentityId;
  /** What the server counts requests against. */
  key: string;
  sub: string;
};

/*
  Three keys, because the limit is per key and that is the part people get
  wrong. The IP is from 203.0.113.0/24, the reserved documentation range, so it
  cannot belong to anybody real; the service key stands in for cron jobs and
  other machine callers, which are the clients that never read the docs.
*/
export const IDENTITIES: Identity[] = [
  { id: "anon", key: "203.0.113.7", sub: "not signed in · keyed by IP" },
  { id: "user", key: "user_4817", sub: "signed in · keyed by account" },
  { id: "service", key: "worker_2201", sub: "machine caller · keyed by token" },
];

export function identityOf(id: IdentityId): Identity {
  return IDENTITIES.find((identity) => identity.id === id) ?? IDENTITIES[0];
}

export type Window = { startedAt: number; used: number } | null;

export type Entry = {
  seq: number;
  identity: IdentityId;
  /** Timestamp of arrival at the server. */
  arrival: number;
  status: 200 | 429;
  retryAfter: number | null;
};

export type Tone = "idle" | "ok" | "warn" | "bad";

export type State = {
  windows: Record<IdentityId, Window>;
  log: Entry[];
  seq: number;
  note: { tone: Tone; text: string };
};

export const INITIAL_STATE: State = {
  windows: { anon: null, user: null, service: null },
  log: [],
  seq: 0,
  note: {
    tone: "idle",
    text: "Nothing has been asked of the server yet. No window is open and every counter is at zero.",
  },
};

/**
 * Elapsed fraction of a window, 0 at open and 1 at expiry. Pure, so the view
 * can render the sweep without owning the clock.
 */
export function elapsed(window: Window, now: number): number {
  if (!window) return 0;
  return Math.min(1, Math.max(0, (now - window.startedAt) / WINDOW_MS));
}

/** Milliseconds left in a window, clamped to the window length. */
export function remainingMs(window: Window, now: number): number {
  return Math.round((1 - elapsed(window, now)) * WINDOW_MS);
}

/**
 * Take one request from an identity and return the next state.
 *
 * A request that is refused does not consume allowance, which is a design
 * choice rather than a law: an implementation that counts refused requests
 * against you exists too, and it is worse for anyone who retries.
 */
export function decide(
  state: State,
  identity: IdentityId,
  now: number,
): State {
  const current = state.windows[identity];
  const window =
    current && now - current.startedAt < WINDOW_MS
      ? current
      : { startedAt: now, used: 0 };

  const seq = state.seq + 1;
  const key = identityOf(identity).key;

  if (window.used < LIMIT) {
    const used = window.used + 1;
    const entry: Entry = {
      seq,
      identity,
      arrival: now,
      status: 200,
      retryAfter: null,
    };

    return {
      windows: {
        ...state.windows,
        [identity]: { startedAt: window.startedAt, used },
      },
      log: [entry, ...state.log].slice(0, LOG_CAP),
      seq,
      note:
        used === LIMIT
          ? {
              tone: "warn",
              text: `Allowed, and that was the last slot: ${key} is now at ${used} of ${LIMIT}. Nothing has changed in the browser — the server simply counted, and the next request on this key will be refused.`,
            }
          : {
              tone: "ok",
              text: `Allowed. The counter for ${key} moved from ${window.used} to ${used} of ${LIMIT}. That number lives on the server; the browser has no way to lower it.`,
            },
    };
  }

  const retryAfter = Math.max(
    1,
    Math.ceil((window.startedAt + WINDOW_MS - now) / 1000),
  );

  const entry: Entry = { seq, identity, arrival: now, status: 429, retryAfter };

  return {
    windows: { ...state.windows, [identity]: window },
    log: [entry, ...state.log].slice(0, LOG_CAP),
    seq,
    note: {
      tone: "bad",
      text: `Refused with 429. The counter did not move, because a refused request consumes no allowance. The Retry-After header says ${retryAfter} second${
        retryAfter === 1 ? "" : "s"
      }, which is what remains of this window.`,
    },
  };
}

/**
 * Retire any window that has run out. Returns null when nothing changed, so the
 * caller can skip a re-render on every tick.
 */
export function expire(state: State, now: number): State | null {
  const expired: IdentityId[] = [];
  const windows = { ...state.windows };

  for (const identity of IDENTITIES) {
    const window = windows[identity.id];
    if (window && now - window.startedAt >= WINDOW_MS) {
      expired.push(identity.id);
      windows[identity.id] = null;
    }
  }

  if (expired.length === 0) return null;

  const who = expired.map((id) => identityOf(id).key).join(" and ");

  return {
    ...state,
    windows,
    note: {
      tone: "idle",
      text: `The window elapsed and the counter for ${who} reset to zero, so requests pass again. The server did not announce this; it simply stopped counting the old window, and the faded entries in the log no longer count towards anything.`,
    },
  };
}
