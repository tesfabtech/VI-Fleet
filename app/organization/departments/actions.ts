"use server";

import { createHash, randomBytes } from "node:crypto";
import { DepartmentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getAppUrl,
  sendDepartmentUserInvitationEmail,
} from "@/lib/gmail-email";
import { prisma } from "@/lib/prisma";

const DEPARTMENTS_PATH = "/organization/departments";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getSafeReturnPath(formData: FormData): string {
  const raw = readText(formData, "returnTo");
  if (raw.startsWith("/organization/departments")) {
    return raw;
  }
  return DEPARTMENTS_PATH;
}

function redirectWithError(basePath: string, error: string): never {
  redirect(`${basePath}?error=${encodeURIComponent(error)}`);
}

function redirectWithSuccess(basePath: string, success: string): never {
  redirect(`${basePath}?success=${encodeURIComponent(success)}`);
}

async function getOrganizationAdmin(returnPath = DEPARTMENTS_PATH) {
  const session = await auth();

  if (!session?.user?.id) {
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

  // Re-verify in PostgreSQL that both the caller and the organization are ACTIVE
  const activeAdmin = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      organizationId: session.user.organizationId,
      role: {
        in: ["ORGANIZATION_ADMINISTRATOR", "VICE_ORGANIZATION_ADMINISTRATOR"],
      },
      status: "ACTIVE",
      deletedAt: null,
      organization: {
        status: "ACTIVE",
        deletedAt: null,
      },
    },
    select: {
      id: true,
      organizationId: true,
    },
  });

  if (!activeAdmin || !activeAdmin.organizationId) {
    redirectWithError(returnPath, "organization-inactive");
  }

  return {
    userId: activeAdmin.id,
    organizationId: activeAdmin.organizationId,
  };
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

function revalidateDepartmentViews(departmentId?: string) {
  revalidatePath(DEPARTMENTS_PATH);
  if (departmentId) {
    revalidatePath(`${DEPARTMENTS_PATH}/${departmentId}`);
  }
  revalidatePath("/organization/department-users");
  revalidatePath("/organization/settings");
  revalidatePath("/organization");
}

/**
 * 1. Create a new department in the authenticated organization.
 */
export async function createDepartment(formData: FormData) {
  const { organizationId } = await getOrganizationAdmin(DEPARTMENTS_PATH);

  const name = readText(formData, "name");
  const description = readText(formData, "description");

  if (!name) {
    redirectWithError(DEPARTMENTS_PATH, "name-required");
  }

  if (name.length > 100) {
    redirectWithError(DEPARTMENTS_PATH, "name-too-long");
  }

  if (description.length > 1000) {
    redirectWithError(DEPARTMENTS_PATH, "description-too-long");
  }

  if (await departmentNameExists(organizationId, name)) {
    redirectWithError(DEPARTMENTS_PATH, "duplicate-name");
  }

  await prisma.department.create({
    data: {
      name,
      description: description || null,
      organizationId,
      status: DepartmentStatus.ACTIVE,
    },
  });

  revalidateDepartmentViews();
  redirectWithSuccess(DEPARTMENTS_PATH, "created");
}

/**
 * 2. Update department name and description.
 */
