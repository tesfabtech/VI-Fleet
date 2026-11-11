import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  updateAdministratorPassword,
  updateAdministratorProfile,
  updateOrganizationProfile,
} from "./actions";
import ThemePreferences from "./theme-preferences";

const ALLOWED_ROLES = [
  "ORGANIZATION_ADMINISTRATOR",
  "VICE_ORGANIZATION_ADMINISTRATOR",
] as const;

type SettingsPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  "name-required": "Enter your organization name.",
  "name-too-long": "Organization name must be 150 characters or fewer.",
  "invalid-email": "Enter a valid contact email address (255 characters max).",
  "phone-too-long": "Phone number must be 30 characters or fewer.",
  "description-too-long": "Description must be 2,000 characters or fewer.",
  "organization-inactive":
    "Your organization is currently inactive. Profile changes cannot be saved while inactive.",
  "invalid-admin-name":
    "First, middle, and last names are required (150 characters max).",
  "profile-update-failed":
    "Could not update your administrator profile. Please try again.",
  "current-password-incorrect":
    "Your current password is incorrect. Password was not changed.",
  "password-length":
    "Your new password must be between 12 and 128 characters.",
  "password-mismatch":
    "The new password and confirmation password do not match.",
  "password-unchanged":
    "Choose a new password that is different from your current password.",
};

const successMessages: Record<string, string> = {
  "organization-updated": "Organization profile updated successfully.",
  "admin-profile-updated": "Your administrator profile details were updated.",
  "password-updated": "Your password has been updated successfully.",
};

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function getPaymentBadge(status: string | undefined) {
  switch (status) {
    case "PAID":
      return { label: "Paid", className: "bg-green-100 text-green-800" };
    case "NOT_REQUIRED":
      return {
        label: "Institutional (No Fee Required)",
        className: "bg-blue-100 text-blue-800",
      };
    case "PENDING":
      return {
        label: "Payment Pending",
        className: "bg-amber-100 text-amber-800",
      };
    case "FAILED":
      return { label: "Payment Failed", className: "bg-red-100 text-red-800" };
    case "REFUNDED":
      return { label: "Refunded", className: "bg-slate-100 text-slate-700" };
    default:
      return { label: "Standard Plan", className: "bg-blue-50 text-blue-700" };
  }
}

