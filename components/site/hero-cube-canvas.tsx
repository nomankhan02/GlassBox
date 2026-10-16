"use client";

import { Environment, MeshTransmissionMaterial } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Component,
  Suspense,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { Color, FrontSide, type Group } from "three";

/*
  The live hero cube: a real box, refracted.

  This is the object the site is named after, so it had better be glass all the
  way through rather than a picture of glass. One box geometry, one
  MeshTransmissionMaterial, and three.js doing the refraction — you can see the
  far faces through the near ones, and the light bending at the edges, because
  the renderer is actually tracing it.

  Kept deliberately small, because the technique is expensive and the hero is
  the first thing anybody loads:

    - the transmission buffer is 32x32, four samples. The material does not
      refract at full resolution: it refracts a small, blurred copy of the scene
      and samples it, so the buffer's size buys sharpness inside the glass and
      costs frame time. drei's own guidance is that 32x32 still reads as glass
      and runs far faster, which is the trade this hero wants. Nothing here is a
      window anyone reads through.
    - the canvas runs at devicePixelRatio clamped to 1.5 rather than the 3 a
      phone reports, for the same reason.
    - antialiasing stays on. It is the one cheap thing that keeps the cube's
      silhouette from crawling, and the buffer is far too small to pay for
      smoothness anywhere else.
    - the material's own extra render passes (see `background` below) happen
      once per frame and are drawn from the same small buffer.

  The scene is lit the way a studio is: one soft key from above and in front,
  a cool fill from behind, a dim bounce from below, and drei's studio
  environment preset doing the broad, even wrap that makes a glass object look
  like glass at all. The preset streams an HDR from drei's asset CDN, so the
  lights are not decoration — if that request never arrives, they carry the cube
  on their own. See the error boundary around it.

  Rotation is a continuous half a radian a minute, give or take: slow enough
  that you never catch it turning, which is how the object in the reference
  reads. Nothing here reacts to the pointer. That is the header mark's job.

  Under prefers-reduced-motion the rotation is dropped and the cube is left
  standing at an angle — still rendered, still glass, simply still. The frame
  loop does drop to on-demand there, since repainting a frozen object sixty
  times a second is work nobody asked for; a few nudged frames at the start
  make sure anything that arrives late (the environment HDR, mainly) still gets
  drawn. See <Settle />.
*/

/** One full turn, in seconds. Slow enough to read as an object, not a spinner. */
const TURN_SECONDS = 30;

/**
 * The ground the cube stands on: the same near-black as --color-void in
 * globals.css, duplicated here because the scene and the material need it as a
 * value rather than as a CSS custom property. The canvas is opaque and paints
 * this itself, so the field around the cube and the field the glass refracts
 * are the same colour, and the black of the canvas meets the black of the hero
 * with nothing to give it away. (See `flat` below: tone mapping is what would
 * make those two blacks disagree.)
 */
const VOID = new Color("#05070b");

/**
 * The transmission buffers. Small on purpose — see the note at the top of this
 * file. These are the difference between a hero that runs on a mid-range phone
 * and one that does not.
 *
 * The backside buffer is the second one, and it is the reason the cube has an
 * inside. Without it the refraction samples an empty scene — the cube itself is
 * removed from its own transmission buffer, so there would be nothing in there
 * but the background — and the glass reads as a dark box with lit edges rather
 * than as something you can see the far side of. With it, the far faces are
 * rendered once into a small buffer and refracted through the near ones, which
 * is the structure the reference has. It costs one more pass over twelve
 * triangles into a 64px buffer: real, small, and worth it.
 */
const BUFFER = 32;
const BACKSIDE_BUFFER = 64;
const SAMPLES = 4;

/**
 * If the studio environment never loads — no network, a blocked CDN — the cube
 * should still be lit and the page should still work, so a failure inside this
 * subtree renders nothing instead of propagating up and taking the canvas with
 * it.
 */
class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Studio light, in four sources. Broad and dim rather than one bright key: a
 * hard light on a glass box just puts a hard hot spot on one face, and the
 * reference is all soft sheen and lit edges.
 */
function StudioLighting() {
  return (
    <>
      <hemisphereLight args={["#e4edf7", VOID, 0.7]} />
      <directionalLight position={[4.5, 6, 4.5]} intensity={3.4} />
      <directionalLight
        position={[-5.5, 1.5, -4]}
        intensity={1.8}
        color="#9db9dd"
      />
      <pointLight
        position={[0, -3.4, -3]}
        intensity={16}
        color="#6f8fc4"
        distance={12}
        decay={2}
      />
    </>
  );
}

