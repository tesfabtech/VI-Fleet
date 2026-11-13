import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import LoginForm from "@/components/auth/login-form";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    reset?: string | string[];
  }>;
};

function getLoginError(error?: string | string[]): string {
  if (typeof error !== "string") {
    return "";
  }

  switch (error) {
    case "CredentialsSignin":
      return "Invalid email or password. Please check your details and try again.";

    case "AccessDenied":
      return "Access denied. Your account may not be authorized to sign in.";

    case "Verification":
      return "Your sign-in link is invalid or has expired.";

    default:
      return "We couldn't sign you in. Please try again.";
  }
}

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams;
  const errorMessage = getLoginError(params.error);
  const resetSucceeded = params.reset === "success";

  async function login(formData: FormData) {
    "use server";

    const email = formData.get("email");
    const password = formData.get("password");

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      redirect("/login?error=CredentialsSignin");
    }

    try {
      await signIn("credentials", {
        email: email.trim(),
        password,
        redirectTo: "/dashboard",
      });
    } catch (error) {
      if (error instanceof AuthError) {
        redirect(`/login?error=${encodeURIComponent(error.type)}`);
      }

      // Preserve Next.js redirects and other unexpected errors.
      throw error;
    }
  }

  return (
    <div className="vi-public vi-login min-h-screen flex flex-col justify-between bg-[#F4F6F8]">
      {/* ─────────────────────────────────────────────────────────────
          MAIN SPLIT: EXACT 50/50 VIEWPORT SPLIT ON DESKTOP
          ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row w-full min-h-[calc(100vh-60px)]">
        {/* LEFT COLUMN: Exactly 50% on desktop */}
        <section
          aria-label="Platform Branding"
          className="w-full lg:w-1/2 relative flex flex-col justify-between overflow-hidden bg-[#142B45] text-white p-8 sm:p-12 lg:p-14 min-h-[460px] lg:min-h-0"
        >
          {/* Background Commercial Fleet Image with Navy Overlay */}
          <div className="absolute inset-0 z-0">
            <Image
              src="/hero-image.jpg"
              alt="VI-Fleet Commercial Fleet Operations"
              fill
              className="object-cover object-center opacity-65 lg:opacity-75"
              priority
            />
            {/* Dark navy overlay gradient for high contrast readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#142B45] via-[#142B45]/75 to-[#142B45]/55" />
          </div>

          {/* Top Brand Logo */}
          <div className="relative z-10">
            <Link
              href="/"
              className="inline-flex items-center gap-3 rounded-xl bg-white/95 px-3.5 py-1.5 shadow-sm backdrop-blur-sm transition-transform hover:scale-105"
            >
              <Image
                src="/logo.jfif"
                alt="VI-Fleet Logo"
                width={36}
                height={23}
                className="h-6 w-auto object-contain"
              />
              <span className="text-base font-black tracking-tight text-[#142B45]">
                VI-Fleet
              </span>
            </Link>
          </div>

          {/* Center Brand Headline & Feature Highlights */}
          <div className="relative z-10 my-8 sm:my-10 max-w-lg">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-white">
              Smarter Fleet Management
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-200 leading-relaxed font-normal">
              Manage your vehicles, drivers, and transportation operations with confidence.
            </p>

            {/* Feature Highlights Pills */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="flex items-center gap-2.5 rounded-full bg-[#142B45]/85 border border-white/20 px-4 py-2 backdrop-blur-md shadow-xs">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#245B85] text-white">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-white">Track Your Fleet</span>
              </div>

              <div className="flex items-center gap-2.5 rounded-full bg-[#142B45]/85 border border-white/20 px-4 py-2 backdrop-blur-md shadow-xs">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#245B85] text-white">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-white">Schedule Trips</span>
              </div>

              <div className="flex items-center gap-2.5 rounded-full bg-[#142B45]/85 border border-white/20 px-4 py-2 backdrop-blur-md shadow-xs">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#245B85] text-white">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-white">Optimize Operations</span>
              </div>

              <div className="flex items-center gap-2.5 rounded-full bg-[#142B45]/85 border border-white/20 px-4 py-2 backdrop-blur-md shadow-xs">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#245B85] text-white">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-white">Reduce Costs</span>
              </div>
            </div>
          </div>

          {/* Bottom Accent Line & Brand Statement */}
          <div className="relative z-10 pt-4 border-t border-white/20 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-300">
              VI-Fleet — <span className="italic text-[#E6A23C]">Moving Forward Together</span>
            </p>
          </div>
        </section>

        {/* RIGHT COLUMN: Exactly 50% on desktop */}
        <section
          aria-label="Sign In Form"
          className="w-full lg:w-1/2 bg-[#F4F6F8] flex items-center justify-center p-6 sm:p-10 lg:p-12"
        >
          <div className="w-full max-w-[440px] rounded-3xl border border-slate-200/90 bg-white p-8 sm:p-10 shadow-xl shadow-slate-200/60">
            {/* Card Centered Brand Logo */}
            <div className="flex justify-center mb-6">
              <div className="relative flex items-center justify-center rounded-2xl bg-white p-1">
                <Image
                  src="/logo.jfif"
                  alt="VI-Fleet Brand Logo"
                  width={54}
                  height={34}
                  className="h-10 w-auto object-contain"
                  priority
                />
              </div>
            </div>

            {/* Interactive Login Form */}
            <LoginForm
              loginAction={login}
              errorMessage={errorMessage}
              resetSucceeded={resetSucceeded}
            />

            {/* Back to Home Link */}
            <div className="mt-6 text-center">
              <Link
                href="/"
                className="text-xs font-semibold text-[#245B85] hover:text-[#142B45] transition-colors"
              >
                ← Back to home
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* Full-Width Footer Below Both Columns */}
      <footer className="w-full border-t border-slate-200 bg-white py-4 px-6 sm:px-12 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p>© 2025 VI-Fleet. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-[#142B45] transition-colors">
            Privacy Policy
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/terms" className="hover:text-[#142B45] transition-colors">
            Terms of Service
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/support" className="hover:text-[#142B45] transition-colors">
            Support
          </Link>
        </div>
      </footer>
    </div>
  );
}
