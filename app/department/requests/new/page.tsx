import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  decodeSpecialRequirements,
  requireDepartmentUserContext,
  toAddisDateTimeLocalValue,
} from "@/lib/department-auth";
import RequestForm, { type RequestFormInitialValues } from "../request-form";

type PageProps = {
  searchParams: Promise<{
    cloneFrom?: string;
  }>;
};

export default async function NewDepartmentRequestPage({
  searchParams,
}: PageProps) {
  const ctx = await requireDepartmentUserContext();
  const params = await searchParams;

  const defaultStart = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const defaultEnd = new Date(Date.now() + 6 * 60 * 60 * 1000);

  let initialValues: RequestFormInitialValues = {
    purpose: "",
    description: "",
    origin: "",
    destination: "",
    passengerCount: 1,
    requestedStart: toAddisDateTimeLocalValue(defaultStart),
    requestedEnd: toAddisDateTimeLocalValue(defaultEnd),
    tripType: "ROUND_TRIP",
    priority: "STANDARD",
    vehiclePreference: "ANY",
    contactName: ctx.userName,
    contactPhone: "",
    cargoDetails: "",
    extraRequirements: "",
    notes: "",
  };

  let clonedTitle: string | null = null;

  if (params.cloneFrom) {
    const source = await prisma.transportationRequest.findFirst({
      where: {
        id: params.cloneFrom,
        organizationId: ctx.organizationId,
        departmentId: ctx.departmentId,
        requestedById: ctx.userId,
        deletedAt: null,
      },
    });

    if (source) {
      const meta = decodeSpecialRequirements(source.specialRequirements);
      clonedTitle = source.purpose;
      initialValues = {
        purpose: source.purpose,
        description: source.description,
        origin: source.origin,
        destination: source.destination,
        passengerCount: source.passengerCount,
        requestedStart: toAddisDateTimeLocalValue(defaultStart),
        requestedEnd: toAddisDateTimeLocalValue(defaultEnd),
        tripType: meta.tripType,
        priority: meta.priority,
        vehiclePreference: meta.vehiclePreference,
        contactName: meta.contactName || ctx.userName,
        contactPhone: meta.contactPhone,
        cargoDetails: meta.cargoDetails,
        extraRequirements: meta.extraRequirements,
        notes: source.notes ?? "",
      };
    }
  }

  const maxVehicleAgg = await prisma.vehicle.aggregate({
    where: {
      organizationId: ctx.organizationId,
      status: "ACTIVE",
      deletedAt: null,
    },
    _max: { seatingCapacity: true },
  });

  const maxVehicleCapacity = maxVehicleAgg._max.seatingCapacity ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Link
            href="/department/requests"
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            ← Back to Transportation Requests
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Submit Transportation Request
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Complete the electronic request form below. New requests are created in{" "}
            <span className="font-semibold text-amber-700">PENDING</span> status and routed to your organization's Transport Manager.
          </p>
        </div>
      </div>

      {clonedTitle && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-800">
          Pre-filled from previous request:{" "}
          <span className="font-bold">{clonedTitle}</span>. Please review and adjust your departure and return times before submitting.
        </div>
      )}

      <RequestForm
        mode="create"
        initialValues={initialValues}
        maxVehicleCapacity={maxVehicleCapacity}
        departmentName={ctx.departmentName}
        organizationName={ctx.organizationName}
      />
    </div>
  );
}