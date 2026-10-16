"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Masthead } from "./masthead";
import { HeroCube } from "./hero-cube";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

/*
  The homepage hero: one full viewport, and almost nothing in it. The wordmark
  at the top, the cube — the object the site is named after — beside it, and two
  lines that say what the site is and invite the scroll.

  It is the one dark ground on the site, and the only place this palette
  applies: the cube is glass, and glass reads as glass by refracting something,
  so it needs a dark field to stand in. Everything below the fold is still the
  white page. The `on-dark` utility re-points the site's own colour tokens for
  this subtree, so the masthead, the rules and the labels here are the same
  components in the same voices, only lit from the other side.

  This section is also the one composition that escapes the site's measure — it
  spans the viewport while everything inside it is aligned to the same 1280px
  column as every other page. That is arranged one level up: the homepage
  renders the hero outside the measure wrapper and its content inside it, which
  is why the black reaches the screen edges and the wordmark still lines up with
  the wordmark on the concepts page.

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
      className="on-dark relative flex min-h-svh flex-col overflow-hidden bg-void"
    >
      <motion.div
        data-hero-drawer
        style={reduceMotion ? { opacity } : { y, opacity }}
        className="flex min-h-svh flex-1 flex-col"
      >
        {/* The measure: the same column every other page sits in, so the
            wordmark here lines up with the wordmark there. */}
        <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col px-3.5 sm:px-5 md:px-6 lg:px-7">
          <Masthead tagline={false} />

          <div className="grid flex-1 items-center gap-x-12 gap-y-8 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)] xl:gap-x-16">
            {/* The cube is decoration and never takes a click: pointer-events
                are off, and the component keeps its own layer aria-hidden. */}
            <div className="pointer-events-none order-last flex justify-center lg:order-none lg:justify-start">
              <HeroCube />
            </div>

            <div className="max-w-[34ch]">
              <p className="text-[15px] leading-[1.7] text-ink-soft">
                You can see straight into it and still not be able to tell which
                part is doing the work. That is most apps built with a prompt.
              </p>
              <p className="mt-4 text-[13.5px] leading-[1.7] text-ink-faint">
                This site is the inside of that object, in three layers: the
                bench you set up before building, the mechanism underneath a
                running app, and the record of building this one.
              </p>
              <p className="field-label mt-6">scroll · begin at layer 00</p>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
