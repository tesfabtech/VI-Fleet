"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLoginModal } from "./login-modal-context";
import { loginAction } from "./auth-actions";

export default function LoginModal() {
  const router = useRouter();
  const { isLoginOpen, closeLogin } = useLoginModal();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Reset errors and state whenever the modal is opened
  useEffect(() => {
    if (isLoginOpen) {
      setErrorMessage("");
      setIsSubmitting(false);
      setShowPassword(false);
    }
  }, [isLoginOpen]);

  if (!isLoginOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage("");

    const formData = new FormData(e.currentTarget);
    try {
      const result = await loginAction(formData);
      if (result?.error) {
        // Invalid credentials or error: keep modal open and display error message
        setErrorMessage(result.error);
        setIsSubmitting(false);
      } else if (result?.success) {
        // Confirmed successful authentication: automatically close modal and transition to dashboard
        closeLogin();
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: unknown) {
      // In Next.js, NextAuth redirect throws an internal NEXT_REDIRECT error on successful navigation
      if (err instanceof Error && err.message?.includes("NEXT_REDIRECT")) {
        closeLogin();
        throw err;
      }
      setErrorMessage("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs transition-opacity overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeLogin();
        }
      }}
    >
      {/* Modal Card */}
      <div className="relative my-auto w-full max-w-[420px] rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-2xl transition-all">
        {/* Close Button [X] */}
        <button
          type="button"
          onClick={closeLogin}
          aria-label="Close login dialog"
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Brand Header */}
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center rounded-xl bg-white p-1">
            <Image
              src="/logo.jfif"
              alt="VI-Fleet Brand Logo"
              width={48}
              height={30}
              className="h-8 w-auto object-contain"
            />
          </div>

          <h2 id="login-modal-title" className="mt-2 text-xl font-black tracking-tight text-[#142B45]">
            Welcome Back
          </h2>

          <p className="mt-0.5 text-xs text-slate-500">
            Sign in to your account to continue
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start gap-2"
          >
            <svg className="h-4 w-4 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="modal-email"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
            >
              Email address
            </label>

            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <input
                id="modal-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder="name@organization.com"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs text-[#142B45] placeholder:text-slate-400 focus:border-[#245B85] focus:outline-none focus:ring-2 focus:ring-[#245B85]/20 transition"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="modal-password"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                onClick={closeLogin}
                className="text-xs font-semibold text-[#245B85] hover:text-[#142B45] hover:underline transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>

              <input
                id="modal-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-xs text-[#142B45] placeholder:text-slate-400 focus:border-[#245B85] focus:outline-none focus:ring-2 focus:ring-[#245B85]/20 transition"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#142B45] hover:bg-[#245B85] py-2.5 text-xs font-bold text-white shadow-md shadow-[#142B45]/15 transition active:scale-[0.99] disabled:opacity-70 cursor-pointer"
          >
            {isSubmitting ? (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <span>Sign In</span>
                <span aria-hidden="true">→</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-5 flex items-start gap-2 rounded-xl border border-slate-200 bg-[#F4F6F8] p-2.5 text-left">
          <svg className="h-3.5 w-3.5 shrink-0 text-[#245B85] mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-[10px] leading-tight text-slate-600">
            Authorized personnel only. All access is logged.
          </p>
        </div>
      </div>
    </div>
  );
}
