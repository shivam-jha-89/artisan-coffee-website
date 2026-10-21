"use client";

import { useRef } from "react";

import { gsap, useGSAP } from "@/lib/gsap";
import { motionState } from "@/lib/motion-state";

const CHAPTERS = [
  {
    index: "01",
    title: "Sourcing",
    body: "Two buying trips a year, and we taste every lot before it ships. Washed Ethiopians from Guji, honey-processed Colombians from Huila, and whatever a farmer is genuinely excited about that season.",
    // The three panels run pale → dark across the sequence, so the track itself
    // darkens as you scrub: the roast happening in the layout.
    tint: "bg-linear-to-br from-[#d6c4a4] via-[#bda484] to-[#957a56]",
  },
  {
    index: "02",
    title: "Roasting",
    body: "Six-kilo batches on a 1962 Probat, every Tuesday morning. We log every curve and cup the results on Thursday — if a roast doesn't beat the last one, it doesn't go out.",
    tint: "bg-linear-to-br from-caramel via-[#8f5a2e] to-roast",
  },
  {
    index: "03",
    title: "Brewing",
    body: "Each bag carries the recipe we landed on: dose, grind, water temperature, time. Follow it once, then start moving the numbers around until it tastes like yours.",
    tint: "bg-linear-to-br from-roast via-[#4a2d1b] to-espresso",
  },
] as const;

/**
 * Pinned, scrub-driven chapter sequence.
 *
 * The scrollbar stops being navigation here and becomes a timeline playhead:
 * the section pins and vertical scroll distance maps 1:1 onto horizontal travel.
 * Because that distance is *measured* (`scrollWidth - innerWidth`) rather than
 * guessed in viewport units, the pin releases exactly as the last chapter lands,
 * at any window size.
 *
 * Note that all chapter copy is animated from the master timeline rather than by
 * the reusable `RevealText` component. Inside a pinned section every panel sits
 * at the same *vertical* position, so a normal enter-trigger would fire all
 * three reveals the moment the section pins. Panels that move horizontally have
 * to be driven by the timeline that moves them.
 */
