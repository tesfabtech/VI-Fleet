
import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

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
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-slate-900">
          VI-Fleet
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          Sign in to your fleet management account.
        </p>

        {errorMessage && (
          <div
            role="alert"
            aria-live="polite"
            className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {errorMessage}
          </div>
          
        )}
        {resetSucceeded && (
  <div
    role="status"
    className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
  >
    Your password has been updated. You can now sign in with your new password.
  </div>
)}

        <form action={login} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Email address
            </label>

            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex justify-end">
  <a
    href="/forgot-password"
    className="text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline"
  >
    Forgot password?
  </a>
</div>

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
