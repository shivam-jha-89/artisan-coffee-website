"use client";

import Lenis from "lenis";
import "lenis/dist/lenis.css";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { motionState } from "@/lib/motion-state";
import { useDevice } from "@/providers/DeviceProvider";
import { usePreloader } from "@/providers/PreloaderProvider";

type ScrollTarget = string | number | HTMLElement;

type SmoothScrollContextValue = {
  lenis: Lenis | null;
  /** Animated scroll that works whether or not Lenis is active. */
  scrollTo: (target: ScrollTarget, options?: { offset?: number; immediate?: boolean }) => void;
};

const SmoothScrollContext = createContext<SmoothScrollContextValue>({
  lenis: null,
  scrollTo: () => {},
});

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const { ready, reducedMotion, isTouch } = useDevice();
  const { isReady } = usePreloader();

  const lenisRef = useRef<Lenis | null>(null);
  // Mirrored into state purely so consumers re-render once when Lenis exists.
  // The ref is what the ticker and callbacks read, so no render is on the
  // critical path of a scroll frame.
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useIsomorphicLayoutEffect(() => {
    // Wait for the real device profile: creating Lenis and then tearing it down
    // one tick later (once we learn the user prefers reduced motion) would
    // leave ScrollTrigger with stale measurements.
    if (!ready) return;

    // Accessibility over spectacle: with reduced motion we hand scrolling back
    // to the browser entirely. ScrollTrigger works fine on native scroll, so
    // all scroll-driven storytelling keeps functioning — it just doesn't glide.
    if (reducedMotion) {
      ScrollTrigger.refresh();
      return;
    }

    const instance = new Lenis({
      // ~1s of glide. Longer feels luxurious but starts to fight the user's
      // intent; shorter reads as "normal scroll with lag".
      duration: 1.1,
      // Exponential-out. Must decay fast at the start or the page feels heavy.
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      // THE critical flag. Lenis' own requestAnimationFrame loop is disabled so
      // that GSAP's ticker is the single clock for the app (see below).
      autoRaf: false,
      smoothWheel: true,
      // Leave touch alone. Hijacking touch scroll drops the OS-level momentum
      // and rubber-banding, costs real frames on mid-range phones, and is the
      // number-one cause of "the site feels broken on my iPhone".
      syncTouch: false,
      touchMultiplier: 1.6,
      wheelMultiplier: 1,
      // Let Lenis animate to `#hash` links instead of the browser jumping.
      anchors: true,
      // Opt any subtree out with `data-lenis-prevent` (modals, code blocks,
      // scrollable overlays) so nested scrolling still works natively.
      prevent: (node) => node.hasAttribute("data-lenis-prevent"),
    });

    lenisRef.current = instance;
    setLenis(instance);

    /**
     * ── Sync #1: Lenis → ScrollTrigger ────────────────────────────────────
     * Lenis moves the page, so ScrollTrigger must re-evaluate its triggers in
     * the *same* frame the position changes. Without this, pinned elements and
     * scrubbed timelines trail the content by a frame and visibly jitter.
     *
     * Note the arrow wrapper: `lenis.on("scroll", ScrollTrigger.update)` passes
     * the Lenis instance as the first argument, which ScrollTrigger reads as its
     * truthy `force` flag and does more work than necessary on every event.
     */
    const onScroll = () => ScrollTrigger.update();
    instance.on("scroll", onScroll);

    /**
     * ── Sync #2: one clock, owned by gsap.ticker ──────────────────────────
     * Two independent requestAnimationFrame loops (Lenis' and GSAP's) execute in
     * an undefined order, so on any given frame the scroll position may be
     * applied *after* the tweens that depend on it — that mismatch is the
     * "they're fighting each other" jitter people describe. Driving Lenis from
     * GSAP's ticker guarantees: advance scroll → update triggers → render tweens.
     *
     * GSAP's ticker gives time in seconds, Lenis expects milliseconds.
     */
    const raf = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(raf);

    /**
     * ── Sync #3: kill lag smoothing ───────────────────────────────────────
     * By default GSAP clamps any frame delta above 500ms to 33ms to keep tweens
     * from teleporting after a stall. Applied to a scroll-linked animation that
     * clamp desynchronises the tween from the actual scroll offset, and the page
     * snaps to catch up. Scrubbed motion must track position, not wall time.
     */
    gsap.ticker.lagSmoothing(0);

    // Keep Lenis' cached dimensions aligned with ScrollTrigger's. Lenis has its
    // own ResizeObserver, but a refresh can also be triggered by us (fonts
    // loading, preloader exit, images decoding) with no resize event at all.
    const onRefresh = () => instance.resize();
    ScrollTrigger.addEventListener("refresh", onRefresh);

    // Publish per-frame scroll values to the non-reactive store that the WebGL
    // layer reads. This is the DOM → GPU handoff, and it costs two property
    // writes per frame instead of a React render.
    const onScrollProgress = ({ progress, velocity }: Lenis) => {
      motionState.scrollProgress = progress;
      motionState.scrollVelocity = velocity;
    };
    instance.on("scroll", onScrollProgress);

    ScrollTrigger.refresh();

    return () => {
      instance.off("scroll", onScroll);
      instance.off("scroll", onScrollProgress);
      ScrollTrigger.removeEventListener("refresh", onRefresh);
      gsap.ticker.remove(raf);
      // Restore GSAP's defaults — the ticker is global and outlives this tree.
      gsap.ticker.lagSmoothing(500, 33);
      instance.destroy();
      lenisRef.current = null;
      setLenis(null);
    };
  }, [ready, reducedMotion]);

  /**
   * Scroll lock while the preloader is up.
   *
   * `overflow: hidden` alone is not enough: Lenis keeps its own virtual scroll
   * position and would accumulate wheel deltas behind the curtain, so the page
   * would fly downward the instant it lifts. `stop()` freezes the virtual
   * position too. The class handles the reduced-motion (no Lenis) path.
   */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("is-scroll-locked", !isReady);

    if (isReady) {
      lenisRef.current?.start();
    } else {
      lenisRef.current?.stop();
    }
  }, [isReady, lenis]);

  /**
   * Browsers restore the previous scroll offset on reload, which would drop the
   * visitor mid-page while the preloader claims to be starting the experience.
   */
  useEffect(() => {
    if (!("scrollRestoration" in history)) return;
    const previous = history.scrollRestoration;
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    return () => {
      history.scrollRestoration = previous;
    };
  }, []);

  /**
   * Re-measure once the curtain is gone. Trigger positions computed while the
   * preloader was pinning the body are unreliable, and fonts swapping in shifts
   * text-height dependent layout.
   */
  useEffect(() => {
    if (!isReady) return;
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [isReady]);

  const scrollTo = useCallback<SmoothScrollContextValue["scrollTo"]>(
    (target, options) => {
      const offset = options?.offset ?? 0;
      const instance = lenisRef.current;

      if (instance) {
        instance.scrollTo(target, {
          offset,
          immediate: options?.immediate ?? false,
          duration: 1.4,
        });
        return;
      }

      // Reduced-motion / no-Lenis fallback: resolve the target ourselves and
      // hand off to the native API.
      let top: number | null = null;

      if (typeof target === "number") {
        top = target + offset;
      } else {
        const element =
          typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
        if (element) {
          top = element.getBoundingClientRect().top + window.scrollY + offset;
        }
      }

      if (top === null) return;

      window.scrollTo({ top, behavior: options?.immediate ? "auto" : "smooth" });
    },
    [],
  );

  // Expose pointer type on the root element so CSS can drop hover-only
  // affordances without us rendering a second tree or an extra wrapper node.
  useEffect(() => {
    document.documentElement.dataset.pointer = isTouch ? "coarse" : "fine";
  }, [isTouch]);

  const value = useMemo<SmoothScrollContextValue>(() => ({ lenis, scrollTo }), [lenis, scrollTo]);

  return <SmoothScrollContext.Provider value={value}>{children}</SmoothScrollContext.Provider>;
}

export function useSmoothScroll(): SmoothScrollContextValue {
  return useContext(SmoothScrollContext);
}
