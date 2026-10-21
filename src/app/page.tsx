import { ClosingSection } from "@/components/sections/ClosingSection";
import { Hero } from "@/components/sections/Hero";
import { ManifestoSection } from "@/components/sections/ManifestoSection";
import { StorySection } from "@/components/sections/StorySection";
import { SiteHeader } from "@/components/ui/SiteHeader";

/**
 * Page composition only — no animation logic.
 *
 * This stays a server component: each section is its own client boundary, so the
 * page shell and all the static copy are server-rendered HTML, and only the
 * motion code for each section is hydrated.
 */
export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <ManifestoSection />
        <StorySection />
        <ClosingSection />
      </main>
    </>
  );
}
