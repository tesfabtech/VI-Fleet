
"use client";

import {
  useState,
  useEffect,
  useRef,
  useSyncExternalStore,
  type MouseEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useLoginModal } from "@/components/auth/login-modal-context";

type Theme = "light" | "dark";

const NAV_LINKS = [
  { name: "Home", href: "#hero", id: "hero" },
  { name: "Platform", href: "#platform", id: "platform" },
  { name: "Features", href: "#features", id: "features" },
  { name: "How It Works", href: "#how-it-works", id: "how-it-works" },
  { name: "Benefits", href: "#benefits", id: "benefits" },
  { name: "FAQ", href: "#faq", id: "faq" },
];

// -------------------------------------------------------------
// Theme Store
// -------------------------------------------------------------

function getThemeSnapshot(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  const documentTheme =
    document.documentElement.getAttribute("data-vi-theme");

  if (documentTheme === "dark" || documentTheme === "light") {
    return documentTheme;
  }

  const savedTheme = localStorage.getItem("vi-fleet-theme");

  if (savedTheme === "dark" || savedTheme === "light") {
    return savedTheme;
  }

  if (
    savedTheme === "system" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  return "light";
}

function getServerThemeSnapshot(): Theme {
  return "light";
}

function subscribeToTheme(callback: () => void) {
  const handleThemeChange = () => callback();

  window.addEventListener("vi-fleet-theme-change", handleThemeChange);
  window.addEventListener("storage", handleThemeChange);

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", handleThemeChange);

  return () => {
    window.removeEventListener("vi-fleet-theme-change", handleThemeChange);
    window.removeEventListener("storage", handleThemeChange);
    mediaQuery.removeEventListener("change", handleThemeChange);
  };
}

// -------------------------------------------------------------
// Theme Icons
// -------------------------------------------------------------

function SunIcon() {
  return (
    <svg
      className="h-[18px] w-[18px] text-[#E6A23C]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="h-[18px] w-[18px] text-slate-700"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  );
}

// -------------------------------------------------------------
// Theme Toggle Component
// Declared outside Header to preserve component identity.
// -------------------------------------------------------------

function ThemeToggle({
  theme,
  onToggle,
  mobile = false,
}: {
  theme: Theme;
  onToggle: () => void;
  mobile?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
      title={
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
      className={`inline-flex select-none items-center justify-center rounded-lg border border-slate-200/90 bg-white/80 text-slate-700 shadow-2xs transition-colors hover:bg-slate-100 hover:text-[#142B45] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#245B85] ${
        mobile ? "h-8 w-8 p-1.5" : "h-9 w-9 p-2"
      }`}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

// -------------------------------------------------------------
// Header Component
// -------------------------------------------------------------

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Home");

  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot
  );

  const { openLogin } = useLoginModal();

  const isManualClick = useRef(false);
  const clickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -------------------------------------------------------------
  // Theme Toggle
  // -------------------------------------------------------------

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";

    localStorage.setItem("vi-fleet-theme", nextTheme);

    document.documentElement.setAttribute("data-vi-theme", nextTheme);

    window.dispatchEvent(new Event("vi-fleet-theme-change"));
  }

  // -------------------------------------------------------------
  // Active Navigation: Scroll Tracking and URL Hash
  // -------------------------------------------------------------

  useEffect(() => {
    const sectionIds = NAV_LINKS.map((link) => link.id);

    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element));

    if (elements.length === 0) return;

    const entryMap = new Map<string, IntersectionObserverEntry>();

    // Respect the URL hash on initial page load.
    const initialHashFrame = window.requestAnimationFrame(() => {
      const initialHash = window.location.hash;

      const found = NAV_LINKS.find(
        (link) => link.href === initialHash
      );

      if (found) {
        setActiveTab(found.name);
      }
    });

    const updateActiveSection = () => {
      if (isManualClick.current) return;

      // Home is active near the top of the page.
      if (window.scrollY < 80) {
        setActiveTab("Home");
        return;
      }

      // FAQ is active near the bottom of the document.
      const scrollBottom = window.innerHeight + window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;

      if (scrollBottom >= documentHeight - 60) {
        setActiveTab("FAQ");
        return;
      }

      // Reference line below the sticky header.
      const targetY = 120;

      for (const id of sectionIds) {
        const element = document.getElementById(id);

        if (!element) continue;

        const rect = element.getBoundingClientRect();

        if (rect.top <= targetY && rect.bottom > targetY) {
          const match = NAV_LINKS.find((link) => link.id === id);

          if (match) {
            setActiveTab(match.name);
            return;
          }
        }
      }

      // Fallback: select the intersecting section
      // with the largest intersection ratio.
      let bestId: string | null = null;
      let maxRatio = -1;

      entryMap.forEach((entry, id) => {
        if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
          maxRatio = entry.intersectionRatio;
          bestId = id;
        }
      });

      if (bestId) {
        const match = NAV_LINKS.find((link) => link.id === bestId);

        if (match) {
          setActiveTab(match.name);
        }
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entryMap.set(entry.target.id, entry);
        });

        updateActiveSection();
      },
      {
        root: null,
        rootMargin: "-64px 0px -40% 0px",
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      }
    );

    elements.forEach((element) => observer.observe(element));

    // Handle browser hash changes.
    const handleHashChange = () => {
      const currentHash = window.location.hash;

      const match = NAV_LINKS.find(
        (link) => link.href === currentHash
      );

      if (match) {
        setActiveTab(match.name);
      }
    };

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.cancelAnimationFrame(initialHashFrame);

      observer.disconnect();

      window.removeEventListener("hashchange", handleHashChange);

      if (clickTimeout.current) {
        clearTimeout(clickTimeout.current);
        clickTimeout.current = null;
      }
    };
  }, []);

  // -------------------------------------------------------------
  // Navigation Click
  // -------------------------------------------------------------

  function handleNavClick(
    event: MouseEvent<HTMLAnchorElement>,
    tab: (typeof NAV_LINKS)[number]
  ) {
    event.preventDefault();

    setActiveTab(tab.name);

    isManualClick.current = true;

    if (clickTimeout.current) {
      clearTimeout(clickTimeout.current);
    }

    clickTimeout.current = setTimeout(() => {
      isManualClick.current = false;
      clickTimeout.current = null;
    }, 850);

    const targetElement = document.querySelector(tab.href);

    if (targetElement) {
      targetElement.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      window.history.pushState(null, "", tab.href);
    }
  }

  // -------------------------------------------------------------
  // Header UI
  // -------------------------------------------------------------

  return (
    <header className="sticky top-0 z-40 w-full select-none border-b border-slate-200/80 bg-white/95 shadow-xs backdrop-blur-md transition-colors duration-200">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Brand Logo & Platform Title */}
        <Link
          href="/"
          className="group flex shrink-0 select-none items-center gap-3 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#245B85]"
        >
          <div className="relative flex items-center justify-center overflow-hidden rounded-md bg-white">
            <Image
              src="/logo.jfif"
              alt="VI-Fleet Logo"
              width={46}
              height={30}
              className="h-8 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
              priority
            />
          </div>

          <span className="select-none text-xl font-black tracking-tight text-[#142B45]">
            VI-Fleet
          </span>
        </Link>

        {/* Desktop Primary Navigation */}
        <nav
          className="hidden select-none items-center space-x-1 md:flex lg:space-x-2"
          aria-label="Main Navigation"
        >
          {NAV_LINKS.map((tab) => {
            const isActive = activeTab === tab.name;

            return (
              <a
                key={tab.name}
                href={tab.href}
                onClick={(event) => handleNavClick(event, tab)}
                aria-current={isActive ? "location" : undefined}
                className={`relative cursor-pointer select-none rounded-md px-3 py-2 text-sm font-semibold transition-colors duration-150 ${
                  isActive
                    ? "text-[#142B45]"
                    : "text-slate-600 hover:bg-slate-50 hover:text-[#142B45]"
                }`}
              >
                <span className="select-none">{tab.name}</span>

                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0.5 left-3 right-3 h-[2.5px] rounded-full bg-[#E6A23C]"
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden select-none items-center gap-2.5 sm:flex">
          <button
            type="button"
            onClick={openLogin}
            className="inline-flex cursor-pointer select-none items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-[#142B45] transition-colors hover:bg-slate-50 hover:text-[#245B85]"
          >
            Sign In
          </button>

          <Link
            href="/register"
            className="inline-flex select-none items-center justify-center gap-1.5 rounded-lg bg-[#E6A23C] px-4 py-2 text-sm font-bold text-white shadow-xs transition-all hover:bg-[#d9942d] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E6A23C] focus-visible:ring-offset-2"
          >
            <span className="select-none">Get Started</span>
            <span aria-hidden="true">→</span>
          </Link>

          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>

        {/* Mobile Controls */}
        <div className="flex select-none items-center gap-1.5 sm:hidden">
          <ThemeToggle
            theme={theme}
            onToggle={toggleTheme}
            mobile
          />

          <button
            type="button"
            onClick={openLogin}
            className="select-none rounded-md px-2.5 py-1.5 text-xs font-semibold text-[#142B45] hover:bg-slate-100"
          >
            Sign In
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((previous) => !previous)}
            className="inline-flex select-none items-center justify-center rounded-lg p-2 text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#245B85]"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="animate-in slide-in-from-top-2 select-none border-b border-slate-200 bg-white px-4 pb-5 pt-2 shadow-lg sm:hidden">
          <nav
            className="flex select-none flex-col space-y-1"
            aria-label="Mobile Navigation"
          >
            {NAV_LINKS.map((tab) => (
              <a
                key={tab.name}
                href={tab.href}
                onClick={(event) => {
                  handleNavClick(event, tab);
                  setMobileMenuOpen(false);
                }}
                aria-current={
                  activeTab === tab.name ? "location" : undefined
                }
                className={`flex select-none items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold ${
                  activeTab === tab.name
                    ? "bg-slate-100 font-bold text-[#142B45]"
                    : "text-slate-600 hover:bg-slate-50 hover:text-[#142B45]"
                }`}
              >
                <span className="select-none">{tab.name}</span>

                {activeTab === tab.name && (
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-[#E6A23C]"
                  />
                )}
              </a>
            ))}
          </nav>

          <div className="mt-4 flex select-none flex-col gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                openLogin();
              }}
              className="flex w-full select-none items-center justify-center rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-[#142B45] hover:bg-slate-50"
            >
              Sign In
            </button>

            <Link
              href="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="flex w-full select-none items-center justify-center gap-1.5 rounded-lg bg-[#E6A23C] py-2.5 text-sm font-bold text-white shadow-xs hover:bg-[#d9942d]"
            >
              <span className="select-none">Get Started</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
