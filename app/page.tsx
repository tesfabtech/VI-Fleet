import Header from "@/components/index/header";
import Hero from "@/components/index/hero";
import ProblemValue from "@/components/index/problem_value";
import Features from "@/components/index/features";
import HowItWorks from "@/components/index/how_it_works";
import Testimonials from "@/components/index/testimonials";
import Faq from "@/components/index/faq";
import RegisterBanner from "@/components/index/register_banner";
import Footer from "@/components/index/footer";

export default function HomePage() {
  return (
    <>
      {/* 1. Navbar */}
      <Header />

      <main>
        {/* 2. Hero section */}
        <Hero />

        {/* 3. Problem and value proposition */}
        <ProblemValue />

        {/* 4. Features */}
        <Features />

        {/* 5. How it works */}
        <HowItWorks />

        {/* 6. Testimonials */}
        <Testimonials />

        {/* 7. FAQ */}
        <Faq />

        {/* Enterprise Call To Action */}
        <RegisterBanner />
      </main>

      {/* 8. Footer */}
      <Footer />
    </>
  );
}
