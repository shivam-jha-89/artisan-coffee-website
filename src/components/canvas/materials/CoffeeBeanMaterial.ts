import { Color, ShaderMaterial } from "three";

import { SIMPLEX_NOISE_3D } from "./glsl/noise";

/**
 * Vertex stage: sculpts a coffee bean out of a sphere, in the shader.
 *
 * Why procedural instead of a GLTF model: the shape is a handful of smooth
 * mathematical operations, so generating it costs zero bytes over the network and
 * zero decode time — versus a model file that has to be fetched, parsed and
 * uploaded before the hero can appear. It also stays crisp at any zoom and its
 * detail scales with the device tier for free.
 *
 * The anatomy being reproduced, in the order it gets applied:
 *
 *   1. A fuller-than-elliptical silhouette. A real bean's outline is closer to a
 *      rounded rectangle than an ellipse — the sides carry more width before they
 *      turn the corner.
 *   2. Two plump lobes. This is the detail that decides whether the object reads
 *      as coffee: the bean is a seed split down the middle, and each half domes
 *      out on its own.
 *   3. A deep, narrow crease between them, meandering slightly and closing before
 *      it reaches the tips.
 *   4. Wrinkles running across the lobes, away from the crease, plus fine pitting
 *      from roasting.
 */
const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uCrease;
uniform float uWrinkle;
uniform float uMicro;

varying vec3 vNormal;
varying vec3 vViewDir;
varying float vCrease;
varying float vRelief;

${SIMPLEX_NOISE_3D}

/* Silhouette exponent. 2.0 is a plain ellipse; higher squares off the sides. */
const float SUPER_N = 2.6;

/**
 * Maps a point on the unit sphere onto the bean surface.
 *
 * The two out parameters report how deep in the crease this point sits and how
 * high it rides on a wrinkle, so the fragment stage can shade both features
 * without recomputing any of this.
 */
vec3 beanSurface(vec3 sp, out float creaseOut, out float wrinkleOut) {
  /*
   * Superellipse fullness. Measured on the sphere's xy direction, so at the
   * equator — which is exactly the set of points that forms the silhouette — this
   * produces a true superellipse, and cross-sections above and below scale with
   * it so the solid stays coherent.
   */
  // Not named "flat": that is a reserved interpolation qualifier in GLSL.
  vec2 planar = vec2(sp.x, sp.y);
  vec2 dir = planar / max(length(planar), 1e-4);
  float superR = pow(pow(abs(dir.x), SUPER_N) + pow(abs(dir.y), SUPER_N), -1.0 / SUPER_N);
  /*
   * Applied at low strength. A superellipse fills out the sides, but it fills the
   * diagonals most, and past roughly a third of the way the outline stops reading
   * as elongated at all — which is the point where the object stops looking like
   * coffee and starts looking like a nut.
   */
  float fullness = mix(1.0, superR, 0.32);

  // Long in x, medium in y, flattened in z.
  vec3 p = sp * vec3(1.0, 0.68, 0.58);
  p.xy *= fullness;

  // Taper toward the tips. Without this the ends stay as full as the middle and
  // the silhouette reads as a pill rather than a seed.
  p.y *= 1.0 - 0.26 * pow(abs(sp.x), 2.2);
  p.z *= 1.0 - 0.3 * pow(abs(sp.x), 2.4);

  // The crease meanders rather than running dead straight — real beans do, and
  // that slight S-curve is most of what sells it.
  float creaseLine = 0.1 * sin(sp.x * 2.2);
  float offset = abs(sp.y - creaseLine);
  /*
   * The seam runs almost the entire length, closing only right at the tips. This
   * matters more than it sounds: fade it out early and you get a short slit in
   * the middle of a lump, which is not what a bean looks like — the full-length
   * seam is the single most recognisable thing about the shape.
   */
  float tipFade = smoothstep(0.99, 0.62, abs(sp.x));

  /*
   * Narrow valley at the seam, and a broad dome centred on each lobe.
   *
   * The valley's width is the sensitive number. Wide and deep together carve an
   * open canyon, and at certain rotations the bean reads as a shell with its
   * mouth open. A real seam is tight: the two halves nearly touch, and what you
   * see is a thin dark line with folded edges.
   */
  float valley = exp(-pow(offset / 0.135, 2.0)) * tipFade;
  float lobe = exp(-pow((offset - 0.46) / 0.32, 2.0));

  creaseOut = valley;

  /*
   * Scaling z (rather than subtracting from it) is the trick that keeps this
   * clean: the indent is proportional to how far out the surface already is, so
   * it fades to nothing at the rim where z is already 0. Subtracting a constant
   * would push the two faces through each other and tear a seam along the edge.
   *
   * Near 0.9 the seam very nearly pinches shut, which is what separates two
   * distinct lobes from one ellipsoid with a dent in it.
   */
  p.z *= (1.0 + 0.1 * lobe) * (1.0 - uCrease * valley);

  /*
   * Wrinkles. The noise coordinate is deliberately anisotropic — stretched ~4x
   * along the bean's long axis — so its iso-lines run across the lobes, away from
   * the crease, the way the real thing folds. Isotropic noise here just looks
   * like generic lumpiness.
   *
   * The warp term is what keeps it from looking manufactured: pure anisotropic
   * noise produces near-parallel ridges of even spacing, which reads as corduroy
   * rather than skin. Displacing the sampling coordinate by a low-frequency noise
   * makes the ridges wander and occasionally merge, the way real folds do.
   */
  float warp = snoise(sp * 2.3) * 0.4;
  float wrinkle = snoise(vec3(sp.x * 10.0 + warp, sp.y * 2.4, sp.z * 2.4));
  // Broaden the peaks: raw simplex is too sinusoidal to read as folded skin.
  wrinkle = sign(wrinkle) * pow(abs(wrinkle), 0.7);
  // Mid-frequency octave: breaks up the ridges and doubles as roast pitting.
  float grain = snoise(sp * 5.2 + vec3(0.0, 0.0, uTime * 0.04));

  // Relief fades out inside the crease, where the surface is already folded.
  float fade = 1.0 - valley * 0.75;
  wrinkleOut = wrinkle * fade;
  p += normalize(p) * (wrinkle * uWrinkle + grain * uMicro) * fade;

  return p;
}

