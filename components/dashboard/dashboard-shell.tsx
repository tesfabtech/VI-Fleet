"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

export type DashboardCard = {
  title: string;
  description: string;
  status: string;
  href?: string;
};

type DashboardShellProps = {
  title: string;
  description: string;
  userName?: string;
  roleLabel?: string;
  cards: DashboardCard[];
  standalone?: boolean;
};

export default function DashboardShell({
  title,
  description,
  userName = "User",
  roleLabel = "Member",
  cards,
  standalone = false,
}: DashboardShellProps) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ redirectTo: "/login" });
  }

  const content = (
    <div className="space-y-8">
      {/* Overview Intro */}
      <section>
        <p className="text-sm font-semibold tracking-wide text-blue-600">
          VI-FLEET
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          {description}
        </p>
      </section>

      {/* Cards Grid */}
      <section
        aria-label="Dashboard overview"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {cards.map((card) => {
          const cardBody = (
            <>
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-slate-900">{card.title}</h3>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    card.href
                      ? "bg-blue-50 text-blue-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {card.status}
                </span>
              </div>
              <p className="mt-2.5 text-sm leading-6 text-slate-600">
                {card.description}
              </p>
            </>
          );

          return card.href ? (
            <Link
              key={card.title}
              href={card.href}
              className="group block rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {cardBody}
            </Link>
          ) : (
            <article
              key={card.title}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
            >
              {cardBody}
            </article>
          );
        })}
      </section>

      {/* Welcome Banner */}
      <section className="rounded-xl border border-blue-100 bg-blue-50/70 p-5 sm:p-6">
        <h3 className="font-semibold text-slate-900">
          Welcome to your workspace
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your dashboard is ready. Operational information and management actions
          will appear here as the relevant VI-Fleet features are activated.
        </p>
      </section>
    </div>
  );

  if (!standalone) {
    return content;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold tracking-wide text-blue-700">
              VI-FLEET
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {description}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
              <p className="text-xs font-medium text-slate-500">Signed in as</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {userName || "VI-Fleet user"}
              </p>
              <p className="mt-1 text-xs text-blue-700">{roleLabel}</p>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-700 shadow-xs transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
            >
              <span>↪</span>
              <span>{signingOut ? "Signing out..." : "Sign out"}</span>
            </button>
          </div>
        </header>

        <div className="mt-8">{content}</div>

        <footer className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-400">
          VI-Fleet Fleet Management System
        </footer>
      </div>
    </main>
  );
}
