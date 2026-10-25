import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-7 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <Link href="/" className="text-lg font-bold text-gray-900">
          VI-Fleet
        </Link>

        <p className="text-sm text-gray-500">
          Vehicle and Fleet Management System
        </p>

        <div className="flex items-center gap-5">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 transition hover:text-blue-700"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="text-sm font-medium text-gray-600 transition hover:text-blue-700"
          >
            Register
          </Link>
        </div>
      </div>
      <div className="border-t border-gray-100 py-4 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} VI-Fleet. All rights reserved.
      </div>
    </footer>
  );
}