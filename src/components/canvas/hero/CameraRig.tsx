"use client";

import { useFrame, useThree } from "@react-three/fiber";

import { damp } from "@/lib/math";
import { motionState } from "@/lib/motion-state";

/**
 * Pointer and scroll driven camera parallax.
 *
 * Moving the *camera* rather than the object is what sells depth: translating a
 * mesh just slides a silhouette around, while translating the camera shifts the
 * perspective projection, so near and far parts of the scene move by different
 * amounts. It also costs nothing extra — the view matrix is recomputed every
 * frame regardless.
 *
 * Kept as its own component so the rig can be reused by other scenes and so the
 * hero object stays purely about its own material.
 */
export function CameraRig() {
  const camera = useThree((state) => state.camera);

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const { pointer, heroProgress } = motionState;

    // Heavier damping than the object's tilt (lower lambda = more lag). The
    // camera trailing slightly behind the pointer is what makes the movement
    // feel weighted rather than glued to the cursor.
    camera.position.x = damp(camera.position.x, pointer.x * 0.42, 2.2, dt);
    camera.position.y = damp(camera.position.y, pointer.y * 0.28 + heroProgress * 0.5, 2.2, dt);

    camera.lookAt(0, 0, 0);
  });

  return null;
}
