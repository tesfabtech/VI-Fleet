"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";

export function DriverHeader({
  driverName,
  organizationName,
  licenseNumber,
}: {
  driverName: string;
  organizationName: string;
  licenseNumber: string;
}) {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200/80 bg-[#142B45] text-white shadow-xs backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
        <Link href="/driver" className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-md bg-white p-0.5">
            <Image
              src="/logo.jfif"
              alt="VI-Fleet"
              width={32}
              height={32}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black tracking-tight text-white">VI-Fleet</span>
              <span className="rounded bg-[#E6A23C] px-1.5 py-0.2 text-[10px] font-black uppercase text-[#142B45]">
                Driver
              </span>
            </div>
            <p className="text-[10px] leading-tight text-slate-300 truncate max-w-[150px] sm:max-w-[220px]">
              {organizationName}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <div className="hidden text-right sm:block">
            <p className="text-xs font-bold text-white">{driverName}</p>
            <p className="text-[10px] text-slate-300">Lic #{licenseNumber}</p>
          </div>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign Out"
            className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20 active:scale-95 cursor-pointer"
          >
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
