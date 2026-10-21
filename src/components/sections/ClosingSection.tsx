"use client";

import { useRef } from "react";

import { RevealText } from "@/components/motion/RevealText";
import { gsap, useGSAP } from "@/lib/gsap";
import { motionState } from "@/lib/motion-state";
import { useDevice } from "@/providers/DeviceProvider";

const MARQUEE_ITEMS = ["Single origin", "Espresso", "Filter", "Cold brew", "Decaf"];

/**
 * Closing statement with a scroll-reactive marquee.
 *
 * The marquee is a single infinite tween whose `timeScale` is modulated by
 * scroll velocity — scroll faster and the type races, stop and it settles back
 * to its resting speed. It is a small effect that does a lot of work, because it
 * ties DOM motion to the same velocity value the bean's rotation is reading, so
 * the whole page reacts to input as one system.
 */
export function ClosingSection() {
  const rootRef = useRef<HTMLElement>(null);
  const { reducedMotion, ready } = useDevice();

  useGSAP(
    () => {
      if (!ready || reducedMotion) return;

      // The row holds the phrase list twice, so -50% lands exactly on the
      // duplicate and the loop is seamless.
      const marquee = gsap.to("[data-marquee-row]", {
        xPercent: -50,
        repeat: -1,
        duration: 26,
        ease: "none",
      });

      const tick = () => {
        // `timeScale` rather than a new tween per frame: we're retiming one
        // existing animation, not creating garbage 60 times a second.
        const boost = Math.min(Math.abs(motionState.scrollVelocity) * 0.06, 5);
        marquee.timeScale(1 + boost);
      };

      gsap.ticker.add(tick);
      return () => gsap.ticker.remove(tick);
    },
    { dependencies: [ready, reducedMotion], scope: rootRef },
  );

  return (
    <section
      ref={rootRef}
      id="contact"
      className="relative flex min-h-svh flex-col justify-between overflow-hidden bg-cream pt-32"
    >
      <div className="px-6 md:px-10">
        <span className="font-mono text-[0.6rem] tracking-[0.3em] text-espresso/55 uppercase">
          Order
        </span>

        <RevealText
          as="h2"
          split="lines"
          className="font-display mt-8 max-w-[20ch] text-[clamp(2.5rem,8vw,7rem)] leading-[0.94] tracking-[-0.03em] text-espresso"
        >
          Let&rsquo;s get you a better morning.
        </RevealText>

        <RevealText
          as="p"
          split="lines"
          stagger={0.05}
          className="mt-10 max-w-[46ch] text-sm leading-relaxed text-espresso/70"
        >
          Subscriptions ship every other Wednesday, and we&rsquo;ll swap the
          origin whenever you want a change. Not sure where to start? Tell us how
          you brew and we&rsquo;ll pick for you.
        </RevealText>

        <a
          href="mailto:hello@maslakroasters.com"
          className="group mt-12 inline-flex items-center gap-4 border-b border-espresso/25 pb-2 font-mono text-xs tracking-[0.2em] text-espresso uppercase transition-colors duration-500 hover:border-caramel"
        >
          hello@maslakroasters.com
          <span className="inline-block transition-transform duration-500 ease-out group-hover:translate-x-1">
            →
          </span>
        </a>
      </div>

      {/* Marquee. `overflow-hidden` on the section clips it; the row is twice as
          wide as its content. */}
      <div aria-hidden className="mt-24 overflow-hidden border-y border-espresso/15 py-6">
        <div data-marquee-row className="flex w-max gap-10 will-change-transform">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, index) => (
            <span
              key={`${item}-${index}`}
              className="font-display flex items-center gap-10 text-[clamp(1.75rem,4vw,3rem)] whitespace-nowrap text-espresso/80"
            >
              {item}
              {/* Bean-shaped separator: an ellipse with a crease, echoing the
                  hero object at glyph scale. */}
              <span className="relative h-2 w-3.5 rotate-[-18deg] rounded-[50%] bg-caramel">
                <span className="absolute inset-x-[15%] top-1/2 h-1/2 -translate-y-1/2 rounded-[50%] border-t border-cream/70" />
              </span>
            </span>
          ))}
        </div>
      </div>

      <footer className="flex flex-col gap-4 px-6 py-8 font-mono text-[0.6rem] tracking-[0.2em] text-espresso/50 uppercase md:flex-row md:items-center md:justify-between md:px-10">
        <span>© {new Date().getFullYear()} Maslak Roasters</span>
        <span>Roasted in Istanbul · Shipped worldwide</span>
      </footer>
    </section>
  );
}