export function StorySection() {
  const rootRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      const track = trackRef.current;
      if (!root || !track) return;

      /**
       * `gsap.matchMedia` instead of hand-rolled resize listeners.
       *
       * Each branch owns a context, so crossing a breakpoint fully reverts the
       * other branch — inline styles, pin spacers and ScrollTriggers included.
       * Hand-rolling this is where responsive ScrollTrigger bugs come from:
       * leftover pin spacing from a layout that no longer applies.
       *
       * Passing the scope means selector strings below resolve inside this
       * section instead of scanning the whole document.
       */
      const mm = gsap.matchMedia(root);

      /** Desktop: pin + horizontal scrub. */
      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", (context) => {
        // Function-based value + `invalidateOnRefresh`, so the distance is
        // re-measured on resize rather than baked in at creation time.
        const distance = () => -(track.scrollWidth - window.innerWidth);

        const timeline = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: () => `+=${Math.abs(distance())}`,
            // A small numeric scrub adds ~0.6s of catch-up smoothing. `true`
            // tracks scroll exactly, which on top of Lenis can read as twitchy;
            // a number gives the sequence weight.
            scrub: 0.6,
            pin: true,
            // Pre-empts the pin by a frame, removing the 1px jump you otherwise
            // get when scrolling fast.
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              motionState.storyProgress = self.progress;

              // Written straight to the DOM: as React state this would re-render
              // the section on every scroll frame.
              if (counterRef.current) {
                const active = Math.min(
                  CHAPTERS.length,
                  Math.floor(self.progress * CHAPTERS.length) + 1,
                );
                counterRef.current.textContent = String(active).padStart(2, "0");
              }
            },
          },
        });

        // The track's travel is the spine of the timeline; everything else is
        // positioned against it.
        timeline.to(track, { x: distance }, 0);

        // Ambient glow builds over the sequence. Opacity only — a
        // compositor-friendly property, unlike animating background-color.
        // Kept low: on a light background a warm glow turns the whole section to
        // mush long before it looks like light.
        timeline.fromTo("[data-story-glow]", { opacity: 0 }, { opacity: 0.14 }, 0);
        timeline.to("[data-story-rail]", { scaleX: 1 }, 0);

        const chapters = context.selector?.("[data-chapter]") as HTMLElement[] | undefined;

        chapters?.forEach((chapter, index) => {
          const media = chapter.querySelector<HTMLElement>("[data-chapter-media]");
          const copy = chapter.querySelector<HTMLElement>("[data-chapter-copy]");
          // Each panel peaks as it crosses centre screen.
          const at = index / CHAPTERS.length;

          if (media) {
            // Counter-motion: media drifts slower than the track, so the
            // sequence has internal depth instead of sliding past as one rigid
            // sheet.
            timeline.fromTo(
              media,
              { scale: 1.18, xPercent: 8 },
              { scale: 1, xPercent: -8 },
              at,
            );
          }

          if (copy) {
            timeline.fromTo(
              copy,
              { opacity: 0, xPercent: 12 },
              { opacity: 1, xPercent: 0, duration: 0.5 },
              at,
            );
          }
        });
      });

      /**
       * Mobile / reduced motion: no pin, no hijack.
       *
       * Pinning on touch fights the browser's own scroll and address-bar
       * behaviour. The layout is already a vertical stack in CSS, so this branch
       * only fades panels in as they arrive.
       */
      mm.add("(max-width: 767px), (prefers-reduced-motion: reduce)", (context) => {
        const chapters = context.selector?.("[data-chapter]") as HTMLElement[] | undefined;

        chapters?.forEach((chapter) => {
          gsap.from(chapter, {
            opacity: 0,
            y: 40,
            duration: 1,
            scrollTrigger: { trigger: chapter, start: "top 80%", once: true },
          });
        });
      });

      return () => mm.revert();
    },
    { scope: rootRef },
  );

  return (
    <section ref={rootRef} id="story" className="relative bg-crema md:h-svh md:overflow-hidden">
      <div
        data-story-glow
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 bg-[radial-gradient(circle_at_70%_50%,var(--color-caramel),transparent_62%)]"
      />

      {/* Fixed chrome over the moving track. */}
      <header className="pointer-events-none absolute inset-x-6 top-24 z-10 flex items-baseline justify-between md:inset-x-10">
        <span className="font-mono text-[0.6rem] tracking-[0.3em] text-espresso/55 uppercase">
          Bean to cup
        </span>
        <span className="font-mono text-[0.6rem] tracking-[0.3em] text-espresso/55 uppercase">
          <span ref={counterRef}>01</span> / {String(CHAPTERS.length).padStart(2, "0")}
        </span>
      </header>

      <div
        aria-hidden
        className="absolute inset-x-6 bottom-10 z-10 hidden h-px bg-espresso/15 md:inset-x-10 md:block"
      >
        <div data-story-rail className="h-full w-full origin-left scale-x-0 bg-caramel" />
      </div>

      {/* Layout is responsive in CSS and GSAP only animates transforms: a
          vertical stack on mobile, a single-row track on desktop. */}
      <div ref={trackRef} className="flex flex-col md:h-full md:flex-row md:will-change-transform">
        {CHAPTERS.map((chapter) => (
          <article
            key={chapter.index}
            data-chapter
            className="flex w-full shrink-0 flex-col justify-center gap-10 px-6 py-24 md:w-screen md:flex-row md:items-center md:gap-16 md:px-10 md:py-0"
          >
            <div data-chapter-copy className="flex-1 md:max-w-[34ch]">
              <span className="font-mono text-[0.6rem] tracking-[0.3em] text-caramel uppercase">
                Step {chapter.index}
              </span>
              <h2 className="font-display mt-5 text-[clamp(2.25rem,6vw,4.5rem)] leading-[0.95] tracking-[-0.02em] text-espresso">
                {chapter.title}
              </h2>
              <p className="mt-6 max-w-[40ch] text-sm leading-relaxed text-espresso/70">
                {chapter.body}
              </p>
            </div>

            {/* Media placeholder — swap for product photography via <Image>, or a
                drei <View> portal into the WebGL scene. Sized with aspect-ratio so
                replacing it cannot shift layout and invalidate ScrollTrigger's
                measurements. */}
            <div
              data-chapter-media
              className={`aspect-4/5 w-full flex-1 rounded-sm border border-espresso/15 ${chapter.tint} md:aspect-square md:max-w-[32rem] md:will-change-transform`}
            />
          </article>
        ))}
      </div>
    </section>
  );
}
