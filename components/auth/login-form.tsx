"use client";

import { useState } from "react";
import Link from "next/link";

type LoginFormProps = {
  loginAction: (formData: FormData) => Promise<void>;
  errorMessage?: string;
  resetSucceeded?: boolean;
};

export default function LoginForm({
  loginAction,
  errorMessage,
  resetSucceeded,
}: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="w-full">
      {/* Error & Success Alerts */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 flex items-start gap-2.5 shadow-2xs"
        >
          <svg className="h-4 w-4 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="leading-relaxed font-medium">{errorMessage}</span>
        </div>
      )}

      {resetSucceeded && (
        <div
          role="status"
          className="mb-5 rounded-xl border border-green-200 bg-green-50 p-3.5 text-xs text-green-800 flex items-start gap-2.5 shadow-2xs"
        >
          <svg className="h-4 w-4 text-green-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="leading-relaxed font-medium">
            Your password has been updated. You can now sign in with your new password.
          </span>
        </div>
      )}

      {/* Form Section Header */}
      <div className="text-center sm:text-left mb-6">
        <h2 className="text-2xl font-black tracking-tight text-[#142B45]">
          Welcome Back
        </h2>
        <p className="mt-1.5 text-sm text-slate-500 font-normal">
          Sign in to your account to continue
        </p>
      </div>

      <form
        action={async (formData) => {
          setIsSubmitting(true);
          try {
            await loginAction(formData);
          } finally {
            setIsSubmitting(false);
          }
        }}
        className="space-y-5"
      >
        {/* Email Address Input */}
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Email address
          </label>

          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              placeholder="name@organization.com"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-[#142B45] placeholder:text-slate-400 focus:border-[#245B85] focus:outline-none focus:ring-2 focus:ring-[#245B85]/20 transition-all shadow-2xs"
            />
          </div>
        </div>

        {/* Password Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-[#245B85] hover:text-[#142B45] hover:underline transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>

            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-11 text-sm text-[#142B45] placeholder:text-slate-400 focus:border-[#245B85] focus:outline-none focus:ring-2 focus:ring-[#245B85]/20 transition-all shadow-2xs"
            />

            {/* Password Visibility Control */}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Primary Navy Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#142B45] hover:bg-[#245B85] py-3.5 text-sm font-bold text-white shadow-md shadow-[#142B45]/15 transition-all active:scale-[0.99] disabled:opacity-70 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#245B85] focus-visible:ring-offset-2"
        >
          {isSubmitting ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              <span>Sign In</span>
              <span aria-hidden="true">→</span>
            </>
          )}
        </button>
      </form>

      {/* Administrator Contact Text */}
      <div className="mt-6 text-center text-xs text-slate-500">
        Don&apos;t have an account?{" "}
        <span className="font-semibold text-[#142B45]">
          Contact your administrator
        </span>
      </div>

      {/* Security Notice Box */}
      <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-[#F4F6F8] p-3 text-left">
        <svg
          className="h-4 w-4 shrink-0 text-[#245B85] mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
        <p className="text-[11px] leading-relaxed text-slate-600">
          This system is strictly for authorized personnel. All access attempts and activities are monitored.
        </p>
      </div>
    </div>
  );
}
