import type {
  Diagram as DiagramSpec,
  DiagramArrow,
  DiagramBoundary,
  DiagramNode,
  Tone,
} from "@/lib/diagrams";

/*
  Schematics, drawn as inline SVG. They share the break's frame — a hairline, a
  field label, the drawing — because a diagram is a thing to read beside the
  text, not a figure you operate. Structure is drawn in the neutral rule ink;
  the only colour is the state pair, ok and bad, used the way the demos already
  use it. Flat fills, no gradients, one line weight.

  Both kinds sit on a Canvas that never lets its labels shrink: the SVG keeps a
  min-width equal to its own viewBox, so on a narrow screen the drawing scrolls
  sideways instead of scaling down to illegibility. On a wide screen it still
  stretches to fill the column.
*/

/* ---- shared geometry ---- */

/** Outer margin of the drawing, and the minimum padding inside a node. */
const PAD = 20;
/** Minimum horizontal padding each side of the longest line in a node. */
const TEXT_PAD = 16;
const MIN_BOX_W = 88;
const BOX_H = 42;
const COL_GAP = 58;
const ROW_GAP = 46;
/** Perpendicular offset of one lane, so parallel arrows do not overlap. */
const LANE_STEP = 13;
/** Corner slot reserved for the lock badge, kept clear of the node's text. */
const LOCK_SLOT = 20;
const LABEL_H = 11;
const LABEL_GAP = 6;
const LABEL_PAD = 8;
const ROW_LABEL_H = 16;
const BOUNDARY_FOOT = 22;
const LABEL_SIZE = 9.5;
const ROW_LABEL_SIZE = 8.5;

const STROKE_TONE: Record<Tone, string> = {
  plain: "var(--color-rule-strong)",
  ok: "var(--color-ok)",
  bad: "var(--color-bad)",
};

const TEXT_TONE: Record<Tone, string> = {
  plain: "var(--color-ink-soft)",
  ok: "var(--color-ok)",
  bad: "var(--color-bad)",
};

type Pt = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };
type Rect = Box & { cx: number; cy: number };
type Seg = { a: Pt; b: Pt };

/**
 * Advance width of a Plex Mono run. The face is 0.6em; the extra headroom
 * keeps this an over-estimate, so a node sized from it cannot be too narrow.
 */
function advance(text: string, size: number) {
  return text.length * size * 0.62;
}

function intersects(a: Box, b: Box, pad = 0) {
  return (
    a.x < b.x + b.w + pad &&
    b.x < a.x + a.w + pad &&
    a.y < b.y + b.h + pad &&
    b.y < a.y + a.h + pad
  );
}

function within(b: Box, w: number, h: number) {
  return (
    b.x >= -0.5 && b.y >= -0.5 && b.x + b.w <= w + 0.5 && b.y + b.h <= h + 0.5
  );
}

function padBox(box: Box, pad: number): Box {
  return { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 };
}

function rectBox(rect: Rect): Box {
  return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
}

function segBox(seg: Seg): Box {
  return {
    x: Math.min(seg.a.x, seg.b.x),
    y: Math.min(seg.a.y, seg.b.y),
    w: Math.abs(seg.b.x - seg.a.x),
    h: Math.abs(seg.b.y - seg.a.y),
  };
}

function between(value: number, a: number, b: number) {
  return value > Math.min(a, b) && value < Math.max(a, b);
}

/** Widest node needed to hold this node's text with the minimum padding. */
function nodeBoxWidth(node: DiagramNode) {
  const content = Math.max(
    advance(node.label, 10),
    node.sub ? advance(node.sub, 8.5) : 0,
  );
  return Math.max(
    MIN_BOX_W,
    Math.ceil(content) + 2 + TEXT_PAD * 2 + (node.lock ? LOCK_SLOT : 0),
  );
}

/**
 * Every arrow is drawn square: horizontal, vertical, or an L whose legs are
 * both axis-aligned. A blocked arrow that crosses the boundary stops on it,
 * which keeps the stop-bar horizontal on a left-to-right run.
 */
