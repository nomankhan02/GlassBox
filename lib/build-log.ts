/**
 * Where a fault came from. Kept explicit because "the AI got it wrong" and "my
 * prompt left the decision open" are different problems with different fixes.
 */
export type FaultSource = "prompt" | "output" | "defaults" | "docs";

export type Fault = {
  source: FaultSource;
  text: string;
};

export type LogEntry = {
  id: string;
  date: string;
  dateLabel: string;
  title: string;
  /** What the session was trying to do. */
  context: string;
  /** The prompt, as sent, transcribed. */
  prompt: string;
  promptNote?: string;
  faults: Fault[];
  /** What was changed in response. */
  correction: string[];
  /** The transferable part. */
  lesson: string;
};

export const FAULT_LEGEND: Record<FaultSource, string> = {
  prompt:
    "the prompt left this open, so a decision got made for me somewhere I could not see it",
  output: "the response was wrong on its own terms",
  defaults: "the default answer to this kind of request, and the default is the problem",
  docs: "recalled convention from an older version, which does not apply here",
};

/*
  Entries are transcribed from real sessions, in order. The first one produced
  the site you are reading, so its output is on screen while you read the log.
  Nothing here is reconstructed after the fact; the faults listed are the ones
  that actually had to be corrected during the session.
*/
export const BUILD_LOG: LogEntry[] = [
  {
    id: "0001",
    date: "2026-09-21",
    dateLabel: "21 Sep 2026",
    title: "Scaffolding the shell, and refusing the default theme",
    context:
      "First session, empty folder. The goal was a working Next.js app with all three layers in place, the visual system decided before any feature work, and version control set up so the project follows its own Layer 0 advice.",
    prompt:
      "Scaffold the Next.js project with this page structure: a clean reusable layout with navigation between the three sections, and a Tailwind theme reflecting the design direction. Set up git properly, and .gitignore should exclude node_modules, .env* and build output from the start. Then build one working interactive demo as a proof of concept, the rate-limiting demo. Leave the other concept cards as placeholders.",
    promptNote:
      "The brief was longer than this. The parts that changed the outcome were the two lists: the specific visual defaults to avoid, and the structure of the demo. Prompts that only say what to build get the most familiar version of it.",
    faults: [
      {
        source: "defaults",
        text: "The framework's own scaffolding produces the exact aesthetic the brief rules out: Geist for everything, a flat white background, zinc greys, and a dark mode inversion for free. It is a good starting point and it is also the default, which is the whole problem. The theme had to be replaced in the first hour rather than tuned later.",
      },
      {
        source: "docs",
        text: "Tailwind's current major version keeps its theme in CSS, under @theme, and does not read a tailwind.config.ts at all. A config file written from recalled convention is not an error. It is silently ignored, and the tokens simply appear to do nothing.",
      },
      {
        source: "docs",
        text: "The installed Next.js generates types for route props from the filesystem. Patterns from older versions of the docs do not apply, and the guide shipped inside node_modules was a more reliable source than what the model already believed.",
      },
      {
        source: "defaults",
        text: "Asked for ten of anything, the default answer is a row of three cards with icons imported from an icon set. That layout is banned in the brief. The reason it keeps returning is that it requires no decisions: it fits any content, which is also why it communicates nothing about this content.",
      },
    ],
    correction: [
      "The theme was written from scratch in CSS. Warm paper tones instead of white, hairline rules instead of shadows, one accent, three semantic state colours, and no dark mode. A lab notebook, not a product page.",
      "Ten concepts became a register: a numbered list of rows, each one opening in place to reveal its explanation, its prompt fragment and its demo. The structure now performs the idea of a case you open to see inside.",
      "The documentation inside the installed package was read before any route was written, instead of trusting recalled API shapes.",
      "Typography was chosen by role rather than by reputation: a serif for headings, a sans for explanation, and mono reserved for anything the site is reporting as a measurement.",
    ],
    lesson:
      "Ask what the scaffold created and why, before asking for anything on top of it. Every default in a generated project is a decision somebody else made, and defaults are chosen to be uncontroversial rather than to be right.",
  },
  {
    id: "0002",
    date: "2026-09-21",
    dateLabel: "21 Sep 2026",
    title: "The rate-limiting demo, specified instead of described",
    context:
      "The proof of concept for every demo that follows. If click-driven demonstrations are going to carry this site, the first one has to be honest about what state is and where it lives.",
    prompt:
      "For rate limiting: a Send Request button that succeeds a few times then starts failing after a threshold, explaining the state change as it happens. Five requests per ten seconds. Not an autoplay animation, the user clicks through it themselves.",
    promptNote:
      "This is a faithful spec of the brief, and a faithful implementation of it teaches very little. Every fault below came from that gap, not from the tool misunderstanding the request.",
    faults: [
      {
        source: "prompt",
        text: "Taken literally, the spec produces a button, a confirming response, and a failing response, with a sentence of explanation. The counter, which is the entire concept, stays invisible. The reader watches a sequence of events rather than a value changing.",
      },
      {
        source: "prompt",
        text: "One client identity was implied. That hides the part that confuses people in practice: a limit is keyed to an identity, so two visitors have separate allowances, and everyone behind one office IP address shares a single one.",
      },
      {
        source: "prompt",
        text: "The ten second window was left as something the reader waits out. The window is the concept being taught, so needing to wait for it means most readers never see a reset at all.",
      },
      {
        source: "defaults",
        text: "The familiar way to build a mechanism demo is to animate it: requests flying along a line, auto-firing on load. It looks like effort and it teaches the animation. An autoplay demo runs once and is over before the reader has decided what to look at.",
      },
    ],
    correction: [
      "The counter became an instrument: five allowance slots with an explicit used count, so the value that decides the outcome is on screen and moves when it changes.",
      "The window became a visible, running track with a countdown, plus a control that advances the simulated clock ten seconds. The reset can now be watched rather than waited for.",
      "Two identities with separate allowances, and one shared server log, because a server sees every request while each key keeps its own counter. Switching identity makes per-key scoping obvious in one click.",
      "Every state change writes a sentence stating the mechanism, including the detail that a refused request does not consume allowance. That is a design choice, not a law, and the copy says so.",
      "Animation is limited to what carries meaning: a slot filling, a row arriving, a refusal marking itself. Nothing moves on load, and nothing moves for decoration.",
    ],
    lesson:
      "A demo teaches a mechanism only if the state is visible and the reader can move it. If the state sits behind an animation, the reader learns the animation.",
  },
  {
    id: "0003",
    date: "2026-09-26",
    dateLabel: "26 Sep 2026",
    title: "Specifying visual intent precisely",
    context:
      "The second pass, once the shell and the first demo were done. The site read as wall-to-wall prose: explanations with nothing to look at, and every number set in the same face as the sentences around it.",
    prompt:
      "More content with specific figures and visual presentation after texts too, not just plain text everywhere. And a different number font, something distinct.",
    promptNote:
      "Both asks named an outcome rather than a specification. A figure is a category of object; it does not say which figure, or what any of them should show.",
    faults: [
      {
        source: "prompt",
        text: "\"Visual presentation\" and \"figures\" were ambiguous enough that the safest interpretation won. The build produced a single hairline-and-text divider component and reused it across every concept, which is presentation, and is not a figure. The real intent, structural diagrams showing the shape of each mechanism, only surfaced after a follow-up clarified it.",
      },
      {
        source: "prompt",
        text: "\"A different number font, something distinct\" was vague in the same way. The fix technically applied, a monospace face with a heavier weight and added letter-spacing, and read as nearly unchanged, because no specific typeface had been named.",
      },
    ],
    correction: [
      "The next prompt named an exact typeface, Martian Mono, instead of a category such as \"monospace\".",
      "The same prompt spelled out concrete diagram content per concept: the boxes, the arrows, and what each one should depict.",
    ],
    lesson:
      "Precision in the ask, not more iteration on the same ask, fixed both.",
  },
  {
    id: "0004",
    date: "2026-09-27",
    dateLabel: "27 Sep 2026",
    title: "Generalizing the diagram system, and two bugs that came with it",
    context:
      "One diagram existed and worked. This pass was about proving it was a system rather than a one-off: the same construction, applied ten times, without each concept reinventing it.",
    prompt:
      "Take the rate-limiting diagram and turn it into a reusable system, then apply it to the remaining nine concepts.",
    promptNote:
      "The one working diagram was the whole specification. Nothing in the prompt said what made it reusable, so two faults arrived underneath the same request.",
    faults: [
      {
        source: "output",
        text: "Diagram labels shrank along with the whole diagram on narrow viewports. Measured in headless Chrome at 320, 360 and 414 pixels, the labels fell to 5.0, 5.6 and 6.5 pixels, which is unreadable. Fixed by keeping diagrams at their authored size and making the container scroll horizontally instead of shrinking.",
      },
      {
        source: "defaults",
        text: "A shared, module-level regex with a global flag was reused across every call to the figure-parsing function. A global regex in JavaScript carries hidden position state between uses, so finishing one concept's text could leave the search partway through the next one, and figures intermittently failed to parse. Fixed by creating a fresh regex per call instead of reusing one.",
      },
    ],
    correction: [
      "A Canvas wrapper pattern, an overflow-x-auto container around a fixed-size SVG, is now used by every diagram.",
      "The figure-parsing regex is created fresh on each call rather than shared at module scope.",
    ],
    lesson:
      "A fix verified by measuring actual rendered pixels, not by reasoning about whether it should work.",
  },
  {
    id: "0005",
    date: "2026-09-28",
    dateLabel: "28 Sep 2026",
    title: "Diagrams that were geometrically correct and still wrong",
    context:
      "The diagram system was proven, so the remaining diagrams were built in a single batch. Nine at once, from a template that had only ever been exercised once.",
    prompt:
      "Build the nine new diagrams reusing the proven system, in one batch.",
    promptNote:
      "A batch is efficient and it hides the checking. Nothing in the request said how the output would be verified, so it was verified by looking.",
    faults: [
      {
        source: "output",
        text: "Several diagrams had real layout problems that were only visible when rendered: a label overflowing its box (1.03), two rows sitting too close to read as separate (1.05), a label landing on its own arrow (1.06), a diagonal arrow and a colliding label (1.08), and an icon overlapping a title (1.09). All of them were caught by eye, not by any check, because the tool that built them has no way to see its own rendered output.",
      },
    ],
    correction: [
      "Five diagrams were fixed by hand, each against the specific collision above.",
      "A script was added that renders every diagram, measures every label and arrow with getBoundingClientRect, and fails the build if anything overlaps or overflows. This class of bug is now caught automatically rather than by a person scrolling through screenshots.",
    ],
    lesson:
      "Correct geometry on paper and a correct render are two different claims. Only one of them can be checked without looking.",
  },
  {
    id: "0006",
    date: "2026-10-03",
    dateLabel: "3 Oct 2026",
    title: "Password hashing, built before the sign-in flow it was waiting for",
    context:
      "1.06 was the clearest case of a queued demo: the mechanism is core to everything the site is about, and the entry had been written and left with nothing to click because the plan said it needed a real sign-in flow to point at.",
    prompt:
      "Build the password hashing demo for 1.06 as a fully simulated, no-backend demo, the way the rate-limiting demo is, rather than waiting on a real sign-in flow. Three steps: store a password and show plaintext versus salted hash side by side; simulate a database leak, with a salt on/off toggle over two accounts that chose the same password; then log in and walk the server's steps in order, take the attempt, add the stored salt, hash it, compare, match or no match. Compute real hashes in the browser with the Web Crypto API and a random salt, no hardcoded strings. Use SHA-256 so the step is watchable, and say on screen that real apps use a deliberately slow algorithm such as bcrypt or argon2 instead. Nothing typed leaves the browser. Follow the rate-limiting pattern exactly.",
    promptNote:
      "The override is the first sentence, and it is the part worth logging: the queue had a reason, and the reason was wrong.",
    faults: [
      {
        source: "defaults",
        text: "The plan on file said this demo had to wait for a real sign-in flow. That is the conventional order — build the infrastructure, then demonstrate it — and it would have left 1.06 with an explanation and no demo indefinitely. The rate-limiting precedent says the opposite: model the mechanism in the browser with real computation, and let the real flow come later, or never.",
      },
      {
        source: "defaults",
        text: "Hashing most often means bcrypt or argon2, and neither exists in the browser's Web Crypto API. Reaching for the real algorithm means a dependency or an unreadable black box; quietly reaching for SHA-256 instead teaches the wrong one. Either default is wrong on its own, and the prompt had to name both the watchable algorithm and why it is not what real apps use.",
      },
    ],
    correction: [
      "The demo was built simulated, matching rate-limiting: real Web Crypto hashing in the tab, visibly labelled as not a real sign-up, with the no-network, no-storage and no-logging guarantees stated rather than assumed.",
      "SHA-256 runs the demo and is named on screen, with a standing note that real apps use a deliberately slow, salted algorithm and tune its cost so every guess costs the attacker.",
      "Hashes and salts wrap inside their cells and the layout holds at 320px, so the 64-character strings cannot overflow the way the diagrams did.",
      "The queued item that deferred this demo was removed from the record and replaced by this entry, so the override is visible rather than silent.",
    ],
    lesson:
      "A mechanism demo does not need the infrastructure the mechanism lives in; it needs the mechanism. Waiting for a real sign-in flow to demonstrate hashing is the same mistake as waiting for a real server to demonstrate rate limiting.",
  },
  {
    id: "0007",
    date: "2026-10-03",
    dateLabel: "3 Oct 2026",
    title: "Authentication and authorization, drawn as the two gates it is",
    context:
      "1.04's diagram already had the right shape: a request, gate 1, gate 2, the record. The demo's job was to make that drawing move without becoming a different component sitting beside it.",
    prompt:
      "Build the authentication versus authorization demo for 1.04, reusing the two-gate shape from the existing diagram as its visual base, so it reads as that diagram coming alive. Fix the target as record #42, owned by Alex, and give an identity selector with four options: not signed in, signed in as Alex, signed in as Jordan, and signed in as an admin. On Send request, move the request through both gates in order, each resolving before the next, ending in 401, 403 or 200 depending on the identity: not signed in stops at gate 1; Jordan passes gate 1 and stops at gate 2; Alex and an admin pass both. State the admin rule on screen as a policy rather than a hidden bypass. End every run with one line naming which gate decided the outcome and why. Follow the rate-limiting pattern exactly, keep it keyboard accessible, and announce results with aria-live.",
    promptNote:
      "A permissions demo usually means a roles-and-permissions matrix. This one had a diagram to answer to, and the diagram knew the shape the matrix does not show: two checks, in order, on one request.",
    faults: [
      {
        source: "defaults",
        text: "The familiar way to grant an admin access is a short condition in the middle of the authorization check. It is functionally correct and invisible: nothing on the page tells the reader the rule exists, which is precisely the failure this concept warns about. A permission that only lives in code is a permission nobody can review.",
      },
      {
        source: "output",
        text: "The first pass resolved the gates as one state change, so the request appeared to arrive at both at once and the ordering the concept depends on was asserted in the copy rather than shown on screen. The gates had to resolve one at a time, each visibly finishing before the next was considered.",
      },
    ],
    correction: [
      "The admin rule was printed on the page as a stated policy, above the gates, rather than left as a branch inside the check. The demo shows the rule being applied, not a hidden shortcut.",
      "Each gate now resolves on its own step, in order, with the node it is about to enter marked active first; a request that stops keeps the gate it failed at, and the outcome line names that gate and the reason.",
      "The record contents stay withheld until both gates have opened, so the difference between passing gate 1 and passing both is something the reader sees rather than reads.",
    ],
    lesson:
      "The second gate is the one that gets left out, and a missing check is invisible from the outside. The demo has to make the two gates visibly separate, because knowing who you are and being allowed to act are not the same thing.",
  },
  {
    id: "0008",
    date: "2026-10-10",
    dateLabel: "10 Oct 2026",
    title: "Sessions versus tokens, and the demo that had to admit it could not revoke a token",
    context:
      "1.05's diagram already had the right shape: two rows, state on the server in one and on the client in the other. The demo's job was to make both stores visible at once and to show the one thing that differs in practice — what a logout can actually do.",
    prompt:
      "Build the sessions versus tokens demo for 1.05, reusing the existing two-row diagram shape: the session row where the client holds a random id and the server holds state, the token row where the client holds the claims and the server holds nothing. A mode toggle, Session or Token. A Log in button: session mode adds a visible row to a small 'server-side sessions' table and gives the client just that id; token mode gives the client a signed token containing the claims directly, and explicitly shows the server-side table staying empty so the contrast is visible. A Make a request button that looks the id up in the table in session mode, and in token mode checks the token's signature and reads the claims directly, no lookup. Then Revoke this login: session mode removes the row and a following request fails immediately; token mode must not pretend to work — show plainly that there is nothing stored server-side to delete, so the token stays valid until it expires on its own, with a visible expiry countdown. Click-driven only, nothing autoplays, ids and tokens in the mono face, keyboard accessible, results announced via aria-live, nothing overflowing at 320px.",
    promptNote:
      "The refusal is the part worth logging: the prompt names the uncomfortable truth and forbids softening it. Everything else follows from that one constraint.",
    faults: [
      {
        source: "prompt",
        text: "The prompt asked for a visible expiry countdown but never said what a token's lifetime should be or whether the reader may skip ahead. Taken literally, the countdown runs on real time: either the reader sits and waits out a realistic 15 to 60 minutes, or a demo-sized number is invented silently. Measuring the mechanism, not the wall clock, is a decision that belongs in the prompt.",
      },
      {
        source: "defaults",
        text: "The familiar token demo is a hand-written string with a step labelled 'verify the signature' that verifies nothing. It looks like the mechanism and is a caption on a random value. Making the signature real — an HMAC-SHA256 over the header and payload, recomputed and compared on every request — is what lets the check actually fail, and it is not what you get by default.",
      },
    ],
    correction: [
      "The token is really signed in the tab with the Web Crypto API, and the request path genuinely recomputes the signature and compares it. The page says the signing key would live on the server in a real app.",
      "The demo token's lifetime is short and the clock is a simulation control: Advance the clock 30 s moves time past the exp claim, so expiry can be watched rather than waited out. The copy names the realistic lifetime separately.",
      "Switching mode resets the run, so the sessions table in token mode is unambiguously empty and the log-in visibly adds nothing to it. The empty table is the contrast, so it is shown rather than described.",
      "Revoke in token mode does not animate a success. It says it did nothing, flashes the still-empty table, and points at the countdown as the only lever that exists.",
      "A session is still refused instantly after the row is deleted, with the client's cookie deliberately left unchanged, so the failure is visibly the server's lookup and not the client's error.",
    ],
    lesson:
      "If a mechanism has an honest weakness, the demo has to show the weakness, not route around it. A token cannot be revoked early, and the moment the demo fakes a working revoke it stops teaching the trade and starts teaching the wrong thing.",
  },
  {
    id: "0009",
    date: "2026-10-10",
    dateLabel: "10 Oct 2026",
    title: "CORS, and refusing to draw the red X",
    context:
      "1.08's diagram was already honest — the server answers both requests and the browser refuses one of them. The demo had to keep that shape against the pull of the familiar error message, which is the single most misleading thing about CORS.",
    prompt:
      "Build the CORS demo for 1.08, reusing the existing two-origin diagram shape. An origin selector, yourdomain.com or attacker-site.com, and a server-config toggle, Allow-Origin: yourdomain.com or Allow-Origin: *. A Send request button. Teach the nuance precisely: the request always actually reaches the server, and the server always actually responds, whatever the origin. What differs is whether the browser lets the page's own script read that response. Specific allow-origin plus the allowed caller renders the data. Specific allow-origin plus the other origin shows the response visibly arriving but the page blocked from reading it — a blocked-by-CORS message instead of the data, not a bare red X. The wildcard shows the other origin successfully reading the response too, demonstrating concretely why Allow-Origin: * removes the protection rather than fixing an error. Click-driven only, keyboard accessible, results announced via aria-live, nothing overflowing at 320px.",
    promptNote:
      "The last sentence is the whole demo. A CORS demo that renders a blocked request as a failure would be technically consistent with the console and wrong about everything the concept is trying to say.",
    faults: [
      {
        source: "defaults",
        text: "The default is a failing call drawn as a red error with no response attached, because that is what the console shows. It teaches that the server refused, which is false: the request reached the server and the server answered with a 200. The red X is the symptom and the opposite of the cause.",
      },
      {
        source: "output",
        text: "The first pass resolved the request, the server's answer and the browser's decision as one state change, so a blocked request looked identical to a request that never arrived. Nothing on screen said the response had come back. It had to resolve in order, with the server's response filled in on every run before the read is decided.",
      },
      {
        source: "defaults",
        text: "Rendering the wildcard as the fix is the reflex: the error goes away, so it reads as solved, and the panel turns green like every other success. That framing is the vulnerability. The wildcard has to read as protection removed, so its success state cannot look like the allowed origin's success state without naming what was given up.",
      },
    ],
    correction: [
      "The result is two panels, not one. The left panel — the server's response, with the status and the Access-Control-Allow-Origin header — fills in on every run, whatever the origin, and says so. The right panel is what the page's script may read, and that is the only thing that varies.",
      "A blocked read shows the response arriving and then a plain blocked-by-CORS message naming both origins and the header value, instead of the fields. There is no bare error mark anywhere.",
      "The wildcard is shown succeeding for the other origin on purpose, with copy that calls it the protection removed rather than an error fixed, and a standing note that Allow-Origin: * is wrong for anything a signed-in visitor can see.",
      "The server node carries the line that it has no idea CORS exists, so the reader never has to infer where the enforcement lives.",
    ],
    lesson:
      "The browser is the enforcer, so a demo that draws a failed request as the server saying no has taught the exact inverse of the concept. Show the response arriving first; only then is it clear that what CORS withholds is the reading, not the answer.",
  },
  {
    id: "0010",
    date: "2026-10-14",
    dateLabel: "14 Oct 2026",
    title: "A glass cube, a hero, and a background that was never one colour",
    context:
      "A full visual redesign, in three dependent stages: build one reusable 3D glass cube and verify it on a phone, build the homepage hero out of it, then change the site-wide theme. The order was deliberate. The cube had to exist and be measured before anything was built on top of it, and the theme change had to come last so the hero could be tuned against the page it would actually sit on.",
    prompt:
      "We're doing a full visual redesign of the homepage hero and the site-wide theme. Build this in three stages, in order, and verify each before moving to the next. STAGE 1 — THE 3D GLASS CUBE COMPONENT (build and verify first, everything else depends on it) Build one reusable 3D glass cube component in pure CSS 3D transforms (perspective + transform-style: preserve-3d + rotateX/rotateY on six face divs — no Three.js, no WebGL, no new dependency). Each face should look like glass: a semi-transparent background, a light backdrop-filter blur, and a subtle border — not a flat solid cube. The component takes props for size and behavior, used in two configurations: Small, cursor-tracked: sits next to the GLASSBOX wordmark in the site header/nav, appears on every page. As the cursor moves near it, the cube subtly tilts to follow (map cursor position relative to the cube into a small, clamped rotateX/rotateY range — enough to read as “alive,” never enough to look broken or disorienting). Smooth and eased, not snapping. Huge, auto-rotating: a slow continuous rotation, roughly one full turn every 20–30 seconds, used only in the homepage hero (stage 2). Both must respect prefers-reduced-motion exactly the way the existing panel-open animations already do in this codebase: the small cube holds a neutral angle instead of tracking the cursor, and the huge one holds still instead of rotating. Test this component's performance on a mid-range mobile viewport before moving on. If the blur causes visible jank, simplify it (less blur radius, or a lighter box-shadow standing in for glass) rather than shipping something that stutters. STAGE 2 — NEW HOMEPAGE HERO Restructure the homepage: the first full-height viewport shows only the GLASSBOX wordmark at the top and the huge rotating cube centered in the middle — nothing else. Set the cube's opacity low enough to read as a background presence, not a focal object (start around 6–8%, adjust after an actual visual check — this needs real eyes on it, not a number guessed in advance). It must never block clicks on anything behind it (pointer-events: none). The wordmark stays clearly legible over it at all times. Everything currently on the homepage continues directly below this hero, reached by scrolling — same content and structure as today, just restyled to match stage 3. STAGE 3 — SITE-WIDE THEME CHANGE Background: replace the current cream/peachy background with white, site-wide, not just the homepage. This isn't a one-line color swap — re-check contrast everywhere the old cream background was being read against: body text, the existing hairline diagram strokes and fills (tuned for the old background, may now read too faint or too harsh against pure white), and the stat/comparison break components. Fix anything that fails rather than leaving it to be discovered later. Spacing: reduce the current page-level padding/gutters so content sits noticeably closer to the viewport edges than it does now — tighter, closer to edge-to-edge — while keeping enough margin on mobile that nothing touches the literal screen edge or becomes hard to read. If this isn't the right amount, say so rather than guessing further. Heading font: replace Fraunces with Bricolage Grotesque (Google Font, variable weight) for all headings, nav, and section titles, loaded the same way Fraunces was. Also use it for the GLASSBOX wordmark itself, in both the header and hero — retire the separate Cinzel-only-for-wordmark rule from the earlier design pass; one confident display font suits this bolder direction better than three competing typefaces. Leave the Martian Mono numeral treatment for data figures completely alone. RULES THAT DON'T CHANGE: this is a visual redesign, not a functional one. Every existing demo (rate limiting, hashing, authn/authz, sessions/tokens, CORS) keeps its exact current logic and click-driven behavior — only restyle them. Keep all existing accessibility work (keyboard access, aria-live) exactly as is. Keep the mobile diagram-scrolls-instead-of-shrinks behavior exactly as is. Follow AGENTS.md: add a build log entry for this pass in the existing format, continuing the numbering, and update the “where this is up to” stats if anything about them changed. Work stage by stage as laid out, confirming each stage before starting the next. Confirm the whole pass with npm run typecheck, npm run lint, and npm run build.",
    promptNote:
      "The parts that carried the outcome were the constraints, not the descriptions: pure CSS with no new dependency, reduced motion handled the way the panels already do it, and two numbers the prompt refused to let stand on their own — the 6–8% opacity and the gutters — both flagged as needing a real check rather than a guess.",
    faults: [
      {
        source: "defaults",
        text: "The default glass face is a backdrop blur on all six faces, everywhere. Behind the hero the page is flat white, so that blur has nothing to blur and still costs frame time on a mid-range phone; the obvious implementation — one face style for both cubes — pays for an effect where it cannot even be seen. The fix was to make the blur opt-in and leave it off the large background cube, where a light box-shadow sheen stands in for the glass.",
      },
      {
        source: "prompt",
        text: "The starting opacity of 6–8% was a number chosen before anything was rendered. Measured against white it produces roughly 2–3% contrast, which is effectively invisible, because the glass is light to begin with. The instruction to adjust after a visual check is the part that caught it: sampling the pixels at each candidate value showed the cube only reads as a presence near 20%.",
      },
      {
        source: "prompt",
        text: "\"The first viewport shows only the wordmark and the cube — nothing else\" did not account for chrome that already renders on every page: a masthead carrying a tagline and the layer rail both land inside that first viewport. The prompt left the homepage's frame versus the content pages' frame undecided, so the restructure had to separate them.",
      },
      {
        source: "docs",
        text: "The old display face was Fraunces, loaded with its SOFT and WONK variation axes and referenced through font-variation-settings across the heading utilities. Swapping the family while leaving those axes in place is a silent no-op — the property simply does nothing on a face that lacks the axis — so the type scale looked updated while carrying a line that quietly stopped working. The axes had to be deleted, not left inert.",
      },
      {
        source: "defaults",
        text: "Changing a theme's background is read as a token change, and the token was changed first. That leaves the pairs that were tuned against the old cream — the ochre \"demo to come\" tag and the arrow between flow-break steps — failing contrast, with the panel and diagram fills nearly vanishing into white. An automated walk of every visible text node is what surfaced them, rather than a reader finding them later.",
      },
      {
        source: "output",
        text: "Under prefers-reduced-motion the large cube rendered as a flat square. The first version set the cube's transform only while it was not spinning, and the site's reduced-motion rule switches the spin animation off entirely, so the element was left with no transform at all — one face, not a still cube. Only emulating reduced motion in the browser and reading the computed transform caught it; the visual difference is obvious once seen and invisible in the source.",
      },
    ],
    correction: [
      "The cube is one component with a behaviour prop. Blur is opt-in and off on the large cube, which is pure transform and paints no backdrop filter; the small tracked cube keeps a 2px blur, which measured at 16.5ms median frame time on a 390px viewport with the CPU throttled 4x.",
      "Cursor tracking eases toward a clamped target with a distance falloff, so the cube drifts back to rest when the pointer leaves. Reduced motion is read with the same useReducedMotion hook the register and the demos already use, so the small cube holds a neutral angle and the large one holds still by the same rule.",
      "A pixel sample of rendered screenshots set the hero opacity at 20%, where the cube's darkest edge lands near L=241 on white: a presence in the corner of the eye, not an object. Pointer events were confirmed to pass straight through it.",
      "The homepage was given its own composition. The content pages moved into a (site) route group with the masthead, rail and colophon frame, while the homepage renders its own masthead — tagline suppressed — inside a full-height hero holding only the wordmark and the cube, with the existing content unchanged below it.",
      "The page is white site-wide, with two faint neutral fills carrying depth. A contrast walk of every page and every opened register panel reports zero AA failures; the strong rule and the ochre were darkened where they fell short, and the diagram strokes were checked against the new page.",
      "Gutters were tightened to 14px on phones and 24–28px on desktop, with the measure widened to 1280px, so content sits closer to the viewport edge without touching it.",
      "Fraunces and Cinzel were both removed. Bricolage Grotesque now sets headings, the nav and the wordmark, loaded as a variable weight; the dead serif axes were deleted rather than left in place. Martian Mono and its numeric treatment are untouched.",
      "The resting angle is now always the cube's base transform, so a reduced-motion visitor sees a still, angled cube and the running animation simply overrides it otherwise. Confirmed by emulating reduce, reading the computed transform, then restoring motion and watching it move.",
    ],
    lesson:
      "A visual number written into a brief — an opacity, a colour — is a hypothesis, and the instruction to verify it is doing the real work; read the value off the render instead of trusting it from the prompt. A background is never one token either: it is the whole set of contrasts that were tuned against the old one, and they only surface when something measures them.",
  },
  {
    id: "0011",
    date: "2026-10-16",
    dateLabel: "16 Oct 2026",
    title: "A real cube, and the number that stopped being a guess",
    context:
      "The hero's cube had been drawn: an isometric SVG construction that looked like glass without being any. This pass replaced it with an actual renderer — three.js through React Three Fiber, drei's MeshTransmissionMaterial doing the refraction — against a reference image of the effect it was supposed to have. Everything else about the hero was to stay exactly as it was.",
    prompt:
      "Replace the hero's cube entirely with a real, live, rotating glass cube using React Three Fiber and drei's MeshTransmissionMaterial — not CSS, not a video. Install three, @react-three/fiber, and @react-three/drei. Before building, look at design-reference/hero-inspo.png — match its mood as closely as this technique allows: dark background behind the cube, soft studio-style lighting, slow rotation, visible chromatic aberration at the edges. Build: a simple box geometry (no external 3D model needed) with MeshTransmissionMaterial applied — tune transmission, thickness, roughness, and chromaticAberration to get as close to the reference as you can. Use drei's <Environment preset=\"studio\" /> (or whichever built-in preset reads closest to the reference) rather than sourcing an external HDR file. Rotate it slowly and continuously on its own, no cursor interaction needed for this one. Performance matters a lot here — per drei's own guidance, keep resolution and sample counts low (their docs specifically suggest something like 32x32 resolution still looks good and runs much faster). Test this on a mid-range mobile viewport before considering it done, and if it's janky, simplify further rather than shipping it slow. Handle two fallback cases: under prefers-reduced-motion, freeze the rotation instead of stopping all rendering. If WebGL isn't supported at all (check and handle this explicitly), fall back to a static image instead of attempting to render anything. Keep everything else from the last pass as-is: the hero text, the scroll-drawer exit effect, the black hero section with white text. Don't touch the header logo in this pass — that's a separate follow-up once this is verified working. Confirm with npm run typecheck, npm run lint, and npm run build.",
    promptNote:
      "The prompt asks for one specific and one unfalsifiable thing at once: chromatic aberration tuned to match a picture, which was done and checked, and a performance claim attached to a number (32x32 runs much faster) that this machine's software renderer could not resolve. The first was measurable. The second had to be reported as a construction argument rather than a measurement, which is written down below rather than rounded up.",
    faults: [
      {
        source: "prompt",
        text: "\"Keep everything else from the last pass as-is: ... the black hero section with white text\" described a hero that did not exist. The section on disk was white paper with dark text — the black in the prompt was the reference image. Two instructions pointed opposite ways (keep the hero exactly as it is, and put a dark ground behind the cube), and which one won decided the whole palette, so it had to be asked rather than guessed. The answer: black hero, white text, white page below it.",
      },
      {
        source: "prompt",
        text: "The contrast work was not in the request. Flipping the ground under a component does not flip its colours: every text pair in the hero, the hairline rules, and the glass fills of the header mark were all tuned against white and would have been invisible or marginal on black. \"Dark background behind the cube\" reads as a change to the cube's backdrop and is in fact a change to a palette.",
      },
      {
        source: "defaults",
        text: "The default answer to \"make it look like glass\" is the material's defaults: 256x256 transmission buffer, ten samples, roughness near zero, and drei's default chromatic aberration of 0.05. The first two are the expensive end of the settings, and 0.05 puts the strongest colour fringe in the frame at a chroma of 32 out of 255 where the reference's is 147 — visible in a diff and invisible on screen. Every one of those numbers is a decision the reference had already made.",
      },
      {
        source: "defaults",
        text: "Without the material's backside pass, the glass refracts an empty scene: the renderer removes the object from its own transmission buffer, so there is nothing behind the near faces to see through them but the background colour. The result is a dark box with lit edges — recognisable as glass, and wrong. The far faces have to be rendered into a second small buffer and refracted through the near ones, which is one more pass over twelve triangles and the difference between a shape and an object with an inside.",
      },
      {
        source: "defaults",
        text: "A transparent canvas is the tidier-looking choice — let the page's own black be the backdrop rather than repeating it in the scene — and it makes the seam worse, not better. With tone mapping in the pipeline the same hex renders a few levels darker than the CSS beside it, and a large flat area is exactly where a five-level step is visible. The canvas now paints its own ground, opaque, and the scene is set to skip tone mapping so the colour it was given is the colour it draws.",
      },
      {
        source: "output",
        text: "The first version of the WebGL gate asked the question in an effect and set state with the answer. That is the shape it is easiest to write, and the project's lint rules reject it (react-hooks/set-state-in-effect) for good reason: it renders the still, then renders again with a canvas, on every visit. useSyncExternalStore with a server snapshot does the same job in one pass and states the real problem — the server cannot ask a browser anything, so the answer is the still until hydration says otherwise.",
      },
      {
        source: "output",
        text: "The same gate gave a browser without WebGL the state \"checking\", which is what the component was doing rather than what it was showing. Nothing was broken on screen — the still was there and no canvas was mounted — but the honest state for a machine that can never run the cube is the still, and a check that reads the state caught the difference.",
      },
      {
        source: "output",
        text: "The verification harness spent most of the pass reporting the app as broken: in dev the page rendered and then sat there, never hydrating, on every route including ones this pass never touched. Next 16 refuses to serve its dev client across origins, and the harness was loading 127.0.0.1 while the server called itself localhost. The page was fine. A check that cannot tell its own path to the app from the app is a check that invents faults.",
      },
    ],
    correction: [
      "The hero is black, full bleed, with the white page below it; its inside is the site's own measure, so the wordmark in the hero lines up with the wordmark on every other page. The root layout gave up the measure for that, and the content pages and the homepage now each declare their own.",
      "Light-on-dark is one utility, on-dark, which re-points the existing colour tokens for the hero's subtree instead of introducing a second palette: rules, labels and glass fills under it keep their names and mean the light version. The header mark was not touched — it draws itself from those tokens and turned light on its own, which is the check this pass runs.",
      "The cube is a box, a MeshTransmissionMaterial, and drei's studio environment. Backside is on, with its own 64x64 buffer, because glass without it has no inside. The transmission buffer is 32x32 with four samples, the canvas runs at devicePixelRatio clamped to 1.5, and the scene skips tone mapping so the field it paints is exactly the field the hero is.",
      "The material was tuned against the reference image with numbers rather than by eye: two screenshots, decoded in the page, compared on field luminance, blown highlights, colour fringing and contrast. Chromatic aberration went to 1.2 and thickness to 1.4; across a full turn the strongest fringe now runs from 43 to 250 where the reference's single frame sits at 147, and the field matches its near-black to within 0.02 of luminance.",
      "The static fallback is not drawn by hand: scripts/hero-cube.mjs renders it from the live cube, waits until there is actually a lit cube in the frame before saving it (the shader compiles for a while on a software rasteriser), and checks that what it wrote is a lit cube on a dark field. It sits under the canvas as well as in place of it, so the first paint has an object in it and a browser without WebGL gets the same object still.",
      "Under prefers-reduced-motion the rotation is dropped and the cube is left standing at an angle, still rendered, still lit — verified by pixel-diffing two captures 1.8 seconds apart: zero change under reduce, and nothing removed. The frame loop does go on-demand there, with a few nudged frames at the start so the environment that arrives late still gets drawn.",
      "The WebGL check is explicit and runs before anything three.js-shaped is fetched: the scene is behind a dynamic import, and a browser that fails the check never downloads it. Confirmed by overriding canvas.getContext to refuse WebGL and watching the network log stay empty while the still stood in place.",
      "The exit, the text and the reader's journey are what they were: the drawer still carries the hero up and fades it, the tips in the still are in the mono face, and every demo and every concept is untouched. Deleted scripts/verify-cube.mjs, whose subject was the drawn cube this pass replaced.",
      "Against the mid-range phone (390x844, devicePixelRatio 3, CPU throttled 4x, software rendering): the frame interval holds at 16.7ms median with the cube live, and the render loop's share of a frame measures around 1-3ms over the same page without it. The 32x32 buffer against 256x256 could not be resolved by that measurement — both landed between 13.7ms and 21.8ms across runs — so the low buffer is claimed as cheaper by construction, not as measured.",
    ],
    lesson:
      "A picture is a specification, and the parts of it you can measure are how you find out whether you matched it: an opacity, a fringe width, a field colour. The parts you cannot measure have to be reported as reasoned rather than tested, and saying which is which is the whole of the work. The same goes for the check itself — before believing a harness that says the app is broken, make it prove it can reach the app.",
  },
];

/**
 * Work that is understood and deliberately not built yet. Kept here so the
 * intent is on the record without pretending it exists.
 */
export const QUEUED: { label: string; where: string; note: string }[] = [
  {
    label: "Secrets hygiene",
    where: "Layer 0, step 0.04",
    note: "Already taught as a rule. Becomes a check once real keys exist.",
  },
  {
    label: "Purging secrets from git history",
    where: "Layer 0, step 0.02",
    note: "The rotate-don't-rewrite decision belongs with the git step.",
  },
  {
    label: "Rate-limited sign-in",
    where: "Layer 1, concept 1.07",
    note: "The demo already models the mechanism. Point it at a real endpoint and key it by account as well as IP.",
  },
  {
    label: "Server-side authorization and row-level security",
    where: "Layer 1, concepts 1.03 and 1.04",
    note: "The demo models both gates in the browser. Point them at real records and enforce them on the server.",
  },
  {
    label: "Input validation",
    where: "Layer 1, concept 1.02",
    note: "Fits the request concept: what the server does with a malformed body.",
  },
  {
    label: "HTTPS, security headers, dependency scanning",
    where: "Layer 1, concept 1.10",
    note: "Belongs to the deployment concept, at the edge, where the headers are actually set.",
  },
];
