export type Step = {
  id: string;
  /** Ordinal shown in the register, e.g. "0.03". */
  code: string;
  title: string;
  /** What this step is really about, in one line. */
  purpose: string;
  plain: string[];
  /**
   * The one non-negotiable this step exists to enforce. Rendered as a single
   * highlighted line, because a rule you can repeat is worth more than a
   * procedure you have to look up.
   */
  rule: string;
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
  Five steps, in the order they have to happen. The point of putting these before
  any prompting is that four of them exist to protect you from a mistake you
  cannot undo later, and the fifth changes the quality of everything you build
  afterwards. The order is not a suggestion: .gitignore and the environment file
  are only cheap before the first commit, and version control is only useful if
  the record starts before there is anything to lose.
*/
export const STEPS: Step[] = [
  {
    id: "project-folder",
    code: "0.01",
    title: "Create the project folder",
    purpose: "One project, one folder, with a name you will still recognise in three months.",
    plain: [
      "Everything else on this list attaches to a folder, so the folder comes first. It is the boundary that git records, that your editor opens, and that an AI tool treats as the whole world it is allowed to read and change. One project per folder, rather than a folder of half-finished experiments, is what keeps that boundary honest: when a tool tells you it changed a file, you know which project the file belongs to.",
      "The name is doing more work than it appears to. It becomes the folder path, the repository, the address once the project is deployed, the browser tab, and the label you will use in every conversation about it later. A name left blank is a name a generator picks for you, and generated defaults are chosen to be inoffensive rather than correct. Ten seconds spent on it now is worth it.",
      "The folder is also where you find out what you did not write. A scaffold produces a structure you did not author: somewhere for pages, somewhere for reusable pieces, somewhere for files served as-is, a configuration file, and a record of dependencies. That is a reasonable trade for starting quickly, and it is also code you have not read yet. The four steps after this one exist because of it.",
    ],
    rule: "The folder is the boundary: everything inside it is the project, and nothing outside it is.",
    specimen: ["app/", "components/", "public/", "package.json"],
    tell: "Scaffold a Next.js App Router project with TypeScript and Tailwind in this folder. Before any features, list every file and folder you created, what each one is for, and which of them I am expected to edit by hand.",
    check: "You can say what each generated folder is for without looking it up.",
    marginalia: "the name shows up in more places than the folder does",
  },
  {
    id: "git",
    code: "0.02",
    title: "Initialize git",
    purpose: "A recorded history before there is anything to lose.",
    plain: [
      "Git keeps a running record of snapshots. Each commit stores the state of the project at that moment with a note about why it changed, and keeps every earlier state available. It is not the same thing as a backup: a backup hands you your latest files, while a history lets you see what a file looked like on Tuesday and what you changed to break it on Wednesday.",
      "It goes before anything else is written because its value is comparative. A snapshot only means something next to an earlier one, so the record has to begin before there is work you would want back. Starting after the first bug is too late in a quiet way: you can still fix the bug, but you can no longer see the version that worked.",
      "With a tool editing the project, this stops being tidiness. One response can rewrite a dozen files at once, and a fix for one thing regularly breaks another. The history turns that from guesswork into a diff you can read, and reverting from an afternoon into one command. It is also what lets you ask for two versions of the same feature and keep the one that turned out better.",
    ],
    rule: "Commit before anything works, and again every time something does.",
    specimen: ["git init", "git status", "git log"],
    tell: "Initialize git here, and commit before we build the first feature. After that, commit every time a change works, with a message that explains why the change happened rather than listing the files it touched. When something breaks, tell me the smallest change that gets back to working.",
    check: "The history contains a commit you made before anything broke, and its message says why rather than what.",
    marginalia: "commit small enough that the diff reads in one screen",
  },
  {
    id: "gitignore",
    code: "0.03",
    title: "Write .gitignore first",
    purpose: "Decide up front what git should never see.",
    plain: [
      "A repository should hold what you wrote: source, configuration, content. It should not hold what your machine produced: installed dependencies, build output, caches, editor settings. Those are large, they change on every run, and they differ from one computer to the next. Once they are in the history, every diff is buried under thousands of lines you did not author, and the change you actually want to review is the one you cannot find.",
      "The .gitignore file is where that judgement is written down: a plain list of paths that are not part of the project. Every framework ships an expected one, so the sensible first move is to read what the scaffold already excludes rather than guessing at it.",
      "The timing is the entire point. A path ignored before the first commit is invisible to git and stays invisible, and that costs nothing. A path that was tracked once stays in the history even after you ignore it later, because an ignore rule stops future tracking and does nothing about the record. That is what turns a small oversight into a permanent one, and the only real remedies are rewriting the history or accepting that it is in there.",
      "This is the step that gets skipped most often, for a simple reason: skipping it produces no error. The project runs, nothing looks wrong, and the problem only appears the first time somebody tries to read the history — or the first time something that should never have been shared is already sitting in a repository.",
    ],
    rule: "Never tracked is invisible and stays invisible; tracked once is in the record for good.",
    specimen: ["node_modules/", ".next/", ".env*", "!.env.example"],
    tell: "Add a .gitignore that excludes installed dependencies, build output, caches and every .env file, and add a .env.example that documents the variable names. Do it before the first commit, not after.",
    check: "git status lists no dependency folder, no build output, and no .env file.",
    marginalia: "the mistake it prevents makes no noise at all",
  },
  {
    id: "env-files",
    code: "0.04",
    title: "Understand .env files",
    purpose:
      "Sort the values the app needs into ones that can be public and ones that cannot.",
    plain: [
      "Nearly every app needs values that are not part of its code: the address of its database, the password for it, a key for a payment provider, a secret used to sign people in. Those cannot sit in a source file, because source files get copied, shared and published. So they live in a separate file that stays on your machine and on your server, and the app reads them when it starts. That is what an environment file is: not configuration for the code, but the values belonging to wherever the code happens to be running.",
      "The rule around that file is absolute. It is never committed, and everything in a repository should be treated as public, including a private one, because repositories get shared, forked, cloned onto laptops that get lost, and read by services you connected once and forgot about. The counterpart that does get committed lists the variable names with placeholder values and nothing else, so the next person — or the next AI session starting cold — knows what to supply without ever seeing a real value.",
      "There is a second way a secret escapes, and it is the one worth knowing about if you are building by prompting: pasting it into the conversation. A transcript is a place you do not control. It is stored, sometimes reviewed, sometimes used to improve a model, and it is not unusual for the model to quote a value back into a file it then writes for you — which is a longer route to the same commit. If a secret has to be discussed, describe its shape or hand over an obvious fake, and keep the real value in the environment file.",
      "Last, one trap that fails silently. In a frontend framework, a variable given a public prefix is compiled straight into the JavaScript the browser downloads. At that point it is not a secret, whatever file it came from: anyone who loads the page can read it. The prefix is a deliberate signal that a value is allowed to be public, and a key that ends up on the wrong side of that line leaks with no error message at all.",
    ],
    rule: "A secret is never committed, and never pasted into a prompt.",
    specimen: [".env.local", ".env.example", "a public prefix is public by definition"],
    tell: "Read every secret from an environment variable, on the server side only. Ignore every .env file from the first commit and commit a .env.example listing each variable name with placeholder values. Then tell me which of the values you use would end up in the browser bundle.",
    check: "You can answer one question about any value: if this were published tomorrow, what could somebody do with it?",
    marginalia: "a repository is public in practice, whatever the setting says",
  },
  {
    id: "sketch",
    code: "0.05",
    title: "Sketch the architecture before you prompt",
    purpose:
      "Decide the shape of the app yourself, so you are checking an answer instead of accepting one.",
    plain: [
      "Before asking for a feature, write down the shape of the app in a few lines: which pages exist, what each page shows, what talks to what, and where the data is written. It does not need to be a diagram or a document. It needs to be short enough that you would actually read it again, and specific enough to settle the questions that would otherwise be settled for you.",
      "This is not busywork before the real work. Every gap in a description gets filled with the most common answer, and the most common answer is not necessarily yours: a form that posts to a page instead of an endpoint, a permission checked in the browser because that is where the button is, data kept in the browser because it made the first version work. None of those arrive labelled as decisions. They arrive as finished code, a few files deep, at which point the shape has become expensive to argue with.",
      "The sketch then does two jobs at once. It is the instruction you send, and it is the checklist you hold the result against. If you wrote down that the server decides who may delete a record, and the code that comes back decides it in the browser, you have found a real problem before anybody used it. Most of the corrections in this site's own build log have that shape: not a tool that failed, but a prompt that left a decision open.",
    ],
    rule: "A shape you wrote down is the thing you check the result against.",
    specimen: [
      "which pages exist",
      "what each page shows",
      "what talks to what",
      "where the data is written",
      "who may read and change it",
      "what runs on the server",
      "what failure looks like",
    ],
    tell: "Here is the shape of the app in a few lines: which pages exist, what each shows, what talks to what, where the data is written, who may read and change it, what runs on the server, and what failure looks like. Propose the file structure that matches it before writing any feature.",
    check: "Your sketch names at least one rule that has to be enforced on the server, and one thing stored somewhere other than the browser.",
    marginalia: "the prompt is the design, whether or not you wrote one",
  },
];
