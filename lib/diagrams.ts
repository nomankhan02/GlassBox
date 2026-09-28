/*
  A diagram is a schematic, not an illustration and not a chart. It shows the
  spatial shape of a mechanism — boxes and arrows, or a timeline — that a
  paragraph can describe but cannot make you picture. A number alone does not
  teach structure; a diagram does.

  Diagrams live beside the stat/comparison break rather than replacing it: the
  break gives you the figures, the diagram gives you the shape. Every concept
  with a real structural shape gets one. The drawings are flat and share the
  site's restrained visual language: hairline strokes, one state pair at most,
  no gradients, no 3D, consistent line weight.

  There are two kinds. A `flow` is the general one: boxes on a grid, arrows
  between them, and optionally a vertical boundary line that arrows can stop at.
  A `timeline` is the special case used where the shape is a run of events in
  time rather than a set of connected boxes. The data here is only structure;
  every figure is either written down or derived from the shape itself.
*/

/** The only colour a diagram is allowed: neutral structure, or a state pair. */
export type Tone = "plain" | "ok" | "bad";

/** One box on the grid. `col` grows rightward, `row` grows downward. */
export type DiagramNode = {
  id: string;
  /** Primary label, in the labels-and-units voice. */
  label: string;
  /** Optional second line, smaller. */
  sub?: string;
  tone?: Tone;
  /** Draw a small padlock: this box holds a credential. */
  lock?: boolean;
  /** Dashed box: a thing that is absent or deliberately not kept. */
  hollow?: boolean;
  col: number;
  row: number;
};

/** One connection between two boxes. */
export type DiagramArrow = {
  from: string;
  to: string;
  label?: string;
  tone?: Tone;
  /**
   * Dashed and stopped with a bar instead of an arrowhead: the direction that
   * does not happen. If a boundary sits between the two boxes, the arrow ends
   * at the boundary rather than at the box.
   */
  blocked?: boolean;
  /**
   * Perpendicular offset in steps, so two arrows between the same pair of boxes
   * (a request and its response, a read and its write) do not overlap.
   */
  lane?: number;
  /** Arrowheads at both ends: one exchange, both directions. */
  both?: boolean;
};

/** A vertical line between two columns: the browser boundary, the network. */
export type DiagramBoundary = {
  /** The line is drawn in the gap after this column index. */
  afterCol: number;
  label: string;
};

/** One arrival on a request timeline. */
export type TimelineRequest = {
  /** The server's verdict for this request. */
  status: 200 | 429;
};

export type Diagram =
  | {
      kind: "timeline";
      /** Field label printed above the drawing, like a break's label. */
      label: string;
      /**
       * How many requests the counter allows before it refuses. The cutoff line
       * is drawn between this request and the next one.
       */
      limit: number;
      /** The window the counter is measured over, printed above the span. */
      window: string;
      requests: TimelineRequest[];
      /** One line under the drawing. Optional. */
      note?: string;
    }
  | {
      kind: "flow";
      label: string;
      nodes: DiagramNode[];
      arrows: DiagramArrow[];
      boundary?: DiagramBoundary;
      /**
       * Small titles above each grid row, indexed by `row`. Used where two
       * rows would otherwise read as one, so each row's labels stay attached
       * to the boxes they describe.
       */
      rowLabels?: string[];
      /**
       * Vertical distance between rows, in user units. Overrides the default
       * when a diagram needs more air between rows than the shared value.
       */
      rowGap?: number;
      note?: string;
    };
