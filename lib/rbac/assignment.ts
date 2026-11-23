import "server-only";

import type { Prisma } from "@prisma/client";
import type { BuiltInRoleSlug } from "./types";

export interface PendingRoleAssignmentParams {
  organizationId: string;
  userId: string;
  roleSlug: BuiltInRoleSlug;
  departmentId?: string | null;
  assignedById?: string | null;
}

/**
 * Creates a PENDING_VERIFICATION role assignment for an invited organization user.
 *
 * Rules:
 * - Resolves the active built-in role matching roleSlug for the organization.
 * - Validates role scope allowed (ORGANIZATION_ONLY requires null departmentId; DEPARTMENT_ONLY requires departmentId).
 * - Avoids duplicate ACTIVE or PENDING_VERIFICATION assignments.
 * - Never reactivates an INACTIVE or REVOKED assignment.
 * - Must be called within a database transaction alongside user & invitation creation.
 */
export async function createPendingRoleAssignment(
  tx: Prisma.TransactionClient,
  params: PendingRoleAssignmentParams,
) {
  const {
    organizationId,
    userId,
    roleSlug,
    departmentId = null,
    assignedById = null,
  } = params;

  // 1. Locate the active built-in role
  const role = await tx.organizationRole.findFirst({
    where: {
      organizationId,
      slug: roleSlug,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: {
      id: true,
      scopeAllowed: true,
    },
  });

  if (!role) {
    throw new Error(
      `Active organization role not found for slug "${roleSlug}" in organization "${organizationId}".`,
    );
  }

  // 2. Validate department scope according to role constraints
  if (role.scopeAllowed === "ORGANIZATION_ONLY" && departmentId !== null) {
    throw new Error(
      `Role "${roleSlug}" is organization-only and cannot be scoped to a department.`,
    );
  }
  if (role.scopeAllowed === "DEPARTMENT_ONLY" && departmentId === null) {
    throw new Error(
      `Role "${roleSlug}" requires a department scope.`,
    );
  }

  // If departmentId is provided, verify that the department exists and belongs to the organization
  if (departmentId !== null) {
    const dept = await tx.department.findFirst({
      where: {
        id: departmentId,
        organizationId,
        status: "ACTIVE",
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!dept) {
      throw new Error(
        `Department "${departmentId}" not found or inactive in organization "${organizationId}".`,
      );
    }
  }

  // 3. Check for existing assignments for this user, role, and department
  const existing = await tx.userRoleAssignment.findFirst({
    where: {
      organizationId,
      userId,
      roleId: role.id,
      departmentId,
    },
    select: { id: true, status: true },
  });

  if (existing) {
    // If already active or pending verification, avoid duplicate assignment
    if (
      existing.status === "ACTIVE" ||
      existing.status === "PENDING_VERIFICATION"
    ) {
      return existing;
    }
    // Never reactivate INACTIVE or REVOKED assignments
    if (existing.status === "INACTIVE" || existing.status === "REVOKED") {
      return existing;
    }
  }

  // 4. Create the new assignment with status PENDING_VERIFICATION
  return tx.userRoleAssignment.create({
    data: {
      organizationId,
      userId,
      roleId: role.id,
      departmentId,
      status: "PENDING_VERIFICATION",
      assignedById,
    },
  });
}