function routeArrow(
  from: Rect,
  to: Rect,
  lane: number,
  blocked: boolean,
  boundaryX: number | null,
): Seg[] {
  const sameRow = Math.abs(from.cy - to.cy) < 1;
  const sameCol = Math.abs(from.cx - to.cx) < 1;

  if (sameRow) {
    const y = from.cy + lane * LANE_STEP;
    const dir = Math.sign(to.cx - from.cx) || 1;
    const x0 = dir > 0 ? from.x + from.w : from.x;
    let x1 = dir > 0 ? to.x : to.x + to.w;
    if (blocked && boundaryX !== null && between(boundaryX, x0, x1)) {
      x1 = boundaryX;
    }
    return [{ a: { x: x0, y }, b: { x: x1, y } }];
  }

  if (sameCol) {
    const x = from.cx + lane * LANE_STEP;
    const dir = Math.sign(to.cy - from.cy) || 1;
    const y0 = dir > 0 ? from.y + from.h : from.y;
    const y1 = dir > 0 ? to.y : to.y + to.h;
    return [{ a: { x, y: y0 }, b: { x, y: y1 } }];
  }

  /* A diagonal pair: leave horizontally, then turn and enter the target. */
  const dir = Math.sign(to.cx - from.cx) || 1;
  const x0 = dir > 0 ? from.x + from.w : from.x;
  const y0 = from.cy;
  if (blocked && boundaryX !== null && between(boundaryX, x0, to.cx)) {
    return [{ a: { x: x0, y: y0 }, b: { x: boundaryX, y: y0 } }];
  }
  const x1 = to.cx;
  const y1 = to.cy > from.cy ? to.y : to.y + to.h;
  return [
    { a: { x: x0, y: y0 }, b: { x: x1, y: y0 } },
    { a: { x: x1, y: y0 }, b: { x: x1, y: y1 } },
  ];
}

/* ---- frame + canvas ---- */

function Frame({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="mt-7 border-t border-rule pt-3">
      <span className="field-label">{label}</span>
      {children}
    </aside>
  );
}

/**
 * The scroll-safe drawing surface. `minWidth` is the drawing's own width in
 * user units, which becomes a CSS min-width in pixels: labels never render
 * smaller than they were drawn, whatever the viewport.
 */
function Canvas({
  width,
  height,
  ariaLabel,
  dataKind,
  children,
}: {
  width: number;
  height: number;
  ariaLabel: string;
  /** Marks the drawing for the automated diagram check. */
  dataKind: "flow" | "timeline";
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 overflow-x-auto pb-1" tabIndex={0}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        data-diagram={dataKind}
        className="block h-auto w-full"
        style={{ minWidth: width }}
      >
        {children}
      </svg>
    </div>
  );
}

function Note({ children }: { children: string }) {
  return (
    <p className="mt-2.5 max-w-[70ch] font-mono text-[10.5px] leading-[1.6] text-ink-faint">
      {children}
    </p>
  );
}

/* ---- flow ---- */

export function Diagram(props: DiagramSpec) {
  if (props.kind === "timeline") return <Timeline {...props} />;
  return <Flow {...props} />;
}

/**
 * Place an arrow's label clear of every box, rule, arrow and other label.
 * Candidates run from the natural spot outward, and the first that fits both
 * the drawing and the free space wins.
 */
function placeLabel(
  seg: Seg,
  text: string,
  from: Rect,
  obstacles: Box[],
  placed: Box[],
  width: number,
  height: number,
): Box {
  const w = advance(text, LABEL_SIZE);
  const h = LABEL_H;
  const rowTop = from.y;
  const rowBottom = from.y + from.h;
  const candidates: Box[] = [];

  if (seg.a.y === seg.b.y) {
    /* Horizontal: try just off the stroke, then off the whole row. */
    const y = seg.a.y;
    const mid = (seg.a.x + seg.b.x) / 2;
    const xs = [mid - w / 2, from.x, from.x + from.w - w];
    const ys = [
      y - LABEL_GAP - h,
      y + LABEL_GAP,
      rowTop - LABEL_GAP - h,
      rowBottom + LABEL_GAP,
    ];
    for (const yc of ys) {
      for (const xc of xs) candidates.push({ x: xc, y: yc, w, h });
    }
  } else {
    /* Vertical: beside the line, never across it. */
    const x = seg.a.x;
    const mid = (seg.a.y + seg.b.y) / 2;
    candidates.push({ x: x + LABEL_PAD, y: mid - h / 2, w, h });
    candidates.push({ x: x - LABEL_PAD - w, y: mid - h / 2, w, h });
  }

  const clear = (box: Box) =>
    obstacles.every((obstacle) => !intersects(box, obstacle, 0)) &&
    placed.every((other) => !intersects(box, other, 6));

  const usable = candidates.filter((box) => box.x >= 0 && box.y >= 0);
  return (
    usable.find((box) => within(box, width, height) && clear(box)) ??
    usable.find(clear) ??
    usable[0] ??
    candidates[0]
  );
}

