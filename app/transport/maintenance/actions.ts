"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveMaintenanceAccess, setMaintenanceOrganization } from "@/lib/maintenance/access";
import {
  validateMaintenanceRecord,
  validateMaintenanceSchedule,
  type MaintenanceFieldErrors,
} from "@/lib/maintenance/validation";
import { prisma } from "@/lib/prisma";

export type MaintenanceActionState = {
  errors: MaintenanceFieldErrors;
  message?: string;
};

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function actionError(
  status: "unauthenticated" | "forbidden" | "select-organization",
): MaintenanceActionState {
  if (status === "unauthenticated") {
    return { errors: {}, message: "Your session expired. Sign in again." };
  }
  if (status === "select-organization") {
    return { errors: {}, message: "Select an organization before continuing." };
  }
  return { errors: {}, message: "You are not authorized to manage maintenance." };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function revalidateMaintenance() {
  revalidatePath("/transport/maintenance");
  revalidatePath("/transport/maintenance/records");
  revalidatePath("/transport/maintenance/schedules");
}

export async function selectMaintenanceOrganization(
  _previousState: MaintenanceActionState,
  formData: FormData,
): Promise<MaintenanceActionState> {
  const organizationId = readText(formData, "organizationId");
  if (!isUuid(organizationId)) {
    return { errors: { organizationId: "Choose an organization." } };
  }

  const result = await setMaintenanceOrganization(organizationId);
  if (!result.ok) {
    if (result.reason === "unauthenticated") {
      return actionError("unauthenticated");
    }
    if (result.reason === "forbidden") return actionError("forbidden");
    return { errors: { organizationId: "Choose an active organization." } };
  }

  revalidateMaintenance();
  redirect("/transport/maintenance");
}

export async function createMaintenanceRecord(
  _previousState: MaintenanceActionState,
  formData: FormData,
): Promise<MaintenanceActionState> {
  const access = await resolveMaintenanceAccess();
  if (access.status !== "ready") return actionError(access.status);

  const result = validateMaintenanceRecord(formData);
  if (!result.ok) return { errors: result.errors };
  if (!isUuid(result.value.vehicleId)) {
    return { errors: { vehicleId: "Choose a valid vehicle." } };
  }

  const created = await prisma.$transaction(async (tx) => {
    const vehicle = await tx.vehicle.findFirst({
      where: {
        id: result.value.vehicleId,
        organizationId: access.context.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!vehicle) return false;

    await tx.maintenanceRecord.create({
      data: {
        ...result.value,
        organizationId: access.context.organizationId,
      },
    });
    return true;
  });
  if (!created) {
    return { errors: { vehicleId: "Choose a vehicle in this organization." } };
  }

  revalidateMaintenance();
  redirect("/transport/maintenance/records?success=created");
}

export async function updateMaintenanceRecord(
  _previousState: MaintenanceActionState,
  formData: FormData,
): Promise<MaintenanceActionState> {
  const access = await resolveMaintenanceAccess();
  if (access.status !== "ready") return actionError(access.status);

  const id = readText(formData, "id");
  if (!isUuid(id)) return { errors: {}, message: "Maintenance record not found." };

  const result = validateMaintenanceRecord(formData);
  if (!result.ok) return { errors: result.errors };
  if (!isUuid(result.value.vehicleId)) {
    return { errors: { vehicleId: "Choose a valid vehicle." } };
  }

  const updateCount = await prisma.$transaction(async (tx) => {
    const vehicle = await tx.vehicle.findFirst({
      where: {
        id: result.value.vehicleId,
        organizationId: access.context.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!vehicle) return -1;

    const updated = await tx.maintenanceRecord.updateMany({
      where: {
        id,
        organizationId: access.context.organizationId,
        deletedAt: null,
      },
      data: result.value,
    });
    return updated.count;
  });
  if (updateCount === -1) {
    return { errors: { vehicleId: "Choose a vehicle in this organization." } };
  }
  if (!updateCount) return { errors: {}, message: "Maintenance record not found." };

  revalidateMaintenance();
  revalidatePath(`/transport/maintenance/records/${id}`);
  redirect(`/transport/maintenance/records/${id}?success=updated`);
}

export async function deleteMaintenanceRecord(
  formData: FormData,
): Promise<void> {
  const access = await resolveMaintenanceAccess();
  if (access.status !== "ready") {
    if (access.status === "unauthenticated") redirect("/login");
    redirect("/transport");
  }

  const id = readText(formData, "id");
  if (!isUuid(id)) redirect("/transport/maintenance/records");

  await prisma.maintenanceRecord.updateMany({
    where: {
      id,
      organizationId: access.context.organizationId,
      deletedAt: null,
    },
    data: { deletedAt: new Date() },
  });
  revalidateMaintenance();
  redirect("/transport/maintenance/records?success=deleted");
}

export async function createMaintenanceSchedule(
  _previousState: MaintenanceActionState,
  formData: FormData,
): Promise<MaintenanceActionState> {
  const access = await resolveMaintenanceAccess();
  if (access.status !== "ready") return actionError(access.status);

  const result = validateMaintenanceSchedule(formData);
  if (!result.ok) return { errors: result.errors };
  if (!isUuid(result.value.vehicleId)) {
    return { errors: { vehicleId: "Choose a valid vehicle." } };
  }

  const created = await prisma.$transaction(async (tx) => {
    const vehicle = await tx.vehicle.findFirst({
      where: {
        id: result.value.vehicleId,
        organizationId: access.context.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!vehicle) return false;

    await tx.maintenanceSchedule.create({
      data: {
        ...result.value,
        organizationId: access.context.organizationId,
      },
    });
    return true;
  });
  if (!created) {
    return { errors: { vehicleId: "Choose a vehicle in this organization." } };
  }

  revalidateMaintenance();
  redirect("/transport/maintenance/schedules?success=created");
}

export async function updateMaintenanceSchedule(
  _previousState: MaintenanceActionState,
  formData: FormData,
): Promise<MaintenanceActionState> {
  const access = await resolveMaintenanceAccess();
  if (access.status !== "ready") return actionError(access.status);

  const id = readText(formData, "id");
  if (!isUuid(id)) return { errors: {}, message: "Service schedule not found." };

  const result = validateMaintenanceSchedule(formData);
  if (!result.ok) return { errors: result.errors };
  if (!isUuid(result.value.vehicleId)) {
    return { errors: { vehicleId: "Choose a valid vehicle." } };
  }

  const updateCount = await prisma.$transaction(async (tx) => {
    const vehicle = await tx.vehicle.findFirst({
      where: {
        id: result.value.vehicleId,
        organizationId: access.context.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!vehicle) return -1;

    const updated = await tx.maintenanceSchedule.updateMany({
      where: {
        id,
        organizationId: access.context.organizationId,
        deletedAt: null,
      },
      data: result.value,
    });
    return updated.count;
  });
  if (updateCount === -1) {
    return { errors: { vehicleId: "Choose a vehicle in this organization." } };
  }
  if (!updateCount) return { errors: {}, message: "Service schedule not found." };

  revalidateMaintenance();
  revalidatePath(`/transport/maintenance/schedules/${id}`);
  redirect(`/transport/maintenance/schedules/${id}?success=updated`);
}

export async function deleteMaintenanceSchedule(
  formData: FormData,
): Promise<void> {
  const access = await resolveMaintenanceAccess();
  if (access.status !== "ready") {
    if (access.status === "unauthenticated") redirect("/login");
    redirect("/transport");
  }

  const id = readText(formData, "id");
  if (!isUuid(id)) redirect("/transport/maintenance/schedules");

  await prisma.maintenanceSchedule.updateMany({
    where: {
      id,
      organizationId: access.context.organizationId,
      deletedAt: null,
    },
    data: { deletedAt: new Date() },
  });
  revalidateMaintenance();
  redirect("/transport/maintenance/schedules?success=deleted");
}
