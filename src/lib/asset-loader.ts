/**
 * Asset pipeline handoff between the WebGL layer and the preloader.
 *
 * Same non-reactive pattern as `motion-state`: the preloader polls this object
 * once per frame from the ticker it already runs, so we need neither a
 * subscription mechanism nor a re-render per loaded byte.
 *
 * Why not read drei's `useProgress` in the preloader directly? It would pull
 * `three` (~600KB) into the initial chunk, so a low-end device that will never
 * run WebGL would still pay to download the entire renderer just to draw a
 * percentage. The heavy dependency stays inside the lazily-loaded canvas, and
 * only numbers cross this boundary.
 */

export type SceneLoadState = {
  /** 0 → 1, mirroring three's LoadingManager across every texture/model. */
  progress: number;
  /** True once the renderer exists and all queued assets have resolved. */
  ready: boolean;
};

const state: SceneLoadState = {
  progress: 0,
  ready: false,
};

/** Called from inside the R3F tree as three's LoadingManager reports in. */
export function reportSceneProgress(progress: number): void {
  state.progress = Math.max(state.progress, Math.min(progress, 1));
}

/** Called once the renderer is live and nothing is left in the load queue. */
export function markSceneReady(): void {
  state.progress = 1;
  state.ready = true;
}

export function getSceneLoadState(): Readonly<SceneLoadState> {
  return state;
}

export function resetSceneLoadState(): void {
  state.progress = 0;
  state.ready = false;
}
