import Header from "@/components/index/header";
import Hero from "@/components/index/hero";
import Features from "@/components/index/features";
import RegisterBanner from "@/components/index/register_banner";
import Footer from "@/components/index/footer";

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Features />
        <RegisterBanner />
      </main>
      <Footer />
    </>
  );
}