export async function updateDepartment(formData: FormData) {
  const returnPath = getSafeReturnPath(formData);
  const { organizationId } = await getOrganizationAdmin(returnPath);

  const id = readText(formData, "id");
  const name = readText(formData, "name");
  const description = readText(formData, "description");

  if (!id || !UUID_PATTERN.test(id)) {
    redirectWithError(returnPath, "invalid-department");
  }

  if (!name) {
    redirectWithError(returnPath, "name-required");
  }

  if (name.length > 100) {
    redirectWithError(returnPath, "name-too-long");
  }

  if (description.length > 1000) {
    redirectWithError(returnPath, "description-too-long");
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
    redirectWithError(returnPath, "department-not-found");
  }

  if (await departmentNameExists(organizationId, name, id)) {
    redirectWithError(returnPath, "duplicate-name");
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

  revalidateDepartmentViews(id);
  redirectWithSuccess(returnPath, "updated");
}

/**
 * 3. Activate or deactivate a department according to business rules.
 *    Blocks deactivation if the department has PENDING transportation requests.
 */
export async function setDepartmentStatus(formData: FormData) {
  const returnPath = getSafeReturnPath(formData);
  const { organizationId } = await getOrganizationAdmin(returnPath);

  const id = readText(formData, "id");
  const requestedStatus = readText(formData, "status");

  if (!id || !UUID_PATTERN.test(id)) {
    redirectWithError(returnPath, "invalid-department");
  }

  if (
    requestedStatus !== DepartmentStatus.ACTIVE &&
    requestedStatus !== DepartmentStatus.INACTIVE
  ) {
    redirectWithError(returnPath, "invalid-status");
  }

  // Business Rule: Do not deactivate a department that has PENDING transportation requests
  if (requestedStatus === DepartmentStatus.INACTIVE) {
    const pendingRequestsCount = await prisma.transportationRequest.count({
      where: {
        organizationId,
        departmentId: id,
        status: "PENDING",
        deletedAt: null,
      },
    });

    if (pendingRequestsCount > 0) {
      redirectWithError(returnPath, "has-pending-requests");
    }
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
    redirectWithError(returnPath, "department-not-found");
  }

  revalidateDepartmentViews(id);

  redirectWithSuccess(
    returnPath,
    requestedStatus === DepartmentStatus.ACTIVE ? "reactivated" : "deactivated",
  );
}

/**
 * 4. Safely archive (soft-delete) an empty department created by mistake.
 *    Only allowed if the department has 0 users, 0 applications, and 0 transport requests.
 */
export async function deleteEmptyDepartment(formData: FormData) {
  const { organizationId } = await getOrganizationAdmin(DEPARTMENTS_PATH);
  const id = readText(formData, "id");

  if (!id || !UUID_PATTERN.test(id)) {
    redirectWithError(DEPARTMENTS_PATH, "invalid-department");
  }

  const department = await prisma.department.findFirst({
    where: {
      id,
      organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      _count: {
        select: {
          users: { where: { deletedAt: null } },
          departmentUserApplications: true,
          transportationRequests: { where: { deletedAt: null } },
        },
      },
    },
  });

  if (!department) {
    redirectWithError(DEPARTMENTS_PATH, "department-not-found");
  }

  const hasLinkedRecords =
    department._count.users > 0 ||
    department._count.departmentUserApplications > 0 ||
    department._count.transportationRequests > 0;

  if (hasLinkedRecords) {
    redirectWithError(DEPARTMENTS_PATH, "department-not-empty");
  }

  const result = await prisma.department.updateMany({
    where: {
      id,
      organizationId,
      deletedAt: null,
    },
    data: {
      status: DepartmentStatus.INACTIVE,
      deletedAt: new Date(),
    },
  });

  if (result.count !== 1) {
    redirectWithError(DEPARTMENTS_PATH, "department-not-found");
  }

  revalidateDepartmentViews(id);
  redirectWithSuccess(DEPARTMENTS_PATH, "deleted");
}

/**
 * 5. Approve a Department User application directly from the Department Details page.
 */
export async function approveApplicationFromDepartment(formData: FormData) {
  const returnPath = getSafeReturnPath(formData);
  const reviewer = await getOrganizationAdmin(returnPath);

  const applicationId = readText(formData, "applicationId");
  const reviewNotes = readText(formData, "reviewNotes");

  if (!applicationId || !UUID_PATTERN.test(applicationId)) {
    redirectWithError(returnPath, "invalid-application");
  }

  if (reviewNotes.length > 2000) {
    redirectWithError(returnPath, "notes-too-long");
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  try {
    await prisma.$transaction(
      async (tx) => {
        const application = await tx.departmentUserApplication.findFirst({
          where: {
            id: applicationId,
            organizationId: reviewer.organizationId,
            status: { in: ["PENDING", "UNDER_REVIEW"] },
            createdUserId: null,
          },
          include: {
            department: {
              select: { id: true, name: true, status: true, deletedAt: true },
            },
            organization: {
              select: { name: true, status: true, deletedAt: true },
            },
          },
        });

        if (!application) {
          throw new Error("APPLICATION_ALREADY_REVIEWED");
        }

        if (
          application.department.status !== "ACTIVE" ||
          application.department.deletedAt !== null ||
          application.organization.status !== "ACTIVE" ||
          application.organization.deletedAt !== null
        ) {
          throw new Error("ORGANIZATION_OR_DEPARTMENT_INACTIVE");
        }

        const email = application.email.trim().toLowerCase();

        const existingUser = await tx.user.findFirst({
          where: {
            OR: [
              { email: { equals: email, mode: "insensitive" } },
              { pendingEmail: { equals: email, mode: "insensitive" } },
            ],
          },
          select: { id: true },
        });

        if (existingUser) {
          throw new Error("EMAIL_ALREADY_USED");
        }

        const user = await tx.user.create({
          data: {
            organizationId: reviewer.organizationId,
            departmentId: application.departmentId,
            firstName: application.firstName,
            middleName: application.middleName,
            lastName: application.lastName,
            email,
            phone: application.phone,
            role: "DEPARTMENT_USER",
            status: "INACTIVE",
            passwordHash: null,
          },
        });

        await tx.organizationInvitation.create({
          data: {
            userId: user.id,
            createdById: reviewer.userId,
            tokenHash,
            expiresAt,
          },
        });

        const updated = await tx.departmentUserApplication.updateMany({
          where: {
            id: application.id,
            organizationId: reviewer.organizationId,
            status: { in: ["PENDING", "UNDER_REVIEW"] },
            createdUserId: null,
          },
          data: {
            status: "APPROVED",
            reviewNotes: reviewNotes || null,
            reviewedById: reviewer.userId,
            reviewedAt: now,
            createdUserId: user.id,
          },
        });

        if (updated.count !== 1) {
          throw new Error("APPLICATION_ALREADY_REVIEWED");
        }

        await sendDepartmentUserInvitationEmail({
          to: email,
          organizationName: application.organization.name,
          departmentName: application.department.name,
          invitationUrl: getAppUrl(
            `/setup-password?token=${encodeURIComponent(rawToken)}`,
          ),
        });
      },
      { timeout: 20000 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_ALREADY_USED") {
      redirectWithError(returnPath, "email-used");
    }
    if (
      error instanceof Error &&
      error.message === "APPLICATION_ALREADY_REVIEWED"
    ) {
      redirectWithError(returnPath, "application-reviewed");
    }
    if (
      error instanceof Error &&
      error.message === "ORGANIZATION_OR_DEPARTMENT_INACTIVE"
    ) {
      redirectWithError(returnPath, "department-inactive-for-approval");
    }
    console.error("Department application approval failed:", error);
    redirectWithError(returnPath, "approval-failed");
  }

  revalidateDepartmentViews();
  redirectWithSuccess(returnPath, "application-approved");
}

/**
 * 6. Reject a Department User application directly from the Department Details page.
 */
export async function rejectApplicationFromDepartment(formData: FormData) {
  const returnPath = getSafeReturnPath(formData);
  const reviewer = await getOrganizationAdmin(returnPath);

  const applicationId = readText(formData, "applicationId");
  const reviewNotes = readText(formData, "reviewNotes");

  if (!applicationId || !UUID_PATTERN.test(applicationId)) {
    redirectWithError(returnPath, "invalid-application");
  }

  if (reviewNotes.length > 2000) {
    redirectWithError(returnPath, "notes-too-long");
  }

  const result = await prisma.departmentUserApplication.updateMany({
    where: {
      id: applicationId,
      organizationId: reviewer.organizationId,
      status: { in: ["PENDING", "UNDER_REVIEW"] },
      createdUserId: null,
    },
    data: {
      status: "REJECTED",
      reviewNotes: reviewNotes || null,
      reviewedById: reviewer.userId,
      reviewedAt: new Date(),
    },
  });

  if (result.count !== 1) {
    redirectWithError(returnPath, "application-reviewed");
  }

  revalidateDepartmentViews();
  redirectWithSuccess(returnPath, "application-rejected");
}