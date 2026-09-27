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

const PAD_X = 14;
const PAD_Y = 24;
const BOX_W = 112;
const BOX_H = 42;
const COL_GAP = 46;
const ROW_GAP = 34;
const COL_W = BOX_W + COL_GAP;
const ROW_H = BOX_H + ROW_GAP;
/** Perpendicular offset of one lane, so parallel arrows do not overlap. */
const LANE_STEP = 13;
/** Rough advance width of a 9.5px mono glyph, for sizing the label mask. */
const LABEL_CHAR = 5.6;

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

type Rect = { x: number; y: number; w: number; h: number; cx: number; cy: number };
type Pt = { x: number; y: number };

function rectOf(node: DiagramNode): Rect {
  const x = PAD_X + node.col * COL_W;
  const y = PAD_Y + node.row * ROW_H;
  return { x, y, w: BOX_W, h: BOX_H, cx: x + BOX_W / 2, cy: y + BOX_H / 2 };
}

/** Where a line from `from`'s centre toward `to`'s centre leaves the box. */
function edgePoint(from: Rect, to: Rect): Pt {
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;
  const sx = dx !== 0 ? from.w / 2 / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? from.h / 2 / Math.abs(dy) : Infinity;
  const scale = Math.min(sx, sy);
  return { x: from.cx + dx * scale, y: from.cy + dy * scale };
}

/**
 * Unit perpendicular, normalised so lane offsets mean the same thing whichever
 * way the arrow points: left-to-right is the reference direction.
 */
