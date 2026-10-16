"use client";

import { motion, useSpring } from "framer-motion";
import { useEffect, useId, useRef } from "react";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

/*
  The glass cube: the site's one object, and the thing it is named after.

  It is drawn, not modelled. An isometric line construction — a hexagonal
  silhouette, three visible faces, three interior edges — in exactly the
  register the concept diagrams use: the same 1px hairline stroke, kept at one
  device pixel at any size with `vector-effect: non-scaling-stroke`, over the
  same neutral ink. Structure is drawn in line; the glass is three soft
  translucent gradient fills, brought to life by one slow specular highlight
  that sweeps across the faces and off again.

  This replaces an earlier literal CSS 3D construction (six faces under a
  perspective). That version read as a live 3D object being operated, which is
  the feeling this pass moves away from: the cube is a drawing in a notebook
  margin, and what makes it read as glass is the highlight travelling over it,
  not transparency maths.

  Two behaviours, one component:

    float  large, in the homepage hero. A slow breathing loop — a small scale
           and translateY oscillation over five seconds — plus the highlight
           sweep. It never spins.
    track  small, beside the wordmark in the header. Framer Motion pointer
           tracking through springs, so it follows the cursor with an elastic
           lag and settles back to rest when the pointer leaves: grabbed, not
           snapping.

  Under prefers-reduced-motion both hold a static pose: no float, no cursor
  tracking, and the highlight rests rather than sweeping. The check is the
  site's own reduced-motion hook, which asks the explicit query the stylesheet
  also uses, so the drawing and the rest of the site agree on the answer.
*/

/* ---- geometry ---- */
/*
  One drawing unit system, on a 2:1 isometric. The hexagon is the cube's
  silhouette; the three faces meet at C, and the interior edges run from C to
  each of the three upper silhouette corners — the standard construction, and
  the reason the drawing reads as a cube rather than a box of lines.
*/
const VIEW = { w: 100, h: 110 };

/** Top face, left face, right face. */
const FACE_TOP = "50,4 88,26 50,48 12,26";
const FACE_LEFT = "12,26 50,48 50,104 12,82";
const FACE_RIGHT = "50,48 88,26 88,82 50,104";
/** The silhouette, drawn once on top of the fills. */
const SILHOUETTE = "50,4 88,26 88,82 50,104 12,82 12,26";
/** The three interior edges, all meeting at the front corner C. */
const EDGES: [number, number, number, number][] = [
  [88, 26, 50, 48],
  [50, 48, 12, 26],
  [50, 48, 50, 104],
];

/** Stroke: the diagram hairline, never scaled with the drawing. */
const HAIRLINE = 1;

/** Fill gradients, one per face: the top catches the most light. */
const FILLS = {
  top: { from: "var(--color-paper)", fromOpacity: 0.96, to: "var(--color-accent-tint)", toOpacity: 0.6 },
  left: { from: "var(--color-accent-tint)", fromOpacity: 0.52, to: "var(--color-accent-tint)", toOpacity: 0.14 },
  right: { from: "var(--color-accent-tint)", fromOpacity: 0.72, to: "var(--color-accent-tint)", toOpacity: 0.3 },
} as const;

type GlassCubeProps = {
  /** Width of the drawing in pixels. The box is slightly taller than wide. */
  size: number;
  /** "float" breathes in place; "track" is dragged by the cursor. */
  behavior?: "float" | "track";
  className?: string;
};

