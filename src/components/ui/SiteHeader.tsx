"use client";

import { useRef } from "react";

import { EASE, gsap, useGSAP } from "@/lib/gsap";
import { useDevice } from "@/providers/DeviceProvider";
import { usePreloader } from "@/providers/PreloaderProvider";
import { useSmoothScroll } from "@/providers/SmoothScrollProvider";

const NAV_LINKS = [
  { label: "Our craft", href: "#story" },
  { label: "Order", href: "#contact" },
];

export function SiteHeader() {
  const rootRef = useRef<HTMLElement>(null);
  const { canAnimateIn } = usePreloader();
  const { reducedMotion } = useDevice();
  const { scrollTo } = useSmoothScroll();

  useGSAP(
    () => {
      if (!canAnimateIn || reducedMotion) return;

      gsap.from("[data-header-item]", {
        yPercent: -120,
        opacity: 0,
        duration: 1.1,
        stagger: 0.08,
        ease: EASE.out,
        // Lands after the hero headline rather than competing with it.
        delay: 0.9,
      });
    },
    { dependencies: [canAnimateIn, reducedMotion], scope: rootRef },
  );

  return (
    <header
      ref={rootRef}
      // Plain espresso ink, no blend mode. The previous dark theme needed
      // `mix-blend-difference` to stay legible over both a dark hero and light
      // panels; now every section sits in the same light range, so a single ink
      // colour is both simpler and more predictable across the palette.
      className="pointer-events-none fixed inset-x-0 top-0 z-50"
    >
      <div className="flex items-center justify-between px-6 py-6 md:px-10">
        <a
          data-header-item
          href="#hero"
          onClick={(event) => {
            event.preventDefault();
            scrollTo("#hero");
          }}
          className="pointer-events-auto font-mono text-[0.7rem] tracking-[0.3em] text-espresso uppercase"
        >
          Maslak Roasters
        </a>

        <nav className="flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              data-header-item
              href={link.href}
              onClick={(event) => {
                event.preventDefault();
                scrollTo(link.href);
              }}
              className="pointer-events-auto font-mono text-[0.65rem] tracking-[0.25em] text-espresso/65 uppercase transition-colors duration-500 hover:text-caramel"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
