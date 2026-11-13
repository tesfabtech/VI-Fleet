import Link from "next/link";
import { redirect } from "next/navigation";
import { DriverStatus, Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type DriversPageProps = {
  searchParams: Promise<{
    created?: string;
    invitation?: string;
    error?: string;
    message?: string;
    q?: string;
    status?: string;
    accountStatus?: string;
    licenseStatus?: string;
    page?: string;
  }>;
};

const ALLOWED_ROLES = [
  "TRANSPORT_MANAGER",
  "VICE_TRANSPORT_MANAGER",
] as const;

const PAGE_SIZE = 15;

function formatDate(date: Date | null): string {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function getDriverStatusBadge(status: string) {
  switch (status) {
    case "ACTIVE":
      return {
        label: "Active",
        cls: "bg-green-100 text-green-800",
      };
    case "SUSPENDED":
      return {
        label: "Suspended",
        cls: "bg-red-100 text-red-800",
      };
    default:
      return {
        label: "Inactive",
        cls: "bg-gray-100 text-gray-700",
      };
  }
}

function getLicenseValidity(expiryDate: Date | null) {
  if (!expiryDate) {
    return {
      label: "No date",
      cls: "bg-gray-100 text-gray-600",
    };
  }

  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffDays = Math.ceil(
    (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0) {
    return {
      label: "Expired",
      cls: "bg-red-100 text-red-800",
    };
  }

  if (diffDays <= 30) {
    return {
      label: `Expiring (${diffDays}d)`,
      cls: "bg-amber-100 text-amber-800",
    };
  }

  return {
    label: "Valid",
    cls: "bg-green-100 text-green-800",
  };
}

function getAccountStage(u: {
  status: string;
  passwordHash: string | null;
  email: string | null;
  pendingEmail: string | null;
} | null) {
  if (!u) {
    return {
      label: "No account",
      cls: "bg-gray-100 text-gray-700",
    };
  }

  if (!u.passwordHash) {
    return {
      label: "Pending password",
      cls: "bg-amber-100 text-amber-800",
    };
  }

  if (u.pendingEmail || !u.email) {
    return {
      label: "Pending verify",
      cls: "bg-blue-100 text-blue-800",
    };
  }

  if (u.status === "ACTIVE") {
    return {
      label: "Active",
      cls: "bg-green-100 text-green-800",
    };
  }

  if (u.status === "SUSPENDED") {
    return {
      label: "Suspended",
      cls: "bg-red-100 text-red-800",
    };
  }

  return {
    label: "Inactive",
    cls: "bg-gray-100 text-gray-700",
  };
}

function getNotice(searchParams: {
  created?: string;
  invitation?: string;
  error?: string;
  message?: string;
}) {
  if (searchParams.created === "1") {
    return {
      type: "success" as const,
      message:
        "The driver account was created and the invitation email was sent.",
    };
  }

  if (searchParams.invitation === "failed") {
    return {
      type: "error" as const,
      message:
        "The driver was created, but the invitation email could not be confirmed. Check your email configuration and arrange a safe way to resend the invitation.",
    };
  }

  const messages: Record<string, string> = {
    "profile-updated": "Driver profile was successfully updated.",
    "status-updated": "Driver operational status was updated.",
    "account-status-updated": "Driver user account status was updated.",
    "invitation-resent": "Password setup invitation email was resent.",
    "verification-resent": "Email verification link was resent.",
    "preferred-vehicle-updated":
      "Driver preferred vehicle was successfully updated.",
    "preferred-vehicle-removed": "Driver preferred vehicle was removed.",
  };

  if (searchParams.message && messages[searchParams.message]) {
    return {
      type: "success" as const,
      message: messages[searchParams.message],
    };
  }

  const errorMessages: Record<string, string> = {
    "email-exists":
      "That email address is already associated with an account or pending invitation.",
    "license-exists":
      "That license number is already registered in your organization.",
    "missing-fields": "Complete all required fields and try again.",
    "invalid-length": "One or more fields exceed the allowed length.",
    "invalid-email": "Enter a valid email address.",
    "invalid-expiry": "Enter a valid license expiry date.",
    "organization-unavailable":
      "Your organization is unavailable. Contact your administrator.",
    "create-failed": "The driver could not be created. Please try again.",
    "driver-not-found": "Driver not found.",
    "account-not-found": "Linked user account not found.",
    "setup-incomplete":
      "The driver must complete password setup and verify their email before their account can be activated.",
    throttled: "Please wait at least 2 minutes before resending another email.",
    "invitation-send-failed": "Could not send the invitation email.",
    "verification-send-failed": "Could not send the verification email.",
    "invalid-vehicle-id": "The selected vehicle is invalid.",
    "vehicle-not-found": "Vehicle not found in your organization.",
    "vehicle-not-active":
      "Only active vehicles can be assigned as a preferred vehicle.",
  };

  if (searchParams.error && errorMessages[searchParams.error]) {
    return {
      type: "error" as const,
      message: errorMessages[searchParams.error],
    };
  }

  return null;
}

export default async function DriversPage({
  searchParams,
}: DriversPageProps) {
  const session = await auth();
  const sessionUser = session?.user;

  if (
    !sessionUser?.id ||
    !sessionUser.organizationId ||
    !sessionUser.role ||
    !ALLOWED_ROLES.includes(
      sessionUser.role as (typeof ALLOWED_ROLES)[number],
    )
  ) {
    redirect("/login");
  }

  const organizationId = sessionUser.organizationId;
  const params = await searchParams;
  const notice = getNotice(params);

  const q = params.q?.trim() ?? "";
  const statusParam = params.status?.trim() ?? "";
  const accountStatusParam = params.accountStatus?.trim() ?? "";
  const licenseStatusParam = params.licenseStatus?.trim() ?? "";
  const page = Math.max(1, Number(params.page) || 1);

  // Base counts across the entire organization (unfiltered)
  const [totalOrgDrivers, activeCount, inactiveCount, suspendedCount] =
    await Promise.all([
      prisma.driver.count({
        where: { organizationId, deletedAt: null },
      }),
      prisma.driver.count({
        where: { organizationId, status: "ACTIVE", deletedAt: null },
      }),
      prisma.driver.count({
        where: { organizationId, status: "INACTIVE", deletedAt: null },
      }),
      prisma.driver.count({
        where: { organizationId, status: "SUSPENDED", deletedAt: null },
      }),
    ]);

  // Construct filtered where clause
  const where: Prisma.DriverWhereInput = {
    organizationId,
    deletedAt: null,
  };

  if (
    statusParam &&
    ["ACTIVE", "INACTIVE", "SUSPENDED"].includes(statusParam)
  ) {
    where.status = statusParam as DriverStatus;
  }

  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { licenseNumber: { contains: q, mode: "insensitive" } },
      {
        preferredVehicle: {
          is: {
            OR: [
              { registrationNumber: { contains: q, mode: "insensitive" } },
              { make: { contains: q, mode: "insensitive" } },
              { model: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      },
      {
        user: {
          is: {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { middleName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { pendingEmail: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }

  // Account status filtering
  if (accountStatusParam === "ACTIVE") {
    where.user = {
      is: {
        status: "ACTIVE",
        passwordHash: { not: null },
        pendingEmail: null,
        email: { not: null },
      },
    };
  } else if (accountStatusParam === "PENDING_PASSWORD") {
    where.user = {
      is: {
        passwordHash: null,
      },
    };
  } else if (accountStatusParam === "PENDING_VERIFY") {
    where.user = {
      is: {
        passwordHash: { not: null },
        pendingEmail: { not: null },
      },
    };
  } else if (accountStatusParam === "SUSPENDED") {
    where.user = {
      is: {
        status: "SUSPENDED",
      },
    };
  } else if (accountStatusParam === "INACTIVE") {
    where.user = {
      is: {
        status: "INACTIVE",
      },
    };
  }

  // License status filtering
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (licenseStatusParam === "EXPIRED") {
    where.licenseExpiryDate = {
      lt: now,
    };
  } else if (licenseStatusParam === "EXPIRING_SOON") {
    where.licenseExpiryDate = {
      gte: now,
      lte: in30Days,
    };
  } else if (licenseStatusParam === "VALID") {
    where.licenseExpiryDate = {
      gt: in30Days,
    };
  }

  const [filteredCount, drivers] = await Promise.all([
    prisma.driver.count({ where }),
    prisma.driver.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        licenseNumber: true,
        licenseExpiryDate: true,
        status: true,
        createdAt: true,
        preferredVehicle: {
          select: {
            id: true,
            registrationNumber: true,
            make: true,
            model: true,
          },
        },
        user: {
          select: {
            id: true,
            middleName: true,
            email: true,
            pendingEmail: true,
            status: true,
            passwordHash: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.ceil(filteredCount / PAGE_SIZE) || 1;
  const isFiltered = Boolean(
    q || statusParam || accountStatusParam || licenseStatusParam,
  );

  function createQueryString(newParams: Record<string, string | null>) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (statusParam) next.set("status", statusParam);
    if (accountStatusParam) next.set("accountStatus", accountStatusParam);
    if (licenseStatusParam) next.set("licenseStatus", licenseStatusParam);

    for (const [key, value] of Object.entries(newParams)) {
      if (value === null) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    const str = next.toString();
    return str ? `?${str}` : "";
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Drivers
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage driver profiles, licenses, operational statuses, and account
            invitations.
          </p>
        </div>

        <Link
          href="/transport/drivers/new"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          + Add driver
        </Link>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            notice.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {notice.message}
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total drivers</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {totalOrgDrivers}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Active</p>
          <p className="mt-2 text-3xl font-bold text-green-700">
            {activeCount}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Inactive</p>
          <p className="mt-2 text-3xl font-bold text-gray-700">
            {inactiveCount}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Suspended</p>
          <p className="mt-2 text-3xl font-bold text-red-700">
            {suspendedCount}
          </p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <form
          method="GET"
          action="/transport/drivers"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          {/* Keyword Search */}
          <div className="lg:col-span-2">
            <label htmlFor="q" className="sr-only">
              Search drivers
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search by name, email, phone, license..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Driver Operational Status Filter */}
          <div>
            <label htmlFor="status" className="sr-only">
              Driver Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={statusParam}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All driver statuses</option>
              <option value="ACTIVE">Driver: Active</option>
              <option value="INACTIVE">Driver: Inactive</option>
              <option value="SUSPENDED">Driver: Suspended</option>
            </select>
          </div>

          {/* Account Status Filter */}
          <div>
            <label htmlFor="accountStatus" className="sr-only">
              Account Status
            </label>
            <select
              id="accountStatus"
              name="accountStatus"
              defaultValue={accountStatusParam}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All account stages</option>
              <option value="ACTIVE">Account: Active</option>
              <option value="PENDING_PASSWORD">Pending password</option>
              <option value="PENDING_VERIFY">Pending verification</option>
              <option value="SUSPENDED">Account: Suspended</option>
              <option value="INACTIVE">Account: Inactive</option>
            </select>
          </div>

          {/* License Status Filter */}
          <div>
            <label htmlFor="licenseStatus" className="sr-only">
              License Status
            </label>
            <select
              id="licenseStatus"
              name="licenseStatus"
              defaultValue={licenseStatusParam}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All license statuses</option>
              <option value="VALID">License: Valid</option>
              <option value="EXPIRING_SOON">Expiring soon (30d)</option>
              <option value="EXPIRED">License: Expired</option>
            </select>
          </div>

          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-5">
            <button
              type="submit"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Apply filters
            </button>

            {isFiltered && (
              <Link
                href="/transport/drivers"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Clear filters
              </Link>
            )}

            <span className="ml-auto text-xs text-gray-500">
              Found {filteredCount} {filteredCount === 1 ? "driver" : "drivers"}
            </span>
          </div>
        </form>
      </div>

      {/* Directory Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Driver directory</h2>
          <p className="mt-1 text-sm text-gray-500">
            Showing {drivers.length} of {filteredCount}{" "}
            {filteredCount === 1 ? "driver" : "drivers"}
          </p>
        </div>

        {drivers.length === 0 ? (
          <div className="px-6 py-14 text-center">
            {isFiltered ? (
              <>
                <h3 className="text-lg font-semibold text-gray-900">
                  No matching drivers
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
                  No drivers in your organization match the specified search
                  and filter criteria.
                </p>
                <Link
                  href="/transport/drivers"
                  className="mt-5 inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
                >
                  Reset filters
                </Link>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900">
                  No drivers yet
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
                  Add your first driver to register their license details and
                  invite them to set up a VI-Fleet account.
                </p>
                <Link
                  href="/transport/drivers/new"
                  className="mt-5 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Add your first driver
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-5 py-3">Driver</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">License</th>
                  <th className="px-5 py-3">Preferred vehicle</th>
                  <th className="px-5 py-3">Driver status</th>
                  <th className="px-5 py-3">Account status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 bg-white text-sm">
                {drivers.map((driver) => {
                  const accountEmail =
                    driver.user?.email ??
                    driver.user?.pendingEmail ??
                    "No email";

                  const emailPending =
                    !driver.user?.email &&
                    Boolean(driver.user?.pendingEmail);

                  const driverStatus = getDriverStatusBadge(driver.status);
                  const licenseValidity = getLicenseValidity(
                    driver.licenseExpiryDate,
                  );
                  const accountStage = getAccountStage(driver.user);

                  const fullName = [
                    driver.firstName,
                    driver.user?.middleName,
                    driver.lastName,
                  ]
                    .filter(Boolean)
                    .join(" ");

                  const initials =
                    (driver.firstName.charAt(0) + driver.lastName.charAt(0))
                      .toUpperCase() || "D";
                  
                  return (
                    <tr key={driver.id} className="hover:bg-gray-50">
                      {/* Driver Name & Initials */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700"
                            aria-hidden="true"
                          >
                            {initials}
                          </div>
                          <div>
                            <Link
                              href={`/transport/drivers/${driver.id}`}
                              className="font-medium text-gray-900 hover:text-blue-600 hover:underline"
                            >
                              {fullName}
                            </Link>
                            <p className="mt-0.5 text-xs text-gray-500">
                              Added {formatDate(driver.createdAt)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="px-5 py-4">
                        <p className="text-gray-900">{accountEmail}</p>
                        {driver.phone && (
                          <p className="mt-0.5 text-xs text-gray-500">
                            {driver.phone}
                          </p>
                        )}
                        {emailPending && (
                          <p className="mt-0.5 text-xs font-medium text-amber-700">
                            Email unverified
                          </p>
                        )}
                      </td>

                      {/* License Details */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <p className="font-mono text-xs font-semibold text-gray-900">
                          {driver.licenseNumber}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${licenseValidity.cls}`}
                          >
                            {licenseValidity.label}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(driver.licenseExpiryDate)}
                          </span>
                        </div>
                      </td>

                      {/* Preferred Vehicle */}
                      <td className="whitespace-nowrap px-5 py-4">
                        {driver.preferredVehicle ? (
                          <div>
                            <Link
                              href={`/transport/vehicles/${driver.preferredVehicle.id}`}
                              className="font-mono text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {driver.preferredVehicle.registrationNumber}
                            </Link>
                            <p className="mt-0.5 text-xs text-gray-500">
                              {[
                                driver.preferredVehicle.make,
                                driver.preferredVehicle.model,
                              ]
                                .filter(Boolean)
                                .join(" ") || "Vehicle"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </td>

                      {/* Operational Driver Status */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${driverStatus.cls}`}
                        >
                          {driverStatus.label}
                        </span>
                      </td>

                      {/* System Account Status */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${accountStage.cls}`}
                        >
                          {accountStage.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="whitespace-nowrap px-5 py-4 text-right text-sm">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/transport/drivers/${driver.id}`}
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            View
                          </Link>
                          <Link
                            href={`/transport/drivers/${driver.id}/edit`}
                            className="font-medium text-gray-600 hover:text-gray-900 hover:underline"
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
            <p className="text-xs text-gray-500">
              Page <span className="font-medium text-gray-900">{page}</span> of{" "}
              <span className="font-medium text-gray-900">{totalPages}</span>
            </p>

            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={`/transport/drivers${createQueryString({
                    page: String(page - 1),
                  })}`}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Previous
                </Link>
              ) : (
                <span className="cursor-not-allowed rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-400">
                  Previous
                </span>
              )}

              {page < totalPages ? (
                <Link
                  href={`/transport/drivers${createQueryString({
                    page: String(page + 1),
                  })}`}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Next
                </Link>
              ) : (
                <span className="cursor-not-allowed rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-400">
                  Next
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
