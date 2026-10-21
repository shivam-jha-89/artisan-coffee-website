"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

import { FALLBACK_DEVICE_PROFILE, type DeviceProfile } from "@/lib/device";
import {
  getDeviceServerSnapshot,
  getDeviceSnapshot,
  subscribeToDevice,
} from "@/lib/device-store";

const DeviceContext = createContext<DeviceProfile>(FALLBACK_DEVICE_PROFILE);

/**
 * Shares one device measurement with the whole tree.
 *
 * Why a provider on top of the store: WebGL probing and `matchMedia` reads touch
 * layout. Calling the store from ten components would still be ten subscriptions
 * and ten independent re-render paths — the context collapses that into one.
 *
 * Hydration contract: the server and the first client render both see
 * `ready: false` with the most conservative capabilities, so consumers must treat
 * `ready === false` as "render the non-WebGL fallback". That is deliberate — it
 * guarantees the HTML payload contains a complete, styled page.
 */
export function DeviceProvider({ children }: { children: ReactNode }) {
  const profile = useSyncExternalStore(
    subscribeToDevice,
    getDeviceSnapshot,
    getDeviceServerSnapshot,
  );

  return <DeviceContext.Provider value={profile}>{children}</DeviceContext.Provider>;
}

export function useDevice(): DeviceProfile {
  return useContext(DeviceContext);
}
