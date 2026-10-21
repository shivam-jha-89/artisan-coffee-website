"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * True while the element is (nearly) on screen *and* the tab is foregrounded.
 *
 * This is what lets us set R3F's `frameloop="never"`, which is the single
 * biggest win available in a scroll-heavy 3D page: a WebGL canvas left running
 * costs full GPU time even when it has been scrolled past, draining battery and
 * stealing frames from the DOM animations the user is actually looking at.
 *
 * The `rootMargin` buffer resumes rendering slightly *before* the canvas
 * re-enters view, so it never appears as a frozen frame mid-scroll.
 */
export function useIsVisible(
  ref: RefObject<HTMLElement | null>,
  rootMargin = "15%",
): boolean {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let inViewport = false;
    let isForeground = document.visibilityState === "visible";

    const sync = () => setIsVisible(inViewport && isForeground);

    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewport = entry.isIntersecting;
        sync();
      },
      { rootMargin },
    );
    observer.observe(element);

    const onVisibilityChange = () => {
      isForeground = document.visibilityState === "visible";
      sync();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [ref, rootMargin]);

  return isVisible;
}
