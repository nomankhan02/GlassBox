/**
 * Two gates, as server logic.
 *
 * No React and no DOM here, on purpose. In a real app both checks run on the
 * server, per request, and that is the mechanism the demo draws: a request
 * arrives, gate 1 asks who sent it, gate 2 asks whether that identity may touch
 * this exact record. `evaluate` is pure, so one identity always produces the
 * same outcome, which is what makes the rule inspectable rather than implied.
 */

/** The record every request in the demo is aimed at. */
export const RECORD = {
  id: "#42",
  ownerId: "alex",
  ownerLabel: "Alex",
  fields: [
    { label: "owner", value: "Alex" },
    { label: "title", value: "Quarterly review notes" },
    { label: "updated", value: "12 Sep 2026" },
    { label: "body", value: "Draft notes, not yet shared with the wider team." },
  ],
};

export type IdentityId = "anonymous" | "alex" | "jordan" | "admin";

export type Identity = {
  id: IdentityId;
  label: string;
  sub: string;
  /** Gate 1 passes only when there is an identity behind the request. */
  signedIn: boolean;
  /** The account this identity acts as, when signed in. */
  user: "alex" | "jordan" | null;
  /** A role that the stated policy allows to read any record. */
  isAdmin: boolean;
};

/*
  Four identities, because the two gates fail in two different places and the
  point is which gate said no. Jordan is the interesting one: fully signed in
  and still refused, because being known is not the same as being allowed.
*/
export const IDENTITIES: Identity[] = [
  {
    id: "anonymous",
    label: "Not signed in",
    sub: "no identity",
    signedIn: false,
    user: null,
    isAdmin: false,
  },
  {
    id: "alex",
    label: "Signed in as Alex",
    sub: "owns record #42",
    signedIn: true,
    user: "alex",
    isAdmin: false,
  },
  {
    id: "jordan",
    label: "Signed in as Jordan",
    sub: "not the owner",
    signedIn: true,
    user: "jordan",
    isAdmin: false,
  },
  {
    id: "admin",
    label: "Signed in as an admin",
    sub: "role · may read any record",
    signedIn: true,
    user: null,
    isAdmin: true,
  },
];

export function identityOf(id: IdentityId): Identity {
  return IDENTITIES.find((identity) => identity.id === id) ?? IDENTITIES[0];
}

export type GateId = "authn" | "authz";

export type Outcome = {
  status: 200 | 401 | 403;
  /** The gate that produced the outcome, or null when both passed. */
  stopGate: GateId | null;
  passedAuthn: boolean;
  passedAuthz: boolean;
  /** One line naming the gate and the reason. */
  reason: string;
};

/**
 * Run one request through both gates, in order.
 *
 * The admin rule is a stated policy on the page rather than a hidden bypass:
 * gate 2 allows it explicitly, which is exactly how a permission rule should
 * read — visible and written down.
 */
export function evaluate(identity: Identity): Outcome {
  if (!identity.signedIn) {
    return {
      status: 401,
      stopGate: "authn",
      passedAuthn: false,
      passedAuthz: false,
      reason:
        "Stopped at gate 1: the request carries no identity, so authentication fails and gate 2 is never reached. 401 means the server does not know who you are.",
    };
  }

  const allowed =
    identity.isAdmin || (identity.user !== null && identity.user === RECORD.ownerId);

  if (!allowed) {
    return {
      status: 403,
      stopGate: "authz",
      passedAuthn: true,
      passedAuthz: false,
      reason:
        "Passed gate 1 — the identity is known — then stopped at gate 2: this account is neither the owner of record #42 nor an admin, so this particular record is refused. 403 means it knows who you are and still says no.",
    };
  }

  return {
    status: 200,
    stopGate: null,
    passedAuthn: true,
    passedAuthz: true,
    reason: identity.isAdmin
      ? "Passed both gates: signed in, and the admin role is allowed to read any record. That is the stated policy on this page, not a hidden bypass."
      : "Passed both gates: signed in, and this account owns record #42, which is what gate 2 checks — this user against this row.",
  };
}
