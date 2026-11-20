"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  icon: (active: boolean) => React.ReactNode;
}

const navItems: NavItem[] = [
  {
    label: "Home",
    href: "/driver",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[#E6A23C]" : "text-slate-400"}`}
        fill={active ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={active ? "2" : "1.75"}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    label: "My Trips",
    href: "/driver/trips",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[#E6A23C]" : "text-slate-400"}`}
        fill={active ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={active ? "2" : "1.75"}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
        />
      </svg>
    ),
  },
  {
    label: "History",
    href: "/driver/history",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[#E6A23C]" : "text-slate-400"}`}
        fill={active ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={active ? "2" : "1.75"}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    label: "Profile",
    href: "/driver/profile",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[#E6A23C]" : "text-slate-400"}`}
        fill={active ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={active ? "2" : "1.75"}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
  },
];

export function DriverBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Driver Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/90 bg-white/95 shadow-lg backdrop-blur-md transition-colors"
    >
      <div className="mx-auto flex h-14 max-w-md items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/driver"
              ? pathname === "/driver"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors select-none ${
                isActive ? "text-[#142B45] font-bold" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <div className="relative flex flex-col items-center">
                {item.icon(isActive)}
                <span className="mt-0.5 text-[11px] font-semibold tracking-tight">
                  {item.label}
                </span>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-1 h-1 w-4 rounded-full bg-[#E6A23C]"
                  />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
