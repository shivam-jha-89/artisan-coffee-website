"use client";

import { useProgress } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";

import { markSceneReady, reportSceneProgress } from "@/lib/asset-loader";

/**
 * Bridges three's `LoadingManager` to the preloader.
 *
 * Lives *outside* any `<Suspense>` boundary so it keeps reporting while its
 * siblings are still suspended — a reporter inside the boundary wouldn't mount
 * until loading had already finished, which is exactly when its numbers stop
 * being useful.
 *
 * Add real assets (`useGLTF`, `useTexture`) anywhere in the tree and they are
 * picked up automatically: they register with the default LoadingManager, which
 * is what `useProgress` observes. Nothing here needs to change.
 */
export function SceneLoadReporter() {
  const { active, progress, total } = useProgress();
  const framesRendered = useRef(0);

  useFrame(() => {
    // Only needs to distinguish "has painted" from "hasn't"; stop counting so
    // this stays a no-op for the rest of the session.
    if (framesRendered.current < 2) {
      framesRendered.current += 1;
    }
  });

  useEffect(() => {
    // `total === 0` means nothing ever entered the queue (our hero is pure
    // procedural geometry). Report that share of the bar as complete rather than
    // stalling the preloader at 35%.
    reportSceneProgress(total === 0 ? 1 : progress / 100);
  }, [progress, total]);

  useEffect(() => {
    if (active) return;

    // "Ready" must mean *visible*, not merely "assets decoded" — signalling
    // before the first paint lifts the curtain on an empty canvas for a frame or
    // two, which is the exact flash the preloader exists to prevent.
    let frame = 0;
    const waitForPaint = () => {
      if (framesRendered.current > 0) {
        markSceneReady();
        return;
      }
      frame = requestAnimationFrame(waitForPaint);
    };
    waitForPaint();

    return () => cancelAnimationFrame(frame);
  }, [active]);

  return null;
}
