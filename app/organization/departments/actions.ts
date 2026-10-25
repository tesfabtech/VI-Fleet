"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DepartmentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const DEPARTMENTS_PATH = "/organization/departments";

async function getOrganizationAdmin() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const allowedRoles = [
    "ORGANIZATION_ADMINISTRATOR",
    "VICE_ORGANIZATION_ADMINISTRATOR",
  ];

  if (!allowedRoles.includes(session.user.role)) {
    redirect("/dashboard");
  }

  if (!session.user.organizationId) {
    redirect("/login");
  }

  return {
    userId: session.user.id,
    organizationId: session.user.organizationId,
  };
}

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectWithError(error: string): never {
  redirect(`${DEPARTMENTS_PATH}?error=${encodeURIComponent(error)}`);
}

function redirectWithSuccess(success: string): never {
  redirect(`${DEPARTMENTS_PATH}?success=${encodeURIComponent(success)}`);
}

async function departmentNameExists(
  organizationId: string,
  name: string,
  excludeId?: string,
): Promise<boolean> {
  const existing = await prisma.department.findFirst({
    where: {
      organizationId,
      name: {
        equals: name,
        mode: "insensitive",
      },
      deletedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });

  return existing !== null;
}

export async function createDepartment(formData: FormData) {
  const { organizationId } = await getOrganizationAdmin();

  const name = readText(formData, "name");
  const description = readText(formData, "description");

  if (!name) {
    redirectWithError("name-required");
  }

  if (name.length > 100) {
    redirectWithError("name-too-long");
  }

  if (await departmentNameExists(organizationId, name)) {
    redirectWithError("duplicate-name");
  }

  await prisma.department.create({
    data: {
      name,
      description: description || null,
      organizationId,
      status: DepartmentStatus.ACTIVE,
    },
  });

  revalidatePath(DEPARTMENTS_PATH);
  revalidatePath("/organization");

  redirectWithSuccess("created");
}

export async function updateDepartment(formData: FormData) {
  const { organizationId } = await getOrganizationAdmin();

  const id = readText(formData, "id");
  const name = readText(formData, "name");
  const description = readText(formData, "description");

  if (!id) {
    redirectWithError("invalid-department");
  }

  if (!name) {
    redirectWithError("name-required");
  }

  if (name.length > 100) {
    redirectWithError("name-too-long");
  }

  const department = await prisma.department.findFirst({
    where: {
      id,
      organizationId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!department) {
    redirectWithError("department-not-found");
  }

  if (await departmentNameExists(organizationId, name, id)) {
    redirectWithError("duplicate-name");
  }

  await prisma.department.updateMany({
    where: {
      id,
      organizationId,
      deletedAt: null,
    },
    data: {
      name,
      description: description || null,
    },
  });

  revalidatePath(DEPARTMENTS_PATH);
  revalidatePath("/organization");

  redirectWithSuccess("updated");
}

export async function setDepartmentStatus(formData: FormData) {
  const { organizationId } = await getOrganizationAdmin();

  const id = readText(formData, "id");
  const requestedStatus = readText(formData, "status");

  if (!id) {
    redirectWithError("invalid-department");
  }

  if (
    requestedStatus !== DepartmentStatus.ACTIVE &&
    requestedStatus !== DepartmentStatus.INACTIVE
  ) {
    redirectWithError("invalid-status");
  }

  const result = await prisma.department.updateMany({
    where: {
      id,
      organizationId,
      deletedAt: null,
    },
    data: {
      status: requestedStatus,
    },
  });

  if (result.count !== 1) {
    redirectWithError("department-not-found");
  }

  revalidatePath(DEPARTMENTS_PATH);
  revalidatePath("/organization");

  redirectWithSuccess(
    requestedStatus === DepartmentStatus.ACTIVE ? "reactivated" : "deactivated",
  );
}