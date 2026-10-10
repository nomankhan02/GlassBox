/**
 * Sessions and tokens, as server-side logic.
 *
 * There is no React and no DOM here, on purpose. In a real app both of these
 * live behind the network boundary: a session is a row in a store the server
 * reads, a token is a signed bundle the server verifies and then trusts. The
 * demo component can call these functions and read what they return, and it has
 * no way to write into the session store directly — which is the whole point.
 *
 * The token is really signed. `encodeToken` computes an HMAC-SHA256 over the
 * header and payload with the Web Crypto API, and `verifyToken` recomputes it
 * and compares. So the signature step in the demo is not a label on a fake
 * string; tamper with the payload and the check genuinely fails.
 */

export type Claims = {
  /** The account this token speaks for. */
  sub: string;
  name: string;
  /** Issued at, in seconds. */
  iat: number;
  /** Expires at, in seconds. */
  exp: number;
};

/** The single account every log-in in the demo is for. */
export const DEMO_USER = { id: "u_4817", name: "Alex" };

/*
  A fixed demo signing key. In a real app this is a server secret and a token
  signed with it is trusted without a lookup — which is exactly why revoking one
  early is hard. It is stated on screen rather than hidden.
*/
const SIGNING_KEY = "glassbox-demo-signing-key";

/** The demo's token lifetime, short so the countdown is watchable. */
export const TOKEN_TTL_MS = 60_000;
/** What a real access token's lifetime usually is. */
export const TOKEN_TTL_REAL_LABEL = "15–60 minutes in a real app";
/** What a real session's lifetime usually is. */
export const SESSION_TTL_LABEL = "until revoked · days to a month idle";
export const SIGNING_KEY_NOTE = "hmac-sha256 · the key stays on the server";

export type SessionRow = {
  id: string;
  user: string;
  createdAt: number;
};

/** Random, opaque, meaningless on its own: a lookup key and nothing more. */
export function createSessionId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createSession(now: number): SessionRow {
  return { id: createSessionId(), user: DEMO_USER.name, createdAt: now };
}

/* ---- base64url, the encoding a JWT segment uses ---- */

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(input: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SIGNING_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(input),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

/**
 * Sign a set of claims. Three base64url segments, exactly the shape of a JWT:
 * header, payload, and a signature over the first two.
 */
export async function encodeToken(claims: Claims): Promise<string> {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = toBase64Url(JSON.stringify(claims));
  const signature = await sign(`${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

export type VerifyStep = {
  label: string;
  value: string;
  tone: "plain" | "ok" | "bad";
};

export type VerifyResult = {
  steps: VerifyStep[];
  valid: boolean;
  expired: boolean;
  mismatch: boolean;
  claims: Claims | null;
};

/**
 * Verify a token the way the server would: recompute the signature and compare,
 * then read the claims off the token and check the expiry. No lookup happens
 * here, because there is nothing to look up.
 */
export async function verifyToken(
  token: string,
  nowMs: number,
): Promise<VerifyResult> {
  const now = Math.floor(nowMs / 1000);
  const [headerB64, payloadB64, signatureB64] = token.split(".");
  const steps: VerifyStep[] = [];

  steps.push({
    label: "split the token into its three parts",
    value: "header · payload · signature",
    tone: "plain",
  });

  const expected = await sign(`${headerB64}.${payloadB64}`);
  const mismatch = expected !== signatureB64;
  steps.push({
    label: "recompute the signature with the server's key",
    value: `${expected.slice(0, 20)}…`,
    tone: "plain",
  });
  steps.push({
    label: "compare it with the signature in the token",
    value: mismatch ? "no match" : "match",
    tone: mismatch ? "bad" : "ok",
  });

  let claims: Claims | null = null;
  try {
    claims = JSON.parse(fromBase64Url(payloadB64)) as Claims;
  } catch {
    claims = null;
  }

  const expired = claims ? now >= claims.exp : false;
  const secondsLeft = claims ? Math.max(0, claims.exp - now) : 0;

  steps.push({
    label: "read the claims straight off the payload",
    value: claims ? `sub ${claims.sub} · ${secondsLeft}s left` : "unreadable",
    tone: "plain",
  });
  steps.push({
    label: "check the exp claim",
    value: expired ? "expired" : "still valid",
    tone: expired ? "bad" : "ok",
  });

  return {
    steps,
    valid: !mismatch && !expired && claims !== null,
    expired,
    mismatch,
    claims,
  };
}
