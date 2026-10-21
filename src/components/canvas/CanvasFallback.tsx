/**
 * Zero-JavaScript stand-in for the WebGL hero.
 *
 * Shown in three situations, all of which are real:
 *
 * - The device has no usable WebGL context (or it's blocklisted).
 * - The visitor asked for reduced motion.
 * - The 3D chunk is still downloading (this is the `next/dynamic` loading state).
 *
 * It is also what the server renders, so the HTML payload always contains a
 * finished-looking hero. Built entirely from border-radius, gradients and blur —
 * no images to download, no canvas — and it animates on the compositor.
 *
 * The shape mirrors the shader: an ellipse for the body, a curved lighter line
 * for the crease, a hairline ring for the coffee-stain orbit. Placement mirrors
 * it too — right-hand column on landscape, top third on portrait — because this
 * swaps in for the canvas at runtime, and a fallback that sits somewhere else
 * would visibly jump when the real scene takes over.
 */
export function CanvasFallback() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <div className="absolute top-[22%] left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-1/2 md:left-[68%]">
        {/* Resting tilt lives on its own wrapper so it survives the animation
            being switched off under prefers-reduced-motion — an axis-aligned
            ellipse reads as an egg, not a bean. */}
        <div className="-rotate-[17deg]">
          {/* Bean body. `animate-drift` is a slow rotate/scale loop, neutralised
              under prefers-reduced-motion by the media query in globals.css. */}
          <div className="animate-drift relative h-[min(38vw,17rem)] w-[min(56vw,26rem)] rounded-[50%] bg-[radial-gradient(ellipse_at_34%_24%,#8a5a33,#5d3418_46%,#2a1a0e_100%)] shadow-[0_40px_110px_-45px_rgba(43,29,19,0.5)] md:h-[min(24vw,19rem)] md:w-[min(34vw,28rem)]">
            {/* Crease. A transparent element with only a top border, curved by an
                asymmetric radius — the cheapest way to draw an arc in CSS. */}
            <div className="absolute inset-x-[9%] top-1/2 h-[40%] -translate-y-1/2 rounded-[50%] border-t-2 border-[#d8bb93]/75 blur-[1px]" />
          </div>
        </div>

        {/* Coffee-ring stain, echoing the orbit ring in the 3D scene. */}
        <div className="absolute top-1/2 left-1/2 h-[min(46vw,21rem)] w-[min(70vw,33rem)] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-caramel/25 md:h-[min(30vw,23rem)] md:w-[min(42vw,35rem)]" />
      </div>
    </div>
  );
}
