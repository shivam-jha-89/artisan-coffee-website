"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * The three states of the entry experience.
 *
 * - `loading`  overlay is up, scroll is locked, assets are downloading.
 * - `reveal`   assets are in, overlay is animating out. **Hero intro animations
 *              start here**, so the type is already moving as the curtain lifts
 *              instead of after it — that overlap is what separates a premium
 *              intro from a page that visibly waits its turn.
 * - `ready`    overlay unmounted, scroll unlocked, page fully interactive.
 */
export type LoadPhase = "loading" | "reveal" | "ready";

type PreloaderContextValue = {
  phase: LoadPhase;
  /** True from `reveal` onward — the cue for entrance timelines. */
  canAnimateIn: boolean;
  /** True only in `ready` — the cue for scroll-driven work. */
  isReady: boolean;
  startReveal: () => void;
  complete: () => void;
};

const PreloaderContext = createContext<PreloaderContextValue | null>(null);

/**
 * Holds *only* the coarse phase, never the download percentage.
 *
 * Progress updates fire many times per second; if they lived here, every tick
 * would re-render every consumer of this context — i.e. the whole page. The
 * percentage therefore stays local to `<Preloader />`, which is the only
 * component that needs to display it, and it reports upward exactly twice.
 */
export function PreloaderProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<LoadPhase>("loading");

  const startReveal = useCallback(() => {
    setPhase((current) => (current === "loading" ? "reveal" : current));
  }, []);

  const complete = useCallback(() => setPhase("ready"), []);

  const value = useMemo<PreloaderContextValue>(
    () => ({
      phase,
      canAnimateIn: phase !== "loading",
      isReady: phase === "ready",
      startReveal,
      complete,
    }),
    [phase, startReveal, complete],
  );

  return <PreloaderContext.Provider value={value}>{children}</PreloaderContext.Provider>;
}

export function usePreloader(): PreloaderContextValue {
  const context = useContext(PreloaderContext);
  if (!context) {
    throw new Error("usePreloader must be used inside <PreloaderProvider>");
  }
  return context;
}
