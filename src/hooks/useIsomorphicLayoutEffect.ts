import { useEffect, useLayoutEffect } from "react";

/**
 * `useLayoutEffect` in the browser, `useEffect` on the server.
 *
 * Animation setup must run *before* the browser paints, otherwise the element's
 * un-animated state (e.g. text at full opacity) flashes for one frame before
 * GSAP sets its `from` values. `useEffect` is too late for that; it fires after
 * paint. But `useLayoutEffect` logs a warning during SSR, hence the swap.
 */
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
