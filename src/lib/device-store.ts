"use client";

/**
 * Device profile as an external store, consumed via `useSyncExternalStore`.
 *
 * The obvious implementation is `useState` + `useEffect(() => setProfile(...))`,
 * but measuring on mount and then calling setState is exactly the cascading
 * render React warns about: the tree renders once with placeholder values, then
 * immediately again with real ones.
 *
 * `useSyncExternalStore` is built for this shape — data that lives outside React
 * (the browser's capabilities) and needs an SSR-safe snapshot. React reads
 * `getServerSnapshot` for the server pass and during hydration, then picks up the
 * measured snapshot, so hydration always matches and the upgrade happens in a
 * single render.
 */

import {
  FALLBACK_DEVICE_PROFILE,
  measureDeviceProfile,
  type DeviceProfile,
} from "@/lib/device";

let snapshot: DeviceProfile = FALLBACK_DEVICE_PROFILE;
let hasMeasured = false;
/** Detaches the shared listeners once the last consumer unsubscribes. */
let cleanup: (() => void) | null = null;

const listeners = new Set<() => void>();

/**
 * Re-measure and swap the snapshot only if something we care about changed.
 *
 * Identity stability is a hard requirement: `getSnapshot` must return the same
 * reference when nothing has changed, or `useSyncExternalStore` detects an
 * endless stream of updates and throws.
 */
function refresh(): boolean {
  const next = measureDeviceProfile();

  const unchanged =
    snapshot.ready === next.ready &&
    snapshot.hasWebGL === next.hasWebGL &&
    snapshot.isTouch === next.isTouch &&
    snapshot.isMobile === next.isMobile &&
    snapshot.reducedMotion === next.reducedMotion &&
    snapshot.tier === next.tier;

  if (unchanged) return false;

  snapshot = next;
  return true;
}

export function subscribeToDevice(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);

  // Listeners are attached once for the whole app, no matter how many components
  // read the store.
  if (listeners.size === 1) {
    const notify = () => {
      if (refresh()) {
        for (const listener of listeners) listener();
      }
    };

    // Resize fires continuously during a drag; coalesce to one measurement per
    // frame so we never read layout more often than we could paint.
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(notify);
    };

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    window.addEventListener("resize", onResize, { passive: true });
    reducedMotionQuery.addEventListener("change", notify);

    cleanup = () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      reducedMotionQuery.removeEventListener("change", notify);
    };
  }

  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0) {
      cleanup?.();
      cleanup = null;
    }
  };
}

export function getDeviceSnapshot(): DeviceProfile {
  // Measured lazily on first read rather than at module scope, which would run
  // during SSR where none of these APIs exist.
  if (!hasMeasured) {
    hasMeasured = true;
    refresh();
  }
  return snapshot;
}

export function getDeviceServerSnapshot(): DeviceProfile {
  return FALLBACK_DEVICE_PROFILE;
}
