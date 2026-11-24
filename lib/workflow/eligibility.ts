import "server-only";

import { prisma } from "@/lib/prisma";
import {
  isPlatformOnlyPermission,
  resolveAuthorizationContextForUser,
} from "@/lib/rbac";
import type {
  ApproverEligibilityResult,
  EvaluateEligibilityParams,
} from "./types";

/**
 * Server-side evaluation of approver eligibility for an approval stage.
 *
 * Enforces:
 * 1. Self-approval prevention: Requesters cannot approve their own requests by default.
 * 2. Organization tenant boundary: Approvers must belong to the workflow organization.
 * 3. User status: Approvers must be ACTIVE and not soft-deleted.
 * 4. System Administrator separation: Platform admins cannot act as organization approvers.
 * 5. Stage required permission: Evaluated using centralized RBAC AuthorizationContext.
 * 6. Direct user approver: User must be configured on stage and hold an active role assignment.
 * 7. Role approver: User must have an active assignment for the configured role within scope.
 *    - Organization-scoped role assignments qualify organization-wide.
 *    - Department-scoped role assignments qualify ONLY if the instance matches that department.
 */
export async function evaluateApproverEligibility(
  params: EvaluateEligibilityParams,
): Promise<ApproverEligibilityResult> {
  const {
    organizationId,
    stageId,
    userId,
    requesterId,
    departmentId,
    tx = prisma,
  } = params;

  // 1. Self-approval prevention
  if (requesterId && userId === requesterId) {
    return {
      eligible: false,
      reason: "Self-approval is prohibited. Requesters cannot approve their own requests.",
    };
  }

  // 2. Fetch User and verify tenant ownership and active status
  const user = await tx.user.findFirst({
    where: {
      id: userId,
      organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      role: true,
      status: true,
      organizationId: true,
      departmentId: true,
    },
  });

  if (!user) {
    return {
      eligible: false,
      reason: "User not found or does not belong to this organization.",
    };
  }

  if (user.status !== "ACTIVE") {
    return {
      eligible: false,
      reason: "User account is not active.",
    };
  }

  // 4. System Administrator separation
  if (user.role === "SYSTEM_ADMINISTRATOR") {
    return {
      eligible: false,
      reason: "System administrators cannot act as organization approvers.",
    };
  }

  // 3. Fetch Stage and its configured approvers
  const stage = await tx.approvalWorkflowStage.findFirst({
    where: {
      id: stageId,
      organizationId,
    },
    include: {
      approvers: {
        include: {
          role: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              deletedAt: true,
            },
          },
          user: {
            select: {
              id: true,
              status: true,
              deletedAt: true,
            },
          },
        },
      },
    },
  });

  if (!stage) {
    return {
      eligible: false,
      reason: "Approval stage not found in this organization.",
    };
  }

  // 5. Stage required permission check (if configured)
  if (stage.requiredPermissionCode) {
    if (isPlatformOnlyPermission(stage.requiredPermissionCode)) {
      return {
        eligible: false,
        reason: "Stage requires a platform-only permission which cannot be used for organization workflows.",
      };
    }

    const authContext = await resolveAuthorizationContextForUser(userId, tx);
    if (!authContext) {
      return {
        eligible: false,
        reason: "Unable to resolve user authorization context.",
      };
    }

    const hasPermission = authContext.hasPermission(
      stage.requiredPermissionCode,
      {
        organizationId,
        departmentId: departmentId ?? null,
      },
    );

    if (!hasPermission) {
      return {
        eligible: false,
        reason: `User lacks required permission "${stage.requiredPermissionCode}" for this scope.`,
      };
    }
  }

  // 6. Check Direct User Match
  const directUserApprover = stage.approvers.find(
    (a) => a.approverType === "USER" && a.userId === userId,
  );

  if (directUserApprover) {
    // Verify user has at least one active, valid role assignment in the organization
    const activeAssignmentCount = await tx.userRoleAssignment.count({
      where: {
        organizationId,
        userId,
        status: "ACTIVE",
        role: {
          status: "ACTIVE",
          deletedAt: null,
        },
      },
    });

    if (activeAssignmentCount === 0) {
      return {
        eligible: false,
        reason: "Direct approver user has no active role assignments in this organization.",
      };
    }

    return {
      eligible: true,
      matchedBy: "USER",
    };
  }

  // 7. Check Role Match
  const roleApprovers = stage.approvers.filter(
    (a) =>
      a.approverType === "ROLE" &&
      a.roleId !== null &&
      a.role &&
      a.role.status === "ACTIVE" &&
      a.role.deletedAt === null,
  );

  if (roleApprovers.length > 0) {
    const roleIds = roleApprovers.map((a) => a.roleId!);

    // Query active user role assignments for the matching roles
    const userAssignments = await tx.userRoleAssignment.findMany({
      where: {
        organizationId,
        userId,
        roleId: { in: roleIds },
        status: "ACTIVE",
        role: {
          status: "ACTIVE",
          deletedAt: null,
        },
      },
      include: {
        department: {
          select: {
            id: true,
            status: true,
            deletedAt: true,
          },
        },
      },
    });

    for (const assignment of userAssignments) {
      // Organization-scoped assignment: covers all departments
      if (assignment.departmentId === null) {
        return {
          eligible: true,
          matchedBy: "ROLE",
          matchedRoleId: assignment.roleId,
        };
      }

      // Department-scoped assignment: requires department to be active and match instance department
      if (
        assignment.department &&
        assignment.department.status === "ACTIVE" &&
        assignment.department.deletedAt === null &&
        departmentId &&
        assignment.departmentId === departmentId
      ) {
        return {
          eligible: true,
          matchedBy: "ROLE",
          matchedRoleId: assignment.roleId,
        };
      }
    }
  }

  return {
    eligible: false,
    reason: "User is not an authorized approver for this stage in the required scope.",
  };
}

