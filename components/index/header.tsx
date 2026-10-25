import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-lg font-bold text-white">
            V
          </div>
          <div>
            <span className="block text-xl font-bold tracking-tight text-gray-900">
              VI-Fleet
            </span>
            <span className="text-xs text-gray-500">
              Vehicle Management System
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="text-sm font-medium text-gray-600 transition hover:text-blue-700"
          >
            Features
          </a>
          <a
            href="#about"
            className="text-sm font-medium text-gray-600 transition hover:text-blue-700"
          >
            About
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            Get Started
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </header>
  );
}