function Flow({
  label,
  nodes,
  arrows,
  boundary,
  rowLabels,
  rowGap,
  note,
}: Extract<DiagramSpec, { kind: "flow" }>) {
  if (nodes.length === 0) return null;

  const maxCol = Math.max(...nodes.map((node) => node.col));
  const maxRow = Math.max(...nodes.map((node) => node.row));

  /* Each column is as wide as its widest node, so text always fits its box. */
  const colW: number[] = [];
  for (let c = 0; c <= maxCol; c += 1) colW[c] = MIN_BOX_W;
  for (const node of nodes) {
    colW[node.col] = Math.max(colW[node.col], nodeBoxWidth(node));
  }

  const colX: number[] = [];
  let cursor = PAD;
  for (let c = 0; c <= maxCol; c += 1) {
    colX[c] = cursor;
    cursor += colW[c] + COL_GAP;
  }
  const baseWidth = cursor - COL_GAP + PAD;

  const hasRowLabels = Boolean(rowLabels && rowLabels.length > 0);
  const gap = rowGap ?? ROW_GAP;
  const rowY: number[] = [];
  let cursorY = PAD + (hasRowLabels ? ROW_LABEL_H : 0);
  for (let r = 0; r <= maxRow; r += 1) {
    rowY[r] = cursorY;
    cursorY += BOX_H + gap;
  }
  const baseHeight =
    rowY[maxRow] + BOX_H + PAD + (boundary ? BOUNDARY_FOOT : 0);

  const rects = new Map<string, Rect>();
  for (const node of nodes) {
    const x = colX[node.col];
    const y = rowY[node.row];
    const w = colW[node.col];
    rects.set(node.id, { x, y, w, h: BOX_H, cx: x + w / 2, cy: y + BOX_H / 2 });
  }

  const boundaryX = boundary
    ? colX[boundary.afterCol] + colW[boundary.afterCol] + COL_GAP / 2
    : null;

  /*
    Everything a label must keep clear of: the boxes, the boundary rule, and
    every arrow segment and end-cap. Labels are placed one at a time into the
    same set, so no two labels can crowd each other either.
  */
  const obstacles: Box[] = [];
  for (const rect of rects.values()) obstacles.push(rectBox(rect));
  if (boundaryX !== null) {
    obstacles.push({
      x: boundaryX - 1,
      y: rowY[0] - 4,
      w: 2,
      h: rowY[maxRow] + BOX_H + 4 - (rowY[0] - 4),
    });
  }

  type Route = { arrow: DiagramArrow; segs: Seg[]; from: Rect; labelBox: Box | null };
  const routes: Route[] = [];
  for (const arrow of arrows) {
    const from = rects.get(arrow.from);
    const to = rects.get(arrow.to);
    if (!from || !to) continue;
    const segs = routeArrow(
      from,
      to,
      arrow.lane ?? 0,
      Boolean(arrow.blocked),
      boundaryX,
    );
    routes.push({ arrow, segs, from, labelBox: null });
    for (const seg of segs) obstacles.push(padBox(segBox(seg), 2));
    const end = segs[segs.length - 1].b;
    obstacles.push(padBox({ x: end.x, y: end.y, w: 0, h: 0 }, 8));
    if (arrow.both) {
      const start = segs[0].a;
      obstacles.push(padBox({ x: start.x, y: start.y, w: 0, h: 0 }, 8));
    }
  }

  /* Row titles first: they are structural, and everything else courses round. */
  const labels: Box[] = [];
  const rowTitles: { box: Box; text: string }[] = [];
  if (hasRowLabels) {
    rowLabels!.forEach((text, r) => {
      if (!text || rowY[r] === undefined) return;
      const box = {
        x: PAD,
        y: rowY[r] - 8 - LABEL_H,
        w: advance(text, ROW_LABEL_SIZE),
        h: LABEL_H,
      };
      rowTitles.push({ box, text });
      labels.push(box);
      obstacles.push(padBox(box, 6));
    });
  }

  for (const route of routes) {
    const text = route.arrow.label;
    if (!text) continue;
    route.labelBox = placeLabel(
      route.segs[0],
      text,
      route.from,
      obstacles,
      labels,
      baseWidth,
      baseHeight,
    );
    labels.push(route.labelBox);
    obstacles.push(padBox(route.labelBox, 6));
  }

  /* Grow the viewBox so a label can never fall outside the drawing. */
  let width = baseWidth;
  let height = baseHeight;
  for (const box of labels) {
    width = Math.max(width, box.x + box.w + PAD);
    height = Math.max(height, box.y + box.h + PAD);
  }

  const ariaLabel =
    `${label}. ` +
    nodes.map((node) => node.sub ? `${node.label}, ${node.sub}` : node.label).join("; ") +
    ".";

  return (
    <Frame label={label}>
      <Canvas width={width} height={height} ariaLabel={ariaLabel} dataKind="flow">
        {boundary && boundaryX !== null ? (
          <BoundaryLine
            boundary={boundary}
            x={boundaryX}
            top={rowY[0]}
            height={height}
          />
        ) : null}

        {rowTitles.map((title, index) => (
          <text
            key={index}
            data-row-label
            x={title.box.x}
            y={title.box.y + 9}
            className="font-mono text-[8.5px] tracking-[0.08em] uppercase"
            fill="var(--color-ink-faint)"
          >
            {title.text}
          </text>
        ))}

        {routes.map((route, index) => (
          <Arrow
            key={`${route.arrow.from}-${route.arrow.to}-${index}`}
            route={route}
          />
        ))}

        {nodes.map((node) => (
          <NodeBox key={node.id} node={node} rect={rects.get(node.id)!} />
        ))}
      </Canvas>
      {note ? <Note>{note}</Note> : null}
    </Frame>
  );
}

