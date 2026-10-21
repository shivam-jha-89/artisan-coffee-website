"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";

import { detailForTier, type DeviceProfile } from "@/lib/device";

import { CameraRig } from "./CameraRig";
import { HeroCoffeeBean } from "./HeroCoffeeBean";
import { SceneLoadReporter } from "./SceneLoadReporter";

type HeroExperienceProps = {
  profile: DeviceProfile;
  /** False when scrolled out of view or the tab is hidden — pauses rendering. */
  active: boolean;
};

/**
 * The WebGL entry point, and the *only* module that statically imports three.
 *
 * Everything three-related is reachable only through this file, so
 * `HeroCanvasSlot`'s dynamic import puts the entire renderer (~600KB) in a
 * separate chunk. A phone that fails the capability check never downloads it.
 *
 * Default export because `next/dynamic` resolves that shape most cleanly.
 */
export default function HeroExperience({ profile, active }: HeroExperienceProps) {
  return (
    <Canvas
      // Clamped by tier. Fragment cost scales with the square of this value, so
      // it is the first dial to turn on mobile.
      dpr={profile.dpr}
      // Stop rendering entirely when off-screen or backgrounded.
      frameloop={active ? "always" : "never"}
      camera={{ fov: 32, near: 0.1, far: 40, position: [0, 0, 5.2] }}
      gl={{
        // MSAA is a real cost on mobile GPUs, and our object is a smooth blob
        // whose edges barely benefit.
        antialias: profile.tier !== "low",
        // Transparent canvas: DOM content behind it stays visible, which is what
        // lets the section be composed in CSS rather than in the scene.
        alpha: true,
        powerPreference: "high-performance",
        // No stencil buffer needed; skipping it saves memory bandwidth per frame.
        stencil: false,
      }}
      // R3F recomputes canvas bounds on scroll by default. With Lenis driving
      // scroll every frame that turns into a `getBoundingClientRect()` per frame
      // — a guaranteed layout thrash. We resize on window resize only.
      resize={{ scroll: false, debounce: { scroll: 0, resize: 200 } }}
      onCreated={({ gl }) => {
        gl.setClearAlpha(0);
      }}
      // Pointer events belong to the DOM overlay (real links and buttons), not
      // the canvas. The scene reads pointer position from `motionState` instead.
      style={{ pointerEvents: "none" }}
    >
      <SceneLoadReporter />
      <CameraRig />

      {/* Suspense boundary is here for the assets you'll add next (GLTF models,
          textures, environment maps) — the procedural hero never suspends. */}
      <Suspense fallback={null}>
        <HeroCoffeeBean detail={detailForTier(profile.tier)} />
      </Suspense>
    </Canvas>
  );
}
