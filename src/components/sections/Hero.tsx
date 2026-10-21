"use client";

import { useRef } from "react";

import { HeroCanvasSlot } from "@/components/canvas/HeroCanvasSlot";
import { EASE, ScrollTrigger, SplitText, gsap, useGSAP } from "@/lib/gsap";
import { motionState } from "@/lib/motion-state";
import { useDevice } from "@/providers/DeviceProvider";
import { usePreloader } from "@/providers/PreloaderProvider";
import { useSmoothScroll } from "@/providers/SmoothScrollProvider";

/**
 * Hero: WebGL layer behind, orchestrated typography in front.
 *
 * The two animation concerns are split into two `useGSAP` calls with different
 * dependencies on purpose — the intro is a one-shot keyed to the preloader,
 * while the scroll-out is a persistent ScrollTrigger keyed to layout. Merging
 * them would mean rebuilding the ScrollTrigger every time the load phase
 * changes, and re-measuring triggers is the expensive part.
 */
export function Hero() {
  const rootRef = useRef<HTMLElement>(null);
  const { canAnimateIn } = usePreloader();
  const { ready, reducedMotion } = useDevice();
  const { scrollTo } = useSmoothScroll();

  /** Intro. Starts on `reveal`, i.e. while the curtain is still lifting. */
  useGSAP(
    () => {
      if (!ready || !canAnimateIn) return;
      // Nothing to animate in: the markup is already in its final state.
      if (reducedMotion) return;

      const headline = rootRef.current?.querySelector<HTMLElement>("[data-hero-headline]");
      if (!headline) return;

      /**
       * The whole intro timeline is built *inside* `onSplit`.
       *
       * That's the key to `autoSplit`: when a font swap or resize forces a
       * re-split, GSAP reverts the old animation and calls this again, so the
       * timeline is rebuilt against the new line elements. Building it outside
       * would leave the timeline holding references to discarded nodes.
       */
      const split = SplitText.create(headline, {
        type: "lines",
        mask: "lines",
        autoSplit: true,
        onSplit: (self) => {
          const timeline = gsap.timeline({ defaults: { ease: EASE.out } });

          timeline
            // Canvas first and slowest — the backdrop settling while the type
            // arrives is what makes the composition feel layered in depth
            // rather than like one group of elements fading in together.
            .from("[data-hero-canvas]", { opacity: 0, scale: 1.12, duration: 2.2 }, 0)
            .from(
              self.lines,
              { yPercent: 120, rotate: 2.5, duration: 1.5, stagger: 0.13 },
              0.1,
            )
            .from("[data-hero-eyebrow]", { yPercent: 100, opacity: 0, duration: 1 }, 0.25)
            .from("[data-hero-body]", { y: 24, opacity: 0, duration: 1.2 }, 0.55)
            .from("[data-hero-cta]", { y: 20, opacity: 0, duration: 1 }, 0.7)
            .from(
              "[data-hero-meta] > *",
              { y: 18, opacity: 0, duration: 0.9, stagger: 0.07 },
              0.8,
            )
            .from("[data-hero-cue]", { opacity: 0, duration: 1 }, 1);

          return timeline;
        },
      });

      return () => split.revert();
    },
    { dependencies: [ready, canAnimateIn, reducedMotion], scope: rootRef },
  );

  /** Scroll-out: publishes progress to the 3D layer and parallaxes the content. */
  useGSAP(
    () => {
      if (!ready) return;

      const scrollTriggerConfig = {
        trigger: rootRef.current,
        start: "top top",
        // "bottom top" = the hero's bottom edge reaching the viewport top, so
        // progress spans exactly one screen of scrolling.
        end: "bottom top",
        scrub: true,
      } as const;

      // A bare ScrollTrigger (no tween) is the cheapest way to publish progress:
      // it writes one number per frame into the non-reactive store that
      // `useFrame` reads. No React render is involved in the DOM → GPU handoff.
      ScrollTrigger.create({
        ...scrollTriggerConfig,
        onUpdate: (self) => {
          motionState.heroProgress = self.progress;
        },
      });

      if (reducedMotion) return;

      // `ease: "none"` is mandatory for scrubbed tweens: any easing curve makes
      // the animation's rate diverge from the scroll's, and it feels like drag.
      gsap.to("[data-hero-parallax]", {
        yPercent: -20,
        opacity: 0.1,
        ease: "none",
        scrollTrigger: scrollTriggerConfig,
      });
    },
    { dependencies: [ready, reducedMotion], scope: rootRef },
  );

  return (
    <section
      ref={rootRef}
      id="hero"
      className="relative flex h-svh min-h-[38rem] flex-col justify-end overflow-hidden px-6 pb-10 md:px-10 md:pb-12"
    >
      {/* `h-svh` over `h-screen`: on mobile `100vh` includes the collapsing URL
          bar, so a full-height hero gets clipped on first paint. */}
      <div data-hero-canvas className="absolute inset-0">
        <HeroCanvasSlot />
      </div>

      {/*
        Legibility scrim between the canvas and the type.
        Contrast can't be left to chance when the backdrop is procedural: the
        bean tumbles and its brightness changes every frame, so text over it
        would pass contrast checks only some of the time. This guarantees a floor
        without dimming the bean itself, and it costs one gradient.
      */}
      {/*
        Explicit stop positions matter now that the palette is light. With the
        default 0/50/100 spread the gradient still carries ~30% cream across the
        bean, and washing a warm brown object with cream is exactly how you get a
        milky, low-contrast render that looks like a shader bug. Reaching full
        transparency before the bean's leading edge keeps the object at its
        intended value while still protecting the type behind it.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-t from-cream from-25% via-cream/80 via-55% to-transparent to-75% md:bg-linear-to-r md:from-cream md:from-20% md:via-cream/75 md:via-38% md:to-transparent md:to-56%"
      />

      <div data-hero-parallax className="relative flex flex-col gap-10">
        <div className="overflow-hidden">
          <p
            data-hero-eyebrow
            className="font-mono text-[0.65rem] tracking-[0.32em] text-espresso/60 uppercase"
          >
            Specialty roastery — Istanbul
          </p>
        </div>

        <h1
          data-hero-headline
          className="font-display max-w-[16ch] text-[clamp(2.75rem,9vw,8.5rem)] leading-[0.92] tracking-[-0.03em] text-espresso"
        >
          <span className="block">Single origin,</span>
          <span className="block">roasted the</span>
          <span className="block text-caramel italic">slow way.</span>
        </h1>

        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <p data-hero-body className="max-w-[42ch] text-sm leading-relaxed text-espresso/70">
            We buy small lots direct from twelve farms, roast them in six-kilo
            batches every Tuesday, and ship the same week. Nothing sits in a
            warehouse losing what the farmer put into it.
          </p>

          <button
            data-hero-cta
            type="button"
            onClick={() => scrollTo("#story", { offset: 0 })}
            className="group flex items-center gap-3 self-start font-mono text-[0.65rem] tracking-[0.25em] text-espresso uppercase md:self-auto"
          >
            <span className="relative">
              Explore the roast
              {/* Underline drawn with a transform so hover stays on the
                  compositor — animating `width` would trigger layout. */}
              <span className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-caramel transition-transform duration-500 ease-out group-hover:scale-x-100" />
            </span>
            <span className="grid size-9 place-items-center rounded-full border border-espresso/20 transition-colors duration-500 group-hover:border-caramel group-hover:bg-caramel/10">
              <svg viewBox="0 0 10 10" aria-hidden className="size-2.5 fill-none stroke-current">
                <path d="M5 1v8M1.5 5.5 5 9l3.5-3.5" strokeWidth="1.2" />
              </svg>
            </span>
          </button>
        </div>

        <div
          data-hero-meta
          className="flex flex-wrap gap-x-8 gap-y-3 border-t border-espresso/15 pt-5 font-mono text-[0.6rem] tracking-[0.2em] text-espresso/55 uppercase"
        >
          <span>Roasted weekly</span>
          <span>12 partner farms</span>
          <span>Direct trade</span>
          <span>Est. 2016</span>
        </div>
      </div>

      <div
        data-hero-cue
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-6 hidden -translate-y-1/2 items-center gap-3 md:right-10 md:flex"
      >
        <span className="font-mono text-[0.6rem] tracking-[0.3em] text-espresso/50 [writing-mode:vertical-rl] uppercase">
          Scroll
        </span>
        <span className="animate-scroll-cue h-16 w-px bg-linear-to-b from-espresso/40 to-transparent" />
      </div>
    </section>
  );
}
