"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { validateVehicleTripState } from "@/lib/vehicles/business-logic";
import {
  requireVehicleContext,
  setVehicleOrganization,
} from "@/lib/vehicles/access";
import { validateVehicleForm } from "@/lib/vehicles/validation";
import { prisma } from "@/lib/prisma";

export type VehicleActionState = {
  errors: Record<string, string>;
  message?: string;
};

type VehicleUpdateResult =
  | { kind: "field-errors"; errors: Record<string, string> }
  | { kind: "error"; message: string }
  | { kind: "updated" };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function selectVehicleOrganization(
  _previousState: VehicleActionState,
  formData: FormData,
): Promise<VehicleActionState> {
  const organizationId = readText(formData, "organizationId");
  if (!UUID_RE.test(organizationId)) {
    return { errors: { organizationId: "Choose an organization." } };
  }

  const result = await setVehicleOrganization(organizationId);
  if (!result.ok) {
    if (result.reason === "unauthenticated") {
      return { errors: {}, message: "Your session expired. Sign in again." };
    }
    if (result.reason === "forbidden") {
      return {
        errors: {},
        message: "You are not authorized to select an organization.",
      };
    }
    return {
      errors: { organizationId: "Choose an active organization." },
    };
  }

  revalidatePath("/transport/vehicles");
  redirect("/transport/vehicles");
}

function revalidateVehicleSurfaces(id?: string) {
  revalidatePath("/transport/vehicles");
  if (id) {
    revalidatePath(`/transport/vehicles/${id}`);
    revalidatePath(`/transport/vehicles/${id}/edit`);
  }
  revalidatePath("/transport/maintenance");
  revalidatePath("/transport/maintenance/records");
  revalidatePath("/transport/maintenance/schedules");
  revalidatePath("/transport/maintenance/records/new");
  revalidatePath("/transport/maintenance/schedules/new");
}

async function findDuplicateVehicle(
  tx: Prisma.TransactionClient,
  organizationId: string,
  registrationNumber: string,
  vin: string | null,
  excludedId?: string,
) {
  const duplicate = await tx.vehicle.findFirst({
    where: {
      organizationId,
      deletedAt: null,
      ...(excludedId ? { id: { not: excludedId } } : {}),
      OR: [
        {
          registrationNumber: {
            equals: registrationNumber,
            mode: "insensitive",
          },
        },
        ...(vin
          ? [{ vin: { equals: vin, mode: "insensitive" as const } }]
          : []),
      ],
    },
    select: { registrationNumber: true, vin: true },
  });
  if (!duplicate) return null;
  if (duplicate.registrationNumber.toUpperCase() === registrationNumber) {
    return {
      field: "registrationNumber",
      message: "A vehicle with this registration number already exists.",
    };
  }
  return {
    field: "vin",
    message: "A vehicle with this VIN already exists.",
  };
}

export async function createVehicle(
  _previousState: VehicleActionState,
  formData: FormData,
): Promise<VehicleActionState> {
  const { organizationId } = await requireVehicleContext();
  const result = validateVehicleForm(formData);
  if (!result.ok) return { errors: result.errors };

  const tripErrors = validateVehicleTripState(
    result.value.status,
    result.value.availability,
    0,
  );
  if (Object.keys(tripErrors).length) {
    return {
      errors: tripErrors,
    };
  }

  const createResult = await prisma.$transaction(async (tx) => {
    const duplicateMessage = await findDuplicateVehicle(
      tx,
      organizationId,
      result.value.registrationNumber,
      result.value.vin,
    );
    if (duplicateMessage) {
      return { kind: "duplicate" as const, duplicate: duplicateMessage };
    }

    const vehicle = await tx.vehicle.create({
      data: {
        ...result.value,
        organizationId,
      },
      select: { id: true },
    });
    return { kind: "created" as const, vehicle };
  });

  if (createResult.kind === "duplicate") {
    return {
      errors: { [createResult.duplicate.field]: createResult.duplicate.message },
    };
  }

  revalidateVehicleSurfaces(createResult.vehicle.id);
  redirect(`/transport/vehicles/${createResult.vehicle.id}?success=created`);
}

export async function updateVehicle(
  _previousState: VehicleActionState,
  formData: FormData,
): Promise<VehicleActionState> {
  const { organizationId } = await requireVehicleContext();
  const id = readText(formData, "id");
  if (!UUID_RE.test(id)) {
    return { errors: {}, message: "Vehicle not found." };
  }

  const result = validateVehicleForm(formData);
  if (!result.ok) return { errors: result.errors };

  const updateResult = await prisma.$transaction(
    async (tx): Promise<VehicleUpdateResult> => {
      const vehicle = await tx.vehicle.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!vehicle) {
        return { kind: "error", message: "Vehicle not found." };
      }

      const duplicateMessage = await findDuplicateVehicle(
        tx,
        organizationId,
        result.value.registrationNumber,
        result.value.vin,
        id,
      );
      if (duplicateMessage) {
        return {
          kind: "field-errors",
          errors: {
            [duplicateMessage.field]: duplicateMessage.message,
          },
        };
      }

      const activeTripCount = await tx.trip.count({
        where: {
          organizationId,
          vehicleId: id,
          deletedAt: null,
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        },
      });
      const tripErrors = validateVehicleTripState(
        result.value.status,
        result.value.availability,
        activeTripCount,
      );
      if (Object.keys(tripErrors).length) {
        return {
          kind: "field-errors",
          errors: tripErrors,
        };
      }

      const updated = await tx.vehicle.updateMany({
        where: { id, organizationId, deletedAt: null },
        data: result.value,
      });
      return updated.count
        ? { kind: "updated" }
        : { kind: "error", message: "Vehicle not found." };
    },
  );

  if (updateResult.kind === "field-errors") {
    return { errors: updateResult.errors };
  }
  if (updateResult.kind === "error") {
    return { errors: {}, message: updateResult.message };
  }

  revalidateVehicleSurfaces(id);
  redirect(`/transport/vehicles/${id}?success=updated`);
}
