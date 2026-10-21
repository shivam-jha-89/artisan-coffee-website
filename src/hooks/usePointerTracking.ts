"use client";

import { useEffect } from "react";

import { motionState } from "@/lib/motion-state";

/**
 * Publishes the pointer position into `motionState` as normalised device
 * coordinates (-1 → 1, y pointing up, matching WebGL convention).
 *
 * Mounted once at the app root rather than per-component:
 *
 * - One passive listener instead of N. `pointermove` fires at input frequency
 *   (up to 1000Hz on gaming mice), so every extra handler is real cost.
 * - The handler does nothing but assign two numbers. No setState, no rAF
 *   scheduling — consumers already run in a frame loop and read the latest
 *   value there, which naturally throttles reads to the display refresh rate.
 *
 * Skipped entirely on touch devices, where there is no hover position to track
 * and the values would just stick wherever the last tap landed.
 */
export function usePointerTracking(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    const onPointerMove = (event: PointerEvent) => {
      motionState.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      motionState.pointer.y = -((event.clientY / window.innerHeight) * 2 - 1);
    };

    // Recentre when the cursor leaves so the scene relaxes instead of holding a
    // hard tilt at the edge of the viewport.
    const onPointerLeave = () => {
      motionState.pointer.x = 0;
      motionState.pointer.y = 0;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [enabled]);
}
