export type Layer = {
  /** Mono identifier shown in the rail. */
  code: string;
  label: string;
  href: string;
  /** One-line gloss under the label in the rail. */
  note: string;
  /** What this layer is for, in one sentence. */
  summary: string;
  /** The named pieces inside it. */
  contents: string;
};

/*
  The site is three layers plus an index. "Layer" is not decoration: each one is
  a level of abstraction down from the surface you look at. Layer 0 is the bench
  you set up before building, layer 1 is the mechanism underneath a running app,
  layer 2 is the record of how this particular app was built.
*/
export const LAYERS: Layer[] = [
  {
    code: "—",
    label: "Home",
    href: "/",
    note: "orientation",
    summary:
      "Why this site exists, and the order the three layers are meant to be read in.",
    contents: "Purpose, reading order, current build status.",
  },
  {
    code: "00",
    label: "Getting started",
    href: "/getting-started",
    note: "the bench",
    summary:
      "What a project needs in place before the first prompt: a folder, version control, a list of things never to commit, and a sketch of the architecture.",
    contents:
      "Project folder, git, .gitignore, environment files, sketching before prompting.",
  },
  {
    code: "01",
    label: "Concepts",
    href: "/concepts",
    note: "the mechanism",
    summary:
      "The ten mechanisms that decide whether an app works, stays up, and keeps its data. Each one is written as plain language, a prompt you could reuse, and a demo you click through yourself.",
    contents:
      "Frontend and backend, requests, databases, authentication, sessions, hashing, rate limiting, CORS, secrets, deployment.",
  },
  {
    code: "02",
    label: "Build log",
    href: "/build-log",
    note: "the record",
    summary:
      "The prompts that built this site, what came back wrong, and the correction. Kept because the corrections are the useful part.",
    contents: "Entries in order, each with prompt, fault, and fix.",
  },
];
