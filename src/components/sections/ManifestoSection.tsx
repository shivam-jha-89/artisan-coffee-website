"use client";

import { useRef } from "react";

import { SplitText, gsap, useGSAP } from "@/lib/gsap";
import { useDevice } from "@/providers/DeviceProvider";

const STATEMENT =
  "Roasting is a conversation with time. Thirty seconds too long and the sugars turn to ash; thirty too short and the acidity never resolves. We chase the same curve every week, on the same drum, until the bean tells us it is ready.";

/**
 * Word-by-word scrubbed reveal.
 *
 * A second, quieter flavour of scroll-driven storytelling: instead of pinning and
 * taking over the viewport, this section lets the reader keep scrolling normally
 * while the text illuminates in step with them. Same mechanism as the pinned
 * section — progress mapped onto a timeline — but the reader stays in control,
 * which is why it works for long-form copy where a pin would feel like a trap.
 */
export function ManifestoSection() {
  const rootRef = useRef<HTMLElement>(null);
  const { ready, reducedMotion } = useDevice();

  useGSAP(
    () => {
      const target = rootRef.current?.querySelector<HTMLElement>("[data-manifesto]");
      if (!target || !ready) return;

      // The copy is legible at rest, so reduced motion simply means: leave it.
      if (reducedMotion) return;

      const split = SplitText.create(target, {
        type: "words",
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.words, {
            // Opacity only. Animating `color` per word repaints text on every
            // frame; opacity on an already-composited element does not.
            //
            // Tuned for a light background: espresso ink at 20% over cream lands
            // around #d5cbc0 — clearly "not yet read" while still holding the
            // shape of the paragraph, so the layout doesn't appear to be missing.
            opacity: 0.2,
            ease: "none",
            stagger: 0.4,
            scrollTrigger: {
              trigger: target,
              // Starts as the paragraph enters the lower third and completes
              // before it exits, so the last word lights up while still
              // comfortably readable rather than at the top edge of the screen.
              start: "top 75%",
              end: "bottom 45%",
              scrub: true,
            },
          }),
      });

      return () => split.revert();
    },
    { dependencies: [ready, reducedMotion], scope: rootRef },
  );

  return (
    <section
      ref={rootRef}
      id="manifesto"
      className="relative flex min-h-svh items-center bg-cream px-6 py-32 md:px-10"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 md:flex-row md:gap-20">
        <span className="shrink-0 font-mono text-[0.6rem] tracking-[0.3em] text-espresso/55 uppercase md:pt-4">
          Philosophy
        </span>

        <p
          data-manifesto
          className="font-display max-w-[34ch] text-[clamp(1.75rem,4.2vw,3.4rem)] leading-[1.12] tracking-[-0.02em] text-espresso"
        >
          {STATEMENT}
        </p>
      </div>
    </section>
  );
}