export default async function OrganizationSettingsPage({
  searchParams,
}: SettingsPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (
    !session.user.role ||
    !ALLOWED_ROLES.includes(
      session.user.role as (typeof ALLOWED_ROLES)[number],
    )
  ) {
    notFound();
  }

  const organizationId = session.user.organizationId;

  if (!organizationId) {
    notFound();
  }

  const params = await searchParams;
  const now = new Date();

  const [
    organization,
    currentAdmin,
    activeDepartmentsCount,
    inactiveDepartmentsCount,
    departmentUsersCount,
    pendingApplicationsCount,
    transportManagersCount,
    administratorsCount,
    vehiclesCount,
    driversCount,
    gpsDevicesCount,
    activeRegistrationLink,
  ] = await Promise.all([
    prisma.organization.findFirst({
      where: {
        id: organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        contactEmail: true,
        phone: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        application: {
          select: {
            status: true,
            paymentStatus: true,
            submittedAt: true,
            reviewedAt: true,
          },
        },
      },
    }),
    prisma.user.findFirst({
      where: {
        id: session.user.id,
        organizationId,
        deletedAt: null,
      },
      select: {
        firstName: true,
        middleName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
      },
    }),
    prisma.department.count({
      where: { organizationId, deletedAt: null, status: "ACTIVE" },
    }),
    prisma.department.count({
      where: { organizationId, deletedAt: null, status: "INACTIVE" },
    }),
    prisma.user.count({
      where: { organizationId, deletedAt: null, role: "DEPARTMENT_USER" },
    }),
    prisma.departmentUserApplication.count({
      where: {
        organizationId,
        status: { in: ["PENDING", "UNDER_REVIEW"] },
      },
    }),
    prisma.user.count({
      where: {
        organizationId,
        deletedAt: null,
        role: { in: ["TRANSPORT_MANAGER", "VICE_TRANSPORT_MANAGER"] },
      },
    }),
    prisma.user.count({
      where: {
        organizationId,
        deletedAt: null,
        role: {
          in: [
            "ORGANIZATION_ADMINISTRATOR",
            "VICE_ORGANIZATION_ADMINISTRATOR",
          ],
        },
      },
    }),
    prisma.vehicle.count({
      where: { organizationId, deletedAt: null },
    }),
    prisma.driver.count({
      where: { organizationId, deletedAt: null },
    }),
    prisma.gPSDevice.count({
      where: { organizationId, deletedAt: null },
    }),
    prisma.departmentRegistrationLink.findFirst({
      where: {
        organizationId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
      },
    }),
  ]);

  if (!organization || !currentAdmin) {
    notFound();
  }

  const isOrganizationActive = organization.status === "ACTIVE";
  const paymentBadge = getPaymentBadge(
    organization.application?.paymentStatus,
  );
  const totalUsersCount =
    administratorsCount +
    transportManagersCount +
    departmentUsersCount +
    driversCount;

  const errorMessage = params.error
    ? errorMessages[params.error] ?? "Something went wrong. Please try again."
    : null;

  const successMessage = params.success
    ? successMessages[params.success] ?? null
    : null;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <Link
            href="/organization"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            ← Back to overview
          </Link>

          <p className="mt-4 text-sm font-medium text-blue-600">
            Organization workspace
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Organization Settings
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Manage your organization profile, subscription & resource usage,
            workspace theme, personal password security, and onboarding controls.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {organization.code && (
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-mono text-xs font-semibold text-slate-700 shadow-xs">
              {organization.code}
            </span>
          )}
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isOrganizationActive
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {isOrganizationActive ? "Active Tenant" : "Inactive Tenant"}
          </span>
        </div>
      </section>

      {!isOrganizationActive && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Your organization is currently marked as <strong>Inactive</strong>.
          Organization profile updates are disabled until platform
          administration reactivates your organization.
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {successMessage}
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* 1. Organization Profile Form */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Organization Profile
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Update your organization’s display name, institutional contact
                details, and operational description.
              </p>
            </div>

            <form action={updateOrganizationProfile} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="organization-name"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Organization name <span className="text-red-600">*</span>
                </label>
                <input
                  id="organization-name"
                  name="name"
                  type="text"
                  required
                  maxLength={150}
                  disabled={!isOrganizationActive}
                  defaultValue={organization.name}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="organization-contact-email"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Official contact email{" "}
                    <span className="text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="organization-contact-email"
                    name="contactEmail"
                    type="email"
                    maxLength={255}
                    disabled={!isOrganizationActive}
                    defaultValue={organization.contactEmail ?? ""}
                    placeholder="transport@wcu.edu.et"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="organization-phone"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Official phone number{" "}
                    <span className="text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="organization-phone"
                    name="phone"
                    type="tel"
                    maxLength={30}
                    disabled={!isOrganizationActive}
                    defaultValue={organization.phone ?? ""}
                    placeholder="+251 46 555 1910"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="organization-description"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Organization description{" "}
                  <span className="text-slate-400">(optional)</span>
                </label>
                <textarea
                  id="organization-description"
                  name="description"
                  rows={4}
                  maxLength={2000}
                  disabled={!isOrganizationActive}
                  defaultValue={organization.description ?? ""}
                  placeholder="Describe your organization, campus locations, and transportation scope..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              <div className="flex items-center justify-end border-t border-slate-100 pt-4">
                <button
                  type="submit"
                  disabled={!isOrganizationActive}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save organization profile
                </button>
              </div>
            </form>
          </section>

          {/* 2. Theme, System Colors & Regional Preferences */}
          <ThemePreferences />

          {/* 3. Administrator Personal Details & Password Update */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Administrator Account & Password Security
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Update your personal administrator details or change your
                account password.
              </p>
            </div>

            {/* Personal Profile Form */}
            <form action={updateAdministratorProfile} className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-800">
                Your administrator profile
              </h3>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="admin-firstName"
                    className="mb-1 block text-xs font-medium text-slate-700"
                  >
                    Your name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="admin-firstName"
                    name="firstName"
                    type="text"
                    required
                    maxLength={150}
                    defaultValue={currentAdmin.firstName ?? ""}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="admin-middleName"
                    className="mb-1 block text-xs font-medium text-slate-700"
                  >
                    Father's name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="admin-middleName"
                    name="middleName"
                    type="text"
                    required
                    maxLength={150}
                    defaultValue={currentAdmin.middleName ?? ""}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="admin-lastName"
                    className="mb-1 block text-xs font-medium text-slate-700"
                  >
                    Grandfather's name{" "}
                    <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="admin-lastName"
                    name="lastName"
                    type="text"
                    required
                    maxLength={150}
                    defaultValue={currentAdmin.lastName ?? ""}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Verified login email
                  </label>
                  <input
                    type="email"
                    disabled
                    value={currentAdmin.email ?? ""}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="admin-phone"
                    className="mb-1 block text-xs font-medium text-slate-700"
                  >
                    Phone number <span className="text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="admin-phone"
                    name="phone"
                    type="tel"
                    maxLength={30}
                    defaultValue={currentAdmin.phone ?? ""}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Update personal details
                </button>
              </div>
            </form>

            {/* Change Password Form */}
            <form
              action={updateAdministratorPassword}
              className="border-t border-slate-100 pt-6 space-y-4"
            >
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Update password
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Use between 12 and 128 characters. Updating your password
                  invalidates any unused password reset links.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="currentPassword"
                    className="mb-1 block text-xs font-medium text-slate-700"
                  >
                    Current password <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="newPassword"
                    className="mb-1 block text-xs font-medium text-slate-700"
                  >
                    New password <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-1 block text-xs font-medium text-slate-700"
                  >
                    Confirm new password <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  Forgot your current password? Send a reset email →
                </Link>

                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Update password
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* RIGHT COLUMN: SUBSCRIPTION, TENANT METADATA & ONBOARDING CONTROLS */}
        <aside className="space-y-6">
          {/* 4. Subscription, Billing & Resource Usage Card */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Subscription & Plan
                </p>
                <h2 className="mt-1 text-base font-bold text-slate-900">
                  Institutional Fleet SaaS
                </h2>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${paymentBadge.className}`}
              >
                {paymentBadge.label}
              </span>
            </div>

            <dl className="divide-y divide-slate-100 text-sm">
              <div className="flex items-center justify-between py-2">
                <dt className="text-slate-500">Tenant status</dt>
                <dd className="font-semibold text-slate-900">
                  {organization.status}
                </dd>
              </div>

              <div className="flex items-center justify-between py-2">
                <dt className="text-slate-500">Organization code</dt>
                <dd className="font-mono font-semibold text-slate-900">
                  {organization.code ?? "—"}
                </dd>
              </div>

              <div className="flex items-center justify-between py-2">
                <dt className="text-slate-500">Approved date</dt>
                <dd className="text-slate-900">
                  {formatDate(
                    organization.application?.reviewedAt ??
                      organization.createdAt,
                  )}
                </dd>
              </div>

              <div className="flex items-center justify-between py-2">
                <dt className="text-slate-500">Last profile update</dt>
                <dd className="text-slate-900">
                  {formatDate(organization.updatedAt)}
                </dd>
              </div>
            </dl>

            {/* Tenant Resource Usage Bars */}
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Current Organization Usage
              </p>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-700">
                    Active Departments
                  </span>
                  <span className="font-semibold text-slate-900">
                    {activeDepartmentsCount} active ({inactiveDepartmentsCount}{" "}
                    inactive)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{
                      width: `${Math.min(100, Math.max(8, activeDepartmentsCount * 10))}%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-700">
                    Organization & Department Users
                  </span>
                  <span className="font-semibold text-slate-900">
                    {totalUsersCount} accounts
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-600"
                    style={{
                      width: `${Math.min(100, Math.max(8, totalUsersCount * 4))}%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-700">
                    Fleet Vehicles & GPS Devices
                  </span>
                  <span className="font-semibold text-slate-900">
                    {vehiclesCount} vehicles • {gpsDevicesCount} trackers
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-600"
                    style={{
                      width: `${Math.min(100, Math.max(8, vehiclesCount * 5))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 5. Onboarding & Access Controls Summary */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Onboarding & Access Controls
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Quick status of self-service registration and role accounts.
              </p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">
                    Department registration link
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      activeRegistrationLink
                        ? "bg-green-100 text-green-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {activeRegistrationLink ? "Active" : "None active"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {activeRegistrationLink
                    ? activeRegistrationLink.expiresAt
                      ? `Expires ${formatDate(activeRegistrationLink.expiresAt)}`
                      : "Active with no automatic expiry"
                    : "Generate a link to allow department staff to apply."}
                </p>
                <Link
                  href="/organization/department-users/registration-links"
                  className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:underline"
                >
                  Manage registration links →
                </Link>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">
                    Pending user applications
                  </span>
                  <span className="font-semibold text-amber-700">
                    {pendingApplicationsCount}
                  </span>
                </div>
                <Link
                  href="/organization/department-users"
                  className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:underline"
                >
                  Review applications & department users →
                </Link>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">
                    Transport managers
                  </span>
                  <span className="font-semibold text-slate-900">
                    {transportManagersCount}
                  </span>
                </div>
                <Link
                  href="/organization/transport-managers"
                  className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:underline"
                >
                  Manage transport manager accounts →
                </Link>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
