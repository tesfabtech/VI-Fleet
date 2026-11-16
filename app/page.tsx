import Header from "@/components/index/header";
import Hero from "@/components/index/hero";
import PlatformIntro from "@/components/index/platform_intro";
import Features from "@/components/index/features";
import HowItWorks from "@/components/index/how_it_works";
import Benefits from "@/components/index/benefits";
import Faq from "@/components/index/faq";
import RegisterBanner from "@/components/index/register_banner";
import Footer from "@/components/index/footer";

export default function HomePage() {
  return (
    <div className="vi-public vi-homepage min-h-screen flex flex-col bg-white">
      {/* 1. Professional navigation header */}
      <Header />

      <main className="flex-1">
        {/* 2. Hero section with commercial fleet logistics imagery */}
        <Hero />

        {/* 3. Platform introduction with authentic VI-Fleet dashboard preview */}
        <PlatformIntro />

        {/* 4. Core feature presentation */}
        <Features />

        {/* 5. How VI-Fleet works (Request -> Plan & Assign -> Track & Complete) */}
        <HowItWorks />

        {/* 6. Benefits section (visibility, organized operations, utilization, centralized) */}
        <Benefits />

        {/* Frequently Asked Questions */}
        <Faq />

        {/* 7. Strong Call-to-action section */}
        <RegisterBanner />
      </main>

      {/* 8. Professional footer */}
      <Footer />
    </div>
  );
}