void main() {
  vec3 sp = normalize(position);

  // Tangent basis for normal reconstruction. The helper axis is swapped near the
  // poles because cross(sp, up) collapses to zero there and would tear the mesh.
  vec3 helper = mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), step(0.99, abs(sp.y)));
  vec3 tangent = normalize(cross(sp, helper));
  vec3 bitangent = normalize(cross(sp, tangent));
  /*
   * Sampling distance for the finite-difference normal. Too small and the
   * near-vertical walls of the seam produce degenerate cross products, which show
   * up as grey specks where the two lobes pinch together; too large and the
   * wrinkles get smoothed out of the lighting entirely.
   */
  float eps = 0.034;

  /*
   * Normals are rebuilt from the deformed surface, not inherited from the sphere.
   * This is the step that's usually skipped: keep the sphere's normals and the
   * crease and wrinkles become invisible to lighting — you get a bean-shaped
   * silhouette that shades like a ball, which looks like a bug nobody can name.
   */
  float crease;
  float creaseA;
  float creaseB;
  float wrinkle;
  float wrinkleA;
  float wrinkleB;
  vec3 surface = beanSurface(sp, crease, wrinkle);
  vec3 neighbourA = beanSurface(normalize(sp + tangent * eps), creaseA, wrinkleA);
  vec3 neighbourB = beanSurface(normalize(sp + bitangent * eps), creaseB, wrinkleB);

  vec3 rebuilt = normalize(cross(neighbourA - surface, neighbourB - surface));
  // The cross product's winding depends on the basis we happened to pick, so
  // force the result outward.
  rebuilt *= sign(dot(rebuilt, sp));

  vec4 viewPosition = viewMatrix * modelMatrix * vec4(surface, 1.0);

  vNormal = normalize(normalMatrix * rebuilt);
  vViewDir = normalize(-viewPosition.xyz);
  vCrease = crease;
  vRelief = wrinkle;

  gl_Position = projectionMatrix * viewPosition;
}
`;

/**
 * Fragment stage: a roasted-bean surface under a two-light studio setup.
 *
 * Deliberately not three's lighting model — no light objects, no shadow maps, no
 * per-light uniforms. Two dot products get us believable product-photography form
 * at a fraction of the cost, which is what keeps this at 60fps on a phone.
 */
const fragmentShader = /* glsl */ `
uniform vec3 uColorRoast;
uniform vec3 uColorDeep;
uniform vec3 uColorCrease;
uniform vec3 uColorSheen;
uniform float uOpacity;

varying vec3 vNormal;
varying vec3 vViewDir;
varying float vCrease;
varying float vRelief;

/**
 * Linear to sRGB transfer function.
 *
 * three converts hex colours to linear space on the way in, and the canvas
 * expects fragments encoded for the output color space. three only injects that
 * encode into shaders that include its colorspace chunk, which a standalone
 * ShaderMaterial does not — so we do it explicitly here. Writing it out rather
 * than including the chunk keeps this material independent of three's internal
 * shader library, where a version bump could otherwise silently shift the scene.
 */
