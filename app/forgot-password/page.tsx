import Link from "next/link";
import { requestPasswordReset } from "./actions";

type ForgotPasswordPageProps = {
  searchParams: Promise<{
    submitted?: string | string[];
  }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = await searchParams;
  const submitted = params.submitted === "1";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-slate-900">
          Forgot password?
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          Enter the email address associated with your VI-Fleet account.
          If an eligible account matches, we will send a reset link.
        </p>

        {submitted && (
          <div
            role="status"
            className="mt-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"
          >
            If an eligible account matches that email, a password-reset
            link will be sent. Check your inbox and spam folder.
          </div>
        )}

        <form action={requestPasswordReset} className="mt-8 space-y-5">
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
              autoComplete="email"
              required
              maxLength={254}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Send reset link
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Remember your password?{" "}
          <Link
            href="/login"
            className="font-medium text-blue-700 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </section>
    </main>
  );
}