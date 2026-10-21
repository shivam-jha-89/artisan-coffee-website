"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";

import { shouldRender3D } from "@/lib/device";
import { useIsVisible } from "@/hooks/useIsVisible";
import { useDevice } from "@/providers/DeviceProvider";

import { CanvasFallback } from "./CanvasFallback";

/**
 * The capability boundary between the DOM and WebGL.
 *
 * `ssr: false` is required, not stylistic: three touches `window` at module
 * scope, and rendering a canvas on the server produces markup that can't match
 * the client anyway. Combined with this being the only import path to three, it
 * means the renderer is a lazily-fetched chunk instead of initial-payload cost.
 */
const HeroExperience = dynamic(() => import("./hero/HeroExperience"), {
  ssr: false,
  // Same visual as the permanent fallback, so upgrading to WebGL is a
  // cross-fade rather than a layout pop.
  loading: () => <CanvasFallback />,
});

export function HeroCanvasSlot() {
  const profile = useDevice();
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisible = useIsVisible(containerRef);

  // Shared with the preloader's asset gate so the two can never disagree about
  // whether a scene is coming.
  const render3D = shouldRender3D(profile);

  return (
    <div ref={containerRef} className="absolute inset-0" aria-hidden>
      {render3D ? (
        <HeroExperience profile={profile} active={isVisible} />
      ) : (
        <CanvasFallback />
      )}
    </div>
  );
}
