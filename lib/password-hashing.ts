/**
 * Password hashing, as the server would do it.
 *
 * There is no React and no DOM in this file. The real algorithm would run on the
 * server, and the demo's point is that the browser can ask for the same
 * calculation and read the result, but the stored hash itself is written down
 * somewhere the visitor cannot reach.
 *
 * The one deliberate compromise is the algorithm. A real app hashes with a
 * slow, memory-hard function (bcrypt, scrypt, argon2) precisely so guessing is
 * expensive; the demo uses SHA-256 through the Web Crypto API because it is
 * fast enough to watch happen. That difference is stated on screen rather than
 * hidden.
 */

/** The algorithm this demo uses, named because the speed is the point. */
export const HASH_ALGORITHM = "SHA-256";
/** Salt length in bytes. Sixteen is the common floor. */
export const SALT_BYTES = 16;
/** SHA-256 renders as 64 hex characters, which is what the avalanche shows. */
export const HASH_HEX_LENGTH = 64;

export type AccountId = "alex" | "jordan";

export type Account = {
  id: AccountId;
  name: string;
  sub: string;
};

/* Two accounts, because the salt argument only lands when two people choose the
   same password and their rows still look unrelated. */
export const ACCOUNTS: Account[] = [
  { id: "alex", name: "Alex", sub: "chose the same password" },
  { id: "jordan", name: "Jordan", sub: "chose the same password" },
];

export type StoredRecord = {
  account: AccountId;
  /** The salt for this row, or null when the store is unsalted. */
  salt: string | null;
  /** Only this value is ever written down. */
  hash: string;
};

export type Store = {
  /** The password as typed at sign-up; the hashes are derived from it. */
  password: string;
  salted: boolean;
  records: StoredRecord[];
};

export type Avalanche = {
  /** The password with exactly one character changed. */
  mutated: string;
  /** Hash of the original, and of the changed input, under the same salt. */
  originalHash: string;
  mutatedHash: string;
  /** How many of the 64 hex characters differ. */
  differing: number;
};

/** Uint8Array to lowercase hex, the way a hash is normally displayed. */
export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

/** A fresh random salt from the browser's cryptographic generator. */
export function randomSalt(): string {
  const bytes = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/** SHA-256 of a string, returned as hex. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest(HASH_ALGORITHM, data);
  return toHex(new Uint8Array(digest));
}

/**
 * The exact calculation: salt first, then the password, or the password alone
 * when there is no salt. The separator matters — without it, two different
 * salt/password pairs can concatenate to the same input.
 */
export async function hashPassword(
  password: string,
  salt: string | null,
): Promise<string> {
  return sha256Hex(salt ? `${salt}:${password}` : password);
}

/** How many hex characters differ between two hashes. */
export function differingCharacters(a: string, b: string): number {
  const length = Math.max(a.length, b.length);
  let count = 0;
  for (let index = 0; index < length; index += 1) {
    if (a[index] !== b[index]) count += 1;
  }
  return count;
}

/** Change exactly one character, so the avalanche effect can be demonstrated. */
export function changeOneCharacter(text: string): string {
  if (text.length === 0) return "x";
  const lastIndex = text.length - 1;
  const last = text[lastIndex];
  return `${text.slice(0, lastIndex)}${last === "x" ? "y" : "x"}`;
}

/**
 * Derive the whole store from a password and a salt mode: one record per
 * account, plus the avalanche pair. Salts are generated fresh here, which is
 * why toggling salt on and off produces new rows each time.
 */
export async function deriveStore(
  password: string,
  salted: boolean,
): Promise<{ store: Store; avalanche: Avalanche }> {
  const mutated = changeOneCharacter(password);

  let records: StoredRecord[];
  if (salted) {
    records = await Promise.all(
      ACCOUNTS.map(async (account) => {
        const salt = randomSalt();
        return { account: account.id, salt, hash: await hashPassword(password, salt) };
      }),
    );
  } else {
    const hash = await hashPassword(password, null);
    records = ACCOUNTS.map((account) => ({
      account: account.id,
      salt: null,
      hash,
    }));
  }

  const salt = records[0]?.salt ?? null;
  const [originalHash, mutatedHash] = await Promise.all([
    hashPassword(password, salt),
    hashPassword(mutated, salt),
  ]);

  return {
    store: { password, salted, records },
    avalanche: {
      mutated,
      originalHash,
      mutatedHash,
      differing: differingCharacters(originalHash, mutatedHash),
    },
  };
}

/** True when every stored row shares one hash, which is what salt prevents. */
export function hasDuplicateHashes(store: Store): boolean {
  const [first, ...rest] = store.records;
  if (!first) return false;
  return rest.some((record) => record.hash === first.hash);
}
