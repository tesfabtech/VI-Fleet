import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DriverStatus, UserStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  resendDriverInvitation,
  resendDriverVerificationEmail,
  updateDriverAccountStatus,
  updateDriverPreferredVehicle,
  removeDriverPreferredVehicle,
  updateDriverStatus,
} from "../management-actions";

type DriverDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    message?: string;
    error?: string;
  }>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_ROLES = [
  "TRANSPORT_MANAGER",
  "VICE_TRANSPORT_MANAGER",
] as const;

const MESSAGES: Record<string, string> = {
  "profile-updated": "Driver profile has been updated successfully.",
  "status-updated": "Driver operational status has been updated.",
  "account-status-updated": "Driver user account status has been updated.",
  "invitation-resent": "Password setup invitation has been resent.",
  "verification-resent": "Verification email has been resent.",
  "preferred-vehicle-updated":
    "Preferred vehicle has been assigned successfully.",
  "preferred-vehicle-removed":
    "Preferred vehicle has been removed successfully.",
};

const ERRORS: Record<string, string> = {
  "driver-not-found": "Driver could not be found.",
  "account-not-found": "Associated user account was not found.",
  "invalid-status": "Selected driver status is invalid.",
  "invalid-user-status": "Selected account status is invalid.",
  "setup-incomplete":
    "The driver must complete password setup and verify their email before their account can be activated.",
  "license-exists":
    "That license number is already registered to another driver in your organization.",
  "missing-fields": "First name, last name, and license number are required.",
  "invalid-length": "One or more fields exceed the allowed character limit.",
  "invalid-expiry": "Enter a valid license expiry date.",
  throttled: "Please wait at least 2 minutes before resending another email.",
  "invitation-send-failed":
    "The invitation email could not be sent. Check your mail configuration.",
  "verification-send-failed":
    "The verification email could not be sent. Check your mail configuration.",
  "update-failed": "An error occurred while updating the driver profile.",
  "organization-unavailable": "Your organization is currently unavailable.",
  "invalid-vehicle-id": "The selected vehicle is invalid.",
  "vehicle-not-found": "The selected vehicle was not found in your organization.",
  "vehicle-not-active":
    "Only active vehicles can be assigned as a preferred vehicle.",
};

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatDateTime(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function getDriverStatusBadge(status: DriverStatus) {
  switch (status) {
    case DriverStatus.ACTIVE:
      return {
        label: "Active",
        cls: "bg-green-100 text-green-800 border-green-200",
      };
    case DriverStatus.SUSPENDED:
      return {
        label: "Suspended",
        cls: "bg-red-100 text-red-800 border-red-200",
      };
    default:
      return {
        label: "Inactive",
        cls: "bg-gray-100 text-gray-700 border-gray-200",
      };
  }
}

function getLicenseValidity(expiryDate: Date | null) {
  if (!expiryDate) {
    return {
      status: "UNSPECIFIED" as const,
      label: "No expiry date",
      cls: "bg-gray-100 text-gray-600 border-gray-200",
    };
  }

  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffDays = Math.ceil(
    (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0) {
    return {
      status: "EXPIRED" as const,
      label: "Expired",
      cls: "bg-red-100 text-red-800 border-red-200",
    };
  }

  if (diffDays <= 30) {
    return {
      status: "EXPIRING_SOON" as const,
      label: `Expiring soon (${diffDays}d)`,
      cls: "bg-amber-100 text-amber-800 border-amber-200",
    };
  }

  return {
    status: "VALID" as const,
    label: "Valid",
    cls: "bg-green-100 text-green-800 border-green-200",
  };
}

function getAccountStage(u: {
  status: UserStatus;
  passwordHash: string | null;
  email: string | null;
  pendingEmail: string | null;
} | null) {
  if (!u) {
    return {
      stage: "NO_ACCOUNT" as const,
      label: "No account",
      cls: "bg-gray-100 text-gray-700 border-gray-200",
      step: 0,
    };
  }

  if (!u.passwordHash) {
    return {
      stage: "PASSWORD" as const,
      label: "Pending password setup",
      cls: "bg-amber-100 text-amber-800 border-amber-200",
      step: 1,
    };
  }

  if (u.pendingEmail || !u.email) {
    return {
      stage: "VERIFY" as const,
      label: "Pending email verification",
      cls: "bg-blue-100 text-blue-800 border-blue-200",
      step: 2,
    };
  }

  if (u.status === UserStatus.ACTIVE) {
    return {
      stage: "ACTIVE" as const,
      label: "Active",
      cls: "bg-green-100 text-green-800 border-green-200",
      step: 3,
    };
  }

  if (u.status === UserStatus.SUSPENDED) {
    return {
      stage: "SUSPENDED" as const,
      label: "Suspended",
      cls: "bg-red-100 text-red-800 border-red-200",
      step: 3,
    };
  }

  return {
    stage: "INACTIVE" as const,
    label: "Inactive",
    cls: "bg-gray-100 text-gray-700 border-gray-200",
    step: 3,
  };
}

export default async function DriverDetailPage({
  params,
  searchParams,
}: DriverDetailPageProps) {
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

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    notFound();
  }

  const query = await searchParams;
  const organizationId = sessionUser.organizationId;

  const [driver, activeVehicles] = await Promise.all([
    prisma.driver.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      include: {
        preferredVehicle: {
          select: {
            id: true,
            registrationNumber: true,
            make: true,
            model: true,
            year: true,
            vehicleType: true,
            status: true,
            availability: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
            pendingEmail: true,
            phone: true,
            status: true,
            passwordHash: true,
            createdAt: true,
            receivedInvitations: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                createdAt: true,
                expiresAt: true,
                consumedAt: true,
                revokedAt: true,
              },
            },
            emailVerificationTokens: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                createdAt: true,
                expiresAt: true,
              },
            },
          },
        },
        trips: {
          where: { deletedAt: null },
          orderBy: { scheduledStart: "desc" },
          take: 10,
          select: {
            id: true,
            scheduledStart: true,
            scheduledEnd: true,
            actualStart: true,
            actualEnd: true,
            status: true,
            vehicle: {
              select: {
                registrationNumber: true,
                make: true,
                model: true,
                vehicleType: true,
              },
            },
            transportationRequest: {
              select: {
                purpose: true,
                origin: true,
                destination: true,
                passengerCount: true,
              },
            },
          },
        },
      },
    }),
    prisma.vehicle.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        deletedAt: null,
      },
      select: {
        id: true,
        registrationNumber: true,
        make: true,
        model: true,
        vehicleType: true,
      },
      orderBy: {
        registrationNumber: "asc",
      },
    }),
  ]);

  if (!driver) {
    notFound();
  }

  const driverStatus = getDriverStatusBadge(driver.status);
  const licenseValidity = getLicenseValidity(driver.licenseExpiryDate);
  const accountStage = getAccountStage(driver.user);
  const returnTo = `/transport/drivers/${driver.id}`;

  const displayName = [
    driver.firstName,
    driver.user?.middleName,
    driver.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  const latestInvitation = driver.user?.receivedInvitations[0];
  const isInvitationExpired =
    latestInvitation &&
    !latestInvitation.consumedAt &&
    !latestInvitation.revokedAt &&
    latestInvitation.expiresAt < new Date();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* Back and Navigation Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/transport/drivers"
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            ← Back to drivers
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              {displayName}
            </h1>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${driverStatus.cls}`}
            >
              Driver: {driverStatus.label}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${accountStage.cls}`}
            >
              Account: {accountStage.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Registered on {formatDate(driver.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/transport/drivers/${driver.id}/edit`}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Edit profile
          </Link>
        </div>
      </div>

      {/* Notice Message/Error Banner */}
      {query.message && MESSAGES[query.message] && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"
        >
          {MESSAGES[query.message]}
        </div>
      )}

      {query.error && ERRORS[query.error] && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {ERRORS[query.error]}
        </div>
      )}

      {/* Top Details Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Contact & Personal Info */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">
            Personal & contact
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Full name
              </dt>
              <dd className="mt-1 font-medium text-gray-900">{displayName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Email address
              </dt>
              <dd className="mt-1 text-gray-900">
                {driver.user?.email ? (
                  <span className="flex items-center gap-1.5">
                    <span>{driver.user.email}</span>
                    <span className="rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-semibold text-green-700">
                      Verified
                    </span>
                  </span>
                ) : driver.user?.pendingEmail ? (
                  <span className="flex items-center gap-1.5">
                    <span>{driver.user.pendingEmail}</span>
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                      Unverified
                    </span>
                  </span>
                ) : (
                  <span className="text-gray-400">No email registered</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Phone number
              </dt>
              <dd className="mt-1 text-gray-900">
                {driver.phone || driver.user?.phone || "—"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Driver's License Info */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              Driver&apos;s license
            </h2>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${licenseValidity.cls}`}
            >
              {licenseValidity.label}
            </span>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
                License number
              </dt>
              <dd className="mt-1 font-mono text-base font-semibold text-gray-900">
                {driver.licenseNumber}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Expiry date
              </dt>
              <dd className="mt-1 text-gray-900">
                {formatDate(driver.licenseExpiryDate)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Compliance status
              </dt>
              <dd className="mt-1 text-xs text-gray-600">
                {licenseValidity.status === "VALID" &&
                  "License is current and authorized for trip assignments."}
                {licenseValidity.status === "EXPIRING_SOON" &&
                  "License is nearing expiration. Arrange renewal promptly."}
                {licenseValidity.status === "EXPIRED" &&
                  "License is expired. The driver should not be assigned to active trips."}
                {licenseValidity.status === "UNSPECIFIED" &&
                  "No expiry date on file. Please update the driver's license record."}
              </dd>
            </div>
          </dl>
        </div>

        {/* Operational Status Control */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">
            Operational status
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Controls whether this driver is eligible for trip assignments.
          </p>

          <form action={updateDriverStatus} className="mt-4 space-y-3">
            <input type="hidden" name="driverId" value={driver.id} />
            <input type="hidden" name="returnTo" value={returnTo} />

            <div>
              <label
                htmlFor="status"
                className="block text-xs font-medium text-gray-700"
              >
                Driver operational state
              </label>
              <select
                id="status"
                name="status"
                defaultValue={driver.status}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ACTIVE">ACTIVE (Available for trips)</option>
                <option value="INACTIVE">
                  INACTIVE (Temporarily off-duty / on leave)
                </option>
                <option value="SUSPENDED">
                  SUSPENDED (Disqualified from driving)
                </option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Update operational status
            </button>
          </form>
        </div>
      </div>

      {/* Account & Onboarding Management Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Onboarding Stage & System Account Control */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              Account onboarding & system access
            </h2>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${accountStage.cls}`}
            >
              {accountStage.label}
            </span>
          </div>

          <div className="mt-4 rounded-lg bg-gray-50 p-3.5 text-xs text-gray-600">
            <p className="font-semibold text-gray-800">
              Account activation lifecycle:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${accountStage.step >= 1
                    ? "bg-green-600 text-white"
                    : "bg-gray-300 text-gray-700"
                  }`}
              >
                1
              </span>
              <span>Invited</span>
              <span className="text-gray-400">→</span>
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${driver.user?.passwordHash
                    ? "bg-green-600 text-white"
                    : "bg-gray-300 text-gray-700"
                  }`}
              >
                2
              </span>
              <span>Password set</span>
              <span className="text-gray-400">→</span>
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${driver.user?.email && !driver.user?.pendingEmail
                    ? "bg-green-600 text-white"
                    : "bg-gray-300 text-gray-700"
                  }`}
              >
                3
              </span>
              <span>Email verified</span>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {accountStage.stage === "PASSWORD" ? (
              <div>
                <p className="text-xs text-amber-800">
                  The driver has not set up their password yet. If they did not
                  receive or misplaced their setup link, you can resend an
                  invitation email.
                </p>
                <form action={resendDriverInvitation} className="mt-3">
                  <input type="hidden" name="driverId" value={driver.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
                  >
                    Resend password setup invitation
                  </button>
                </form>
              </div>
            ) : accountStage.stage === "VERIFY" ? (
              <div>
                <p className="text-xs text-blue-800">
                  Password has been created, but email verification is pending.
                  You can resend a verification link to{" "}
                  <strong>{driver.user?.pendingEmail}</strong>.
                </p>
                <form action={resendDriverVerificationEmail} className="mt-3">
                  <input type="hidden" name="driverId" value={driver.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    Resend verification email
                  </button>
                </form>
              </div>
            ) : accountStage.stage === "NO_ACCOUNT" ? (
              <p className="text-sm text-gray-500">
                No system login account is currently linked to this driver
                record.
              </p>
            ) : (
              <div>
                <p className="text-xs text-gray-600">
                  Onboarding complete. You can modify login privileges for this
                  account below:
                </p>
                <form
                  action={updateDriverAccountStatus}
                  className="mt-3 flex flex-col gap-2 sm:flex-row"
                >
                  <input type="hidden" name="driverId" value={driver.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <select
                    name="userStatus"
                    defaultValue={driver.user?.status}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="ACTIVE">ACTIVE (Can log in)</option>
                    <option value="INACTIVE">
                      INACTIVE (Login disabled)
                    </option>
                    <option value="SUSPENDED">
                      SUSPENDED (Account locked)
                    </option>
                  </select>
                  <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Save account status
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Invitation & Security Audit Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">
            Invitation monitoring
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Monitoring account activation attempts and invitation tokens without
            revealing sensitive secrets.
          </p>

          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Latest invitation sent
              </dt>
              <dd className="mt-1 text-gray-900">
                {latestInvitation
                  ? formatDateTime(latestInvitation.createdAt)
                  : "No invitation records on file"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Invitation validity
              </dt>
              <dd className="mt-1 text-gray-900">
                {latestInvitation ? (
                  latestInvitation.consumedAt ? (
                    <span className="text-green-700">
                      Consumed on {formatDateTime(latestInvitation.consumedAt)}
                    </span>
                  ) : latestInvitation.revokedAt ? (
                    <span className="text-gray-500">
                      Revoked (superseded by newer link)
                    </span>
                  ) : isInvitationExpired ? (
                    <span className="text-red-700">
                      Expired on {formatDateTime(latestInvitation.expiresAt)}
                    </span>
                  ) : (
                    <span className="text-blue-700">
                      Pending (expires{" "}
                      {formatDateTime(latestInvitation.expiresAt)})
                    </span>
                  )
                ) : (
                  "—"
                )}
              </dd>
            </div>
            {driver.notes && (
              <div className="border-t border-gray-100 pt-3">
                <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  Manager notes
                </dt>
                <dd className="mt-1 rounded-lg bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">
                  {driver.notes}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Preferred Vehicle Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Preferred vehicle
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Recommended vehicle for future trip assignments. This does not restrict assigning other vehicles for a specific trip.
            </p>
          </div>
          {driver.preferredVehicle ? (
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              Assigned
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
              No preferred vehicle
            </span>
          )}
        </div>

        {/* Current Assignment Details */}
        <div className="mt-4">
          {driver.preferredVehicle ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/transport/vehicles/${driver.preferredVehicle.id}`}
                      className="font-mono text-base font-bold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {driver.preferredVehicle.registrationNumber}
                    </Link>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${driver.preferredVehicle.status === "ACTIVE"
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                        }`}
                    >
                      {driver.preferredVehicle.status}
                    </span>
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {driver.preferredVehicle.availability}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-700">
                    {[
                      driver.preferredVehicle.year,
                      driver.preferredVehicle.make,
                      driver.preferredVehicle.model,
                      driver.preferredVehicle.vehicleType,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/transport/vehicles/${driver.preferredVehicle.id}`}
                    className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    View vehicle
                  </Link>

                  <form action={removeDriverPreferredVehicle}>
                    <input type="hidden" name="driverId" value={driver.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                    >
                      Remove preference
                    </button>
                  </form>
                </div>
              </div>

              {driver.preferredVehicle.status !== "ACTIVE" && (
                <p className="mt-3 text-xs text-amber-800 font-medium">
                  Note: This vehicle is currently {driver.preferredVehicle.status}. You may change the preferred vehicle to an active vehicle below.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
              <p className="text-sm font-medium text-gray-700">
                No preferred vehicle currently assigned
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs text-gray-500">
                A preferred vehicle serves as a recommendation for future trip assignments. You can assign any active vehicle from your organization&apos;s fleet.
              </p>
            </div>
          )}
        </div>

        {/* Change / Assign Form */}
        <div className="mt-5 border-t border-gray-100 pt-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            {driver.preferredVehicle ? "Change preferred vehicle" : "Assign preferred vehicle"}
          </h3>

          <form action={updateDriverPreferredVehicle} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="driverId" value={driver.id} />
            <input type="hidden" name="returnTo" value={returnTo} />

            <div className="flex-1">
              <label
                htmlFor="vehicleId"
                className="mb-1 block text-xs font-medium text-gray-700"
              >
                Select active vehicle
              </label>
              <select
                id="vehicleId"
                name="vehicleId"
                required
                defaultValue=""
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="" disabled>
                  {activeVehicles.length === 0
                    ? "No active vehicles available"
                    : "Choose an active vehicle..."}
                </option>
                {activeVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registrationNumber} — {[v.make, v.model].filter(Boolean).join(" ")} ({v.vehicleType || "Vehicle"})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={activeVehicles.length === 0}
              className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {driver.preferredVehicle ? "Update preference" : "Assign preference"}
            </button>
          </form>
        </div>
      </div>

      {/* Recent Trips Section */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">
            Recent trip assignments ({driver.trips.length})
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Review recent trips driven or scheduled for this driver.
          </p>
        </div>

        {driver.trips.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500">
            No trips have been assigned to this driver yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-6 py-3">Purpose / Route</th>
                  <th className="px-6 py-3">Vehicle</th>
                  <th className="px-6 py-3">Scheduled start</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {driver.trips.map((trip) => (
                  <tr key={trip.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">
                        {trip.transportationRequest?.purpose || "Trip assignment"}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {trip.transportationRequest?.origin} →{" "}
                        {trip.transportationRequest?.destination} (
                        {trip.transportationRequest?.passengerCount}{" "}
                        passengers)
                      </p>
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      <p className="font-mono text-xs font-semibold text-gray-900">
                        {trip.vehicle?.registrationNumber || "Unassigned"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {[trip.vehicle?.make, trip.vehicle?.model]
                          .filter(Boolean)
                          .join(" ")}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-xs text-gray-600">
                      {formatDateTime(trip.scheduledStart)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                        {trip.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

