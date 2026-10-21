/**
 * Frame-loop math helpers.
 *
 * These live outside of React on purpose: they are called dozens of times per
 * frame inside `useFrame` / `gsap.ticker`, where allocating objects or reading
 * React state would show up immediately in the frame budget.
 */

export const clamp = (value: number, min = 0, max = 1): number =>
  Math.min(Math.max(value, min), max);

export const lerp = (from: number, to: number, alpha: number): number =>
  from + (to - from) * alpha;

/**
 * Frame-rate independent interpolation.
 *
 * A raw `lerp(current, target, 0.1)` moves 10% per *frame*, so it converges
 * twice as fast on a 120Hz display as it does on 60Hz. Exponential damping
 * makes the easing a function of elapsed time instead, which keeps motion
 * identical across refresh rates.
 *
 * @param lambda Higher = snappier. 4–8 feels good for pointer follow.
 * @param delta  Seconds since last frame (R3F gives you this in `useFrame`).
 */
export const damp = (
  current: number,
  target: number,
  lambda: number,
  delta: number,
): number => lerp(current, target, 1 - Math.exp(-lambda * delta));

/** Remap a value from one range to another without clamping. */
export const mapRange = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number => outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);

/** Normalised 0→1 progress of `value` across `[start, end]`, clamped. */
export const progress = (value: number, start: number, end: number): number =>
  clamp((value - start) / (end - start));