vec3 linearToSRGB(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewDir);

  // Key light up and to the left — the default studio position, and the one that
  // reads most naturally in product photography.
  vec3 keyDir = normalize(vec3(-0.42, 0.78, 0.55));
  // Fill from the opposite side, weak, to keep the shadow side from going flat
  // black. This pair is what makes the two lobes read as separate volumes.
  vec3 fillDir = normalize(vec3(0.55, -0.32, 0.42));

  /*
   * Clamped Lambert with an explicit ambient floor, rather than a half-Lambert
   * wrap. Half-Lambert (dot * 0.5 + 0.5) never lets any part of the surface get
   * genuinely dark — the shadow side bottoms out at the midpoint of the ramp — so
   * a brown object drifts toward milky beige and reads as chocolate instead of
   * coffee.
   */
  float key = max(dot(normal, keyDir), 0.0);
  float fill = max(dot(normal, fillDir), 0.0) * 0.2;
  float shade = clamp(0.16 + 0.84 * pow(key, 0.9) + fill, 0.0, 1.0);

  vec3 color = mix(uColorDeep, uColorRoast, shade);

  /*
   * Cavity term: darken the wrinkle valleys, lift the ridges slightly.
   *
   * Lighting alone gives the wrinkles shape but not tone, and a roasted surface
   * with perfectly even colour across every fold is most of what makes a render
   * look like moulded plastic. Reusing the displacement value the vertex stage
   * already computed costs one varying and no extra noise samples.
   */
  color *= mix(0.8, 1.06, vRelief * 0.5 + 0.5);

  // Ambient occlusion in the crease. Cheap, and without it the seam reads as a
  // painted line rather than a recess between two halves.
  color *= 1.0 - vCrease * 0.62;

  // The crease exposes the pale silverskin along its length, so its centre comes
  // back up in value even though the walls around it are in shadow.
  color = mix(color, uColorCrease, smoothstep(0.72, 1.0, vCrease) * 0.38);

  /*
   * Beans carry a faint oil sheen, so the highlight has to stay tight and weak.
   * A broad, strong one interacts with the wrinkle normals and scatters into
   * blotches, which instantly reads as wet clay.
   */
  vec3 halfway = normalize(keyDir + viewDir);
  float specular = pow(max(dot(normal, halfway), 0.0), 58.0) * 0.11;
  // No specular inside the seam; a highlight down there destroys the depth.
  specular *= 1.0 - vCrease * 0.85;

  /*
   * Rim term separates the dark bean from the cream background at the edges. It
   * gets suppressed inside the seam: a recess has no background behind it to pick
   * up, and leaving it on lights the near-vertical seam walls into pale specks
   * wherever the reconstructed normal turns edge-on.
   */
  float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
  rim *= 1.0 - vCrease * 0.92;

  color += uColorSheen * specular;
  color += uColorSheen * rim * 0.16;

  gl_FragColor = vec4(linearToSRGB(color), uOpacity);
}
`;

export type CoffeeBeanUniforms = {
  uTime: { value: number };
  /** Seam depth, 0 → 1. Near 0.9 the two lobes almost meet; 1.0 pinches shut. */
  uCrease: { value: number };
  /** Amplitude of the wrinkles running across the lobes. */
  uWrinkle: { value: number };
  /** Fine roast pitting. Keep tiny — this is surface, not shape. */
  uMicro: { value: number };
  uOpacity: { value: number };
  uColorRoast: { value: Color };
  uColorDeep: { value: Color };
  uColorCrease: { value: Color };
  uColorSheen: { value: Color };
};

/**
 * Subclassing `ShaderMaterial` rather than using drei's `shaderMaterial()`
 * helper is a deliberate TypeScript call: the helper requires `extend()` plus
 * `ThreeElements` module augmentation to be usable in JSX, and the resulting
 * element props are only loosely typed. A plain class instantiated in `useMemo`
 * gives fully-typed uniform access (`material.uniforms.uTime.value`) with no
 * global namespace patching.
 */
export class CoffeeBeanMaterial extends ShaderMaterial {
  declare uniforms: CoffeeBeanUniforms;

  constructor() {
    super({
      vertexShader,
      fragmentShader,
      transparent: true,
      // We encode the output color space by hand, so keep three out of it.
      toneMapped: false,
      uniforms: {
        uTime: { value: 0 },
        uCrease: { value: 0.82 },
        uWrinkle: { value: 0.012 },
        uMicro: { value: 0.006 },
        uOpacity: { value: 1 },
        // Medium roast: warm enough to sit in a light palette, dark enough that
        // the bean still reads as coffee against the cream background.
        uColorRoast: { value: new Color("#8b5626") },
        uColorDeep: { value: new Color("#2a1a0e") },
        uColorCrease: { value: new Color("#c9a87c") },
        uColorSheen: { value: new Color("#f6ecdc") },
      },
    });
  }
}
