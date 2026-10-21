"use client";

import { useRef, type ReactNode } from "react";

import { EASE, SplitText, gsap, useGSAP } from "@/lib/gsap";
import { useDevice } from "@/providers/DeviceProvider";

/**
 * Deliberately a closed union rather than `ElementType`. A fully polymorphic
 * `as` prop makes TypeScript intersect every possible element's props, which
 * collapses `ref` and `className` to `never`. These all share the same attribute
 * surface, so one union keeps the component both flexible and type-safe.
 */
type TextTag = "p" | "h1" | "h2" | "h3" | "h4" | "span" | "div" | "blockquote";

type RevealTextProps = {
  children: ReactNode;
  /** Rendered tag. Text stays semantic — split wrappers are added at runtime. */
  as?: TextTag;
  className?: string;
  /** Granularity of the reveal. Lines read editorial, chars read technical. */
  split?: "lines" | "words" | "chars";
  stagger?: number;
  delay?: number;
  /** Fire on scroll (default) or immediately on mount. */
  trigger?: "scroll" | "mount";
};

/**
 * Scroll-triggered typographic reveal.
 *
 * Three details that matter more than the animation itself:
 *
 * 1. **`mask`** wraps every line in an overflow-hidden parent, so text slides
 *    out from behind a hard edge instead of fading through the layout above it.
 *    Doing this by hand normally means nested wrapper markup.
 * 2. **`autoSplit` + `onSplit`** re-splits after a resize or a font swap. A
 *    web font landing after the split leaves lines broken at the fallback
 *    font's metrics — the classic "why is my reveal off by one word".
 * 3. **The text is written to the DOM normally**, so crawlers and screen readers
 *    get the real content; splitting only happens client-side after paint.
 */
export function RevealText({
  children,
  as = "p",
  className,
  split = "lines",
  stagger = 0.08,
  delay = 0,
  trigger = "scroll",
}: RevealTextProps) {
  // Narrowed to a single concrete tag so JSX resolves one consistent props type.
  const Tag = as as "p";
  const containerRef = useRef<HTMLParagraphElement>(null);
  const { reducedMotion, ready } = useDevice();

  useGSAP(
    () => {
      const element = containerRef.current;
      if (!element || !ready) return;

      // Reduced motion: leave the text exactly as authored. No split, no tween.
      if (reducedMotion) return;

      const instance = SplitText.create(element, {
        type: split,
        mask: split,
        // Re-split on resize/font-load, and re-run the reveal so a mid-animation
        // re-split doesn't leave fragments stuck at their `from` values.
        autoSplit: true,
        onSplit: (self) => {
          const targets =
            split === "lines" ? self.lines : split === "words" ? self.words : self.chars;

          return gsap.from(targets, {
            yPercent: 115,
            // A touch of rotation keeps a straight vertical slide from looking
            // mechanical; it reads as physical weight.
            rotate: split === "lines" ? 2 : 0,
            duration: 1.1,
            ease: EASE.out,
            stagger,
            delay,
            scrollTrigger:
              trigger === "scroll"
                ? {
                    trigger: element,
                    // Fire when the text is meaningfully in view, not at the
                    // very first pixel — reveals that start off-screen are
                    // finished before the reader arrives.
                    start: "top 85%",
                    once: true,
                  }
                : undefined,
          });
        },
      });

      return () => instance.revert();
    },
    { dependencies: [ready, reducedMotion, split, stagger, delay, trigger] },
  );

  return (
    <Tag ref={containerRef} className={className}>
      {children}
    </Tag>
  );
}
