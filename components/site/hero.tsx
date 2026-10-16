"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Masthead } from "./masthead";
import { GlassCube } from "./glass-cube";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

/*
  The homepage hero: one full viewport, and almost nothing in it. The wordmark
  at the top, the cube — the object the site is named after — at the centre, and
  two lines beside it that say what the site is and invite the scroll.

  The exit is a drawer, not a cutoff. Scroll progress is read from this section
  only, and the whole composition translates up and fades out as it passes, so
  the hero leaves the way a page turns rather than being clipped off the top.
  Under prefers-reduced-motion the translate is dropped entirely and only the
  opacity crossfades: the same departure, without the movement.
*/
export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  /*
    The fade is derived from the same motion value as the travel rather than
    from the scroll progress independently: two outputs of one driver always
    agree about where the drawer is, which is the whole point of an exit that
    reads as one movement.
  */
  const y = useTransform(scrollYProgress, [0, 1], [0, -170]);
  const opacity = useTransform(y, [-158, -18], [0, 1]);

  return (
    <section
      ref={sectionRef}
      data-hero
      className="relative flex min-h-svh flex-col overflow-hidden"
    >
      <motion.div
        data-hero-drawer
        style={reduceMotion ? { opacity } : { y, opacity }}
        className="flex min-h-svh flex-1 flex-col"
      >
        <Masthead tagline={false} />

        <div className="grid flex-1 items-center gap-x-12 gap-y-8 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)] xl:gap-x-16">
          {/*
            The cube is decoration, so it never takes a click: pointer-events
            are off, and the layer stays aria-hidden inside the component. The
            scale is clamped against the smaller viewport dimension, because a
            short window (a 1280x700 laptop) would otherwise crop a cube this
            large before the drawer had even started moving.
          */}
          <div className="pointer-events-none order-last flex justify-center lg:order-none lg:justify-start">
            <div className="scale-[clamp(0.42,0.75vmin,1)]">
              <GlassCube size={560} behavior="float" />
            </div>
          </div>

          <div className="max-w-[34ch]">
            <p className="text-[15px] leading-[1.7] text-ink-soft">
              You can see straight into it and still not be able to tell which
              part is doing the work. That is most apps built with a prompt.
            </p>
            <p className="mt-4 text-[13.5px] leading-[1.7] text-ink-faint">
              This site is the inside of that object, in three layers: the bench
              you set up before building, the mechanism underneath a running app,
              and the record of building this one.
            </p>
            <p className="field-label mt-6">scroll · begin at layer 00</p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
