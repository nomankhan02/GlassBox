import type { Break } from "./breaks";
import type { Diagram } from "./diagrams";

export type Concept = {
  id: string;
  /** Ordinal shown in the register, e.g. "1.07". */
  code: string;
  title: string;
  /** The question this concept answers, in the reader's own words. */
  asks: string;
  /**
   * Plain-language explanation paragraphs. Numbers written as {{...}} are data
   * and are rendered in the instrument face; everything else stays body text.
   */
  plain: string[];
  /**
   * A schematic drawing of the mechanism's shape. Sits beside the break rather
   * than replacing it: the break gives you the figures, the diagram the shape.
   */
  diagram?: Diagram;
  /** One small visual that sits after the explanation. Optional. */
  brk?: Break;
  /** What you would actually ask a tool to set up. */
  tell: string;
  /** Short note set in the margin. */
  marginalia: string;
  /** Which demo is wired up, if any. */
  demoId: string | null;
  /** What the demo (planned or live) shows. */
  demoNote: string;
  /** Another concept worth reading next. */
  related?: string;
};

/*
  Ten mechanisms, in reading order: each one assumes the previous ones. The two
  authentication concepts sit next to each other because they are routinely
  conflated, and password hashing follows them because it is what the database
  does at the moment authentication happens.
*/
export const CONCEPTS: Concept[] = [
  {
    id: "frontend-backend",
    code: "1.01",
    title: "Frontend and backend",
    asks: "Which half of what I am looking at is running where?",
    plain: [
      "Every web app is split in two. The frontend is the code that runs inside your visitor's browser: the layout, the styling, the interactions. It arrives as files that anyone can read. The backend is code running on a machine you rent, where visitors cannot see it.",
      "The split matters because of what each side can be trusted with. Browser code is public. Someone can open developer tools, change a value in a form field, or call your endpoints directly, without ever loading your page. Server code can hold a credential, decide whether a request is allowed, and read from a database. It is the only place a rule actually holds.",
      "The mistake that shows up most often in AI-built projects is a rule that lives in the frontend. Hiding a button looks like enforcement and is not. It is worth being able to point at any given rule and say which side of the line it sits on.",
    ],
    diagram: {
      kind: "flow",
      label: "one rule, and which side of the line can hold it",
      nodes: [
        { id: "browser", label: "the browser", sub: "public code", col: 0, row: 0 },
        { id: "server", label: "the server", sub: "holds the rules", col: 1, row: 0 },
      ],
      boundary: { afterCol: 0, label: "the network" },
      arrows: [
        {
          from: "browser",
          to: "server",
          both: true,
          label: "requests · responses",
        },
      ],
      note: "Everything on the browser side can be read and edited, so a rule written there is a suggestion. The server is the one box a visitor cannot open, which is why it is the only place a rule actually holds.",
    },
    brk: {
      kind: "compare",
      label: "the same rule, on each side of the line",
      left: {
        title: "in the browser",
        tone: "bad",
        points: [
          "Hiding the button is a suggestion, not a rule.",
          "Anyone can call the endpoint directly, with or without the page.",
          "A value in the page can be edited before it is sent.",
        ],
        note: "holds until someone opens developer tools",
      },
      right: {
        title: "on the server",
        tone: "ok",
        points: [
          "The request is checked before the work is done.",
          "The answer is the same however it was asked for.",
          "A refused request cannot be un-refused from the client.",
        ],
        note: "holds against everyone who tries",
      },
      verdict:
        "A rule has one honest home. If you cannot say which side of the line it sits on, it is in the browser.",
    },
    tell: "Keep a clean split. The browser gets HTML, CSS and JavaScript, and talks to my API. Anything with a credential, or any rule that has to hold, lives on the server. Never enforce a permission only in the browser.",
    marginalia: "anything the browser can read, a visitor can change",
    demoId: null,
    demoNote:
      "A split view of one click: what happens in the browser, what travels, and what only the server can do.",
  },
  {
    id: "requests",
    code: "1.02",
    title: "Client and server requests",
    asks: "What happens between a click and the page updating?",
    plain: [
      "A request is a message from the browser to a server asking for something. It has a method (GET to read, POST to send, PATCH to change, DELETE to remove), a path, some headers, and sometimes a body. The server replies with a status code and usually some data.",
      "Round trips take time: a request to a server in another region usually costs {{100-250 ms}} uncached, and a slow mobile connection pushes that past half a second. That delay is why interfaces show spinners, and why a slow endpoint feels broken even when it is working correctly.",
      "Status codes are the server's verdict in one number. {{2xx}} worked. {{3xx}} go elsewhere. {{4xx}} the request was wrong or not allowed. {{5xx}} the server itself failed. The difference between a {{401}} and a {{500}} tells you which side of the line to go and fix.",
    ],
    diagram: {
      kind: "flow",
      label: "one round trip, and what each direction carries",
      nodes: [
        { id: "browser", label: "the browser", sub: "asks", col: 0, row: 0 },
        { id: "server", label: "the server", sub: "answers", col: 1, row: 0 },
      ],
      arrows: [
        {
          from: "browser",
          to: "server",
          lane: -1,
          label: "method · path · headers · body",
        },
        {
          from: "server",
          to: "browser",
          lane: 1,
          label: "status · response body",
        },
      ],
      note: "Two halves of one exchange: the request out, the verdict and usually the data back. Every spinner on a page is a pair of these still in flight.",
    },
    brk: {
      kind: "flow",
      label: "what one request is made of",
      steps: ["method + path", "headers", "body", "status + response"],
      note: "one round trip. every spinner on a page is one of these still in flight.",
    },
    tell: "List the endpoints before building the UI: method, path, what comes back on success, and what comes back when it fails. Include the failure codes and what the user should see for each one.",
    marginalia: "every spinner is a round trip you can watch",
    demoId: null,
    demoNote:
      "One request followed from click to response, with the status code explained at the point it arrives.",
  },
  {
    id: "databases",
    code: "1.03",
    title: "Databases",
    asks: "Where does the data live after the tab closes?",
    plain: [
      "Anything stored in the browser is a convenience, not a record. It disappears when the visitor clears their data. The database is where your app's data actually lives: on a machine you control, outliving every session.",
      "Most web databases are tables of rows (Postgres, MySQL) or collections of documents (MongoDB). You rarely touch them by hand. Your code sends queries: read the rows where the owner is this user, insert a row, update one. A lookup that can use an index returns in single-digit milliseconds; the same lookup with no index has to read the table.",
      "The schema, meaning which tables and columns exist and what types they hold, is the shape of your app's memory. It changes as the app grows, and every change needs a migration so the database on your laptop, your test environment and production all agree about that shape.",
    ],
    diagram: {
      kind: "flow",
      label: "the one place a record actually lives",
      nodes: [
        { id: "app", label: "your server code", col: 0, row: 0 },
        {
          id: "db",
          label: "the database",
          sub: "outlives sessions",
          col: 1,
          row: 0,
        },
      ],
      arrows: [
        { from: "app", to: "db", lane: -1, label: "write" },
        { from: "db", to: "app", lane: 1, label: "read" },
      ],
      note: "Reads and writes are separate trips to a machine you rent, even when one screen shows both. The browser is not in this picture at all.",
    },
    brk: {
      kind: "compare",
      label: "two places to keep something",
      left: {
        title: "in the browser",
        tone: "bad",
        points: [
          "Survives until the visitor clears site data.",
          "Visible on one device, in one tab's world.",
          "No rule can be enforced here.",
        ],
        note: "a convenience, not a record",
      },
      right: {
        title: "in the database",
        tone: "ok",
        points: [
          "Outlives every session and every device.",
          "The only place a rule can actually hold.",
          "Reached only through code you control.",
        ],
        note: "the record",
      },
      verdict: "If losing it would matter, it does not belong in the browser.",
    },
    tell: "Write down the data I need to store, how the pieces relate, and who is allowed to read or write each table. Use migrations for every schema change so environments stay in step.",
    marginalia: "a schema is the decision that gets expensive to undo",
    demoId: null,
    demoNote:
      "Two visitors, one database: the write each one makes and what the other one sees afterwards.",
  },
  {
    id: "authn-authz",
    code: "1.04",
    title: "Authentication and authorization",
    asks: "Who are you, and what are you allowed to do?",
    plain: [
      "Two questions get said in the same breath and they are not the same question. Authentication is proving identity: this request really comes from the account it claims. Authorization is permission: this account may perform this particular action.",
      "A sign-in flow answers the first question only. It is common for an app to know exactly who you are and still let you read somebody else's records, because nothing ever checked the second question.",
      "Authorization is checked per request, on the server, against the specific record being touched. The shape is always: identify the user, then confirm this user may act on this row. Anything less is a rule that only holds for people who were not trying.",
    ],
    diagram: {
      kind: "flow",
      label: "two gates, in order, on every request",
      nodes: [
        { id: "req", label: "a request", col: 0, row: 0 },
        { id: "authn", label: "gate 1", sub: "authentication", col: 1, row: 0 },
        { id: "authz", label: "gate 2", sub: "authorization", col: 2, row: 0 },
        { id: "rec", label: "the record", col: 3, row: 0 },
      ],
      arrows: [
        { from: "req", to: "authn", label: "who are you?" },
        { from: "authn", to: "authz", label: "signed in" },
        { from: "authz", to: "rec", label: "allowed for this row", tone: "ok" },
      ],
      note: "A sign-in flow opens gate 1 and leaves gate 2 shut. The second gate is the one routinely left out, and the one that stops one account reading another's records.",
    },
    brk: {
      kind: "compare",
      label: "two questions that get said in one breath",
      left: {
        title: "authentication",
        tone: "plain",
        points: [
          "Answered once, at sign-in.",
          "Proves the request comes from the account it claims.",
          "A password, a one-time code, a session cookie.",
        ],
        note: "who you are",
      },
      right: {
        title: "authorization",
        tone: "plain",
        points: [
          "Answered on every request, not once.",
          "Checks this account against this exact record.",
          "The check that gets left out.",
        ],
        note: "what you may do",
      },
      verdict: "A sign-in flow answers the first question and nothing else.",
    },
    tell: "Sign-in only answers who the user is. Every read and write then re-checks whether this user may touch this specific record, on the server, on every request. Do not rely on the UI hiding anything.",
    marginalia: "signed in is not the same as allowed",
    demoId: "authn-authz",
    demoNote:
      "Two accounts and one record: where the permission check has to sit for the rule to hold.",
  },
  {
    id: "sessions-tokens",
    code: "1.05",
    title: "Sessions and tokens",
    asks: "How does the server remember me between requests?",
    plain: [
      "HTTP has no memory. Each request arrives as a stranger, so anything that persists has to be either carried along or looked up. Two approaches are common and they trade off differently.",
      "A session is a random identifier in a cookie. The server keeps the details under that identifier and can delete them, which logs you out everywhere at once. A token is a signed bundle of data the server hands out and then trusts on sight. It scales well and is hard to revoke before it expires. Expiry is where the two differ in practice: a session commonly idles out somewhere between a few days and a month, while a short-lived access token is often given {{15}} to {{60}} minutes, with a longer-lived refresh token behind it.",
      "Where the credential sits decides how exposed it is. A cookie marked httpOnly cannot be read by your page's JavaScript, which is what you want for sign-in. A token in localStorage can be read by any script running on the page, so a single compromised dependency can walk away with it.",
    ],
    diagram: {
      kind: "flow",
      label: "who is holding the state: the server, or the client",
      rowLabels: ["session", "token"],
      rowGap: 58,
      nodes: [
        { id: "client-s", label: "client", sub: "holds a random id", col: 0, row: 0 },
        { id: "server-s", label: "server", sub: "holds the session", col: 1, row: 0 },
        { id: "client-t", label: "client", sub: "holds the claims", col: 0, row: 1 },
        {
          id: "server-t",
          label: "server",
          sub: "holds nothing",
          hollow: true,
          col: 1,
          row: 1,
        },
      ],
      arrows: [
        { from: "client-s", to: "server-s", lane: -1, label: "cookie carries an id" },
        { from: "server-s", to: "client-s", lane: 1, label: "details looked up" },
        { from: "client-t", to: "server-t", lane: -1, label: "token carries the claims" },
        { from: "server-t", to: "client-t", lane: 1, label: "verified, nothing stored" },
      ],
      note: "A session keeps its state on the server and sends an id. A token carries the state itself, so the server keeps nothing to look up — and nothing to revoke before it expires.",
    },
    brk: {
      kind: "compare",
      label: "two ways to be remembered",
      left: {
        title: "session in a cookie",
        tone: "ok",
        points: [
          "httpOnly by default, so page scripts cannot read it.",
          "Revoked by deleting one record on the server.",
          "The store is shared state to run and to scale.",
        ],
        note: "server-side record",
      },
      right: {
        title: "signed token in localStorage",
        tone: "bad",
        points: [
          "Valid until it expires, wherever it happens to be.",
          "Readable by any script on the page, including a compromised dependency.",
          "Revoking it early means keeping a denylist, which puts the state back.",
        ],
        note: "self-contained claim",
      },
      verdict:
        "Both can be right. The token is only wrong when it sits where a script can read it.",
    },
    tell: "Store sign-in state in an httpOnly, secure, sameSite cookie. No auth tokens in localStorage. Give credentials an expiry, and tell me how a user logs out of every device at once.",
    marginalia: "whoever holds the credential is you, as far as the server knows",
    demoId: null,
    demoNote:
      "Two tabs and one sign-out: what happens to a session and what happens to a token.",
  },
  {
    id: "password-hashing",
    code: "1.06",
    title: "Password hashing",
    asks: "What does the database store when someone signs up?",
    plain: [
      "Passwords are never stored in a form anyone could reverse. Instead a hash function runs over the password plus a random salt, and only the result is stored. At sign-in the same calculation runs again and the two results are compared.",
      "The salt stops two people who chose the same password from having the same stored value, which is what defeats precomputed lookup tables. The hash function should be deliberately slow (bcrypt, scrypt, argon2), because slow is what makes guessing expensive. Slow has a figure attached: bcrypt at cost {{10}} lands around {{100 ms}} per hash on ordinary server hardware, cost {{12}} several times that, and each step of the cost doubles the work, so the factor is tuned to the machine rather than picked once and forgotten.",
      "The size of the blast radius is the real argument. A leaked list of email addresses is bad. A leaked list of email addresses beside plaintext passwords is a problem for every other site those people use, because passwords get reused across them. The asymmetry is the whole design: SHA-256 can be tried billions of times a second on one graphics card, while the same hardware gets through a small fraction of that against bcrypt at a sensible cost.",
    ],
    diagram: {
      kind: "flow",
      label: "what is written down, and what is only ever compared",
      rowGap: 76,
      nodes: [
        { id: "pw", label: "password", sub: "at sign-up", col: 0, row: 0 },
        { id: "hash", label: "hash function", sub: "salted · slow", col: 1, row: 0 },
        { id: "stored", label: "stored hash", sub: "the only record", col: 2, row: 0 },
        { id: "pw2", label: "password", sub: "at log-in", col: 0, row: 1 },
        { id: "hash2", label: "same function", sub: "same salt", col: 1, row: 1 },
        { id: "compare", label: "compare", sub: "equal or not", col: 2, row: 1 },
      ],
      arrows: [
        { from: "pw", to: "hash", lane: -1, label: "plain text, never stored" },
        { from: "hash", to: "stored", label: "only this is written down" },
        { from: "pw2", to: "hash2", lane: -1, label: "same input" },
        { from: "hash2", to: "compare", label: "same calculation" },
        { from: "stored", to: "compare", label: "read for comparison" },
      ],
      note: "The stored hash is the only value the database holds. At log-in the same calculation runs again and the two results are compared; the password itself is never stored and never reversed.",
    },
    brk: {
      kind: "compare",
      label: "the same password, stored two ways",
      left: {
        title: "stored fast and unsalted",
        tone: "bad",
        points: [
          "SHA-256 or MD5: a single GPU tries billions of guesses a second.",
          "Identical passwords produce identical rows.",
          "A leaked table is, for most of the rows in it, just the passwords.",
        ],
        note: "insecure",
      },
      right: {
        title: "stored slow and salted",
        tone: "ok",
        points: [
          "bcrypt, scrypt or argon2: every guess costs the attacker the wait the server pays.",
          "A fresh salt per row, so two identical passwords look unrelated.",
          "A leaked table buys the attacker very little.",
        ],
        note: "secure",
      },
      verdict:
        "The point is not that the hash cannot be reversed in principle. It is that reversing it costs far more than the password is worth.",
    },
    tell: "Never store the password itself. Hash it with a salted, slow algorithm such as bcrypt or argon2, verify with a constant-time comparison, and never write a password to a log.",
    marginalia: "slow on purpose, so guessing stops paying for itself",
    demoId: "password-hashing",
    demoNote:
      "Type a password and watch what gets stored: same input, different salt, and no route back.",
  },
  {
    id: "rate-limiting",
    code: "1.07",
    title: "Rate limiting",
    asks: "How does a server refuse to be hammered?",
    plain: [
      "A rate limit is a counter with a window. The server picks an identity (an IP address, an API key, a user account) and counts how many requests that identity has made recently. Past the threshold it stops doing the work and replies {{429}} with a Retry-After header telling the client when to come back.",
      "The counter lives on the server, which is what makes it worth anything. A client cannot raise its own limit, and two tabs share one allowance. When there is more than one server instance, the counter has to live somewhere all of them read, usually a shared store with a short expiry, or the limit multiplies by the number of instances.",
      "The endpoints that need this most are the ones that cost money or leak information when guessed: sign-in, sign-up, password reset, one-time codes, and anything that calls a paid API. Sign-in is the classic case: a common ceiling is {{5}} to {{10}} attempts per account in {{15}} minutes, which turns a thousand guesses a minute into a handful.",
      "A rate limit is also not the same thing as a quota. A limit protects the service from bursts. A quota is a billing or plan concept. They are often implemented with the same counter, which is why the two get confused.",
    ],
    diagram: {
      kind: "timeline",
      label: "eight requests, one window, and where the counter stops allowing them",
      limit: 5,
      window: "one window · 10 s",
      requests: [
        { status: 200 },
        { status: 200 },
        { status: 200 },
        { status: 200 },
        { status: 200 },
        { status: 429 },
        { status: 429 },
        { status: 429 },
      ],
      note: "The first five arrivals are answered; that is the whole allowance. The counter is full but the window is still open, so everything after the dashed line is refused at the server and told when to retry. The client cannot raise the limit from its side, and a second tab shares the same counter.",
    },
    brk: {
      kind: "stats",
      label: "thresholds services actually advertise",
      stats: [
        {
          value: "5,000",
          unit: "/ hour",
          label: "GitHub's API, for an authenticated token",
        },
        {
          value: "60",
          unit: "/ hour",
          label: "the same API without one",
        },
        {
          value: "100",
          unit: "/ second",
          label: "Stripe, on a live account",
        },
      ],
      note: "A limit and a quota read the same counter differently: one protects the service, the other the bill.",
    },
    tell: "Rate limit sign-in, password reset and every endpoint that calls a paid API. Key the counter by IP plus account, return 429 with a Retry-After header, and keep the counter in a shared store so all server instances agree.",
    marginalia: "the counter is server state, and the client cannot reach it",
    demoId: "rate-limiting",
    demoNote:
      "A live fixed-window limiter: five requests per ten seconds, keyed by identity, with the counter and the window on screen.",
    related: "deployment-cdn",
  },
  {
    id: "cors",
    code: "1.08",
    title: "CORS",
    asks: "Why does the console say blocked by CORS policy?",
    plain: [
      "CORS is a rule the browser enforces about which other origins are allowed to read the response to a request. The server declares permission with an Access-Control-Allow-Origin header, and the browser is the thing that enforces it. The server was never blocking you.",
      "That is why the same call can succeed from a terminal and fail from a web page. A command-line tool does not enforce the policy. Nothing is broken on your server.",
      "For requests that could change data, the browser sends a preflight OPTIONS request first, asking what is allowed before sending the real one, which is {{1}} request as you wrote it and {{2}} on the wire. That extra round trip appearing in your network tab is normal traffic, not a bug.",
      "The direction of protection matters. CORS protects your visitors from other sites reading their data with their credentials attached. It is not access control for your API, since anything calling your API from a script ignores it completely.",
    ],
    diagram: {
      kind: "flow",
      label: "the same call from two origins, and where each one stops",
      nodes: [
        { id: "mine", label: "your origin", col: 0, row: 0 },
        { id: "other", label: "another origin", col: 0, row: 1 },
        { id: "server", label: "the server", sub: "answers both", col: 1, row: 0 },
      ],
      boundary: { afterCol: 0, label: "the browser boundary" },
      arrows: [
        { from: "mine", to: "server", tone: "ok", label: "allowed · readable" },
        { from: "other", to: "server", blocked: true, label: "blocked by CORS" },
      ],
      note: "The server answers both requests; the browser is what refuses to hand one of the responses back to the page. That is why the same call succeeds from a terminal and fails from another site.",
    },
    brk: {
      kind: "compare",
      label: "what the header does and does not do",
      left: {
        title: "what CORS does",
        tone: "ok",
        points: [
          "Stops another site's page from reading your response in the visitor's browser.",
          "Enforced by the browser, on the browser's behalf.",
          "Answered by the Access-Control-Allow-Origin header you set.",
        ],
        note: "a browser policy",
      },
      right: {
        title: "what it does not do",
        tone: "bad",
        points: [
          "Does not stop a script, a terminal, or a server calling your API.",
          "Does not authenticate anyone.",
          "Does not protect your data on its own.",
        ],
        note: "not access control",
      },
      verdict:
        "It is the browser protecting one page from another origin, not the server protecting itself.",
    },
    tell: "Allow only the origins I actually use. No wildcard on anything authenticated. Explain which of my requests will trigger a preflight and why.",
    marginalia: "enforced by the browser, so it only guards browsers",
    demoId: null,
    demoNote:
      "The same request from three different origins, and the preflight that decides which one gets an answer.",
  },
  {
    id: "secrets",
    code: "1.09",
    title: "Secrets management",
    asks: "Where do API keys live, and who can see them?",
    plain: [
      "A secret is any value that grants access: a database URL with a password in it, a payment provider key, a mail provider token. Secrets belong in environment variables read by the server, not in source files and not in the repository.",
      "In a Next.js app the prefix decides exposure. Variables beginning with NEXT_PUBLIC_ are compiled into the JavaScript the browser downloads, where anyone can read them. Everything else stays server-side. That prefix is the most common way a key leaks, usually with no visible symptom.",
      "Git remembers. Deleting a key in a later commit leaves it in the history, and a key pushed to a public repository is usually swept up within {{minutes}} of arriving. The fix is to treat any committed key as already compromised and rotate it, rather than trying to rewrite history.",
    ],
    diagram: {
      kind: "flow",
      label: "where a secret is read, and the line it never crosses",
      rowGap: 52,
      nodes: [
        {
          id: "env",
          label: "server environment",
          sub: "the key lives here",
          lock: true,
          col: 0,
          row: 0,
        },
        { id: "server", label: "server code", sub: "reads it at boot", col: 1, row: 0 },
        {
          id: "browser",
          label: "browser bundle",
          sub: "public by definition",
          col: 1,
          row: 1,
        },
      ],
      arrows: [
        { from: "env", to: "server", label: "read on the server" },
        { from: "server", to: "browser", blocked: true, label: "no secret crosses" },
      ],
      note: "The environment file is read by the server, which never hands the value to the page. The moment a value carries the public prefix it is compiled into the bundle, where anyone who loads the page can read it.",
    },
    brk: {
      kind: "flow",
      label: "one key, three places it can sit",
      steps: ["server environment", "browser bundle", "git history"],
      note: "The first is where a key belongs. The other two are where it leaks, and the prefix decides which of them it reaches without changing the value at all.",
    },
    tell: "Read every key from an environment variable on the server. Commit a .env.example with the names and placeholder values. Never put a secret behind the NEXT_PUBLIC_ prefix, and ignore .env files in git from the first commit.",
    marginalia: "committed once means rotated, not deleted",
    demoId: null,
    demoNote:
      "One key in three places: the server, the browser bundle, and git history. Where it is safe, and where it leaks.",
  },
  {
    id: "deployment-cdn",
    code: "1.10",
    title: "Deployment and the network edge",
    asks: "Where does my app actually live once it is online?",
    plain: [
      "Deploying means taking the built output of your project and putting it on a machine with a public address. A build step turns your source into something smaller and faster to serve, and that output is the only thing that runs in production.",
      "Most hosts put a CDN in front of your app, caching copies of pages and assets in data centres near each visitor. That is why a site can load in {{40 ms}} in a city where you own no hardware. The trade-off is staleness, so cached responses carry rules about how long they may be reused before being rechecked: a static asset with a hashed filename is usually cached for {{1}} year, while a page is revalidated on a much shorter clock.",
      "DNS maps your domain to that infrastructure. HTTPS is the certificate that encrypts the connection and proves the domain is the one you meant to reach. Both are usually handled by the platform, and neither is optional.",
      "Cloudflare is one common choice at this layer: DNS, TLS, caching, plus a firewall and rate limits that run before a request ever reaches your app. Now that 1.07 has explained what a rate limit is, you can see what an edge service is doing to your traffic.",
    ],
    diagram: {
      kind: "flow",
      label: "the fast path answered at the edge, the slow path that reaches you",
      nodes: [
        { id: "visitor", label: "a visitor", col: 0, row: 0 },
        { id: "edge", label: "the edge", sub: "a node near them", col: 1, row: 0 },
        { id: "origin", label: "your origin", sub: "the server you own", col: 2, row: 0 },
      ],
      arrows: [
        { from: "visitor", to: "edge", lane: -1, label: "request" },
        {
          from: "edge",
          to: "visitor",
          lane: 1,
          tone: "ok",
          label: "cache hit · served here",
        },
        { from: "edge", to: "origin", lane: -1, label: "cache miss" },
        { from: "origin", to: "edge", lane: 1, label: "fills the cache" },
      ],
      note: "A hit is answered at the node and your server never hears about it; that is the fast path. A miss is the only request that reaches the origin, and the response it returns refills the cache.",
    },
    brk: {
      kind: "stats",
      label: "what the edge is holding on your behalf",
      stats: [
        {
          value: "31,536,000",
          unit: "s",
          label: "one year: the cache lifetime a hashed asset earns",
        },
        {
          value: "40",
          unit: "ms",
          label: "a page answered by an edge node near the visitor",
        },
        {
          value: "0",
          label: "requests your server sees while the cache stays fresh",
        },
      ],
      note: "A cache lifetime is a promise about how stale the content is allowed to be, not a performance setting.",
    },
    tell: "Deploy the production build to a host with a CDN. Cache static assets aggressively, revalidate pages on a schedule, terminate TLS at the edge and force HTTPS. Tell me how to invalidate the cache when content changes.",
    marginalia: "the edge answers before your server hears about it",
    demoId: null,
    demoNote:
      "A request reaching the nearest edge node, and what the cache decides to do with it.",
    related: "rate-limiting",
  },
];

export const DEMO_CONCEPT_ID = "rate-limiting";

export function getConcept(id: string): Concept | undefined {
  return CONCEPTS.find((concept) => concept.id === id);
}
