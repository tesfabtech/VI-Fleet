"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  submitOrganizationApplication,
  type RegistrationState,
} from "./actions";

const initialState: RegistrationState = {
  success: false,
  message: "",
};

const inputClass =
  "mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(
    submitOrganizationApplication,
    initialState,
  );

  if (state.success) {
    return (
      <main className="min-h-screen bg-white">
        <header className="border-b border-gray-100">
          <div className="mx-auto max-w-6xl px-6 py-5">
            <Link href="/" className="text-xl font-bold text-gray-900">
              VI-Fleet
            </Link>
          </div>
        </header>

        <section className="mx-auto max-w-2xl px-6 py-20 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl text-green-700">
            ✓
          </div>

          <h1 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Application submitted
          </h1>

          <p className="mt-4 leading-7 text-gray-600">{state.message}</p>

          <p className="mt-3 text-sm leading-6 text-gray-500">
            Your submission is an application, not an active organization
            account. Please wait for the review process.
          </p>

          <Link
            href="/"
            className="mt-8 inline-flex rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            Return to home
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-xl font-bold text-gray-900">
            VI-Fleet
          </Link>

          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 transition hover:text-blue-700"
          >
            Already registered? Sign in
          </Link>
        </div>
      </header>

      <section className="px-6 py-12 md:py-16">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8">
            <Link
              href="/"
              className="text-sm font-medium text-blue-700 hover:text-blue-800"
            >
              ← Back to home
            </Link>

            <h1 className="mt-5 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Register your organization
            </h1>

            <p className="mt-3 leading-7 text-gray-600">
              Submit your organization details to begin the VI-Fleet
              registration process. Our team will review your application.
            </p>
          </div>

          <form
            action={formAction}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <div className="space-y-6">
              <div>
                <label
                  htmlFor="organizationName"
                  className="block text-sm font-semibold text-gray-800"
                >
                  Organization name <span className="text-red-600">*</span>
                </label>

                <input
                  id="organizationName"
                  name="organizationName"
                  type="text"
                  autoComplete="organization"
                  required
                  maxLength={150}
                  placeholder="Enter your organization name"
                  className={inputClass}
                  aria-invalid={Boolean(state.errors?.organizationName)}
                />

                {state.errors?.organizationName && (
                  <p className="mt-2 text-sm text-red-600">
                    {state.errors.organizationName}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="contactEmail"
                  className="block text-sm font-semibold text-gray-800"
                >
                  Contact email <span className="text-red-600">*</span>
                </label>

                <input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={255}
                  placeholder="organization@example.com"
                  className={inputClass}
                  aria-invalid={Boolean(state.errors?.contactEmail)}
                />

                {state.errors?.contactEmail && (
                  <p className="mt-2 text-sm text-red-600">
                    {state.errors.contactEmail}
                  </p>
                )}

                <p className="mt-2 text-xs leading-5 text-gray-500">
                  Use an organizational email if available. A personal email
                  is also accepted.
                </p>
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-semibold text-gray-800"
                >
                  Phone number{" "}
                  <span className="font-normal text-gray-500">(optional)</span>
                </label>

                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={30}
                  placeholder="Enter a contact phone number"
                  className={inputClass}
                  aria-invalid={Boolean(state.errors?.phone)}
                />

                {state.errors?.phone && (
                  <p className="mt-2 text-sm text-red-600">
                    {state.errors.phone}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-semibold text-gray-800"
                >
                  About your organization{" "}
                  <span className="font-normal text-gray-500">(optional)</span>
                </label>

                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  maxLength={5000}
                  placeholder="Tell us briefly about your organization and its transportation needs."
                  className={inputClass}
                  aria-invalid={Boolean(state.errors?.description)}
                />

                {state.errors?.description && (
                  <p className="mt-2 text-sm text-red-600">
                    {state.errors.description}
                  </p>
                )}
              </div>
            </div>

            {state.message && !state.success && (
              <div
                role="alert"
                className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
              >
                {state.message}
              </div>
            )}

            <div className="mt-8 border-t border-gray-100 pt-6">
              <p className="text-sm leading-6 text-gray-500">
                Submitting this form does not activate an organization or
                create a user account. Activation requires administrator
                review and approval.
              </p>

              <button
                type="submit"
                disabled={pending}
                className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-blue-700 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {pending ? "Submitting application..." : "Submit application"}
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-blue-700 hover:text-blue-800"
            >
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}