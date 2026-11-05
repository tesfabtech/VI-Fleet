import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  canCancelTransportationRequest,
  canEditTransportationRequest,
  canHardDeleteTransportationRequest,
  canSoftDeleteTransportationRequest,
  decodeSpecialRequirements,
  formatAddisDateTime,
  isUuid,
  requireDepartmentUserContext,
  toAddisDateTimeLocalValue,
} from "@/lib/department-auth";
import RequestForm, {
  CancelRequestCard,
  PermanentDeleteButton,
  RestoreRequestButton,
  SoftDeleteButton,
} from "../request-form";

const statusBadge: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-800 border-rose-200",
  CANCELLED: "bg-slate-100 text-slate-700 border-slate-300",
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string; updated?: string; edit?: string }>;
};

export default async function DepartmentRequestDetailPage({
  params,
  searchParams,
}: PageProps) {
  const ctx = await requireDepartmentUserContext();
  const { id } = await params;
  const query = await searchParams;

  if (!isUuid(id)) notFound();

  const [request, maxVeh] = await Promise.all([
    prisma.transportationRequest.findFirst({
      where: {
        id,
        organizationId: ctx.organizationId,
        departmentId: ctx.departmentId,
      },
      include: {
        requestedBy: { select: { firstName: true, middleName: true, lastName: true, email: true } },
        reviewedBy: { select: { firstName: true, middleName: true, lastName: true, email: true } },
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
            driver: { select: { firstName: true, lastName: true, phone: true } },
          },
        },
      },
    }),
    prisma.vehicle.aggregate({
      where: { organizationId: ctx.organizationId, status: "ACTIVE", deletedAt: null },
      _max: { seatingCapacity: true },
    }),
  ]);

  if (!request) notFound();

  const isOwner = request.requestedById === ctx.userId;
  // Soft-deleted requests are only visible to their owner
  if (request.deletedAt && !isOwner) notFound();

  const maxVehicleCapacity = maxVeh._max.seatingCapacity ?? 0;
  const meta = decodeSpecialRequirements(request.specialRequirements);
  const canEdit = isOwner && canEditTransportationRequest(request.status, request.deletedAt);
  const canCancel =
    isOwner &&
    canCancelTransportationRequest(request.status, request.trip?.status, request.deletedAt);
  const canSoftDelete =
    isOwner &&
    canSoftDeleteTransportationRequest(request.status, request.trip?.status, request.deletedAt);
  const canHardDelete =
    isOwner && canHardDeleteTransportationRequest(request.trip?.status, request.deletedAt);
  const isEditing = canEdit && query.edit === "1";

  const requesterName =
    [request.requestedBy.firstName, request.requestedBy.middleName, request.requestedBy.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    request.requestedBy.email ||
    "Department User";

  const reviewerName = request.reviewedBy
    ? [request.reviewedBy.firstName, request.reviewedBy.middleName, request.reviewedBy.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() || request.reviewedBy.email
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Link
            href={request.deletedAt ? "/department/requests/recycle-bin" : "/department/requests"}
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            ← Back to {request.deletedAt ? "Recycle Bin" : "Transportation Requests"}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{request.purpose}</h1>
            <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${statusBadge[request.status]}`}>
              {request.status}
            </span>
            {request.deletedAt && (
              <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-bold text-white">
                In Recycle Bin
              </span>
            )}
            {meta.priority === "URGENT" && (
              <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">URGENT</span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Requested by {requesterName} on {formatAddisDateTime(request.createdAt)} • {ctx.departmentName}
          </p>
        </div>

        {isOwner && !request.deletedAt && (
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <Link
                href={
                  isEditing
                    ? `/department/requests/${request.id}`
                    : `/department/requests/${request.id}?edit=1#edit-request-form`
                }
                className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-amber-600"
              >
                {isEditing ? "View Read-Only Summary" : "Edit Request"}
              </Link>
            )}
            <Link
              href={`/department/requests/new?cloneFrom=${request.id}`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Clone / Request Again
            </Link>
            {canSoftDelete && <SoftDeleteButton requestId={request.id} redirectAfter />}
          </div>
        )}
      </div>

      {/* Recycle Bin Banner */}
      {request.deletedAt && isOwner && (
        <section className="flex flex-col justify-between gap-4 rounded-2xl border border-rose-300 bg-rose-50 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-bold text-rose-950">
              This request is in your Recycle Bin
            </h2>
            <p className="mt-1 text-xs text-rose-800">
              Moved to Recycle Bin on {formatAddisDateTime(request.deletedAt)}. Restore it to return it to your active requests list, or delete it permanently.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <RestoreRequestButton requestId={request.id} />
            {canHardDelete && (
              <PermanentDeleteButton requestId={request.id} redirectAfter />
            )}
          </div>
        </section>
      )}

      {query.submitted === "1" && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          Your transportation request was submitted and is now awaiting review by the Transport Manager.
        </div>
      )}

      {query.updated === "1" && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          Your changes have been saved to this transportation request.
        </div>
      )}

      {/* 4-Step Timeline */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">Status Timeline</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-4 text-xs">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
            <p className="font-bold text-emerald-900">1. Submitted</p>
            <p className="mt-1 text-emerald-700">{formatAddisDateTime(request.createdAt)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="font-bold text-slate-900">2. Manager Review</p>
            <p className="mt-1 text-slate-600">
              {request.reviewedAt ? `${request.status} (${formatAddisDateTime(request.reviewedAt)})` : "Pending decision"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="font-bold text-slate-900">3. Vehicle Dispatch</p>
            <p className="mt-1 text-slate-600">
              {request.trip ? `${request.trip.vehicle.registrationNumber} (${request.trip.status})` : "Not assigned yet"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="font-bold text-slate-900">
              4. {request.status === "CANCELLED" ? "Cancelled" : "Completion"}
            </p>
            <p className="mt-1 text-slate-600">
              {request.status === "CANCELLED"
                ? formatAddisDateTime(request.updatedAt)
                : request.trip?.actualEnd
                  ? formatAddisDateTime(request.trip.actualEnd)
                  : "Scheduled"}
            </p>
          </div>
        </div>
      </section>

      {/* Decision Banners */}
      {request.status === "REJECTED" && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-xs text-rose-900">
          <p className="text-sm font-bold">Request Rejected {reviewerName ? `by ${reviewerName}` : ""}</p>
          {isOwner && (
            <p className="mt-2 rounded-lg bg-white p-3 font-medium">
              Reason: {request.rejectionReason || "No specific rejection reason recorded."}
            </p>
          )}
        </section>
      )}

      {request.status === "CANCELLED" && (
        <section className="rounded-2xl border border-slate-300 bg-slate-100 p-5 text-xs text-slate-800">
          <p className="text-sm font-bold">Request Cancelled</p>
          {isOwner && (
            <p className="mt-2 rounded-lg bg-white p-3 font-medium">
              Reason: {request.cancellationReason || "Cancelled by requester."}
            </p>
          )}
        </section>
      )}

      {request.status === "APPROVED" && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
          <p className="text-sm font-bold text-emerald-950">
            Request Approved {reviewerName ? `by ${reviewerName}` : ""}
          </p>
          {request.trip ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-xl border border-emerald-200 bg-white p-3.5">
                <p className="font-semibold text-slate-500 uppercase">Assigned Vehicle</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {request.trip.vehicle.registrationNumber} — {[request.trip.vehicle.make, request.trip.vehicle.model].filter(Boolean).join(" ")}
                </p>
                <p className="text-slate-600">Capacity: {request.trip.vehicle.seatingCapacity ?? "N/A"} seats</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-white p-3.5">
                <p className="font-semibold text-slate-500 uppercase">Assigned Driver</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {request.trip.driver.firstName} {request.trip.driver.lastName}
                </p>
                <p className="text-slate-600">Phone: {request.trip.driver.phone || "Contact Transport Office"}</p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-emerald-900">
              Approved — vehicle and driver details will appear once assigned by the Transport Manager.
            </p>
          )}
        </section>
      )}

      {/* Itinerary Summary */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <h2 className="text-base font-bold text-slate-900">Itinerary & Specifications</h2>
          <div className="flex gap-2 text-xs font-semibold">
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700">
              {meta.tripType === "ONE_WAY" ? "One-Way" : "Round-Trip"}
            </span>
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700">
              Vehicle Pref: {meta.vehiclePreference}
            </span>
          </div>
        </div>

        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Origin / Pickup</dt>
            <dd className="font-semibold text-slate-900">{request.origin}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Destination</dt>
            <dd className="font-semibold text-slate-900">{request.destination}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Departure (EAT)</dt>
            <dd className="text-slate-900">{formatAddisDateTime(request.requestedStart)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Return / End (EAT)</dt>
            <dd className="text-slate-900">{formatAddisDateTime(request.requestedEnd)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Passenger Count</dt>
            <dd className="font-semibold text-slate-900">{request.passengerCount} passenger(s)</dd>
          </div>
          {isOwner && (
            <>
              <div>
                <dt className="text-xs text-slate-500">On-Site Pickup Contact</dt>
                <dd className="text-slate-900">
                  {meta.contactName || ctx.userName} {meta.contactPhone ? `(${meta.contactPhone})` : ""}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">Trip Description</dt>
                <dd className="mt-1 rounded-xl bg-slate-50 p-3 text-xs text-slate-800 whitespace-pre-line">
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
                  <dd className="text-xs text-slate-800">{meta.extraRequirements}</dd>
                </div>
              )}
              {request.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-500">Additional Notes</dt>
                  <dd className="text-xs text-slate-800">{request.notes}</dd>
                </div>
              )}
            </>
          )}
        </dl>
      </section>

      {isOwner && canEdit && (
        <section id="edit-request-form" className="space-y-3 scroll-mt-24">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Edit Pending Request</h2>
              <p className="text-xs text-slate-500">
                Update any field below while this request remains in PENDING status.
              </p>
            </div>
          </div>
          <RequestForm
            mode="edit"
            initialValues={{
              requestId: request.id,
              purpose: request.purpose,
              description: request.description,
              origin: request.origin,
              destination: request.destination,
              passengerCount: request.passengerCount,
              requestedStart: toAddisDateTimeLocalValue(request.requestedStart),
              requestedEnd: toAddisDateTimeLocalValue(request.requestedEnd),
              tripType: meta.tripType,
              priority: meta.priority,
              vehiclePreference: meta.vehiclePreference,
              contactName: meta.contactName,
              contactPhone: meta.contactPhone,
              cargoDetails: meta.cargoDetails,
              extraRequirements: meta.extraRequirements,
              notes: request.notes ?? "",
            }}
            maxVehicleCapacity={maxVehicleCapacity}
            departmentName={ctx.departmentName}
            organizationName={ctx.organizationName}
          />
        </section>
      )}

      {isOwner && !canEdit && !request.deletedAt && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          Editing is locked because this request is <strong>{request.status}</strong>.
        </div>
      )}

      {canCancel && (
        <CancelRequestCard
          requestId={request.id}
          currentStatus={request.status as "PENDING" | "APPROVED"}
          hasScheduledTrip={Boolean(request.trip && request.trip.status === "SCHEDULED")}
        />
      )}
    </div>
  );
}