/**
 * The box. Tuned against design-reference/hero-inspo.png: clear rather than
 * frosted (low roughness), a little thicker than the glass it looks like
 * (thickness carries the edge light), and chromatic aberration pushed well past
 * drei's default of 0.05 — the reference's sign that this is refraction and not
 * a transparent solid is the colour fringing along every edge, and at 0.05 you
 * cannot see it at all. Measured against the reference, 0.05 puts the strongest
 * fringe in the frame at a chroma of 32/255 where the reference's is 148; 2.0
 * overshoots it at 200; 1.2 lands beside it.
 *
 * `background` is what the refraction samples behind the cube. Left unset, the
 * buffer would be transparent and the glass would refract nothing; set to the
 * void, the glass refracts the dark field it is standing in, which is what makes
 * the interior of the cube read as depth rather than as an empty outline.
 */
function GlassBox({ frozen }: { frozen: boolean }) {
  const pivot = useRef<Group>(null);

  useFrame((_, delta) => {
    if (frozen) return;
    const group = pivot.current;
    if (!group) return;
    group.rotation.y += (delta * Math.PI * 2) / TURN_SECONDS;
  });

  return (
    /* Tilted on two axes so three faces are visible from the start: a cube seen
       square-on is a square. */
    <group ref={pivot} rotation={[0.34, 0.62, 0.05]}>
      <mesh>
        <boxGeometry args={[1.5, 1.5, 1.5]} />
        <MeshTransmissionMaterial
          samples={SAMPLES}
          resolution={BUFFER}
          backside
          backsideResolution={BACKSIDE_BUFFER}
          backsideThickness={1.4}
          backsideEnvMapIntensity={1.2}
          transmission={1}
          thickness={1.4}
          roughness={0.05}
          ior={1.45}
          chromaticAberration={1.2}
          anisotropy={0.12}
          distortion={0.1}
          distortionScale={0.2}
          temporalDistortion={0.05}
          attenuationDistance={6}
          attenuationColor="#dbe7f2"
          envMapIntensity={2.4}
          background={VOID}
          color="#eaf1f8"
          side={FrontSide}
        />
      </mesh>
    </group>
  );
}

/**
 * Under reduced motion the loop runs on demand, so this nudges a handful of
 * frames over the first couple of seconds. Without it, anything that resolves
 * after the first draw — the environment HDR, mostly — would never appear, and
 * the cube would be lit by the plain lights and nothing else.
 */
function Settle() {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const timers = [0, 120, 320, 700, 1400, 2600].map((ms) =>
      window.setTimeout(invalidate, ms),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [invalidate]);

  return null;
}

export default function HeroCubeCanvas({ frozen }: { frozen: boolean }) {
  return (
    <Canvas
      data-hero-cube-scene
      dpr={[1, 1.5]}
      frameloop={frozen ? "demand" : "always"}
      /* Far enough back that the cube has dark field around it rather than
         filling the frame — the reference's cube sits in a room, not in a crop. */
      camera={{ position: [0, 0, 5.6], fov: 32 }}
      gl={{
        antialias: true,
        /* Asked for, and worth knowing it is not what makes the canvas opaque:
           three builds the context with alpha true whatever you pass and uses
           this only for the clear alpha it would use with no background. The
           opacity here is the scene's own background colour, below. */
        alpha: false,
        powerPreference: "high-performance",
      }}
      /*
        No tone mapping, on purpose, and this is the one place it is worth
        arguing for. A filmic curve is built for a photograph: it rolls
        highlights off towards white so nothing clips. Two things here are not
        photographs. The field is a flat colour that has to match the colour on
        the page around it exactly — through ACES the same hex comes out a few
        levels darker than the CSS beside it, which is a visible edge on a large
        flat area. And the reference's cube is not soft at its edges: it has
        blown-out white highlights and colour fringes that are supposed to clip.
        Straight through, the canvas draws the colour it was given and the
        highlights go where they like.
      */
      flat
      className="h-full w-full"
    >
      <color attach="background" args={[VOID]} />
      <StudioLighting />

      {/* The environment is its own boundary, inside a boundary, because the
          preset is a network request and a hero is not allowed to fail because
          somebody else's CDN is having a bad afternoon. */}
      <Quiet>
        <Suspense fallback={null}>
          <Environment preset="studio" environmentIntensity={2.2} />
        </Suspense>
      </Quiet>

      <GlassBox frozen={frozen} />
      {frozen ? <Settle /> : null}
    </Canvas>
  );
}
