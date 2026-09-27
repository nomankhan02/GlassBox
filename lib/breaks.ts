/*
  A "break" is the small visual that sits after a run of explanation: lighter
  than the main interactive demo, heavier than another paragraph. Three kinds,
  because those are the only three shapes the explanations actually need — a
  set of measured figures, two things held side by side, or a short sequence.

  A break is content, not decoration, so it lives with the rest of the copy in
  lib/ and is rendered by one component. Nothing here is generated from a
  random number: every value is either written down as a real-world figure or
  computed from the data on the page.
*/

export type BreakStat = {
  /** The measurement itself, set in the instrument face. */
  value: string;
  /** Unit or range marker, kept small beside the value. */
  unit?: string;
  /** What the figure is, in plain words. */
  label: string;
};

export type BreakSide = {
  title: string;
  /**
   * Which side of the line this is. "plain" for a neutral pairing, "ok"/"bad"
   * when one side is the safe answer and the other is the mistake. Tone only
   * ever draws a six-pixel state square, the same mark the demos use.
   */
  tone?: "plain" | "ok" | "bad";
  points: string[];
  /** The one-line summary under the points. */
  note?: string;
};

export type Break =
  | {
      kind: "stats";
      label: string;
      stats: BreakStat[];
      note?: string;
    }
  | {
      kind: "compare";
      label: string;
      left: BreakSide;
      right: BreakSide;
      verdict?: string;
    }
  | {
      kind: "flow";
      label: string;
      steps: string[];
      note?: string;
    };
