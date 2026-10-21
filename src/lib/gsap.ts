"use client";

/**
 * Single GSAP entry point.
 *
 * Every animated component imports gsap from *here* rather than from "gsap"
 * directly. Reasons:
 *
 * 1. Plugin registration happens exactly once. Registering ScrollTrigger from
 *    five different components is a well-known source of "plugin not found"
 *    errors in bundled apps, because tree-shaking can drop a bare import.
 * 2. Our custom eases are guaranteed to exist before any tween references them
 *    by string name.
 * 3. It gives us one place to configure SSR-sensitive defaults.
 */

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

/**
 * Named eases. Strings (not functions) so they can be passed through
 * `gsap.defaults`, ScrollTrigger configs and data attributes.
 */
export const EASE = {
  /** cubic-bezier(0.16, 1, 0.3, 1) — the "expensive" deceleration. Default. */
  out: "hi-out",
  /** cubic-bezier(0.76, 0, 0.24, 1) — symmetrical, for layout/state swaps. */
  inOut: "hi-in-out",
  /** cubic-bezier(0.7, 0, 0.84, 0) — for exits that need to feel yanked away. */
  in: "hi-in",
  /** Slight overshoot. Use sparingly: logo marks, counters, badge pops. */
  hop: "hi-hop",
} as const;

// Client components still execute once on the server during SSR, and creating
// eases/plugins there is wasted work, so the whole block is browser-gated.
if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger, CustomEase, SplitText);

  CustomEase.create(EASE.out, "0.16,1,0.3,1");
  CustomEase.create(EASE.inOut, "0.76,0,0.24,1");
  CustomEase.create(EASE.in, "0.7,0,0.84,0");
  CustomEase.create(
    EASE.hop,
    "M0,0 C0.14,0 0.242,0.438 0.272,0.561 0.313,0.728 0.354,0.963 0.362,1 0.37,0.985 0.409,0.897 0.442,0.85 0.516,0.746 0.578,0.999 0.62,1.001 0.699,1.006 0.752,1 1,1",
  );

  gsap.defaults({ ease: EASE.out, duration: 1 });

  ScrollTrigger.config({
    // Mobile browsers fire `resize` when the URL bar collapses, which would
    // otherwise re-run every ScrollTrigger measurement mid-scroll and cause a
    // visible jump on the first swipe.
    ignoreMobileResize: true,
  });

  // Never warn on missing targets: sections mount/unmount behind the preloader.
  gsap.config({ nullTargetWarn: false });
}

export { gsap, ScrollTrigger, CustomEase, SplitText, useGSAP };
