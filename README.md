# Glassbox

A site that teaches how AI-assisted web apps actually work underneath: not a
coding tutorial, and no code walkthroughs. Concepts and decisions, taught through
short interactive demos you click through yourself.

Frontend only for now. Everything on the site is simulated in the browser.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # next typegen && tsc --noEmit
npm run build      # production build
npm run lint
```

Requires Node 20+. Built against Next.js 16 (App Router), React 19, Tailwind CSS
v4 and Framer Motion.

## Structure

Three layers plus an index. Each layer is a level of abstraction down from the
surface a visitor looks at.

| Route              | Layer | What it is                                          |
| ------------------ | ----- | --------------------------------------------------- |
| `/`                | —     | Purpose, reading order, current build status         |
| `/getting-started` | 00    | The bench: setup before the first prompt             |
| `/concepts`        | 01    | The mechanism: ten concepts, one demo built so far   |
| `/build-log`       | 02    | The record: prompts, faults, corrections             |

```text
app/
  layout.tsx              root shell: type, masthead, layer rail, colophon
  globals.css             the visual system, as Tailwind v4 @theme tokens
  page.tsx                index
  getting-started/page.tsx
  concepts/page.tsx
  build-log/page.tsx
  icon.svg                the mark, drawn
components/
  site/                   shell and register primitives (shared)
  concepts/               concept register and the rate limiting demo
  steps/                  the layer 0 register
lib/
  layers.ts               layer definitions, used by the rail and the index
  concepts.ts             layer 1 content
  getting-started.ts      layer 0 content
  build-log.ts            layer 2 content, plus what is queued
```

Content lives in `lib/`. Adding a concept means adding one object to
`lib/concepts.ts`; the register, the row numbering, the margin notes and the
demo placeholder all follow from it.

## The visual system

The reference object is a lab notebook or a bench instrument, not a SaaS landing
page. Three decisions carry it.

**Paper and rules, one soft edge.** Depth comes from three paper values (`paper`,
`paper-raised`, `paper-sunk`), a faint paper-grain texture, hairline rules, and a
single soft shadow reserved for demo frames — the page is a physical object on a
bench, not a stack of cards. There is one strong horizontal mark on the site, at
the top of a figure caption, and it means "what follows is a thing to look at".
No gradients, no blur, no glow, no dark mode inversion.

**One accent, one highlighter.** A desaturated bench green carries structure and
interaction. A marker ochre is reserved for highlighting prose — a highlighter
pass over a printed page, used for `<mark>` and for "not built yet" tags. Three
semantic state colours report real state changes inside demos and appear nowhere
else. The palette is warm paper and ink rather than white and black, so nothing
is flat.

**Type by role, not by reputation.** IBM Plex is a technical superfamily, chosen
because the site is full of measurements. Three jobs from one voice: Plex Serif
for headings so a page reads like a printed field report, Plex Sans for
explanatory prose, and Plex Mono reserved for identifiers and units. Numerals in
counters, timings and readouts get a fourth face, Spline Sans Mono — boxier,
more instrument-like digits, set tabular, so a measurement reads as a measurement
rather than as part of a sentence.

Two structural devices do the work that templates usually do with cards and
icons:

- **The layer rail.** Navigation is a layer index in the left margin, like the
  tab strip of a notebook, so you always know how deep you are. Active layers are
  marked with a filled square.
- **The register.** Layer 0 and layer 1 are lists of closed cases. Each row shows
  its number, its title and the question it answers. Clicking opens the casing and
  reveals the explanation, the wording you would hand to an AI, and the demo.

That last one is the whole "glassbox" idea carried by layout and interaction.
There is no `backdrop-filter` anywhere in this project: the panel is see-through
because the mechanism is genuinely there when you open it.

## Demos

Demos are figures, numbered and captioned, in `components/concepts/`. One is
built: `rate-limit-demo.tsx`, a fixed-window limiter of five requests per ten
seconds, keyed by identity.

It is the model for the rest, so it holds to four rules:

1. The state that decides the outcome is on screen, not implied.
2. The reader moves it, so nothing auto-plays and nothing is over before you have
   decided what to look at.
3. Every state change writes a sentence saying what the mechanism just did.
4. Animation carries meaning (a slot filling, a row arriving) and nothing else.

The demo is honest about where state lives: the counter is server state, decided
by a pure function, and no control on the page can write to it directly.

## Not built yet

There is no backend, no database and no authentication. A pre-launch hardening
pass is understood and deliberately deferred until there is something real to
harden. The queued items are listed on `/build-log`, each pointing at the entry
it belongs to, because most of them map onto existing layers 0 and 1 content and
should be woven in rather than gathered into a separate security section.

## Environment

`.env.example` is committed and documents the variable names without values.
Every other `.env` file is ignored from the first commit, which is the practice
layer 0 teaches.
