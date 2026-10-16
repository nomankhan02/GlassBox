"use client";

import dynamic from "next/dynamic";
import {
  Component,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

/*
  The hero's glass cube, and the two ways it can fail.

  What is drawn here is a still: a single image of this same cube, sitting
  underneath everything else and mounted from the first render. It is not a
  poster frame for the live cube so much as the cube's floor — the thing that
  holds the shape while the renderer arrives, and the thing that stays if the
  renderer never does. It is a plain <img> on purpose (see the note on it), so it
  needs no JavaScript, no image optimizer and no second request to be there.

  Over the top of that, when — and only when — the browser can actually run it,
  the live cube is mounted. Two gates, checked in this order:

    WebGL. Asked explicitly, with canvas.getContext, before anything
    three.js-shaped is even fetched. The canvas component is behind a dynamic
    import, so a browser that fails this check never downloads a renderer it
    cannot run. (That is also why this file is a client component and the scene
    is a separate one: the question cannot be asked on the server.)

    Reduced motion. Handled inside the scene rather than here: the cube keeps
    rendering, it simply stops turning. Freezing the rotation is the request;
    stopping the render would take the object away instead of steadying it.

  And a third path that is not a gate but a seatbelt: if three.js throws for any
  reason at all — a lost context, a driver, a shader this device cannot compile —
  the error boundary below drops the canvas and leaves the still standing.

  Nothing here takes a click. The cube is scenery.
*/

const HeroCubeCanvas = dynamic(() => import("./hero-cube-canvas"), {
  ssr: false,
});

/**
 * What the hero is showing: the live cube, or the still standing in for it.
 * There is no third state, and that is the point — until the browser has
 * answered the WebGL question the still is what is on screen, which is exactly
 * what a browser that cannot run the cube gets.
 */
type CubeState = "live" | "still";

/**
 * Whether this browser will hand out a WebGL context at all. Asked directly
 * rather than inferred from a later failure, because the answer decides whether
 * we fetch a few hundred kilobytes of renderer in the first place, and because
 * there is a browser somewhere with a canvas that creates a context and still
 * cannot draw the first frame — for that one, the boundary below is the answer.
 */
function probeWebGL(): boolean {
  try {
    const probe = document.createElement("canvas");
    const context = probe.getContext("webgl2") ?? probe.getContext("webgl");
    if (!context) return false;
    /* Hand the context straight back: a check should not hold a GPU slot. */
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * The answer, asked once. A browser does not grow a WebGL context while the page
 * is open, so the probe result is the same for every render — which is what
 * makes it legal to hand to useSyncExternalStore, whose snapshot must be stable.
 */
let probeResult: boolean | null = null;

function webglAvailable(): boolean {
  probeResult ??= probeWebGL();
  return probeResult;
}

/* Nothing to subscribe to: the answer never changes. */
const subscribeToNothing = () => () => {};

/**
 * The seatbelt. Inside, the scene; outside, nothing, so whatever was covering
 * the still is simply gone and the still is what is left.
 */
class CubeBoundary extends Component<
  { onFail: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFail();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function HeroCube() {
  const reduceMotion = usePrefersReducedMotion();
  const [failed, setFailed] = useState(false);

  /*
    The two snapshots are the whole trick. The server cannot ask a browser
    anything, and asking during the first client render would disagree with the
    HTML that was already sent, so the server's answer — and so the answer React
    uses while hydrating — is the still. Once past hydration React asks the
    browser for itself, and a machine with WebGL swaps the live cube in without
    an effect, without a second render's worth of layout shift, and without a
    state update on mount.
  */
  const supported = useSyncExternalStore(
    subscribeToNothing,
    webglAvailable,
    () => false,
  );
  const state: CubeState = supported && !failed ? "live" : "still";

  return (
    <div
      /* The rendered state, in the DOM, so it can be checked from outside
         without reading a single line of this component's mind. */
      data-hero-cube={state}
      aria-hidden
      className="relative aspect-square w-[clamp(210px,74vw,33rem)]"
    >
      {/*
        The still, and the reason it is not a next/image: this is fallback
        content. It has to be one eager, plain request that lands wherever the
        rest of the fallback lands, not something routed through an optimizer or
        deferred by a lazy loader — and it is above the fold, so it is exactly
        the image a lazy loader would get wrong.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        data-hero-cube-still
        src="/hero-cube.png"
        alt=""
        width={1056}
        height={1056}
        decoding="async"
        className="absolute inset-0 h-full w-full object-contain"
      />

      {state === "live" ? (
        <CubeBoundary onFail={() => setFailed(true)}>
          <div className="absolute inset-0">
            <HeroCubeCanvas frozen={reduceMotion} />
          </div>
        </CubeBoundary>
      ) : null}
    </div>
  );
}
