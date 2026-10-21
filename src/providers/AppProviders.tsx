"use client";

import type { ReactNode } from "react";

import { Preloader } from "@/components/ui/Preloader";
import { usePointerTracking } from "@/hooks/usePointerTracking";
import { DeviceProvider, useDevice } from "@/providers/DeviceProvider";
import { PreloaderProvider } from "@/providers/PreloaderProvider";
import { SmoothScrollProvider } from "@/providers/SmoothScrollProvider";

/**
 * Provider composition. Order is load-bearing:
 *
 * 1. `DeviceProvider`    — everything below branches on capability, so it has to
 *                          resolve first.
 * 2. `PreloaderProvider` — owns the load phase that the scroll lock reads.
 * 3. `SmoothScrollProvider` — needs both: capability to decide *whether* to run
 *                          Lenis, and phase to decide *when* to unlock it.
 *
 * This is the only `"use client"` boundary the root layout crosses, which keeps
 * `layout.tsx` and `page.tsx` server components. Sections stay individually
 * server-rendered as static HTML and only their animation logic ships as JS.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <DeviceProvider>
      <PreloaderProvider>
        <SmoothScrollProvider>
          <PointerBridge />
          <Preloader />
          {children}
        </SmoothScrollProvider>
      </PreloaderProvider>
    </DeviceProvider>
  );
}

/**
 * Renders nothing; exists so the pointer listener can read the device profile
 * without forcing `AppProviders` itself to be a consumer (a consumer would
 * re-render all children on every profile change).
 */
function PointerBridge() {
  const { isTouch, reducedMotion } = useDevice();
  usePointerTracking(!isTouch && !reducedMotion);
  return null;
}