function BoundaryLine({
  boundary,
  x,
  top,
  height,
}: {
  boundary: DiagramBoundary;
  x: number;
  /** Top of the first row, so the rule starts just above the boxes. */
  top: number;
  height: number;
}) {
  return (
    <g>
      <line
        data-boundary-line
        x1={x}
        y1={top - 4}
        x2={x}
        y2={height - 20}
        stroke="var(--color-rule-strong)"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      <text
        data-boundary-label
        x={x}
        y={height - 8}
        textAnchor="middle"
        className="font-mono text-[8.5px] tracking-[0.06em] uppercase"
        fill="var(--color-ink-faint)"
      >
        {boundary.label}
      </text>
    </g>
  );
}

function Arrow({
  route,
}: {
  route: { arrow: DiagramArrow; segs: Seg[]; labelBox: Box | null };
}) {
  const { arrow, segs, labelBox } = route;
  const tone: Tone = arrow.tone ?? (arrow.blocked ? "bad" : "plain");
  const stroke = STROKE_TONE[tone];
  const first = segs[0];
  const last = segs[segs.length - 1];

  return (
    <g data-arrow={`${arrow.from}->${arrow.to}`}>
      {segs.map((seg, index) => (
        <line
          key={index}
          data-arrow-seg
          x1={seg.a.x}
          y1={seg.a.y}
          x2={seg.b.x}
          y2={seg.b.y}
          stroke={stroke}
          strokeWidth="1"
          strokeDasharray={arrow.blocked ? "3 3" : undefined}
        />
      ))}

      {arrow.blocked ? (
        <StopBar at={last.b} from={last.a} stroke={stroke} />
      ) : (
        <ArrowHead tip={last.b} from={last.a} stroke={stroke} />
      )}
      {arrow.both && !arrow.blocked ? (
        <ArrowHead tip={first.a} from={first.b} stroke={stroke} />
      ) : null}

      {arrow.label && labelBox ? (
        <text
          data-arrow-label
          x={labelBox.x + labelBox.w / 2}
          y={labelBox.y + 9}
          textAnchor="middle"
          className="font-mono text-[9.5px]"
          fill={TEXT_TONE[tone]}
        >
          {arrow.label}
        </text>
      ) : null}
    </g>
  );
}

