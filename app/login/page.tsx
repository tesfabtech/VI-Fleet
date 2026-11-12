import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
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
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f4f5fd] via-[#f7f8fe] to-[#eceffd] px-4 py-10">
      {/* Centered Login Card */}
      <div className="w-full max-w-[420px] rounded-3xl border border-indigo-100 bg-white p-6 sm:p-8 shadow-xl shadow-indigo-100/50">
        {/* Card Logo & Brand Title (Home page style) */}
        <div className="text-center">
          {/* Home Page Brand Icon Mark */}
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>

          <div className="mt-3 flex items-center justify-center gap-1.5">
            <h1 className="text-xl font-black tracking-tight text-slate-900">
              VI-Fleet
            </h1>
          </div>

          <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Fleet Management System
          </p>

          {/* Indigo Accent Line matching home page */}
          <div className="mx-auto mt-2 h-1 w-8 rounded-full bg-indigo-600" />
        </div>

        {/* Interactive Form Component */}
        <div className="mt-4">
          <LoginForm
            loginAction={login}
            errorMessage={errorMessage}
            resetSucceeded={resetSucceeded}
          />
        </div>

        {/* Back to Home Link */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-xs font-medium text-slate-500 hover:text-indigo-600 transition"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
