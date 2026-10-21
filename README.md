# High-End — Motion & WebGL Landing Page Architecture

A production-ready foundation for an immersive, scroll-driven landing page: Next.js App Router, Lenis smooth scroll synchronised with GSAP ScrollTrigger, and a React Three Fiber hero with real mobile fallbacks.

The priority throughout is a **60fps frame budget**. Most of the architecture below exists to keep per-frame work out of React's render path.

## Stack

| Concern         | Choice                                    |
| --------------- | ----------------------------------------- |
| Framework       | Next.js 16 (App Router, TypeScript)       |
| Styling         | Tailwind CSS v4 (CSS-first `@theme`)      |
| Smooth scroll   | `lenis` 1.3                               |
| Animation       | `gsap` 3.15 + ScrollTrigger, CustomEase, SplitText |
| React/GSAP glue | `@gsap/react` (`useGSAP`)                 |
| 3D              | `three`, `@react-three/fiber` 9, `@react-three/drei` |

## Getting started

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
npm run lint
```

## Directory structure

```
src/
├── app/
│   ├── layout.tsx              Fonts, metadata, single client boundary
│   ├── page.tsx                Section composition (server component)
│   └── globals.css             Tailwind v4 @theme tokens, base styles, keyframes
│
├── providers/                  Global, order-dependent app wiring
│   ├── AppProviders.tsx        Composes the three providers below
│   ├── DeviceProvider.tsx      Capability profile via useSyncExternalStore
│   ├── PreloaderProvider.tsx   Coarse load phase (loading → reveal → ready)
│   └── SmoothScrollProvider.tsx  ← Lenis ⇄ GSAP ticker ⇄ ScrollTrigger sync
│
├── components/
│   ├── canvas/                 Everything WebGL
│   │   ├── HeroCanvasSlot.tsx  Capability gate + dynamic import boundary
│   │   ├── CanvasFallback.tsx  Zero-JS CSS fallback
│   │   ├── hero/
│   │   │   ├── HeroExperience.tsx   The <Canvas> (only static three import)
│   │   │   ├── HeroCoffeeBean.tsx   Procedural coffee bean, tumbling
│   │   │   ├── CameraRig.tsx        Pointer/scroll camera parallax
│   │   │   └── SceneLoadReporter.tsx  LoadingManager → preloader bridge
│   │   └── materials/
│   │       ├── CoffeeBeanMaterial.ts  Typed ShaderMaterial subclass
│   │       └── glsl/noise.ts        Shared simplex noise source
│   │
│   ├── sections/               One file per scroll act
│   │   ├── Hero.tsx                Intro timeline + scroll-out
│   │   ├── ManifestoSection.tsx    Word-by-word scrubbed reveal
│   │   ├── StorySection.tsx        Pinned horizontal scrub
│   │   └── ClosingSection.tsx      Velocity-reactive marquee
│   │
│   ├── motion/
│   │   └── RevealText.tsx      Reusable masked SplitText reveal
│   └── ui/
│       ├── Preloader.tsx       Curtain + load gate
│       └── SiteHeader.tsx      Fixed nav (mix-blend-difference)
│
├── hooks/
│   ├── useIsVisible.ts             IntersectionObserver + tab visibility
│   ├── usePointerTracking.ts       Single global pointer listener
│   └── useIsomorphicLayoutEffect.ts
│
└── lib/
    ├── gsap.ts                 Single registration point + named eases
    ├── motion-state.ts         Non-reactive per-frame store (DOM → GPU)
    ├── asset-loader.ts         Scene load progress registry
    ├── device.ts               Capability detection + quality tiers
    ├── device-store.ts         External store backing DeviceProvider
    └── math.ts                 lerp / clamp / frame-rate independent damp