function ArrowHead({ tip, from, stroke }: { tip: Pt; from: Pt; stroke: string }) {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  const size = 7;
  const spread = 0.42;
  const a = {
    x: tip.x - size * Math.cos(angle - spread),
    y: tip.y - size * Math.sin(angle - spread),
  };
  const b = {
    x: tip.x - size * Math.cos(angle + spread),
    y: tip.y - size * Math.sin(angle + spread),
  };
  return (
    <path
      data-arrow-head
      d={`M ${a.x} ${a.y} L ${tip.x} ${tip.y} L ${b.x} ${b.y}`}
      fill="none"
      stroke={stroke}
      strokeWidth="1"
    />
  );
}

/** The bar that says a line ends here, and why: it was stopped, not routed. */
function StopBar({ at, from, stroke }: { at: Pt; from: Pt; stroke: string }) {
  const angle = Math.atan2(at.y - from.y, at.x - from.x);
  const nx = -Math.sin(angle) * 6;
  const ny = Math.cos(angle) * 6;
  return (
    <line
      data-arrow-stop
      x1={at.x - nx}
      y1={at.y - ny}
      x2={at.x + nx}
      y2={at.y + ny}
      stroke={stroke}
      strokeWidth="1"
    />
  );
}

function NodeBox({ node, rect }: { node: DiagramNode; rect: Rect }) {
  const stroke = STROKE_TONE[node.tone ?? "plain"];
  /*
    A locked node reserves its top-right corner: the text is centred in the
    space left of the lock, so the badge can never sit on a line of text.
  */
  const contentW = rect.w - TEXT_PAD * 2 - (node.lock ? LOCK_SLOT : 0);
  const textX = rect.x + TEXT_PAD + contentW / 2;
  const lockX = rect.x + rect.w - LOCK_SLOT + 6;

  return (
    <g data-node={node.id}>
      <rect
        data-node-rect
        x={rect.x}
        y={rect.y}
        width={rect.w}
        height={rect.h}
        fill={node.hollow ? "none" : "var(--color-paper-raised)"}
        stroke={stroke}
        strokeWidth="1"
        strokeDasharray={node.hollow ? "3 3" : undefined}
      />
      <text
        data-node-text
        x={textX}
        y={node.sub ? rect.cy : rect.cy + 3.5}
        textAnchor="middle"
        className="font-mono text-[10px]"
        fill="var(--color-ink)"
      >
        {node.label}
      </text>
      {node.sub ? (
        <text
          data-node-text
          x={textX}
          y={rect.cy + 13}
          textAnchor="middle"
          className="font-mono text-[8.5px]"
          fill="var(--color-ink-faint)"
        >
          {node.sub}
        </text>
      ) : null}
      {node.lock ? (
        <g data-node-lock stroke="var(--color-ink-faint)" strokeWidth="1" fill="none">
          <rect x={lockX} y={rect.y + 9} width={7} height={5.5} />
          <path
            d={`M ${lockX + 1.75} ${rect.y + 9} v-1.5 a1.75 1.75 0 0 1 3.5 0 V ${rect.y + 9}`}
          />
        </g>
      ) : null}
    </g>
  );
}

/* ---- timeline (rate limiting) ---- */

const TL_W = 640;
const TL_H = 166;
const TL_FIRST_X = 64;
const TL_SPACING = 68;
const TL_AXIS_Y = 118;
const TL_AXIS_X0 = 34;
const TL_AXIS_X1 = 596;
const TL_SQUARE = 11;
const TL_SQUARE_TOP = 96;
const TL_CUTOFF_TOP = 56;
const TL_CUTOFF_BOTTOM = 150;

