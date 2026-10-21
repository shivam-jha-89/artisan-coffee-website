import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

import { AppProviders } from "@/providers/AppProviders";

import "./globals.css";

/**
 * `next/font` self-hosts and preloads these at build time, which matters more
 * than usual here: the preloader waits on `document.fonts.ready`, so a runtime
 * request to Google's CDN would sit directly on the critical path of the intro.
 * `display: "swap"` plus SplitText's `autoSplit` means a late swap re-splits
 * cleanly instead of leaving lines measured against fallback metrics.
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const displaySerif = Instrument_Serif({
  variable: "--font-display",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Maslak Roasters — Single Origin Coffee, Roasted Weekly",
  description:
    "A specialty coffee roastery in Istanbul. Small lots bought direct from twelve farms, roasted in six-kilo batches every Tuesday and shipped the same week.",
};

export const viewport: Viewport = {
  // Matches the cream page background, so mobile browser chrome blends into the
  // page instead of drawing a hard band above the fold.
  themeColor: "#f3ebe0",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${displaySerif.variable} antialiased`}
      // Lenis adds classes to <html> and Next's dev overlay compares the
      // server/client attribute; suppressing keeps the console honest.
      suppressHydrationWarning
    >
      <body className="bg-cream text-espresso">
        {/*
          The single client boundary. Everything below can still be a server
          component — only the animation logic ships as JavaScript.
        */}
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
