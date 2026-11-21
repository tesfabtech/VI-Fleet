"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useActionState,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  submitOrganizationApplication,
  type RegistrationState,
} from "./actions";

const initialState: RegistrationState = {
  success: false,
  message: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e293b] px-3.5 py-2.5 text-sm text-[#142B45] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#245B85] dark:focus:border-[#60a5fa] focus:outline-none focus:ring-2 focus:ring-[#245B85]/20 dark:focus:ring-blue-500/20 transition-all shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed";

const inputErrorClass =
  "border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-100 dark:focus:ring-red-950/40";

const labelClass =
  "block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(
    submitOrganizationApplication,
    initialState,
  );

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | null) => {
    setFileError(null);
    if (!file) {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_SIZE) {
      setFileError("File exceeds the maximum allowed size of 10 MB.");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["pdf", "jpg", "jpeg", "png"].includes(ext)) {
      setFileError("Only PDF, JPG, JPEG, and PNG files are accepted.");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!pending) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (pending) return;

    const file = e.dataTransfer.files?.[0] || null;
    if (file) {
      if (fileInputRef.current) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInputRef.current.files = dataTransfer.files;
      }
      handleFile(file);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ─────────────────────────────────────────────────────────────
  // SUCCESS SCREEN
  // ─────────────────────────────────────────────────────────────
  if (state.success) {
    return (
      <div className="vi-public min-h-screen flex flex-col justify-between bg-[#F4F6F8] dark:bg-[#0b1120] text-[#142B45] dark:text-slate-100 transition-colors">
        {/* Branded Navigation Header */}
        <header className="sticky top-0 z-40 w-full select-none border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0b1120]/95 shadow-xs backdrop-blur-md transition-colors">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link
              href="/"
              className="group flex shrink-0 select-none items-center gap-3 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#245B85]"
            >
              <div className="relative flex items-center justify-center overflow-hidden rounded-md bg-white p-1 shadow-2xs">
                <Image
                  src="/logo.jfif"
                  alt="VI-Fleet Logo"
                  width={46}
                  height={30}
                  className="h-8 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
                  priority
                />
              </div>

              <span className="select-none text-xl font-black tracking-tight text-[#142B45] dark:text-white">
                VI-Fleet
              </span>
            </Link>

            <Link
              href="/"
              className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-[#142B45] dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              ← Back to home
            </Link>
          </div>
        </header>

        {/* Success Presentation */}
        <main className="flex-1 flex items-center justify-center px-4 py-12 sm:py-20">
          <section className="w-full max-w-2xl rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0f172a] p-8 sm:p-12 shadow-xl shadow-slate-200/50 dark:shadow-none text-center transition-colors">
            {/* Success Check Badge */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E6A23C]/15 border border-[#E6A23C]/30 text-3xl font-black text-[#E6A23C]">
              ✓
            </div>

            <h1 className="mt-6 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[#142B45] dark:text-white">
              Application Submitted
            </h1>

            <p className="mt-4 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">
              {state.message}
            </p>

            {/* Next Steps Information Card */}
            <div className="mt-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#F4F6F8] dark:bg-[#1e293b]/60 p-6 text-left">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#142B45] dark:text-white mb-3">
                What Happens Next?
              </h2>
              <ul className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#142B45] dark:bg-[#245B85] text-[10px] font-bold text-white mt-0.5">
                    1
                  </span>
                  <span>
                    Our administration team will review your organization profile
                    and verify the uploaded official document.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#142B45] dark:bg-[#245B85] text-[10px] font-bold text-white mt-0.5">
                    2
                  </span>
                  <span>
                    Upon review approval, an administrator onboarding invitation
                    will be delivered to your contact email.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#142B45] dark:bg-[#245B85] text-[10px] font-bold text-white mt-0.5">
                    3
                  </span>
                  <span>
                    The designated administrator can configure their password
                    and immediately begin managing the organization fleet.
                  </span>
                </li>
              </ul>
            </div>

            <div className="mt-8">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#142B45] hover:bg-[#245B85] dark:bg-[#245B85] dark:hover:bg-[#1d4ed8] px-8 py-3.5 text-sm font-bold text-white shadow-md transition-all active:scale-[0.98]"
              >
                <span>Return to home</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="w-full border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] py-4 px-6 sm:px-12 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3 transition-colors">
          <p>© 2025 VI-Fleet. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-[#142B45] dark:hover:text-white transition-colors">
              Home
            </Link>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <Link href="/login" className="hover:text-[#142B45] dark:hover:text-white transition-colors">
              Sign In
            </Link>
          </div>
        </footer>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // MAIN REGISTRATION PAGE
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="vi-public min-h-screen flex flex-col justify-between bg-[#F4F6F8] dark:bg-[#0b1120] text-[#142B45] dark:text-slate-100 transition-colors">
      {/* Branded Navigation Header */}
      <header className="sticky top-0 z-40 w-full select-none border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0b1120]/95 shadow-xs backdrop-blur-md transition-colors">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo */}
          <Link
            href="/"
            className="group flex shrink-0 select-none items-center gap-3 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#245B85]"
          >
            <div className="relative flex items-center justify-center overflow-hidden rounded-md bg-white p-1 shadow-2xs">
              <Image
                src="/logo.jfif"
                alt="VI-Fleet Logo"
                width={46}
                height={30}
                className="h-8 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
                priority
              />
            </div>

            <span className="select-none text-xl font-black tracking-tight text-[#142B45] dark:text-white">
              VI-Fleet
            </span>
          </Link>

          {/* Header Right Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/"
              className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-[#142B45] dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              ← Back
            </Link>

            <span className="text-slate-300 dark:text-slate-700">|</span>

            <Link
              href="/login"
              className="inline-flex select-none items-center justify-center rounded-lg border border-slate-200/90 dark:border-slate-700 bg-white/80 dark:bg-[#1e293b] px-3.5 py-1.5 text-xs sm:text-sm font-bold text-[#142B45] dark:text-white shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Registration Area */}
      <main className="flex-1 px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
        <div className="mx-auto max-w-3xl">
          {/* Page Heading & Process Intro */}
          <div className="mb-8 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E6A23C]/40 bg-[#142B45]/5 dark:bg-[#142B45]/60 px-3.5 py-1 text-xs font-bold tracking-widest text-[#E6A23C] backdrop-blur-xs shadow-2xs">
              <span>ORGANIZATION ONBOARDING</span>
            </div>

            <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#142B45] dark:text-white leading-tight">
              Register Your Organization
            </h1>

            <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300 max-w-2xl">
              Provide your organization details and upload official registration documentation.
              Our team reviews and approves each application before provisioning administrative access.
            </p>
          </div>

          {/* Registration Form Card */}
          <form
            action={formAction}
            className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0f172a] p-6 sm:p-10 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-8 transition-colors"
          >
            {/* Global Error Banner */}
            {state.message && !state.success && (
              <div
                role="alert"
                aria-live="polite"
                className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-4 text-xs text-red-800 dark:text-red-300 flex items-start gap-3 shadow-2xs"
              >
                <svg
                  className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div>
                  <p className="font-bold text-red-900 dark:text-red-200">
                    {state.message}
                  </p>
                  {state.errors && Object.keys(state.errors).length > 0 && (
                    <p className="mt-1 text-red-700 dark:text-red-400">
                      Please check the highlighted fields below.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* SECTION 1: Organization Information */}
            <div className="space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#142B45] dark:bg-[#245B85] text-[11px] font-black text-white">
                  01
                </span>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-[#142B45] dark:text-white">
                    Organization Information
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Entity name, legal classification, and profile overview.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="organizationName" className={labelClass}>
                    Organization Name <span className="text-[#E6A23C] font-black">*</span>
                  </label>
                  <input
                    id="organizationName"
                    name="organizationName"
                    type="text"
                    required
                    maxLength={150}
                    placeholder="e.g., Acme Logistics Ltd."
                    className={`${inputClass} ${
                      state.errors?.organizationName ? inputErrorClass : ""
                    }`}
                    disabled={pending}
                    aria-invalid={Boolean(state.errors?.organizationName)}
                  />
                  {state.errors?.organizationName && (
                    <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                      {state.errors.organizationName}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="organizationType" className={labelClass}>
                    Organization Type <span className="text-[#E6A23C] font-black">*</span>
                  </label>
                  <select
                    id="organizationType"
                    name="organizationType"
                    required
                    defaultValue=""
                    className={`${inputClass} ${
                      state.errors?.organizationType ? inputErrorClass : ""
                    }`}
                    disabled={pending}
                    aria-invalid={Boolean(state.errors?.organizationType)}
                  >
                    <option value="" disabled className="bg-white dark:bg-[#1e293b] text-slate-500">
                      Select an organization type
                    </option>
                    <option value="PRIVATE_COMPANY" className="bg-white dark:bg-[#1e293b] text-[#142B45] dark:text-slate-100">
                      Private Company
                    </option>
                    <option value="GOVERNMENT" className="bg-white dark:bg-[#1e293b] text-[#142B45] dark:text-slate-100">
                      Government
                    </option>
                    <option value="NGO" className="bg-white dark:bg-[#1e293b] text-[#142B45] dark:text-slate-100">
                      NGO
                    </option>
                    <option value="OTHER" className="bg-white dark:bg-[#1e293b] text-[#142B45] dark:text-slate-100">
                      Other
                    </option>
                  </select>
                  {state.errors?.organizationType && (
                    <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                      {state.errors.organizationType}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="website" className={labelClass}>
                    Website <span className="text-slate-400 dark:text-slate-500 font-normal normal-case text-xs">(optional)</span>
                  </label>
                  <input
                    id="website"
                    name="website"
                    type="text"
                    maxLength={255}
                    placeholder="https://example.com"
                    className={`${inputClass} ${
                      state.errors?.website ? inputErrorClass : ""
                    }`}
                    disabled={pending}
                    aria-invalid={Boolean(state.errors?.website)}
                  />
                  {state.errors?.website && (
                    <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                      {state.errors.website}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="description" className={labelClass}>
                    About Your Organization <span className="text-slate-400 dark:text-slate-500 font-normal normal-case text-xs">(optional)</span>
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    maxLength={5000}
                    placeholder="Briefly describe your organization's mission and transport operations."
                    className={`${inputClass} ${
                      state.errors?.description ? inputErrorClass : ""
                    }`}
                    disabled={pending}
                    aria-invalid={Boolean(state.errors?.description)}
                  />
                  {state.errors?.description && (
                    <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                      {state.errors.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 2: Contact Information */}
            <div className="space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#142B45] dark:bg-[#245B85] text-[11px] font-black text-white">
                  02
                </span>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-[#142B45] dark:text-white">
                    Contact Information
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Direct communication and administrator invitation delivery channel.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="contactEmail" className={labelClass}>
                    Contact Email <span className="text-[#E6A23C] font-black">*</span>
                  </label>
                  <input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    required
                    maxLength={255}
                    placeholder="contact@organization.com"
                    className={`${inputClass} ${
                      state.errors?.contactEmail ? inputErrorClass : ""
                    }`}
                    disabled={pending}
                    aria-invalid={Boolean(state.errors?.contactEmail)}
                  />
                  <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    This is the organization&apos;s contact/invitation delivery email,
                    not necessarily the future administrator&apos;s login email.
                  </p>
                  {state.errors?.contactEmail && (
                    <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                      {state.errors.contactEmail}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="phone" className={labelClass}>
                    Phone Number <span className="text-[#E6A23C] font-black">*</span>
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    maxLength={30}
                    placeholder="+251 912 345 678"
                    className={`${inputClass} ${
                      state.errors?.phone ? inputErrorClass : ""
                    }`}
                    disabled={pending}
                    aria-invalid={Boolean(state.errors?.phone)}
                  />
                  {state.errors?.phone && (
                    <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                      {state.errors.phone}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 3: Location */}
            <div className="space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#142B45] dark:bg-[#245B85] text-[11px] font-black text-white">
                  03
                </span>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-[#142B45] dark:text-white">
                    Location
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Primary operational headquarters or base address.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <label htmlFor="country" className={labelClass}>
                    Country <span className="text-[#E6A23C] font-black">*</span>
                  </label>
                  <input
                    id="country"
                    name="country"
                    type="text"
                    required
                    maxLength={100}
                    placeholder="e.g., Ethiopia"
                    className={`${inputClass} ${
                      state.errors?.country ? inputErrorClass : ""
                    }`}
                    disabled={pending}
                    aria-invalid={Boolean(state.errors?.country)}
                  />
                  {state.errors?.country && (
                    <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                      {state.errors.country}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="region" className={labelClass}>
                    Region / State <span className="text-[#E6A23C] font-black">*</span>
                  </label>
                  <input
                    id="region"
                    name="region"
                    type="text"
                    required
                    maxLength={100}
                    placeholder="e.g., Addis Ababa"
                    className={`${inputClass} ${
                      state.errors?.region ? inputErrorClass : ""
                    }`}
                    disabled={pending}
                    aria-invalid={Boolean(state.errors?.region)}
                  />
                  {state.errors?.region && (
                    <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                      {state.errors.region}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="city" className={labelClass}>
                    City <span className="text-[#E6A23C] font-black">*</span>
                  </label>
                  <input
                    id="city"
                    name="city"
                    type="text"
                    required
                    maxLength={100}
                    placeholder="e.g., Addis Ababa"
                    className={`${inputClass} ${
                      state.errors?.city ? inputErrorClass : ""
                    }`}
                    disabled={pending}
                    aria-invalid={Boolean(state.errors?.city)}
                  />
                  {state.errors?.city && (
                    <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                      {state.errors.city}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="streetAddress" className={labelClass}>
                    Street Address <span className="text-slate-400 dark:text-slate-500 font-normal normal-case text-xs">(optional)</span>
                  </label>
                  <input
                    id="streetAddress"
                    name="streetAddress"
                    type="text"
                    maxLength={255}
                    placeholder="e.g., 100 Main St, Suite 400"
                    className={`${inputClass} ${
                      state.errors?.streetAddress ? inputErrorClass : ""
                    }`}
                    disabled={pending}
                    aria-invalid={Boolean(state.errors?.streetAddress)}
                  />
                  {state.errors?.streetAddress && (
                    <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                      {state.errors.streetAddress}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 4: Fleet Information */}
            <div className="space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#142B45] dark:bg-[#245B85] text-[11px] font-black text-white">
                  04
                </span>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-[#142B45] dark:text-white">
                    Fleet Information
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Estimated vehicle fleet count and administrative structure.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="estimatedFleetSize" className={labelClass}>
                    Estimated Fleet Size <span className="text-[#E6A23C] font-black">*</span>
                  </label>
                  <select
                    id="estimatedFleetSize"
                    name="estimatedFleetSize"
                    required
                    defaultValue=""
                    className={`${inputClass} ${
                      state.errors?.estimatedFleetSize ? inputErrorClass : ""
                    }`}
                    disabled={pending}
                    aria-invalid={Boolean(state.errors?.estimatedFleetSize)}
                  >
                    <option value="" disabled className="bg-white dark:bg-[#1e293b] text-slate-500">
                      Select estimated fleet size
                    </option>
                    <option value="1-10" className="bg-white dark:bg-[#1e293b] text-[#142B45] dark:text-slate-100">
                      1-10 vehicles
                    </option>
                    <option value="11-50" className="bg-white dark:bg-[#1e293b] text-[#142B45] dark:text-slate-100">
                      11-50 vehicles
                    </option>
                    <option value="51-100" className="bg-white dark:bg-[#1e293b] text-[#142B45] dark:text-slate-100">
                      51-100 vehicles
                    </option>
                    <option value="101-500" className="bg-white dark:bg-[#1e293b] text-[#142B45] dark:text-slate-100">
                      101-500 vehicles
                    </option>
                    <option value="500+" className="bg-white dark:bg-[#1e293b] text-[#142B45] dark:text-slate-100">
                      500+ vehicles
                    </option>
                  </select>
                  {state.errors?.estimatedFleetSize && (
                    <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                      {state.errors.estimatedFleetSize}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="departmentCount" className={labelClass}>
                    Number of Departments <span className="text-slate-400 dark:text-slate-500 font-normal normal-case text-xs">(optional)</span>
                  </label>
                  <input
                    id="departmentCount"
                    name="departmentCount"
                    type="number"
                    min={0}
                    max={10000}
                    placeholder="e.g., 5"
                    className={`${inputClass} ${
                      state.errors?.departmentCount ? inputErrorClass : ""
                    }`}
                    disabled={pending}
                    aria-invalid={Boolean(state.errors?.departmentCount)}
                  />
                  {state.errors?.departmentCount && (
                    <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                      {state.errors.departmentCount}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 5: Official Organization Document */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#142B45] dark:bg-[#245B85] text-[11px] font-black text-white">
                    05
                  </span>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wider text-[#142B45] dark:text-white">
                      Official Organization Document <span className="text-[#E6A23C] font-black">*</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Business license, incorporation certificate, or official government authorization.
                    </p>
                  </div>
                </div>

                <span className="hidden sm:inline-flex rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Max 10 MB
                </span>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                id="officialDocument"
                name="officialDocument"
                type="file"
                required
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={handleFileChange}
                disabled={pending}
                className="sr-only"
                aria-invalid={Boolean(state.errors?.officialDocument || fileError)}
              />

              {!selectedFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !pending && fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-all cursor-pointer ${
                    isDragging
                      ? "border-[#E6A23C] bg-amber-50/40 dark:bg-amber-950/20"
                      : state.errors?.officialDocument || fileError
                      ? "border-red-300 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 hover:border-red-400"
                      : "border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-[#1e293b]/40 hover:border-[#245B85] dark:hover:border-[#60a5fa] hover:bg-slate-50 dark:hover:bg-[#1e293b]"
                  } ${pending ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#142B45]/5 dark:bg-white/10 text-[#245B85] dark:text-[#E6A23C] mb-3">
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>

                  <p className="text-sm font-bold text-[#142B45] dark:text-white">
                    Click to browse or drag and drop your document
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    PDF, JPG, JPEG, or PNG (up to 10 MB)
                  </p>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-[#1e293b] p-4 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#142B45] dark:bg-[#245B85] text-white font-black text-xs uppercase shadow-sm">
                      {selectedFile.name.split(".").pop() || "DOC"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#142B45] dark:text-white max-w-[200px] sm:max-w-xs md:max-w-md">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatBytes(selectedFile.size)} • Ready for upload
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={pending}
                      className="cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={removeFile}
                      disabled={pending}
                      className="cursor-pointer rounded-lg border border-red-200 dark:border-red-900/50 bg-white dark:bg-[#0f172a] px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              {fileError && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">{fileError}</p>
              )}
              {state.errors?.officialDocument && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  {state.errors.officialDocument}
                </p>
              )}
            </div>

            {/* Disclaimer & Submission Notice */}
            <div className="border-t border-slate-100 dark:border-slate-800/80 pt-6 space-y-6">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#F4F6F8] dark:bg-[#1e293b]/60 p-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                <p>
                  <strong className="font-bold text-[#142B45] dark:text-white">
                    Approval Process:
                  </strong>{" "}
                  Submitting this application initiates administrator verification.
                  Once verified, account setup instructions and an administrator invitation link
                  will be delivered to your contact email.
                </p>
              </div>

              {/* Form Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full sm:w-auto inline-flex select-none items-center justify-center gap-2 rounded-xl bg-[#E6A23C] hover:bg-[#d9942d] px-8 py-3.5 text-sm sm:text-base font-bold text-[#142B45] shadow-lg shadow-[#E6A23C]/20 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E6A23C]"
                >
                  {pending ? (
                    <>
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#142B45] border-t-transparent" />
                      <span>Submitting application...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Application</span>
                      <span aria-hidden="true">→</span>
                    </>
                  )}
                </button>

                <p className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-right">
                  Fields marked with <span className="text-[#E6A23C] font-black">*</span> are required.
                </p>
              </div>
            </div>
          </form>

          {/* Bottom Navigation */}
          <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an active account?{" "}
            <Link
              href="/login"
              className="font-bold text-[#245B85] hover:text-[#142B45] dark:text-[#60a5fa] dark:hover:text-white transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>

      {/* Branded Footer */}
      <footer className="w-full border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] py-6 px-4 sm:px-8 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3 transition-colors">
        <p>© 2025 VI-Fleet. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <Link href="/" className="hover:text-[#142B45] dark:hover:text-white transition-colors">
            Home
          </Link>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <Link href="/login" className="hover:text-[#142B45] dark:hover:text-white transition-colors">
            Sign In
          </Link>
        </div>
      </footer>
    </div>
  );
}
