import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { TransportationRequestStatus, TripStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type DepartmentUserContext = {
  userId: string;
  userName: string;
  userEmail: string;
  organizationId: string;
  organizationName: string;
  departmentId: string;
  departmentName: string;
};

const getCachedDepartmentAuth = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, reason: "UNAUTH" as const };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      organization: { select: { id: true, name: true, status: true, deletedAt: true } },
      department: {
        select: { id: true, name: true, status: true, deletedAt: true, organizationId: true },
      },
    },
  });

  if (
    !user ||
    user.deletedAt ||
    user.role !== "DEPARTMENT_USER" ||
    user.status !== "ACTIVE" ||
    !user.organizationId ||
    !user.departmentId ||
    user.organization?.deletedAt !== null ||
    user.organization?.status !== "ACTIVE" ||
    user.department?.deletedAt !== null ||
    user.department?.status !== "ACTIVE" ||
    user.department.organizationId !== user.organizationId
  ) {
    return { ok: false as const, reason: "FORBIDDEN" as const };
  }

  const userName =
    [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.email ||
    "Department User";

  return {
    ok: true as const,
    ctx: {
      userId: user.id,
      userName,
      userEmail: user.email ?? "",
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      departmentId: user.departmentId,
      departmentName: user.department.name,
    },
  };
});

export async function requireDepartmentUserContext(): Promise<DepartmentUserContext> {
  const res = await getCachedDepartmentAuth();
  if (!res.ok) {
    if (res.reason === "UNAUTH") redirect("/login");
    notFound();
  }
  return res.ctx;
}

export async function requireDepartmentActionContext() {
  const res = await getCachedDepartmentAuth();
  if (!res.ok) {
    return {
      ok: false as const,
      error:
        res.reason === "UNAUTH"
          ? "Session expired. Please sign in again."
          : "Unauthorized department request action.",
    };
  }
  return { ok: true as const, ctx: res.ctx };
}

export const canEditTransportationRequest = (status: TransportationRequestStatus) =>
  status === "PENDING";

export const canCancelTransportationRequest = (
  status: TransportationRequestStatus,
  tripStatus?: TripStatus | null,
) =>
  status === "PENDING" ||
  (status === "APPROVED" && (!tripStatus || tripStatus === "SCHEDULED"));

export type TripTypeOption = "ROUND_TRIP" | "ONE_WAY";
export type PriorityOption = "STANDARD" | "URGENT";
export type VehiclePreferenceOption =
  | "ANY"
  | "SEDAN"
  | "SUV_4X4"
  | "MINIBUS"
  | "BUS"
  | "PICKUP_CARGO";

export type StructuredRequestMeta = {
  tripType: TripTypeOption;
  priority: PriorityOption;
  vehiclePreference: VehiclePreferenceOption;
  contactName: string;
  contactPhone: string;
  cargoDetails: string;
  extraRequirements: string;
};

const META_PREFIX = "[VI-META]";
const cleanPipe = (val: string) => val.replace(/[|\n\r]/g, " ").trim();

export function encodeSpecialRequirements(meta: StructuredRequestMeta): string {
  const header = [
    `TRIP_TYPE=${meta.tripType}`,
    `PRIORITY=${meta.priority}`,
    `VEHICLE_PREF=${meta.vehiclePreference}`,
    `CONTACT_NAME=${cleanPipe(meta.contactName)}`,
    `CONTACT_PHONE=${cleanPipe(meta.contactPhone)}`,
    `CARGO=${cleanPipe(meta.cargoDetails)}`,
  ].join("|");
  const body = meta.extraRequirements.trim();
  return body ? `${META_PREFIX}${header}\n${body}` : `${META_PREFIX}${header}`;
}

export function decodeSpecialRequirements(
  raw?: string | null,
): StructuredRequestMeta {
  if (!raw?.startsWith(META_PREFIX)) {
    return {
      tripType: "ROUND_TRIP",
      priority: "STANDARD",
      vehiclePreference: "ANY",
      contactName: "",
      contactPhone: "",
      cargoDetails: "",
      extraRequirements: raw?.trim() ?? "",
    };
  }

  const [firstLine, ...rest] = raw.slice(META_PREFIX.length).split("\n");
  const map = Object.fromEntries(
    firstLine.split("|").map((p) => {
      const i = p.indexOf("=");
      return i > 0 ? [p.slice(0, i).trim(), p.slice(i + 1).trim()] : ["", ""];
    }),
  );

  const vehicles: VehiclePreferenceOption[] = [
    "ANY",
    "SEDAN",
    "SUV_4X4",
    "MINIBUS",
    "BUS",
    "PICKUP_CARGO",
  ];

  return {
    tripType: map.TRIP_TYPE === "ONE_WAY" ? "ONE_WAY" : "ROUND_TRIP",
    priority: map.PRIORITY === "URGENT" ? "URGENT" : "STANDARD",
    vehiclePreference: vehicles.includes(map.VEHICLE_PREF as VehiclePreferenceOption)
      ? (map.VEHICLE_PREF as VehiclePreferenceOption)
      : "ANY",
    contactName: map.CONTACT_NAME ?? "",
    contactPhone: map.CONTACT_PHONE ?? "",
    cargoDetails: map.CARGO ?? "",
    extraRequirements: rest.join("\n").trim(),
  };
}

export const formatAddisDateTime = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Addis_Ababa",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

export const toAddisDateTimeLocalValue = (date: Date) =>
  new Date(date.getTime() + 3 * 3600_000).toISOString().slice(0, 16);