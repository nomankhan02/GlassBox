"use client";

import { useEffect, useState } from "react";

/**
 * Whether the visitor has asked for less motion.
 *
 * This asks the same question the stylesheet does — `prefers-reduced-motion:
 * reduce`, explicitly — and it keeps asking it. Framer Motion ships a
 * `useReducedMotion` hook, but it samples the preference once at first render
 * and never updates, so a visitor who turns reduced motion on with the page
 * open keeps the animation. One explicit query, one answer, followed for as
 * long as the page is alive.
 *
 * The value arrives in an effect rather than during render, because the server
 * has no matchMedia and rendering a different tree on the first client pass
 * would be a hydration mismatch. At worst a reduced-motion visitor sees a
 * single frame of a transform before it holds still.
 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}