export function GlassCube({ size, behavior = "float", className }: GlassCubeProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  /*
    Cursor tracking. Targets are set from the pointer's offset from the cube's
    centre and the springs carry the element to them, so the lag in the follow
    is real physics rather than an easing curve. The same values drive the
    position and a small rotation, which is what makes it read as picked up and
    tilted rather than slid.
  */
  const maxShift = Math.max(3, size * 0.14);
  const maxTilt = 8;

  const offsetX = useSpring(0, { stiffness: 150, damping: 15, mass: 0.45 });
  const offsetY = useSpring(0, { stiffness: 150, damping: 16, mass: 0.45 });
  const tilt = useSpring(0, { stiffness: 120, damping: 14, mass: 0.5 });

  const tracking = behavior === "track" && !reduceMotion;

  useEffect(() => {
    if (!tracking) return;
    const wrap = wrapRef.current;
    if (!wrap) return;

    const onMove = (event: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      /* Within one cube-width the pull is at full strength; past it, it fades. */
      const reach = Math.max(140, size * 8);
      const pull = Math.max(0, 1 - Math.hypot(dx, dy) / reach);
      const nx = Math.max(-1, Math.min(1, dx / (reach * 0.6)));
      const ny = Math.max(-1, Math.min(1, dy / (reach * 0.6)));
      offsetX.set(nx * maxShift * pull * 2);
      offsetY.set(ny * maxShift * pull * 1.6);
      tilt.set(nx * maxTilt * pull * 2);
    };

    /* Pointer gone: let the springs carry it back to rest. */
    const onLeave = () => {
      offsetX.set(0);
      offsetY.set(0);
      tilt.set(0);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, [tracking, size, maxShift, offsetX, offsetY, tilt]);

  const height = size * (VIEW.h / VIEW.w);
  /* Room for the drag and the tilt, so nothing ever clips the drawing. */
  const pad = Math.min(20, Math.max(5, size * 0.17));

  /* Under reduced motion there is no style object at all: the cube is a drawing. */
  const drag = tracking ? { x: offsetX, y: offsetY, rotate: tilt } : undefined;

  return (
    <div
      ref={wrapRef}
      aria-hidden
      data-glass-cube={behavior}
      className={className}
      style={{
        width: size + pad * 2,
        height: height + pad * 2,
        overflow: "visible",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <motion.div
        style={{ width: size, height, overflow: "visible", ...drag }}
        animate={
          behavior === "float" && !reduceMotion
            ? { y: [0, -7, 0], scale: [1, 1.015, 1] }
            : undefined
        }
        transition={
          behavior === "float" && !reduceMotion
            ? { duration: 5.2, ease: "easeInOut", repeat: Infinity }
            : undefined
        }
      >
        <svg
          viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
          width={size}
          height={height}
          className="block"
        >
          <defs>
            <linearGradient id={`${uid}-top`} x1="0" y1="0" x2="0.7" y2="1">
              <stop offset="0" stopColor={FILLS.top.from} stopOpacity={FILLS.top.fromOpacity} />
              <stop offset="1" stopColor={FILLS.top.to} stopOpacity={FILLS.top.toOpacity} />
            </linearGradient>
            <linearGradient id={`${uid}-left`} x1="0" y1="0" x2="1" y2="0.8">
              <stop offset="0" stopColor={FILLS.left.from} stopOpacity={FILLS.left.fromOpacity} />
              <stop offset="1" stopColor={FILLS.left.to} stopOpacity={FILLS.left.toOpacity} />
            </linearGradient>
            <linearGradient id={`${uid}-right`} x1="0.2" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={FILLS.right.from} stopOpacity={FILLS.right.fromOpacity} />
              <stop offset="1" stopColor={FILLS.right.to} stopOpacity={FILLS.right.toOpacity} />
            </linearGradient>

            {/* The highlight itself: white, feathered to nothing at both ends. */}
            <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.85" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>

            <clipPath id={`${uid}-clip`}>
              <polygon points={FACE_TOP} />
              <polygon points={FACE_LEFT} />
              <polygon points={FACE_RIGHT} />
            </clipPath>
          </defs>

          {/* Faces: soft translucent fills, no visible edges of their own. */}
          <g>
            <polygon points={FACE_TOP} fill={`url(#${uid}-top)`} />
            <polygon points={FACE_LEFT} fill={`url(#${uid}-left)`} />
            <polygon points={FACE_RIGHT} fill={`url(#${uid}-right)`} />
          </g>

          {/*
            The sweep. A wide feathered band travels across the faces and off
            the far side, then waits before the next pass — a reflection moving
            over a surface, not a pulse. It is clipped to the faces, so it can
            never light up the page around the cube.
          */}
          <g clipPath={`url(#${uid}-clip)`}>
            {reduceMotion ? (
              /*
                Reduced motion: the highlight rests where a sweep would have
                caught the light — one static sheen across the left face and
                the front corner — rather than travelling or disappearing.
              */
              <g data-glass-sheen="rest" opacity="0.5">
                <rect
                  x="16"
                  y="-30"
                  width="30"
                  height="176"
                  fill={`url(#${uid}-sheen)`}
                  transform="rotate(20 50 55)"
                />
              </g>
            ) : (
              <motion.g
                data-glass-sheen="sweep"
                animate={{ x: [-78, -30, 52, 104], opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: 6.6,
                  times: [0, 0.16, 0.62, 0.8],
                  repeat: Infinity,
                  repeatDelay: 1.4,
                  ease: "easeInOut",
                }}
              >
                <rect
                  x="-24"
                  y="-30"
                  width="30"
                  height="176"
                  fill={`url(#${uid}-sheen)`}
                  transform="rotate(20 50 55)"
                />
              </motion.g>
            )}
          </g>

          {/* Structure: the same hairline the diagrams are drawn in. */}
          <g
            fill="none"
            stroke="var(--color-rule-strong)"
            strokeWidth={HAIRLINE}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          >
            {EDGES.map(([x1, y1, x2, y2]) => (
              <line key={`${x1}-${y1}-${x2}-${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} />
            ))}
          </g>

          <polygon
            points={SILHOUETTE}
            fill="none"
            stroke="var(--color-ink)"
            strokeOpacity="0.72"
            strokeWidth={HAIRLINE}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        </svg>
      </motion.div>
    </div>
  );
}
