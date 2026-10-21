"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { DoubleSide, type Group, type Mesh } from "three";

import { damp } from "@/lib/math";
import { motionState } from "@/lib/motion-state";

import { CoffeeBeanMaterial } from "../materials/CoffeeBeanMaterial";

/** Deltas above this are treated as a hitch, not real elapsed time. */
const MAX_DELTA = 1 / 30;

type HeroCoffeeBeanProps = {
  /** Icosahedron subdivision level, chosen per performance tier. */
  detail: number;
};

/**
 * The hero object: a slowly tumbling coffee bean.
 *
 * Structure note — the transforms are split across nested objects on purpose. The
 * inner mesh owns the continuous tumble (an accumulating value) while the outer
 * group owns the damped pointer tilt (a value chasing a target). Mixing both on
 * one object means the damping constantly fights the tumble's accumulation and
 * the rotation stutters.
 */
export function HeroCoffeeBean({ detail }: HeroCoffeeBeanProps) {
  const tiltRef = useRef<Group>(null);
  const spinRef = useRef<Mesh>(null);
  const ringRef = useRef<Mesh>(null);

  // Instantiated once. Rebuilding a ShaderMaterial recompiles the program on the
  // GPU, which is a multi-millisecond stall — never do it in a render path.
  const material = useMemo(() => new CoffeeBeanMaterial(), []);

  // R3F auto-disposes objects it created from JSX, but this one is ours.
  useEffect(() => () => material.dispose(), [material]);

  /**
   * Composition in world units, not CSS.
   *
   * `viewport` is the scene's visible extent at z=0, so deriving placement from
   * it keeps the bean in the same *compositional* position at any window size —
   * offset into the right-hand column on landscape, centred and lifted on
   * portrait where there is no room beside the headline. A hardcoded
   * `position={[1, 0, 0]}` would drift across the layout as the aspect changes.
   *
   * Selector subscription: this re-renders only when the viewport actually
   * changes, not every frame.
   */
  const viewport = useThree((state) => state.viewport);
  const isPortrait = viewport.aspect < 1;
  const offsetX = isPortrait ? 0 : viewport.width * 0.2;
  /*
   * Portrait pushes the bean into the top third and shrinks it hard. The copy
   * block is bottom-aligned on that layout, so anything close to the landscape
   * size lands directly behind the headline — and a veil strong enough to fix
   * that by itself would grey out the bean entirely.
   */
  const offsetY = isPortrait ? viewport.height * 0.28 : 0.1;
  const baseScale = isPortrait ? 0.5 : 0.88;

  useFrame((_state, delta) => {
    const tilt = tiltRef.current;
    const spin = spinRef.current;
    if (!tilt || !spin) return;

    // Clamp the delta. Returning from a background tab or resuming a paused
    // frameloop hands us a delta of seconds, which would teleport every
    // time-integrated value in one frame.
    const dt = Math.min(delta, MAX_DELTA);

    const { pointer, heroProgress, scrollVelocity } = motionState;

    // Drive time by accumulated delta rather than `clock.elapsedTime`: the clock
    // keeps counting across a paused frameloop, so the surface relief would jump
    // when the canvas resumes.
    material.uniforms.uTime.value += dt;

    /*
     * Scroll velocity spins the bean faster — as if the page were a grinder.
     * A solid object shouldn't deform under scroll (that's what the previous
     * abstract shape did), so the energy goes into rotation instead, which reads
     * as physical momentum rather than jelly.
     */
    const boost = 1 + Math.min(Math.abs(scrollVelocity) * 0.022, 3.4);

    /*
     * The bean spins around its own long axis, like a turntable shot of one lying
     * on its side. The other two axes only drift gently around a fixed pose.
     *
     * This is the one axis that stays legible for a full revolution. Spinning
     * around the short axis instead — the obvious choice, and what this did first
     * — swings the bean end-on twice per turn, and from that angle the seam
     * splits the silhouette down the middle and the whole thing reads as a pair
     * of shells rather than a coffee bean. Around the long axis the full length is
     * always facing us and the seam simply sweeps across the face and back.
     *
     * Euler order matters here: three's default XYZ applies the x spin in the
     * object's own frame first, then the y/z drift tilts the result into the
     * composition. Reordering these would spin it in world space instead.
     */
    const elapsed = material.uniforms.uTime.value;
    spin.rotation.x += dt * 0.36 * boost;
    spin.rotation.y = 0.42 + Math.sin(elapsed * 0.26) * 0.12;
    spin.rotation.z = 0.18 + Math.sin(elapsed * 0.19) * 0.07;

    // Fade out as the hero scrolls away rather than leaving a hard edge.
    material.uniforms.uOpacity.value = 1 - heroProgress * 0.85;

    tilt.rotation.y = damp(tilt.rotation.y, pointer.x * 0.4, 2.6, dt);
    tilt.rotation.x = damp(tilt.rotation.x, -pointer.y * 0.28, 2.6, dt);

    // Sink and shrink on scroll — parallax against the DOM content moving up.
    tilt.position.y = damp(tilt.position.y, heroProgress * -1.1, 3.2, dt);
    tilt.scale.setScalar(damp(tilt.scale.x, 1 - heroProgress * 0.25, 3.2, dt));

    if (ringRef.current) {
      // Counter-rotation: the ring drifts the other way, so the two elements
      // separate in depth without needing a second light or a shadow pass.
      ringRef.current.rotation.z -= dt * 0.06;
    }
  });

  return (
    // Placement group is declarative — static transforms belong in JSX, where
    // they're applied once, rather than in the frame loop.
    <group position={[offsetX, offsetY, 0]} scale={baseScale}>
      <group ref={tiltRef}>
        <mesh ref={spinRef} material={material} rotation={[0, 0.42, 0.18]}>
          {/* Icosahedron over sphere: evenly sized triangles deform without the
              pinching you get at a UV sphere's poles, and the crease needs even
              tessellation to stay smooth. */}
          <icosahedronGeometry args={[1, detail]} />
        </mesh>

        {/* Hairline ring — a coffee-ring stain, the kind a cup leaves on paper.
            Tilted so its rotation is actually legible; a face-on circle spinning
            looks completely static. */}
        <mesh ref={ringRef} rotation={[0.95, 0, 0]} scale={1.28}>
          <ringGeometry args={[0.99, 1, 128]} />
          <meshBasicMaterial color="#a9713c" transparent opacity={0.22} side={DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}