```

## The five decisions that matter

### 1. Lenis and GSAP share one clock

Two independent `requestAnimationFrame` loops execute in an undefined order, so on any frame the scroll position may be applied *after* the tweens that depend on it. That mismatch is the jitter people describe as "Lenis and ScrollTrigger fighting". `SmoothScrollProvider` fixes it with three lines:

```ts
lenis.on("scroll", () => ScrollTrigger.update());   // same-frame trigger updates
gsap.ticker.add((time) => lenis.raf(time * 1000));  // GSAP owns the only rAF loop
gsap.ticker.lagSmoothing(0);                        // never clamp scroll-linked deltas
```

Lenis is constructed with `autoRaf: false` so it has no loop of its own. See the inline comments in `SmoothScrollProvider.tsx` for why each line is required.

### 2. Per-frame values never touch React state

`lib/motion-state.ts` is a plain mutable object. ScrollTrigger and the pointer listener write to it; `useFrame` reads from it. No subscriptions, no re-renders, no allocation.

The alternative — `useState` updated from `onUpdate` — re-renders a component tree 60–120 times per second while scrolling and reliably drops frames.

> **Rule of thumb:** values that change every frame go in `motion-state`. Values that change a handful of times (load phase, device tier) go in React state.

The same principle drives the numeric counters: the preloader percentage and the chapter index are written straight to `textContent`.

### 3. Mobile fallbacks are structural, not cosmetic

`lib/device.ts` probes an actual WebGL context (UA sniffing lies) and derives a `low | mid | high` tier from core count, memory hint, pointer type and viewport. The tier scales quality only, never correctness:

| Tier | DPR clamp | Antialias | Icosahedron detail |
| ---- | --------- | --------- | ------------------ |
| high | 1 – 2     | on        | 24 (~12.5k tris)   |
| mid  | 1 – 1.5   | on        | 16 (~5.6k tris)    |
| low  | 1 – 1     | off       | 8 (~1.4k tris)     |

Clamping DPR is the highest-leverage mobile win available, since fragment cost scales with its square — a 3x-DPR phone rendering at 3x draws 9× the pixels of a 1x pass.

Beyond quality scaling:

- **`shouldRender3D()` is the single source of truth** for whether WebGL runs at all. The canvas mount and the preloader's asset gate both call it — when they disagree, the preloader waits for a scene that never mounts and the curtain hangs.
- **The renderer is a separate chunk.** `HeroCanvasSlot` is the only path to three, via `next/dynamic({ ssr: false })`, so a device that fails the probe never downloads ~600KB.
- **`frameloop="never"` when off-screen or backgrounded** (`useIsVisible`). A canvas left running costs full GPU time after you've scrolled past it.
- **Reduced motion is honoured at every layer** — no Lenis, no 3D, no pin, no CSS animation.
- **The server renders the fallback.** The pre-hydration profile is the most conservative one, so the HTML payload always contains a complete, styled page.

### 4. The preloader gates on real signals

`Preloader.tsx` combines weighted progress from `document.fonts.ready` (35%) and three's `LoadingManager` (65%), with a `MIN_DURATION` floor so a warm cache still gets a legible count-up, and a `MAX_DURATION` ceiling so a hung asset shows the site instead of a dead screen.

Phases overlap deliberately: hero timelines start on `reveal`, while the curtain is still lifting, rather than waiting for `ready`.

Assets report through `lib/asset-loader.ts`, so the preloader itself never imports three.

### 5. Animation setup is scoped and reversible

Every animation lives in `useGSAP` with a `scope`, so selector strings resolve inside the component and GSAP reverts everything on unmount. `StorySection` uses `gsap.matchMedia()` for its responsive branches: crossing the breakpoint fully reverts the other branch, pin spacers included.

## Extending it

**Add a 3D model.** Drop the file in `public/`, then load it inside the existing Suspense boundary in `HeroExperience.tsx`:

```tsx
const { scene } = useGLTF("/model.glb");
```

`SceneLoadReporter` picks it up automatically — it observes the default `LoadingManager`, so the preloader bar starts reflecting real bytes with no other changes.

**Add a section.** Create it in `components/sections/`, mark it `"use client"`, put its animation in a `useGSAP` with `scope`, and add it to `page.tsx`. Publish scroll progress to `motion-state` if the 3D layer needs to react.

**Add a scrubbed animation.** Always pass `ease: "none"`. Any easing curve makes the animation's rate diverge from the scroll's, which feels like drag.

**Change the palette.** Edit the `@theme` block in `globals.css`. Tokens are available both as Tailwind utilities (`bg-cream`) and CSS variables (`var(--color-cream)`), which is how the WebGL fallback stays in sync. The bean's own colours are uniforms in `CoffeeBeanMaterial.ts` — they live in the shader rather than in CSS, so keep the two in step by hand.

One gotcha worth knowing on a light palette: the hero's legibility scrim is a cream gradient sitting on top of the canvas, so widening it washes out the 3D object and makes the material look broken. If the bean ever renders milky, check the scrim's gradient stops before you touch the shader.

## Performance checklist

- Animate `transform` and `opacity` only. `width`, `top` and `background-color` trigger layout or paint every frame.
- Use `damp()` from `lib/math.ts` rather than a raw lerp, so easing is frame-rate independent.
- Clamp `useFrame` deltas (`Math.min(delta, 1/30)`); a resumed frameloop hands you deltas measured in seconds.
- Never construct a `ShaderMaterial` in a render path — recompiling the program stalls the GPU for milliseconds.
- Call `ScrollTrigger.refresh()` after anything that changes document height.
- Keep `resize={{ scroll: false }}` on the Canvas so R3F doesn't measure bounds on every Lenis-driven scroll frame.

## Accessibility

`prefers-reduced-motion` disables smooth scroll, 3D and every entrance animation. Split text is created from real DOM copy so crawlers and screen readers get the authored content, the preloader announces itself via `role="status"`, and focus styling survives the dark palette.

## Known constraints

- `react-hooks/immutability` is disabled for `src/components/canvas/**` (see `eslint.config.mjs`). R3F is built on mutating three.js objects inside `useFrame`; the rule assumes the opposite.
- The hero geometry is fully procedural, so `LoadingManager` reports zero assets until you add some. `SceneLoadReporter` auto-completes that share of the bar in the meantime.
