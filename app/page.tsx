import { CtaSection } from "@/components/marketing/cta-section";
import { ExampleWalkthrough } from "@/components/marketing/example-walkthrough";
import { Hero } from "@/components/marketing/hero";
import { InputModes } from "@/components/marketing/input-modes";
import { LifecyclePipeline } from "@/components/marketing/lifecycle-pipeline";
import { ProductPillars } from "@/components/marketing/product-pillars";
import { SecuritySection } from "@/components/marketing/security-section";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { UncertaintySection } from "@/components/marketing/uncertainty-section";

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        <Hero />
        <LifecyclePipeline />
        <ProductPillars />
        <InputModes />
        <ExampleWalkthrough />
        <UncertaintySection />
        <SecuritySection />
        <CtaSection />
      </main>
      <SiteFooter />
    </div>
  );
}
