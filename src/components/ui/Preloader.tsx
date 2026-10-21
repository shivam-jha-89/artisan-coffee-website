"use client";

import { useRef } from "react";

import { getSceneLoadState } from "@/lib/asset-loader";
import { shouldRender3D } from "@/lib/device";
import { clamp, damp } from "@/lib/math";
import { EASE, gsap, useGSAP } from "@/lib/gsap";
import { useDevice } from "@/providers/DeviceProvider";
import { usePreloader } from "@/providers/PreloaderProvider";

/** Minimum time the curtain stays up, so a warm cache still gets an intro. */
const MIN_DURATION = 1400;
/** Hard ceiling. If an asset hangs we show the site rather than a dead screen. */
const MAX_DURATION = 6000;

/**
 * Entry curtain and load gate.
 *
 * Two deliberate implementation choices:
 *
 * 1. **The percentage never touches React state.** It updates every frame; as
 *    state it would trigger 60–120 renders/sec during the most jank-sensitive
 *    moment of the page's life. Instead the ticker writes to `textContent` and a
 *    transform directly, and React only hears about the two phase changes.
 *
 * 2. **The displayed value is damped toward the real one.** Raw loader progress
 *    arrives in ugly jumps (0 → 71 → 100). Easing toward the target turns that
 *    into a continuous count that reads as intentional.
 */
export function Preloader() {
  const { phase, startReveal, complete } = usePreloader();
  const profile = useDevice();
  const { ready: deviceReady, reducedMotion } = profile;

  // Must be the same predicate the canvas mounts on — see `shouldRender3D`.
  const awaitsScene = shouldRender3D(profile);

  const rootRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!deviceReady || phase !== "loading") return;

      const startedAt = performance.now();
      let displayed = 0;
      let fontsReady = false;
      let finished = false;

      // Fonts are part of the critical path: revealing hero type mid-swap causes
      // a reflow that ScrollTrigger has already measured around.
      document.fonts.ready.then(() => {
        fontsReady = true;
      });

      /**
       * Weighted target. Fonts are a third of the bar, the 3D scene the rest.
       * When no scene will mount, its share auto-completes — otherwise the bar
       * would sit at 35% until the failsafe timeout fired.
       */
      const computeReal = (): number => {
        const scene = awaitsScene ? getSceneLoadState().progress : 1;
        return (fontsReady ? 0.35 : 0) + scene * 0.65;
      };

      const isActuallyReady = (): boolean =>
        fontsReady && (!awaitsScene || getSceneLoadState().ready);

      const tick = (_time: number, deltaTime: number) => {
        const elapsed = performance.now() - startedAt;
        const timed = elapsed / MIN_DURATION;
        const timedOut = elapsed > MAX_DURATION;

        // Never outrun the minimum duration, so the count-up is always legible.
        const target = timedOut ? 1 : clamp(Math.min(timed, computeReal()));

        // Exponential damping keyed off the ticker's delta (ms → s) so the count
        // takes the same wall-clock time on a 60Hz and a 120Hz display.
        displayed = damp(displayed, target * 100, 8, deltaTime / 1000);

        if (counterRef.current) {
          counterRef.current.textContent = String(Math.round(displayed)).padStart(2, "0");
        }
        if (barRef.current) {
          barRef.current.style.transform = `scaleX(${displayed / 100})`;
        }

        if (finished) return;
        if (displayed > 99.2 && (isActuallyReady() || timedOut)) {
          finished = true;
          displayed = 100;
          if (counterRef.current) counterRef.current.textContent = "100";
          if (barRef.current) barRef.current.style.transform = "scaleX(1)";
          startReveal();
        }
      };

      // Reuse GSAP's ticker rather than opening a second rAF loop — the whole
      // point of the Lenis/GSAP setup is that the app has exactly one clock.
      gsap.ticker.add(tick);
      return () => gsap.ticker.remove(tick);
    },
    { dependencies: [deviceReady, phase, awaitsScene, startReveal] },
  );

  /** Exit choreography. Runs on `reveal`, hands control back with `complete()`. */
  useGSAP(
    () => {
      if (phase !== "reveal") return;

      if (reducedMotion) {
        complete();
        return;
      }

      const timeline = gsap.timeline({
        defaults: { ease: EASE.inOut },
        onComplete: complete,
      });

      timeline
        .to("[data-preloader-meta]", {
          yPercent: -120,
          opacity: 0,
          duration: 0.7,
          stagger: 0.06,
          ease: EASE.in,
        })
        .to(
          "[data-preloader-panel]",
          {
            // scaleY on a transform-only property: stays on the compositor, so
            // the curtain lift never triggers layout or paint.
            scaleY: 0,
            duration: 1.1,
            stagger: { each: 0.07, from: "start" },
          },
          0.25,
        )
        // Only now release pointer events — a curtain that is still mid-lift but
        // already click-through swallows the first interaction.
        .set(rootRef.current, { pointerEvents: "none" }, 0.25);
    },
    { dependencies: [phase, reducedMotion, complete], scope: rootRef },
  );

  if (phase === "ready") return null;

  return (
    <div
      ref={rootRef}
      // aria-hidden + role=status: announce loading, but keep the decorative
      // panels out of the accessibility tree.
      role="status"
      aria-live="polite"
      aria-label="Loading experience"
      className="pointer-events-auto fixed inset-0 z-[100] flex items-end justify-between overflow-hidden p-6 md:p-10"
    >
      {/*
        Curtain panels sit behind the text and lift independently.
        Espresso, against the cream page underneath: the reveal goes from dark
        roast to light, which is the brand story in one gesture.
      */}
      <div aria-hidden className="absolute inset-0 flex">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            data-preloader-panel
            className="h-full flex-1 origin-top bg-espresso will-change-transform"
          />
        ))}
      </div>

      <p
        data-preloader-meta
        className="relative font-mono text-[0.65rem] tracking-[0.3em] text-cream/60 uppercase"
      >
        Brewing
      </p>

      <div data-preloader-meta className="relative flex items-end gap-3">
        <span
          ref={counterRef}
          className="font-display text-[clamp(4rem,14vw,11rem)] leading-[0.8] text-cream tabular-nums"
        >
          00
        </span>
        <span className="pb-2 font-mono text-xs text-cream/50">%</span>
      </div>

      <div
        aria-hidden
        className="absolute inset-x-6 bottom-5 h-px origin-left bg-cream/20 md:inset-x-10"
      >
        <div
          ref={barRef}
          style={{ transform: "scaleX(0)" }}
          className="h-full w-full origin-left bg-caramel will-change-transform"
        />
      </div>
    </div>
  );
}
