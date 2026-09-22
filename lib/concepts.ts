export type Concept = {
  id: string;
  /** Ordinal shown in the register, e.g. "1.07". */
  code: string;
  title: string;
  /** The question this concept answers, in the reader's own words. */
  asks: string;
  /** Plain-language explanation paragraphs. */
  plain: string[];
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
      "Round trips take time: tens of milliseconds on a good connection, much longer on a bad one. That delay is why interfaces show spinners, and why a slow endpoint feels broken even when it is working correctly.",
      "Status codes are the server's verdict in one number. 2xx worked. 3xx go elsewhere. 4xx the request was wrong or not allowed. 5xx the server itself failed. The difference between a 401 and a 500 tells you which side of the line to go and fix.",
    ],
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
      "Most web databases are tables of rows (Postgres, MySQL) or collections of documents (MongoDB). You rarely touch them by hand. Your code sends queries: read the rows where the owner is this user, insert a row, update one.",
      "The schema, meaning which tables and columns exist and what types they hold, is the shape of your app's memory. It changes as the app grows, and every change needs a migration so the database on your laptop, your test environment and production all agree about that shape.",
    ],
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
    tell: "Sign-in only answers who the user is. Every read and write then re-checks whether this user may touch this specific record, on the server, on every request. Do not rely on the UI hiding anything.",
    marginalia: "signed in is not the same as allowed",
    demoId: null,
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
      "A session is a random identifier in a cookie. The server keeps the details under that identifier and can delete them, which logs you out everywhere at once. A token is a signed bundle of data the server hands out and then trusts on sight. It scales well and is hard to revoke before it expires.",
      "Where the credential sits decides how exposed it is. A cookie marked httpOnly cannot be read by your page's JavaScript, which is what you want for sign-in. A token in localStorage can be read by any script running on the page, so a single compromised dependency can walk away with it.",
    ],
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
      "The salt stops two people who chose the same password from having the same stored value, which is what defeats precomputed lookup tables. The hash function should be deliberately slow (bcrypt, scrypt, argon2), because slow is what makes guessing expensive.",
      "The size of the blast radius is the real argument. A leaked list of email addresses is bad. A leaked list of email addresses beside plaintext passwords is a problem for every other site those people use, because passwords get reused across them.",
    ],
    tell: "Never store the password itself. Hash it with a salted, slow algorithm such as bcrypt or argon2, verify with a constant-time comparison, and never write a password to a log.",
    marginalia: "slow on purpose, so guessing stops paying for itself",
    demoId: null,
    demoNote:
      "Type a password and watch what gets stored: same input, different salt, and no route back.",
  },
  {
    id: "rate-limiting",
    code: "1.07",
    title: "Rate limiting",
    asks: "How does a server refuse to be hammered?",
    plain: [
      "A rate limit is a counter with a window. The server picks an identity (an IP address, an API key, a user account) and counts how many requests that identity has made recently. Past the threshold it stops doing the work and replies 429 with a Retry-After header telling the client when to come back.",
      "The counter lives on the server, which is what makes it worth anything. A client cannot raise its own limit, and two tabs share one allowance. When there is more than one server instance, the counter has to live somewhere all of them read, usually a shared store with a short expiry, or the limit multiplies by the number of instances.",
      "The endpoints that need this most are the ones that cost money or leak information when guessed: sign-in, sign-up, password reset, one-time codes, and anything that calls a paid API.",
      "A rate limit is also not the same thing as a quota. A limit protects the service from bursts. A quota is a billing or plan concept. They are often implemented with the same counter, which is why the two get confused.",
    ],
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
      "For requests that could change data, the browser sends a preflight OPTIONS request first, asking what is allowed before sending the real one. That extra round trip appearing in your network tab is normal traffic, not a bug.",
      "The direction of protection matters. CORS protects your visitors from other sites reading their data with their credentials attached. It is not access control for your API, since anything calling your API from a script ignores it completely.",
    ],
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
      "Git remembers. Deleting a key in a later commit leaves it in the history, and on a public repository it will be scraped within minutes of being pushed. The fix is to treat any committed key as already compromised and rotate it, rather than trying to rewrite history.",
    ],
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
      "Most hosts put a CDN in front of your app, caching copies of pages and assets in data centres near each visitor. That is why a site can load in forty milliseconds in a city where you own no hardware. The trade-off is staleness, so cached responses carry rules about how long they may be reused before being rechecked.",
      "DNS maps your domain to that infrastructure. HTTPS is the certificate that encrypts the connection and proves the domain is the one you meant to reach. Both are usually handled by the platform, and neither is optional.",
      "Cloudflare is one common choice at this layer: DNS, TLS, caching, plus a firewall and rate limits that run before a request ever reaches your app. Now that 1.07 has explained what a rate limit is, you can see what an edge service is doing to your traffic.",
    ],
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
