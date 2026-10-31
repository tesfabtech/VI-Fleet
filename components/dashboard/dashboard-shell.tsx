"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type DashboardCard = {
  title: string;
  description: string;
  status: string;
  href?: string;
};

type DashboardShellProps = {
  title: string;
  description: string;
  userName: string;
  roleLabel: string;
  cards: DashboardCard[];
};

export default function DashboardShell({
  title,
  description,
  userName,
  roleLabel,
  cards,
}: DashboardShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ redirectTo: "/login" });
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold tracking-wide text-blue-700">
              VI-FLEET
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              {description}
            </p>
          </div>

          <div ref={dropdownRef} className="relative w-fit">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-left shadow-sm transition hover:border-gray-300"
            >
              <div>
                <p className="text-xs font-medium text-gray-500">
                  Signed in as
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {userName || "VI-Fleet user"}
                </p>
                <p className="text-xs text-blue-700">{roleLabel}</p>
              </div>
              <span className="text-xs text-gray-400">▾</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-60 rounded-xl border border-gray-200 bg-white p-2 shadow-xl z-50">
                <Link
                  href="/forgot-password"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Reset password
                </Link>
                <Link
                  href="/"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Public home page
                </Link>
                <div className="mt-1 border-t border-gray-100 pt-1">
                  <button
                    type="button"
                    disabled={signingOut}
                    onClick={handleSignOut}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    <span>{signingOut ? "Signing out..." : "Sign out"}</span>
                    <span>↪</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <section
          aria-label="Dashboard overview"
          className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {cards.map((card) => (
            <article
              key={card.title}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <h2 className="font-semibold text-gray-900">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                {card.description}
              </p>
              <span className="mt-5 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                {card.status}
              </span>
            </article>
          ))}
        </section>

        <footer className="mt-8 border-t border-gray-200 pt-4 text-xs text-gray-400">
          VI-Fleet Fleet Management System
        </footer>
      </div>
    </main>
  );
}