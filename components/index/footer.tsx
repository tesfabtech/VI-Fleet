"use client";

import Image from "next/image";
import Link from "next/link";
import { useLoginModal } from "@/components/auth/login-modal-context";

export default function Footer() {
  const { openLogin } = useLoginModal();

  return (
    <footer className="bg-[#142B45] text-white border-t border-slate-800">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12 lg:gap-16">
          {/* Brand Info */}
          <div className="md:col-span-5">
            <Link
              href="/"
              className="inline-flex items-center gap-3 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-md"
            >
              <div className="relative flex items-center justify-center rounded-xl bg-white p-1.5 shadow-sm">
                <Image
                  src="/logo.jfif"
                  alt="VI-Fleet Logo"
                  width={42}
                  height={27}
                  className="h-7 w-auto object-contain"
                />
              </div>
              <span className="text-2xl font-black tracking-tight text-white">
                VI-Fleet
              </span>
            </Link>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed max-w-sm">
              Enterprise fleet and transportation intelligence platform engineered to maximize vehicle uptime, streamline multi-department dispatch, and eliminate operational blind spots.
            </p>

            {/* Social Icons */}
            <div className="mt-6 flex items-center gap-4 text-slate-400">
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="hover:text-white transition-colors"
              >
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                </svg>
              </a>

              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
                className="hover:text-white transition-colors"
              >
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                  <path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z" />
                </svg>
              </a>

              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X (formerly Twitter)"
                className="hover:text-white transition-colors"
              >
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Navigation Links Group */}
          <div className="md:col-span-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-[#E6A23C]">
              Platform Navigation
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm font-semibold text-slate-300">
              <li>
                <a href="#hero" className="hover:text-white transition-colors">
                  Home
                </a>
              </li>
              <li>
                <a href="#platform" className="hover:text-white transition-colors">
                  Product Overview
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  Core Features
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-white transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#benefits" className="hover:text-white transition-colors">
                  Why VI-Fleet
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Account & Legal Group */}
          <div className="md:col-span-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-[#E6A23C]">
              Access & Support
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm font-semibold text-slate-300">
              <li>
                <button
                  type="button"
                  onClick={openLogin}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Sign In to Workspace
                </button>
              </li>
              <li>
                <Link href="/register" className="hover:text-white transition-colors">
                  Register Organization
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/support" className="hover:text-white transition-colors">
                  Support & Helpdesk
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© 2025 VI-Fleet. All rights reserved.</p>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>All Enterprise Fleet Services Operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
