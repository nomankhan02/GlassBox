"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

/*
  The glass cube: the site's one object, and the thing it is named after.

  Six faces, each a plain div placed in 3D with a translateZ, inside a parent
  that keeps the depth (`transform-style: preserve-3d`) under a perspective.
  No canvas, no WebGL and no new dependency: it is the same kind of construction
  as the diagram SVG, just in a third dimension.

  Two behaviours, both honest about reduced motion:

    track  small, beside the wordmark in the header. The cursor's position
           relative to the cube is mapped into a clamped rotation and eased
           toward, so it tilts to follow and drifts back to rest when the
           pointer leaves. Under prefers-reduced-motion it holds its resting
           angle and never listens to the pointer at all.
    spin   large, in the homepage hero. One slow turn every 26 seconds. Under
           prefers-reduced-motion it holds still.

  The reduced-motion check uses the same framer-motion `useReducedMotion` hook
  the register and the demos already use for their panel-open animations, so a
  visitor who has asked for less motion gets it from every animated part of the
  site by the same rule.
*/

/** The resting angle. Turned enough that three faces read as a cube. */
const REST_X = -8;
const REST_Y = -24;

type GlassCubeProps = {
  /** Edge length, in pixels. */
  size: number;
  /** "track" follows the cursor, "spin" turns on its own. */
  behavior?: "track" | "spin";
  /** Maximum tilt, in degrees, when tracking. Clamped below 24. */
  tilt?: number;
  /** Distance in pixels over which cursor tracking fades to neutral. */
  reach?: number;
  /** Apply the glass backdrop blur. Left off for the large background cube. */
  blur?: boolean;
  className?: string;
};

export function GlassCube({
  size,
  behavior = "track",
  tilt = 10,
  reach = 240,
  blur = true,
  className,
}: GlassCubeProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const half = size / 2;
  const tracking = behavior === "track" && !reduceMotion;
  const spinning = behavior === "spin" && !reduceMotion;

  useEffect(() => {
    const inner = innerRef.current;
    const wrap = wrapRef.current;
    if (!tracking || !inner || !wrap) return;

    const max = Math.min(tilt, 24);
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;
    let frame = 0;

    /* Ease toward the target rather than snapping to it. */
    const render = () => {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      inner.style.transform = `rotateX(${(REST_X + currentX).toFixed(3)}deg) rotateY(${(REST_Y + currentY).toFixed(3)}deg)`;
      if (Math.abs(targetX - currentX) > 0.02 || Math.abs(targetY - currentY) > 0.02) {
        frame = requestAnimationFrame(render);
      } else {
        frame = 0;
      }
    };

    const kick = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };

    const onMove = (event: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy);
      const influence = Math.max(0, 1 - distance / reach);
      const nx = Math.max(-1, Math.min(1, dx / reach));
      const ny = Math.max(-1, Math.min(1, dy / reach));
      targetY = nx * max * influence;
      targetX = -ny * max * influence;
      kick();
    };

    /* Pointer gone: settle back to the resting angle. */
    const onLeave = () => {
      targetX = 0;
      targetY = 0;
      kick();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [tracking, tilt, reach]);

  const faces = [
    { key: "front", transform: `translateZ(${half}px)` },
    { key: "back", transform: `rotateY(180deg) translateZ(${half}px)` },
    { key: "right", transform: `rotateY(90deg) translateZ(${half}px)` },
    { key: "left", transform: `rotateY(-90deg) translateZ(${half}px)` },
    { key: "top", transform: `rotateX(90deg) translateZ(${half}px)` },
    { key: "bottom", transform: `rotateX(-90deg) translateZ(${half}px)` },
  ];

  return (
    <div
      ref={wrapRef}
      aria-hidden
      data-glass-cube={behavior}
      className={className}
      style={{ width: size, height: size, perspective: `${size * 2}px` }}
    >
      <div
        ref={innerRef}
        className={spinning ? "cube-spin" : undefined}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          /* The resting angle is always the base transform. When the spin
             animation runs it overrides this (animations win over inline
             style); when motion is reduced and the animation is switched off
             by CSS, this is what holds the cube still — an angled cube rather
             than a flat square. */
          transform: `rotateX(${REST_X}deg) rotateY(${REST_Y}deg)`,
        }}
      >
        {faces.map((face) => (
          <span
            key={face.key}
            className={blur ? "glass-face glass-blur" : "glass-face"}
            style={{ transform: face.transform }}
          />
        ))}
      </div>
    </div>
  );
}
