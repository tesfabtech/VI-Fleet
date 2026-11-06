import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  canReviewTransportationRequest,
  decodeSpecialRequirements,
  formatAddisDateTime,
  formatWaitingDuration,
  isUuid,
} from "@/lib/department-auth";
import {
  AdminCancelApprovedCard,
  ReviewDecisionCard,
} from "../review-actions";

const ALLOWED_ROLES = [
  "ORGANIZATION_ADMINISTRATOR",
  "VICE_ORGANIZATION_ADMINISTRATOR",
];

const statusBadge: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-800 border-rose-200",
  CANCELLED: "bg-slate-100 text-slate-700 border-slate-300",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrganizationRequestDetailPage({
  params,
}: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!ALLOWED_ROLES.includes(session.user.role)) notFound();

  const { id } = await params;
  if (!isUuid(id)) notFound();

  const adminUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      organization: {
        select: { id: true, name: true, status: true, deletedAt: true },
      },
    },
  });

  if (
    !adminUser ||
    adminUser.deletedAt !== null ||
    adminUser.status !== "ACTIVE" ||
    !adminUser.organizationId ||
    !adminUser.organization ||
    adminUser.organization.deletedAt !== null ||
    adminUser.organization.status !== "ACTIVE"
  ) {
    notFound();
  }

  const organizationId = adminUser.organizationId;

  const request = await prisma.transportationRequest.findFirst({
    where: {
      id,
      organizationId,
      deletedAt: null,
    },
    include: {
      department: { select: { id: true, name: true, status: true } },
      requestedBy: {
        select: {
          firstName: true,
          middleName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      reviewedBy: {
        select: {
          firstName: true,
          middleName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
      trip: {
        include: {
          vehicle: {
            select: {
              registrationNumber: true,
              make: true,
              model: true,
              vehicleType: true,
              seatingCapacity: true,
            },
          },
          driver: {
            select: { firstName: true, lastName: true, phone: true },
          },
        },
      },
    },
  });

  if (!request) notFound();

  // Advisory Window-Based Fleet Feasibility Check in [requestedStart, requestedEnd]
  const [windowFreeVehicles, totalActiveVehicles, overlappingApprovedRequests] =
    await Promise.all([
      prisma.vehicle.findMany({
        where: {
          organizationId,
          status: "ACTIVE",
          deletedAt: null,
          trips: {
            none: {
              deletedAt: null,
              status: { in: ["SCHEDULED", "IN_PROGRESS"] },
              scheduledStart: { lt: request.requestedEnd },
              scheduledEnd: { gt: request.requestedStart },
            },
          },
        },
        select: {
          id: true,
          registrationNumber: true,
          make: true,
          model: true,
          vehicleType: true,
          seatingCapacity: true,
        },
      }),
      prisma.vehicle.count({
        where: { organizationId, status: "ACTIVE", deletedAt: null },
      }),
      prisma.transportationRequest.findMany({
        where: {
          organizationId,
          id: { not: request.id },
          status: "APPROVED",
          deletedAt: null,
          requestedStart: { lt: request.requestedEnd },
          requestedEnd: { gt: request.requestedStart },
        },
        select: {
          id: true,
          purpose: true,
          destination: true,
          passengerCount: true,
          department: { select: { name: true } },
        },
        take: 5,
      }),
    ]);

  const maxWindowSeats = windowFreeVehicles.reduce(
    (max, v) => Math.max(max, v.seatingCapacity ?? 0),
    0,
  );
  const totalWindowSeats = windowFreeVehicles.reduce(
    (sum, v) => sum + (v.seatingCapacity ?? 0),
    0,
  );

  const meta = decodeSpecialRequirements(request.specialRequirements);
  const canReview = canReviewTransportationRequest(
    request.status,
    request.deletedAt,
  );
  const isExpired =
    request.status === "PENDING" &&
    request.requestedStart.getTime() < Date.now();
  const canAdminCancel =
    request.status === "APPROVED" &&
    (!request.trip ||
      (request.trip.status !== "IN_PROGRESS" &&
        request.trip.status !== "COMPLETED"));

  const requesterName =
    [
      request.requestedBy.firstName,
      request.requestedBy.middleName,
      request.requestedBy.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    request.requestedBy.email ||
    "Department User";

  const reviewerName = request.reviewedBy
    ? [
        request.reviewedBy.firstName,
        request.reviewedBy.middleName,
        request.reviewedBy.lastName,
      ]
        .filter(Boolean)
        .join(" ")
        .trim() || request.reviewedBy.email
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Link
            href="/organization/requests"
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            ← Back to Request Review Queue
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">
              {request.purpose}
            </h1>
            <span
              className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${statusBadge[request.status]}`}
            >
              {request.status}
            </span>
            {meta.priority === "URGENT" && (
              <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                URGENT
              </span>
            )}
            {isExpired && (
              <span className="rounded bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">
                Expired Departure
              </span>
            )}
            {request.status === "PENDING" && (
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                Waiting {formatWaitingDuration(request.createdAt)}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Department: <strong>{request.department.name}</strong> • Requested
            by {requesterName} on {formatAddisDateTime(request.createdAt)}
          </p>
        </div>
      </div>

      {/* Transport Manager Unfulfillable Flag Banner */}
      {meta.transportFlagReason && request.status === "APPROVED" && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-sm font-bold text-amber-950">
            ⚠ Escalated by Transport Manager (Cannot Fulfil Dispatch)
          </h2>
          <p className="mt-1 text-xs text-amber-900">
            The Transport Manager reported that this approved request cannot be fulfilled with current fleet availability:
          </p>
          <p className="mt-2 rounded-lg bg-white p-3 text-xs font-semibold text-amber-950">
            {meta.transportFlagReason}
          </p>
        </section>
      )}

      {/* Advisory Window-Based Fleet Feasibility Panel */}
      <section className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Advisory Fleet Feasibility in Requested Time Window
            </h2>
            <p className="text-xs text-slate-600">
              Window: {formatAddisDateTime(request.requestedStart)} →{" "}
              {formatAddisDateTime(request.requestedEnd)}
            </p>
          </div>
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-800">
            Advisory Check
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-xl border border-blue-200 bg-white p-3.5">
            <p className="font-semibold text-slate-500 uppercase">
              Unbooked Active Vehicles in Window
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {windowFreeVehicles.length}{" "}
              <span className="text-xs font-normal text-slate-500">
                of {totalActiveVehicles} active
              </span>
            </p>
            <p className="mt-0.5 text-slate-500">
              No overlapping scheduled/in-progress trips
            </p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-white p-3.5">
            <p className="font-semibold text-slate-500 uppercase">
              Passenger Capacity vs. Request
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {request.passengerCount} pax{" "}
              <span className="text-xs font-normal text-slate-500">
                (Max single vehicle: {maxWindowSeats || "N/A"})
              </span>
            </p>
            {maxWindowSeats > 0 && request.passengerCount > maxWindowSeats ? (
              <p className="mt-0.5 font-semibold text-amber-700">
                Requires multiple vehicles ({totalWindowSeats} total seats free)
              </p>
            ) : (
              <p className="mt-0.5 text-emerald-700">
                Fits single vehicle capacity
              </p>
            )}
          </div>

          <div className="rounded-xl border border-blue-200 bg-white p-3.5">
            <p className="font-semibold text-slate-500 uppercase">
              Other Approved Requests in Window
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {overlappingApprovedRequests.length}
            </p>
            <p className="mt-0.5 text-slate-500">
              {overlappingApprovedRequests.length === 0
                ? "Zero competing approved requests"
                : overlappingApprovedRequests
                    .map((r) => `${r.department.name} (${r.passengerCount} pax)`)
                    .join(", ")}
            </p>
          </div>
        </div>
      </section>

      {/* Approve / Reject Decision Panel (Only when PENDING) */}
      {canReview && (
        <ReviewDecisionCard
          requestId={request.id}
          expectedUpdatedAt={request.updatedAt.toISOString()}
          isExpired={isExpired}
          defaultAdminNote={meta.adminReviewNote}
        />
      )}

      {/* Decision Summary (When already APPROVED / REJECTED / CANCELLED) */}
      {request.status !== "PENDING" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900">
            Recorded Review Decision ({request.status})
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            {reviewerName
              ? `Decided by ${reviewerName}`
              : "Decision recorded"}
            {request.reviewedAt
              ? ` on ${formatAddisDateTime(request.reviewedAt)}`
              : ""}
          </p>

          {request.status === "REJECTED" && (
            <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-900">
              Rejection Reason: {request.rejectionReason || "Not specified."}
            </p>
          )}

          {request.status === "CANCELLED" && (
            <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-800">
              Cancellation Reason:{" "}
              {request.cancellationReason || "Cancelled."}
            </p>
          )}

          {meta.adminReviewNote && (
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-950">
              <strong>Admin Dispatch Instructions:</strong>{" "}
              {meta.adminReviewNote}
            </p>
          )}
        </section>
      )}

      {/* Full Itinerary & Requester Details */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <h2 className="text-base font-bold text-slate-900">
            Request Specifications & Department Details
          </h2>
          <div className="flex gap-2 text-xs font-semibold">
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700">
              {meta.tripType === "ONE_WAY" ? "One-Way" : "Round-Trip"}
            </span>
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700">
              Preferred Vehicle: {meta.vehiclePreference}
            </span>
          </div>
        </div>

        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Department</dt>
            <dd className="font-semibold text-slate-900">
              {request.department.name}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Requester</dt>
            <dd className="font-semibold text-slate-900">
              {requesterName}{" "}
              {request.requestedBy.email ? `(${request.requestedBy.email})` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Origin / Pickup Point</dt>
            <dd className="font-semibold text-slate-900">{request.origin}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Destination</dt>
            <dd className="font-semibold text-slate-900">
              {request.destination}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Requested Departure (EAT)</dt>
            <dd className="text-slate-900">
              {formatAddisDateTime(request.requestedStart)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Requested Return / End (EAT)</dt>
            <dd className="text-slate-900">
              {formatAddisDateTime(request.requestedEnd)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Passenger Count</dt>
            <dd className="font-semibold text-slate-900">
              {request.passengerCount} passenger(s)
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">On-Site Pickup Contact</dt>
            <dd className="text-slate-900">
              {meta.contactName || requesterName}{" "}
              {meta.contactPhone ? `(${meta.contactPhone})` : ""}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-slate-500">Trip Description</dt>
            <dd className="mt-1 whitespace-pre-line rounded-xl bg-slate-50 p-3 text-xs text-slate-800">
              {request.description}
            </dd>
          </div>
          {meta.cargoDetails && (
            <div>
              <dt className="text-xs text-slate-500">Cargo / Luggage</dt>
              <dd className="text-xs text-slate-800">{meta.cargoDetails}</dd>
            </div>
          )}
          {meta.extraRequirements && (
            <div>
              <dt className="text-xs text-slate-500">Special Requirements</dt>
              <dd className="text-xs text-slate-800">
                {meta.extraRequirements}
              </dd>
            </div>
          )}
          {request.notes && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">
                Requester Notes (Department User)
              </dt>
              <dd className="mt-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
                {request.notes}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Assigned Trip Info (if Dispatched by Transport Manager) */}
      {request.trip && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
          <h2 className="text-sm font-bold text-emerald-950">
            Assigned Trip & Vehicle Dispatch ({request.trip.status})
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-xl border border-emerald-200 bg-white p-3.5">
              <p className="font-semibold text-slate-500 uppercase">Vehicle</p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {request.trip.vehicle.registrationNumber} —{" "}
                {[request.trip.vehicle.make, request.trip.vehicle.model]
                  .filter(Boolean)
                  .join(" ")}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-white p-3.5">
              <p className="font-semibold text-slate-500 uppercase">Driver</p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {request.trip.driver.firstName} {request.trip.driver.lastName}
              </p>
              <p className="text-slate-600">
                Phone: {request.trip.driver.phone || "N/A"}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Admin Cancel Approved Request Card */}
      {canAdminCancel && (
        <AdminCancelApprovedCard
          requestId={request.id}
          hasScheduledTrip={Boolean(
            request.trip && request.trip.status === "SCHEDULED",
          )}
          transportFlagReason={meta.transportFlagReason}
        />
      )}
    </div>
  );
}