function Timeline({
  label,
  limit,
  window: windowLabel,
  requests,
  note,
}: Extract<DiagramSpec, { kind: "timeline" }>) {
  const xs = requests.map((_, index) => TL_FIRST_X + index * TL_SPACING);
  const lastX = xs[xs.length - 1];
  const allowed = Math.min(limit, requests.length);
  const hasCutoff = allowed > 0 && allowed < requests.length;
  const cutoffX = hasCutoff ? (xs[allowed - 1] + xs[allowed]) / 2 : 0;

  const ariaLabel =
    `A timeline of ${requests.length} requests in one window. ` +
    (hasCutoff
      ? `The first ${allowed} are answered with 200; the rest are refused with 429 after the counter fills.`
      : `All ${allowed} requests are answered with 200.`);

  return (
    <Frame label={label}>
      <Canvas width={TL_W} height={TL_H} ariaLabel={ariaLabel} dataKind="timeline">
        {/* The window the counter is measured over. */}
        <path
          d={`M ${TL_FIRST_X} 52 V 42 H ${lastX} V 52`}
          fill="none"
          stroke="var(--color-rule-strong)"
          strokeWidth="1"
        />
        <text
          x={(TL_FIRST_X + lastX) / 2}
          y={30}
          textAnchor="middle"
          className="font-mono text-[9.5px] tracking-[0.08em] uppercase"
          fill="var(--color-ink-faint)"
        >
          {windowLabel}
        </text>

        {/* The cutoff: past this point the allowance is spent. */}
        {hasCutoff ? (
          <>
            <line
              x1={cutoffX}
              y1={TL_CUTOFF_TOP}
              x2={cutoffX}
              y2={TL_CUTOFF_BOTTOM}
              stroke="var(--color-ink-soft)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <text
              x={cutoffX + 7}
              y={TL_CUTOFF_TOP + 12}
              className="font-mono text-[9.5px]"
              fill="var(--color-ink-soft)"
            >
              counter full · limit {limit}
            </text>
          </>
        ) : null}

        {/* Time runs left to right. */}
        <line
          x1={TL_AXIS_X0}
          y1={TL_AXIS_Y}
          x2={TL_AXIS_X1}
          y2={TL_AXIS_Y}
          stroke="var(--color-rule-strong)"
          strokeWidth="1"
        />
        <path
          d={`M ${TL_AXIS_X1 - 8} ${TL_AXIS_Y - 5} L ${TL_AXIS_X1} ${TL_AXIS_Y} L ${TL_AXIS_X1 - 8} ${TL_AXIS_Y + 5}`}
          fill="none"
          stroke="var(--color-rule-strong)"
          strokeWidth="1"
        />
        <text
          x={TL_AXIS_X1}
          y={TL_AXIS_Y + 16}
          textAnchor="end"
          className="font-mono text-[9px] tracking-[0.08em] uppercase"
          fill="var(--color-ink-faint)"
        >
          time
        </text>

        {/* Each arrival. Allowed fills a square; refused is struck through. */}
        {requests.map((request, index) => {
          const x = xs[index];
          const isAllowed = request.status === 200;
          const color = isAllowed ? "var(--color-ok)" : "var(--color-bad)";

          return (
            <g key={index}>
              <line
                x1={x}
                y1={TL_SQUARE_TOP + TL_SQUARE}
                x2={x}
                y2={TL_AXIS_Y}
                stroke={color}
                strokeWidth="1"
              />
              <rect
                x={x - TL_SQUARE / 2}
                y={TL_SQUARE_TOP}
                width={TL_SQUARE}
                height={TL_SQUARE}
                fill={isAllowed ? color : "none"}
                stroke={color}
                strokeWidth="1"
              />
              {isAllowed ? null : (
                <path
                  d={`M ${x - TL_SQUARE / 2} ${TL_SQUARE_TOP} L ${x + TL_SQUARE / 2} ${TL_SQUARE_TOP + TL_SQUARE} M ${x + TL_SQUARE / 2} ${TL_SQUARE_TOP} L ${x - TL_SQUARE / 2} ${TL_SQUARE_TOP + TL_SQUARE}`}
                  fill="none"
                  stroke={color}
                  strokeWidth="1"
                />
              )}
              <text
                x={x}
                y={TL_AXIS_Y + 20}
                textAnchor="middle"
                className="readout text-[10px]"
                fill={color}
              >
                {request.status}
              </text>
            </g>
          );
        })}
      </Canvas>
      {note ? <Note>{note}</Note> : null}
    </Frame>
  );
}
