/**
 * Mutable, non-reactive bridge between the DOM/scroll world and the WebGL
 * render loop.
 *
 * This is the single most important performance decision in the project.
 *
 * The tempting alternative is React state: `const [progress, setProgress] =
 * useState(0)` updated from ScrollTrigger's `onUpdate`. That would re-render a
 * component tree ~60–120 times per second while scrolling, and each render
 * would reconcile, re-run effects and allocate — guaranteeing dropped frames.
 *
 * Instead, scroll/pointer producers *write* to this plain object and `useFrame`
 * consumers *read* it. No subscriptions, no re-renders, no allocation. React
 * owns the tree; the ticker owns the values.
 *
 * Rule of thumb: if a value changes every frame, it belongs here. If it changes
 * a handful of times (e.g. loading phase), it belongs in React state.
 */

export type MotionState = {
  /** Whole-page scroll progress, 0 → 1. */
  scrollProgress: number;
  /** Scroll velocity from Lenis. Signed; roughly px/frame. */
  scrollVelocity: number;
  /** Hero section scroll-out progress, 0 → 1. */
  heroProgress: number;
  /** Pinned story section scrub progress, 0 → 1. */
  storyProgress: number;
  /** Pointer in normalised device coords: -1 → 1 on both axes, y up. */
  pointer: { x: number; y: number };
};

export const motionState: MotionState = {
  scrollProgress: 0,
  scrollVelocity: 0,
  heroProgress: 0,
  storyProgress: 0,
  pointer: { x: 0, y: 0 },
};

/** Reset between route transitions so a new page never inherits stale scrub. */
export function resetMotionState(): void {
  motionState.scrollProgress = 0;
  motionState.scrollVelocity = 0;
  motionState.heroProgress = 0;
  motionState.storyProgress = 0;
  motionState.pointer.x = 0;
  motionState.pointer.y = 0;
}
