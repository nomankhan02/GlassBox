export type Step = {
  id: string;
  /** Ordinal shown in the register, e.g. "0.03". */
  code: string;
  title: string;
  /** What this step is really about, in one line. */
  purpose: string;
  plain: string[];
  /** What you would actually ask a tool to do. */
  tell: string;
  /** How to know the step is actually done. */
  check: string;
  /** Short note set in the margin. */
  marginalia: string;
  /**
   * Identifiers, names and filenames shown as a specimen. These are things the
   * reader will need to type or recognise, never code to copy.
   */
  specimen?: string[];
};

/*
  Five steps, in the order they have to happen. The point of putting these
  before any prompting is that four of them exist to protect you from a mistake
  you cannot undo later, and the fifth one changes the quality of everything you
  build afterwards.
*/
export const STEPS: Step[] = [
  {
    id: "project-folder",
    code: "0.01",
    title: "Create the project folder",
    purpose: "One project, one folder, and know what was written into it.",
    plain: [
      "Decide where the project lives on your machine and give it a name you will still recognise in three months. A folder per project, rather than a folder full of experiments.",
      "When you ask an AI tool to scaffold a project, it creates this structure for you, with the framework's conventions already in place: a place for pages, a place for components, a place for files served as-is, a configuration file, and a record of the project's dependencies.",
      "The thing worth noticing is that scaffolding writes code you did not write and have not read. That is a reasonable trade for starting quickly, and it is also the reason the next four steps exist.",
    ],
    tell: "Scaffold a Next.js App Router project with TypeScript and Tailwind in this folder. Then list every file and folder you created and tell me what each one is for, before we write any features.",
    check: "You can say what each generated folder is for without looking it up.",
    marginalia: "the first commit has no history to explain",
    specimen: ["app/", "components/", "public/", "package.json"],
  },
  {
    id: "git",
    code: "0.02",
    title: "Initialize git",
    purpose: "Version control before there is anything to lose.",
    plain: [
      "Git records snapshots of your project over time, so you can see what changed, when, and why. Initializing it takes one command and immediately buys you the ability to undo with confidence instead of hope.",
      "The habit that matters afterwards is committing small and often, with a message that says why a change happened. The first commit should happen before there is anything to lose, not after the first bug.",
      "This matters more with an AI in the loop, because a tool edits many files in one response. When a change goes wrong, version control is the difference between reading a diff and trying to remember what the file used to say.",
    ],
    tell: "Initialize git in this folder and make an initial commit. Then commit after each change that works, with messages that explain the reason for the change rather than listing the files.",
    check: "git status is clean, and git log shows a commit you made before anything broke.",
    marginalia: "commit small enough that a diff is readable in one screen",
    specimen: ["git init", "git add", "git commit"],
  },
  {
    id: "gitignore",
    code: "0.03",
    title: "Write .gitignore first",
    purpose: "Keep what you made, leave out what your machine made.",
    plain: [
      "Version control should hold the things you authored: your source, your configuration, your content. It should not hold the things your machine produced: installed dependencies, build output, caches, editor settings.",
      "Those folders are large, regenerable, and different on every computer. Committing them makes every diff unreadable and every clone slower, and it buries the changes you actually want to review.",
      "Write this file before the first commit. Files that were never tracked are invisible to git, and they stay invisible. Files that were tracked once and ignored later remain in the history for good, which turns a small omission into a permanent one.",
    ],
    tell: "Add a .gitignore that excludes installed dependencies, build output, caches, and every .env file, and add a .env.example that documents the variable names. Do this before the first commit, not after.",
    check: "git status lists no dependency folder, no build output, and no .env file.",
    marginalia: "never tracked is invisible; tracked once is permanent",
    specimen: ["node_modules/", ".next/", ".env*", "!.env.example"],
  },
  {
    id: "env-files",
    code: "0.04",
    title: "Understand .env files",
    purpose: "Separate values that can be public from values that cannot.",
    plain: [
      "Some values your app needs are not safe to publish: database passwords, provider keys, signing secrets. Those live in a file that stays on your machine and on your host, and the app reads them when it runs.",
      "The rule is simple and absolute. Environment files are never committed, and everything in a repository should be assumed to be public, including a private one, because repositories get shared, forked, and cloned onto laptops that get lost.",
      "The counterpart that does get committed lists the variable names with placeholder values, so a new person or a new AI session knows what to set without ever seeing a real value.",
      "There is one more trap worth knowing before it bites. In frontend frameworks, variables with a public prefix are compiled straight into the file the browser downloads. A key with that prefix is not a secret, whatever file it came from.",
    ],
    tell: "Read all secrets from environment variables on the server side only. Add every .env file to .gitignore, and commit a .env.example listing each variable name with placeholder values.",
    check: "You can answer one question about any value: if this were published tomorrow, what could somebody do with it?",
    marginalia: "a repository is public in practice, whatever the setting says",
    specimen: [".env", ".env.local", ".env.example", "NEXT_PUBLIC_ goes to the browser"],
  },
  {
    id: "sketch",
    code: "0.05",
    title: "Sketch the architecture before you prompt",
    purpose: "Six lines of design beat a paragraph of description.",
    plain: [
      "Before asking for a feature, write six lines about it: who does it, what data has to be stored, who is allowed to read it, who is allowed to change it, what runs on the server, and what happens when it fails.",
      "This is not documentation for its own sake. A tool that receives a clear shape produces a structure that matches it. A vague prompt produces plausible-looking code with the decisions quietly made for you, in places you will not think to look.",
      "The sketch is also what you check the output against. If you wrote that permissions are checked on the server, and the generated code checks them in the browser, you have found a real bug before anyone shipped it.",
    ],
    tell: "Here is the feature in six lines: who does it, what is stored, who may read it, who may change it, what runs server-side, and what happens on failure. Propose the file structure first, then implement.",
    check: "Your sketch names at least one place where a rule has to be enforced on the server.",
    marginalia: "the prompt is the design, whether you wrote one or not",
    specimen: [
      "who does it",
      "what is stored",
      "who may read it",
      "who may change it",
      "what runs on the server",
      "what failure looks like",
    ],
  },
];
