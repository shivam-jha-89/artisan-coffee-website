/**
 * Device capability detection.
 *
 * Everything here is pure and browser-only so it can be measured **once** on
 * mount by `DeviceProvider` and then shared. The defaults are deliberately the
 * *most conservative* values, because they are what the server renders — the
 * client then upgrades after hydration. That ordering means the low-end
 * fallback markup is always what ships in the HTML, so a phone on a bad
 * connection sees a styled page even if the WebGL bundle never arrives.
 */

export type PerfTier = "low" | "mid" | "high";

export type DeviceProfile = {
  /** WebGL (1 or 2) context could actually be created. */
  hasWebGL: boolean;
  /** Coarse pointer — drives hover-vs-tap interaction choices. */
  isTouch: boolean;
  /** Viewport-based, updates on resize. */
  isMobile: boolean;
  /** `prefers-reduced-motion: reduce` — we disable smooth scroll + 3D motion. */
  reducedMotion: boolean;
  tier: PerfTier;
  /** `[min, max]` device pixel ratio clamp handed straight to R3F's `<Canvas>`. */
  dpr: [number, number];
  /** True once measured in the browser. Gate 3D mounting on this. */
  ready: boolean;
};

export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1280,
} as const;

/**
 * Server / pre-hydration profile: no WebGL, no motion, cheapest pixel ratio.
 */
export const FALLBACK_DEVICE_PROFILE: DeviceProfile = {
  hasWebGL: false,
  isTouch: false,
  isMobile: false,
  reducedMotion: false,
  tier: "low",
  dpr: [1, 1],
  ready: false,
};

type ExtendedNavigator = Navigator & {
  deviceMemory?: number;
  hardwareConcurrency?: number;
};

let cachedWebGL: boolean | null = null;

/**
 * Feature-detect WebGL by actually creating a context — UA sniffing lies, and
 * browsers can have WebGL disabled or blocklisted at the driver level.
 *
 * The probe context is explicitly destroyed: browsers cap the number of live
 * contexts (~16), and silently dropping one on the floor can cost us the real
 * scene's context later on.
 */
export function detectWebGL(): boolean {
  if (cachedWebGL !== null) return cachedWebGL;
  if (typeof window === "undefined") return false;

  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ??
      (canvas.getContext("webgl") as WebGLRenderingContext | null);

    cachedWebGL = gl !== null;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    cachedWebGL = false;
  }

  return cachedWebGL;
}

/**
 * Heuristic performance tier. There is no reliable GPU API on the web, so we
 * blend the signals that do exist: core count, RAM hint, pointer type and
 * viewport. Wrong guesses are cheap because tier only scales *quality*
 * (pixel ratio, geometry detail, antialiasing) and never correctness.
 */
export function detectTier(): PerfTier {
  if (typeof window === "undefined") return "low";

  const nav = navigator as ExtendedNavigator;
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const isSmallViewport = window.innerWidth < BREAKPOINTS.tablet;
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

  if (cores <= 4 || memory <= 4) return "low";
  if (isCoarsePointer || isSmallViewport) return cores >= 8 ? "mid" : "low";
  return cores >= 8 && memory >= 8 ? "high" : "mid";
}

/**
 * Pixel ratio budget per tier. Fragment shader cost scales with the *square*
 * of this number, so capping it is by far the highest-leverage mobile
 * optimisation available — a 3x-DPR phone rendering at 3x is drawing 9x the
 * pixels of a 1x pass for a difference almost nobody can see.
 */
export function dprForTier(tier: PerfTier): [number, number] {
  switch (tier) {
    case "high":
      return [1, 2];
    case "mid":
      return [1, 1.5];
    default:
      return [1, 1];
  }
}

/**
 * Icosahedron subdivision budget for the hero mesh.
 *
 * Counts matter here: `IcosahedronGeometry` splits each of its 20 faces into
 * `(detail + 1)²` triangles, so this scale is roughly 21k / 8.8k / 3.4k
 * triangles. The vertex shader evaluates the bean's surface function three times
 * per vertex (once for the position, twice more to rebuild the normal), making
 * this the dominant vertex cost in the scene.
 *
 * The crease sets the floor: too few subdivisions and the groove's edge turns
 * visibly faceted, which is exactly where the eye is drawn.
 */
export function detailForTier(tier: PerfTier): number {
  switch (tier) {
    case "high":
      return 32;
    case "mid":
      return 20;
    default:
      return 12;
  }
}

/**
 * Single source of truth for "will this session actually run WebGL?".
 *
 * Both the canvas mount and the preloader's asset gate must agree on this. When
 * they disagree the preloader waits for load progress from a scene that is never
 * going to mount, and the curtain hangs until the failsafe timeout expires.
 *
 * - `ready`: pre-hydration we render the fallback, matching the server HTML.
 * - `hasWebGL`: an actual context probe, not a UA guess.
 * - `reducedMotion`: a continuously animating object is precisely what that
 *   setting asks us not to ship.
 */
export function shouldRender3D(profile: DeviceProfile): boolean {
  return profile.ready && profile.hasWebGL && !profile.reducedMotion;
}

/** Measure the full profile. Browser-only; call from an effect, not render. */
export function measureDeviceProfile(): DeviceProfile {
  if (typeof window === "undefined") return FALLBACK_DEVICE_PROFILE;

  const tier = detectTier();

  return {
    hasWebGL: detectWebGL(),
    isTouch: window.matchMedia("(pointer: coarse)").matches,
    isMobile: window.innerWidth < BREAKPOINTS.mobile,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    tier,
    dpr: dprForTier(tier),
    ready: true,
  };
}