function perpendicular(from: Rect, to: Rect): Pt {
  let ux = to.cx - from.cx;
  let uy = to.cy - from.cy;
  const len = Math.hypot(ux, uy) || 1;
  ux /= len;
  uy /= len;
  if (ux < 0 || (ux === 0 && uy < 0)) {
    ux = -ux;
    uy = -uy;
  }
  return { x: -uy, y: ux };
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
  children,
}: {
  width: number;
  height: number;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 overflow-x-auto pb-1" tabIndex={0}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
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

function Flow({
  label,
  nodes,
  arrows,
  boundary,
  note,
}: Extract<DiagramSpec, { kind: "flow" }>) {
  if (nodes.length === 0) return null;

  const rects = new Map(nodes.map((node) => [node.id, rectOf(node)]));
  const maxCol = Math.max(...nodes.map((node) => node.col));
  const maxRow = Math.max(...nodes.map((node) => node.row));
  const width = PAD_X * 2 + maxCol * COL_W + BOX_W;
  /* A boundary carries its name underneath the boxes, so it gets a footer. */
  const height =
    PAD_Y * 2 + maxRow * ROW_H + BOX_H + (boundary ? 20 : 0);

  const boundaryX = boundary
    ? PAD_X + boundary.afterCol * COL_W + BOX_W + COL_GAP / 2
    : null;

  const ariaLabel =
    `${label}. ` +
    nodes.map((node) => node.sub ? `${node.label}, ${node.sub}` : node.label).join("; ") +
    ".";

  return (
    <Frame label={label}>
      <Canvas width={width} height={height} ariaLabel={ariaLabel}>
        {boundary && boundaryX !== null ? (
          <BoundaryLine boundary={boundary} x={boundaryX} height={height} />
        ) : null}

        {arrows
          .filter((arrow) => rects.has(arrow.from) && rects.has(arrow.to))
          .map((arrow, index) => (
            <Arrow
              key={`${arrow.from}-${arrow.to}-${index}`}
              arrow={arrow}
              from={rects.get(arrow.from)!}
              to={rects.get(arrow.to)!}
              boundaryX={boundaryX}
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
  height,
}: {
  boundary: DiagramBoundary;
  x: number;
  height: number;
}) {
  return (
    <g>
      <line
        x1={x}
        y1={12}
        x2={x}
        y2={height - 22}
        stroke="var(--color-rule-strong)"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      <text
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
  arrow,
  from,
  to,
  boundaryX,
}: {
  arrow: DiagramArrow;
  from: Rect;
  to: Rect;
  boundaryX: number | null;
}) {
  const tone: Tone = arrow.tone ?? (arrow.blocked ? "bad" : "plain");
  const stroke = STROKE_TONE[tone];

  const perp = perpendicular(from, to);
  const offset = (arrow.lane ?? 0) * LANE_STEP;
  const startEdge = edgePoint(from, to);
  const endEdge = edgePoint(to, from);
  const start: Pt = {
    x: startEdge.x + perp.x * offset,
    y: startEdge.y + perp.y * offset,
  };
  let end: Pt = {
    x: endEdge.x + perp.x * offset,
    y: endEdge.y + perp.y * offset,
  };

  /* A blocked arrow that crosses a boundary stops at the line, not the box. */
  if (arrow.blocked && boundaryX !== null) {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    if (boundaryX > minX && boundaryX < maxX && end.x !== start.x) {
      const t = (boundaryX - start.x) / (end.x - start.x);
      end = { x: boundaryX, y: start.y + (end.y - start.y) * t };
    }
  }

  /*
    A label never sits over a box. Between two boxes on the same row the gap is
    only wide enough for a short word, so labels go above the row — or below it,
    for the return half of a pair, which keeps the two readings apart. On any
    other line there is room beside the stroke, so the label rides next to it.
  */
  const horizontal = Math.abs(from.cy - to.cy) < 1;
  const lane = arrow.lane ?? 0;
  const mid: Pt = horizontal
    ? {
        x: (start.x + end.x) / 2,
        y: lane > 0 ? from.y + BOX_H + 12 : from.y - 7,
      }
    : (() => {
        /* A blocked arrow reads from the side it came from, before the bar. */
        const side = arrow.blocked ? -13 : 13;
        return {
          x: (start.x + end.x) / 2 + perp.x * side,
          y: (start.y + end.y) / 2 + perp.y * side,
        };
      })();

  const maskWidth = arrow.label ? arrow.label.length * LABEL_CHAR + 8 : 0;

  return (
    <g>
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={stroke}
        strokeWidth="1"
        strokeDasharray={arrow.blocked ? "3 3" : undefined}
      />

      {arrow.blocked ? (
        <StopBar at={end} from={start} stroke={stroke} />
      ) : (
        <ArrowHead tip={end} from={start} stroke={stroke} />
      )}
      {arrow.both && !arrow.blocked ? (
        <ArrowHead tip={start} from={end} stroke={stroke} />
      ) : null}

      {arrow.label ? (
        <>
          <rect
            x={mid.x - maskWidth / 2}
            y={mid.y - 9}
            width={maskWidth}
            height={11}
            fill="var(--color-paper)"
          />
          <text
            x={mid.x}
            y={mid.y}
            textAnchor="middle"
            className="font-mono text-[9.5px]"
            fill={TEXT_TONE[tone]}
          >
            {arrow.label}
          </text>
        </>
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
  return (
    <g>
      <rect
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
        x={rect.cx}
        y={node.sub ? rect.cy : rect.cy + 3.5}
        textAnchor="middle"
        className="font-mono text-[10px]"
        fill="var(--color-ink)"
      >
        {node.label}
      </text>
      {node.sub ? (
        <text
          x={rect.cx}
          y={rect.cy + 13}
          textAnchor="middle"
          className="font-mono text-[8.5px]"
          fill="var(--color-ink-faint)"
        >
          {node.sub}
        </text>
      ) : null}
      {node.lock ? (
        <g stroke="var(--color-ink-faint)" strokeWidth="1" fill="none">
          <rect x={rect.x + rect.w - 17} y={rect.y + 9} width={7} height={5.5} />
          <path
            d={`M ${rect.x + rect.w - 15.25} ${rect.y + 9} v-1.5 a1.75 1.75 0 0 1 3.5 0 V ${rect.y + 9}`}
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
      <Canvas width={TL_W} height={TL_H} ariaLabel={ariaLabel}>
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
