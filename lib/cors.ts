/**
 * CORS, modelled as the two halves it actually is.
 *
 * `respond` is the server: it always answers, with whatever the configured
 * header says, and it never blocks anything. `read` is the browser: it takes
 * the response that arrived and decides whether the page's script may see the
 * body. Keeping them as separate functions is the whole teaching point — the
 * request always arrives and the server always answers, so the only thing that
 * varies is whether the browser lets the page read what came back.
 */

export type OriginId = "mine" | "attacker";

export type Origin = {
  id: OriginId;
  label: string;
  host: string;
  /** Whether the server's allow-list names this origin. */
  onList: boolean;
  note: string;
};

/*
  Two origins, the shape of the existing diagram: the origin the API is built
  for, and any other origin at all. Nothing here is a real site; the second one
  is a stand-in for every site that is not yours.
*/
export const ORIGINS: Origin[] = [
  {
    id: "mine",
    label: "yourdomain.com",
    host: "https://yourdomain.com",
    onList: true,
    note: "your own origin",
  },
  {
    id: "attacker",
    label: "attacker-site.com",
    host: "https://attacker-site.com",
    onList: false,
    note: "not on the allow-list",
  },
];

export function originOf(id: OriginId): Origin {
  return ORIGINS.find((origin) => origin.id === id) ?? ORIGINS[0];
}

export type AllowId = "specific" | "wildcard";

export type AllowConfig = {
  id: AllowId;
  label: string;
  /** The exact value the server puts in Access-Control-Allow-Origin. */
  header: string;
  note: string;
};

export const ALLOW: AllowConfig[] = [
  {
    id: "specific",
    label: "Allow-Origin: yourdomain.com",
    header: "https://yourdomain.com",
    note: "only the named origin may read the response",
  },
  {
    id: "wildcard",
    label: "Allow-Origin: *",
    header: "*",
    note: "every origin may read the response",
  },
];

export function allowOf(id: AllowId): AllowConfig {
  return ALLOW.find((config) => config.id === id) ?? ALLOW[0];
}

/** The visitor data an origin is trying to read. */
export const PAYLOAD = [
  { label: "email", value: "alex@yourdomain.com" },
  { label: "plan", value: "team · 12 seats" },
  { label: "last login", value: "9 Oct 2026, 08:41" },
];

export const PAYLOAD_JSON =
  '{"email":"alex@yourdomain.com","plan":"team","last_login":"2026-10-09T08:41Z"}';

export type ServerResponse = {
  status: 200;
  /** Whatever the config put in Access-Control-Allow-Origin. */
  header: string;
  body: string;
};

/** The server answers. It does not know about CORS and does not enforce it. */
export function respond(allow: AllowConfig): ServerResponse {
  return { status: 200, header: allow.header, body: PAYLOAD_JSON };
}

export type ReadDecision = {
  readable: boolean;
  reason: string;
};

/** The browser decides whether the page's script may read the body. */
export function read(origin: Origin, response: ServerResponse): ReadDecision {
  const permitted =
    response.header === "*" || response.header === origin.host;

  if (permitted && response.header === "*") {
    return {
      readable: true,
      reason:
        "Permitted, for every origin. Access-Control-Allow-Origin: * allows any site at all, so the browser handed this body to the page's script. That is the protection removed rather than an error fixed: it is fine for genuinely public data, and wrong for anything a signed-in visitor can see.",
    };
  }

  if (permitted) {
    return {
      readable: true,
      reason: `Permitted. The header names exactly this origin (${origin.host}), so the browser handed the response to the page. Nothing was blocked, because the server declared this one origin readable.`,
    };
  }

  return {
    readable: false,
    reason: `Withheld at the browser boundary. Access-Control-Allow-Origin: ${response.header} does not match this page's origin ${origin.host}, so the browser will not let this page's script read the body. The request arrived and the server answered with the data — the network tab would show a 200. The code sees nothing, and the console reads: "Access to fetch at 'https://api.yourdomain.com/me' from origin '${origin.host}' has been blocked by CORS policy."`,
  };
}
