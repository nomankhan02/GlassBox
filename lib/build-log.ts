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
    label: "Hashed passwords",
    where: "Layer 1, concept 1.06",
    note: "Its own demo, written when a real sign-in flow exists to point at.",
  },
  {
    label: "Rate-limited sign-in",
    where: "Layer 1, concept 1.07",
    note: "The demo already models the mechanism. Point it at a real endpoint and key it by account as well as IP.",
  },
  {
    label: "Server-side authorization and row-level security",
    where: "Layer 1, concepts 1.03 and 1.04",
    note: "Needs a database and real user records to demonstrate honestly.",
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