/**
 * Resolves the complete set of distinct eligible approver user IDs for a stage instance.
 * Used by the ALL approval policy to determine which users must submit an APPROVE decision.
 */
export async function getEligibleApproverIdsForStage(params: {
  organizationId: string;
  stageId: string;
  requesterId?: string;
  departmentId?: string | null;
  tx?: EvaluateEligibilityParams["tx"];
}): Promise<string[]> {
  const {
    organizationId,
    stageId,
    requesterId,
    departmentId,
    tx = prisma,
  } = params;

  const stage = await tx.approvalWorkflowStage.findFirst({
    where: {
      id: stageId,
      organizationId,
    },
    include: {
      approvers: true,
    },
  });

  if (!stage) {
    return [];
  }

  const candidateUserIds = new Set<string>();

  // 1. Collect direct user approvers
  for (const approver of stage.approvers) {
    if (approver.approverType === "USER" && approver.userId) {
      if (!requesterId || approver.userId !== requesterId) {
        candidateUserIds.add(approver.userId);
      }
    }
  }

  // 2. Collect users holding configured roles within scope
  const roleApproverIds = stage.approvers
    .filter((a) => a.approverType === "ROLE" && a.roleId !== null)
    .map((a) => a.roleId!);

  if (roleApproverIds.length > 0) {
    const roleAssignments = await tx.userRoleAssignment.findMany({
      where: {
        organizationId,
        roleId: { in: roleApproverIds },
        status: "ACTIVE",
        role: {
          status: "ACTIVE",
          deletedAt: null,
        },
        user: {
          status: "ACTIVE",
          deletedAt: null,
          role: { not: "SYSTEM_ADMINISTRATOR" },
        },
      },
      select: {
        userId: true,
        departmentId: true,
        department: {
          select: {
            status: true,
            deletedAt: true,
          },
        },
      },
    });

    for (const asgn of roleAssignments) {
      if (requesterId && asgn.userId === requesterId) {
        continue;
      }

      // Organization-wide assignment
      if (asgn.departmentId === null) {
        candidateUserIds.add(asgn.userId);
      } else if (
        departmentId &&
        asgn.departmentId === departmentId &&
        asgn.department &&
        asgn.department.status === "ACTIVE" &&
        asgn.department.deletedAt === null
      ) {
        // Department-scoped assignment matching the instance department
        candidateUserIds.add(asgn.userId);
      }
    }
  }

  // 3. Verify each candidate through the comprehensive eligibility evaluator
  // (which also evaluates stage.requiredPermissionCode against RBAC)
  const verifiedUserIds: string[] = [];

  for (const candidateId of candidateUserIds) {
    const check = await evaluateApproverEligibility({
      organizationId,
      stageId,
      userId: candidateId,
      requesterId,
      departmentId,
      tx,
    });

    if (check.eligible) {
      verifiedUserIds.push(candidateId);
    }
  }

  return verifiedUserIds;
}
