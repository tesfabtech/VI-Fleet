import Link from "next/link";
import { resetPassword } from "@/app/forgot-password/actions";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    token?: string | string[];
    error?: string | string[];
  }>;
};

function firstValue(value?: string | string[]): string {
  return typeof value === "string" ? value : "";
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const params = await searchParams;
  const token = firstValue(params.token);
  const error = firstValue(params.error);

  const validTokenFormat = /^[a-f0-9]{64}$/i.test(token);

  let errorMessage = "";

  if (error === "password") {
    errorMessage = "Your password must be between 12 and 128 characters.";
  } else if (error === "mismatch") {
    errorMessage = "The passwords do not match. Please try again.";
  } else if (error === "invalid" || (token && !validTokenFormat)) {
    errorMessage =
      "This reset link is invalid, expired, or already used. Request a new one.";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-slate-900">
          Reset your password
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          Choose a new password for your VI-Fleet account.
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {errorMessage}
          </div>
        )}

        {!validTokenFormat ? (
          <div className="mt-6">
            <Link
              href="/forgot-password"
              className="font-medium text-blue-700 hover:underline"
            >
              Request a new reset link
            </Link>
          </div>
        ) : (
          <form action={resetPassword} className="mt-8 space-y-5">
            <input type="hidden" name="token" value={token} />

            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                New password
              </label>

              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />

              <p className="mt-1 text-xs text-slate-500">
                Use between 12 and 128 characters.
              </p>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Confirm new password
              </label>

              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Update password
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
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