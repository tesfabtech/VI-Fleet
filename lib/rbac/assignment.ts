import "server-only";

import {
  Prisma,
  RoleAssignmentStatus,
  RoleScopeAllowed,
  RoleStatus,
  RoleType,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { BuiltInRoleSlug } from "./types";
import { ForbiddenError } from "./types";

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
    throw new Error(`Role "${roleSlug}" requires a department scope.`);
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

// ============================================================
// ASSIGNMENT DIRECTORY & MANAGEMENT TYPES
// ============================================================

export interface UserRoleAssignmentItem {
  id: string;
  roleId: string;
  roleName: string;
  roleSlug: string;
  roleType: RoleType;
  scopeAllowed: RoleScopeAllowed;
  departmentId: string | null;
  departmentName: string | null;
  status: RoleAssignmentStatus;
  assignedAt: Date;
  assignedById: string | null;
  assignedByName: string | null;
  assignedByEmail: string | null;
  revokedAt: Date | null;
  revokedById: string | null;
  revokedByName: string | null;
  revokedByEmail: string | null;
  revocationReason: string | null;
}

export interface OrganizationUserWithAssignments {
  id: string;
  name: string;
  email: string | null;
  pendingEmail: string | null;
  phone: string | null;
  legacyRole: UserRole;
  status: UserStatus;
  departmentId: string | null;
  departmentName: string | null;
  createdAt: Date;
  assignments: UserRoleAssignmentItem[];
  activeAssignmentCount: number;
}

export interface AssignmentDirectoryFilters {
  query?: string;
  roleId?: string;
  departmentId?: string;
  status?: RoleAssignmentStatus | "ALL";
}

export interface AssignmentDirectoryStats {
  totalUsers: number;
  usersWithActiveRoles: number;
  totalActiveAssignments: number;
  totalInactiveAssignments: number;
  totalPendingAssignments: number;
  totalRevokedAssignments: number;
}

export interface RoleAssignmentInput {
  roleId: string;
  scope: "ORGANIZATION" | "DEPARTMENT";
  departmentId?: string | null;
}

export interface AssignRolesParams {
  userId: string;
  assignments: RoleAssignmentInput[];
}

export interface UserAssignmentDetailsResult {
  user: {
    id: string;
    name: string;
    email: string | null;
    pendingEmail: string | null;
    phone: string | null;
    legacyRole: UserRole;
    status: UserStatus;
    departmentId: string | null;
    departmentName: string | null;
    createdAt: Date;
  };
  assignments: UserRoleAssignmentItem[];
  availableRoles: Array<{
    id: string;
    name: string;
    slug: string;
    roleType: RoleType;
    scopeAllowed: RoleScopeAllowed;
    description: string | null;
    status: RoleStatus;
  }>;
  availableDepartments: Array<{
    id: string;
    name: string;
  }>;
}

// ============================================================
// DIRECTORY LISTING
// ============================================================

/**
 * Lists all organization users and their role assignments matching filters.
 * Strictly enforces organization tenant isolation.
 */
export async function getOrganizationUserAssignments(
  organizationId: string,
  filters?: AssignmentDirectoryFilters,
): Promise<{
  users: OrganizationUserWithAssignments[];
  stats: AssignmentDirectoryStats;
}> {
  const query = filters?.query?.trim();
  const roleId = filters?.roleId?.trim() || undefined;
  const departmentId = filters?.departmentId?.trim() || undefined;
  const statusFilter =
    filters?.status && filters.status !== "ALL" ? filters.status : undefined;

  // Build filter conditions
  const conditions: Prisma.UserWhereInput[] = [
    {
      organizationId,
      deletedAt: null,
      role: { not: "SYSTEM_ADMINISTRATOR" },
    },
  ];

  if (query) {
    conditions.push({
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { middleName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { pendingEmail: { contains: query, mode: "insensitive" } },
        { phone: { contains: query, mode: "insensitive" } },
      ],
    });
  }

  if (roleId) {
    conditions.push({
      roleAssignments: {
        some: {
          organizationId,
          roleId,
          ...(statusFilter ? { status: statusFilter } : {}),
        },
      },
    });
  } else if (statusFilter) {
    conditions.push({
      roleAssignments: {
        some: {
          organizationId,
          status: statusFilter,
        },
      },
    });
  }

  if (departmentId) {
    conditions.push({
      OR: [
        { departmentId },
        {
          roleAssignments: {
            some: {
              organizationId,
              departmentId,
              ...(statusFilter ? { status: statusFilter } : {}),
            },
          },
        },
      ],
    });
  }

  // Fetch users with their role assignments
  const [users, allOrgAssignments, totalOrgUsers] = await Promise.all([
    prisma.user.findMany({
      where: { AND: conditions },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        email: true,
        pendingEmail: true,
        phone: true,
        role: true,
        status: true,
        departmentId: true,
        createdAt: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        roleAssignments: {
          where: {
            organizationId,
          },
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            roleId: true,
            departmentId: true,
            status: true,
            assignedAt: true,
            assignedById: true,
            revokedAt: true,
            revokedById: true,
            revocationReason: true,
            role: {
              select: {
                id: true,
                name: true,
                slug: true,
                roleType: true,
                scopeAllowed: true,
              },
            },
            department: {
              select: {
                id: true,
                name: true,
              },
            },
            assignedBy: {
              select: {
                id: true,
                firstName: true,
                middleName: true,
                lastName: true,
                email: true,
              },
            },
            revokedBy: {
              select: {
                id: true,
                firstName: true,
                middleName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    }),
    prisma.userRoleAssignment.findMany({
      where: {
        organizationId,
        user: {
          deletedAt: null,
          role: { not: "SYSTEM_ADMINISTRATOR" },
        },
      },
      select: {
        userId: true,
        status: true,
      },
    }),
    prisma.user.count({
      where: {
        organizationId,
        deletedAt: null,
        role: { not: "SYSTEM_ADMINISTRATOR" },
      },
    }),
  ]);

  // Calculate statistics across organization
  const activeUserIdsWithRoles = new Set<string>();
  let totalActiveAssignments = 0;
  let totalInactiveAssignments = 0;
  let totalPendingAssignments = 0;
  let totalRevokedAssignments = 0;

  for (const asgn of allOrgAssignments) {
    if (asgn.status === "ACTIVE") {
      totalActiveAssignments++;
      activeUserIdsWithRoles.add(asgn.userId);
    } else if (asgn.status === "INACTIVE") {
      totalInactiveAssignments++;
    } else if (asgn.status === "PENDING_VERIFICATION") {
      totalPendingAssignments++;
    } else if (asgn.status === "REVOKED") {
      totalRevokedAssignments++;
    }
  }

  const formattedUsers: OrganizationUserWithAssignments[] = users.map((u) => {
    const fullName =
      [u.firstName, u.middleName, u.lastName].filter(Boolean).join(" ") ||
      u.email ||
      "User";

    const assignments: UserRoleAssignmentItem[] = u.roleAssignments.map(
      (a) => ({
        id: a.id,
        roleId: a.role.id,
        roleName: a.role.name,
        roleSlug: a.role.slug,
        roleType: a.role.roleType,
        scopeAllowed: a.role.scopeAllowed,
        departmentId: a.departmentId,
        departmentName: a.department?.name ?? null,
        status: a.status,
        assignedAt: a.assignedAt,
        assignedById: a.assignedById,
        assignedByName: a.assignedBy
          ? [a.assignedBy.firstName, a.assignedBy.lastName]
              .filter(Boolean)
              .join(" ") || a.assignedBy.email
          : null,
        assignedByEmail: a.assignedBy?.email ?? null,
        revokedAt: a.revokedAt,
        revokedById: a.revokedById,
        revokedByName: a.revokedBy
          ? [a.revokedBy.firstName, a.revokedBy.lastName]
              .filter(Boolean)
              .join(" ") || a.revokedBy.email
          : null,
        revokedByEmail: a.revokedBy?.email ?? null,
        revocationReason: a.revocationReason,
      }),
    );

    const activeAssignmentCount = assignments.filter(
      (a) => a.status === "ACTIVE",
    ).length;

    return {
      id: u.id,
      name: fullName,
      email: u.email,
      pendingEmail: u.pendingEmail,
      phone: u.phone,
      legacyRole: u.role,
      status: u.status,
      departmentId: u.departmentId,
      departmentName: u.department?.name ?? null,
      createdAt: u.createdAt,
      assignments,
      activeAssignmentCount,
    };
  });

  return {
    users: formattedUsers,
    stats: {
      totalUsers: totalOrgUsers,
      usersWithActiveRoles: activeUserIdsWithRoles.size,
      totalActiveAssignments,
      totalInactiveAssignments,
      totalPendingAssignments,
      totalRevokedAssignments,
    },
  };
}

// ============================================================
// USER ASSIGNMENT DETAILS
// ============================================================

/**
 * Retrieves detailed assignment history for a specific organization user,
 * along with available roles and active departments for assignment.
 */
export async function getUserAssignmentDetails(
  organizationId: string,
  userId: string,
): Promise<UserAssignmentDetailsResult | null> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      organizationId,
      deletedAt: null,
      role: { not: "SYSTEM_ADMINISTRATOR" },
    },
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      email: true,
      pendingEmail: true,
      phone: true,
      role: true,
      status: true,
      departmentId: true,
      createdAt: true,
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      roleAssignments: {
        where: {
          organizationId,
        },
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          roleId: true,
          departmentId: true,
          status: true,
          assignedAt: true,
          assignedById: true,
          revokedAt: true,
          revokedById: true,
          revocationReason: true,
          role: {
            select: {
              id: true,
              name: true,
              slug: true,
              roleType: true,
              scopeAllowed: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          assignedBy: {
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
              email: true,
            },
          },
          revokedBy: {
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  const [availableRoles, availableDepartments] = await Promise.all([
    prisma.organizationRole.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        deletedAt: null,
      },
      orderBy: [{ roleType: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        roleType: true,
        scopeAllowed: true,
        description: true,
        status: true,
      },
    }),
    prisma.department.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        deletedAt: null,
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  const fullName =
    [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ") ||
    user.email ||
    "User";

  const assignments: UserRoleAssignmentItem[] = user.roleAssignments.map((a) => ({
    id: a.id,
    roleId: a.role.id,
    roleName: a.role.name,
    roleSlug: a.role.slug,
    roleType: a.role.roleType,
    scopeAllowed: a.role.scopeAllowed,
    departmentId: a.departmentId,
    departmentName: a.department?.name ?? null,
    status: a.status,
    assignedAt: a.assignedAt,
    assignedById: a.assignedById,
    assignedByName: a.assignedBy
      ? [a.assignedBy.firstName, a.assignedBy.lastName]
          .filter(Boolean)
          .join(" ") || a.assignedBy.email
      : null,
    assignedByEmail: a.assignedBy?.email ?? null,
    revokedAt: a.revokedAt,
    revokedById: a.revokedById,
    revokedByName: a.revokedBy
      ? [a.revokedBy.firstName, a.revokedBy.lastName]
          .filter(Boolean)
          .join(" ") || a.revokedBy.email
      : null,
    revokedByEmail: a.revokedBy?.email ?? null,
    revocationReason: a.revocationReason,
  }));

  return {
    user: {
      id: user.id,
      name: fullName,
      email: user.email,
      pendingEmail: user.pendingEmail,
      phone: user.phone,
      legacyRole: user.role,
      status: user.status,
      departmentId: user.departmentId,
      departmentName: user.department?.name ?? null,
      createdAt: user.createdAt,
    },
    assignments,
    availableRoles,
    availableDepartments,
  };
}

// ============================================================
// ASSIGN ROLES OPERATION
// ============================================================

/**
 * Assigns one or multiple roles to an organization user.
 * Enforces role scope constraints, organization tenant isolation,
 * duplicate prevention, and atomic transactional execution.
 */
export async function assignRolesToUser(
  organizationId: string,
  assignedById: string,
  params: AssignRolesParams,
): Promise<{ count: number }> {
  const { userId, assignments } = params;

  if (!assignments || assignments.length === 0) {
    throw new Error("At least one role assignment must be provided.");
  }

  // Prevent duplicate role & scope targets within the same submission
  const seenTargets = new Set<string>();
  for (const a of assignments) {
    const deptKey = a.scope === "DEPARTMENT" ? (a.departmentId ?? "null") : "null";
    const key = `${a.roleId}:${deptKey}`;
    if (seenTargets.has(key)) {
      throw new Error(
        "Duplicate role and scope assignment detected in the submission.",
      );
    }
    seenTargets.add(key);
  }

  return prisma.$transaction(async (tx) => {
    // 1. Verify target user
    const targetUser = await tx.user.findFirst({
      where: {
        id: userId,
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
        role: true,
      },
    });

    if (!targetUser) {
      throw new Error("Target user not found or does not belong to your organization.");
    }

    if (targetUser.role === "SYSTEM_ADMINISTRATOR") {
      throw new ForbiddenError(
        "Platform System Administrators cannot be assigned organization roles.",
      );
    }

    if (targetUser.status === "SUSPENDED") {
      throw new Error("Cannot assign roles to a suspended user account.");
    }

    // Determine initial status based on user status
    // Active users get ACTIVE assignments; inactive/unverified users get PENDING_VERIFICATION
    const targetAssignmentStatus: RoleAssignmentStatus =
      targetUser.status === "ACTIVE" ? "ACTIVE" : "PENDING_VERIFICATION";

    let assignedCount = 0;

    for (const item of assignments) {
      const { roleId, scope, departmentId: requestedDeptId } = item;

      // 2. Verify Role
      const role = await tx.organizationRole.findFirst({
        where: {
          id: roleId,
          organizationId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          scopeAllowed: true,
        },
      });

      if (!role) {
        throw new Error(
          `Role "${roleId}" was not found or does not belong to your organization.`,
        );
      }

      if (role.status !== "ACTIVE") {
        throw new Error(
          `Role "${role.name}" is currently inactive and cannot be assigned.`,
        );
      }

      // 3. Validate Scope
      let resolvedDeptId: string | null = null;

      if (role.scopeAllowed === "ORGANIZATION_ONLY") {
        if (scope === "DEPARTMENT" || requestedDeptId) {
          throw new Error(
            `Role "${role.name}" is organization-only and cannot be assigned to a department.`,
          );
        }
        resolvedDeptId = null;
      } else if (role.scopeAllowed === "DEPARTMENT_ONLY") {
        if (scope !== "DEPARTMENT" || !requestedDeptId) {
          throw new Error(
            `Role "${role.name}" requires a specific department scope.`,
          );
        }
        resolvedDeptId = requestedDeptId;
      } else {
        // ORGANIZATION_OR_DEPARTMENT
        if (scope === "DEPARTMENT") {
          if (!requestedDeptId) {
            throw new Error(
              `Department scope selected for "${role.name}" requires selecting a valid department.`,
            );
          }
          resolvedDeptId = requestedDeptId;
        } else {
          resolvedDeptId = null;
        }
      }

      // Built-in department-user role specifically requires department scope
      if (role.slug === "department-user" && resolvedDeptId === null) {
        throw new Error(
          'The built-in "Department User" role requires a specific department scope.',
        );
      }

      // 4. Validate Department if department scope is selected
      if (resolvedDeptId !== null) {
        const dept = await tx.department.findFirst({
          where: {
            id: resolvedDeptId,
            organizationId,
            deletedAt: null,
          },
          select: {
            id: true,
            status: true,
          },
        });

        if (!dept) {
          throw new Error(
            `The selected department was not found or does not belong to your organization.`,
          );
        }

        if (dept.status !== "ACTIVE") {
          throw new Error(
            `The selected department is inactive and cannot be assigned roles.`,
          );
        }
      }

      // 5. Check Driver Role Profile Precondition if assigning Driver role actively
      if (role.slug === "driver" && targetAssignmentStatus === "ACTIVE") {
        const driverProfile = await tx.driver.findFirst({
          where: {
            userId: targetUser.id,
            organizationId,
            deletedAt: null,
          },
          select: { id: true, status: true },
        });

        if (!driverProfile) {
          throw new Error(
            `Active Driver role assignment requires an active driver profile linked to this user.`,
          );
        }
      }

      // 6. Check for existing assignments for this (user, role, department)
      const existing = await tx.userRoleAssignment.findFirst({
        where: {
          organizationId,
          userId: targetUser.id,
          roleId: role.id,
          departmentId: resolvedDeptId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (existing) {
        if (existing.status === "ACTIVE") {
          throw new Error(
            `The user already has an active assignment for role "${role.name}" with the selected scope.`,
          );
        }

        if (existing.status === "PENDING_VERIFICATION") {
          if (targetAssignmentStatus === "ACTIVE") {
            // Activate the pending assignment
            await tx.userRoleAssignment.update({
              where: { id: existing.id },
              data: {
                status: "ACTIVE",
                assignedById,
                assignedAt: new Date(),
                revokedById: null,
                revokedAt: null,
                revocationReason: null,
              },
            });
            assignedCount++;
            continue;
          } else {
            throw new Error(
              `The user already has a pending verification assignment for role "${role.name}".`,
            );
          }
        }

        if (existing.status === "INACTIVE") {
          // Reactivate the inactive assignment
          await tx.userRoleAssignment.update({
            where: { id: existing.id },
            data: {
              status: targetAssignmentStatus,
              assignedById,
              assignedAt: new Date(),
              revokedById: null,
              revokedAt: null,
              revocationReason: null,
            },
          });
          assignedCount++;
          continue;
        }

        // If existing is REVOKED, terminal state protection prevents updating it.
        // We fall through and create a brand new assignment record.
      }

      // 7. Create new assignment
      await tx.userRoleAssignment.create({
        data: {
          organizationId,
          userId: targetUser.id,
          roleId: role.id,
          departmentId: resolvedDeptId,
          status: targetAssignmentStatus,
          assignedById,
        },
      });

      assignedCount++;
    }

    return { count: assignedCount };
  });
}

// ============================================================
// ASSIGNMENT LIFECYCLE OPERATIONS
// ============================================================

/**
 * Activates an eligible inactive or pending role assignment.
 * Enforces entity preconditions and prevents reactivation of revoked assignments.
 */
export async function activateAssignment(
  organizationId: string,
  adminUserId: string,
  assignmentId: string,
): Promise<UserRoleAssignmentItem> {
  return prisma.$transaction(async (tx) => {
    const assignment = await tx.userRoleAssignment.findFirst({
      where: {
        id: assignmentId,
        organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            status: true,
            deletedAt: true,
            role: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            slug: true,
            roleType: true,
            scopeAllowed: true,
            status: true,
            deletedAt: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            status: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!assignment) {
      throw new Error(
        "Assignment not found or does not belong to your organization.",
      );
    }

    // Terminal state protection: REVOKED is permanent
    if (assignment.status === "REVOKED") {
      throw new Error(
        "Cannot reactivate or modify the status of a permanently revoked role assignment.",
      );
    }

    if (assignment.status === "ACTIVE") {
      // Already active, no update needed
      return formatAssignmentItem(assignment);
    }

    // Precondition 1: Target user must be active
    if (
      assignment.user.deletedAt !== null ||
      assignment.user.status !== "ACTIVE"
    ) {
      throw new Error(
        "Cannot activate role assignment for an inactive or deleted user.",
      );
    }

    // Precondition 2: Role must be active
    if (
      assignment.role.deletedAt !== null ||
      assignment.role.status !== "ACTIVE"
    ) {
      throw new Error(
        `Cannot activate assignment: role "${assignment.role.name}" is inactive or deleted.`,
      );
    }

    // Precondition 3: Department must be active if department-scoped
    if (assignment.departmentId !== null) {
      if (
        !assignment.department ||
        assignment.department.deletedAt !== null ||
        assignment.department.status !== "ACTIVE"
      ) {
        throw new Error(
          "Cannot activate role assignment for an inactive or deleted department.",
        );
      }
    }

    // Precondition 4: Driver profile check
    if (assignment.role.slug === "driver") {
      const driver = await tx.driver.findFirst({
        where: {
          userId: assignment.userId,
          organizationId,
          deletedAt: null,
        },
        select: { id: true, status: true },
      });

      if (!driver) {
        throw new Error(
          "Active Driver role assignment requires an active driver profile linked to the user.",
        );
      }
    }

    // Precondition 5: Avoid conflicting active assignment
    const conflict = await tx.userRoleAssignment.findFirst({
      where: {
        organizationId,
        userId: assignment.userId,
        roleId: assignment.roleId,
        departmentId: assignment.departmentId,
        status: "ACTIVE",
        id: { not: assignmentId },
      },
      select: { id: true },
    });

    if (conflict) {
      throw new Error(
        "The user already has an active assignment for this role and scope.",
      );
    }

    const updated = await tx.userRoleAssignment.update({
      where: { id: assignmentId },
      data: {
        status: "ACTIVE",
        assignedById: adminUserId,
        assignedAt: new Date(),
        revokedById: null,
        revokedAt: null,
        revocationReason: null,
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            slug: true,
            roleType: true,
            scopeAllowed: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
          },
        },
        revokedBy: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return formatAssignmentItem(updated);
  });
}

/**
 * Deactivates an active role assignment.
 * Immediately suspends permissions granted by this assignment.
 */
export async function deactivateAssignment(
  organizationId: string,
  _adminUserId: string,
  assignmentId: string,
): Promise<UserRoleAssignmentItem> {
  return prisma.$transaction(async (tx) => {
    const assignment = await tx.userRoleAssignment.findFirst({
      where: {
        id: assignmentId,
        organizationId,
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            slug: true,
            roleType: true,
            scopeAllowed: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
          },
        },
        revokedBy: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!assignment) {
      throw new Error(
        "Assignment not found or does not belong to your organization.",
      );
    }

    if (assignment.status === "REVOKED") {
      throw new Error(
        "Cannot reactivate or modify the status of a permanently revoked role assignment.",
      );
    }

    if (assignment.status === "INACTIVE") {
      return formatAssignmentItem(assignment);
    }

    // Setting INACTIVE: revocation fields must be null according to DB check constraint
    const updated = await tx.userRoleAssignment.update({
      where: { id: assignmentId },
      data: {
        status: "INACTIVE",
        revokedById: null,
        revokedAt: null,
        revocationReason: null,
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            slug: true,
            roleType: true,
            scopeAllowed: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
          },
        },
        revokedBy: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return formatAssignmentItem(updated);
  });
}

/**
 * Permanently revokes a role assignment with an audit reason.
 * REVOKED is a terminal state that cannot be reactivated.
 */
export async function revokeAssignment(
  organizationId: string,
  adminUserId: string,
  assignmentId: string,
  reason: string,
): Promise<UserRoleAssignmentItem> {
  const trimmedReason = reason?.trim();

  if (!trimmedReason || trimmedReason.length < 3) {
    throw new Error(
      "A revocation reason of at least 3 characters is required to revoke an assignment.",
    );
  }

  if (trimmedReason.length > 1000) {
    throw new Error(
      "Revocation reason must be 1,000 characters or fewer.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const assignment = await tx.userRoleAssignment.findFirst({
      where: {
        id: assignmentId,
        organizationId,
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            slug: true,
            roleType: true,
            scopeAllowed: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
          },
        },
        revokedBy: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!assignment) {
      throw new Error(
        "Assignment not found or does not belong to your organization.",
      );
    }

    if (assignment.status === "REVOKED") {
      throw new Error("This role assignment has already been permanently revoked.");
    }

    const updated = await tx.userRoleAssignment.update({
      where: { id: assignmentId },
      data: {
        status: "REVOKED",
        revokedById: adminUserId,
        revokedAt: new Date(),
        revocationReason: trimmedReason,
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            slug: true,
            roleType: true,
            scopeAllowed: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
          },
        },
        revokedBy: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return formatAssignmentItem(updated);
  });
}

// Helper to format UserRoleAssignment records consistently
function formatAssignmentItem(a: {
  id: string;
  roleId: string;
  departmentId: string | null;
  status: RoleAssignmentStatus;
  assignedAt: Date;
  assignedById: string | null;
  revokedAt: Date | null;
  revokedById: string | null;
  revocationReason: string | null;
  role: {
    id: string;
    name: string;
    slug: string;
    roleType: RoleType;
    scopeAllowed: RoleScopeAllowed;
  };
  department?: {
    id: string;
    name: string;
  } | null;
  assignedBy?: {
    id: string;
    firstName: string | null;
    middleName?: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
  revokedBy?: {
    id: string;
    firstName: string | null;
    middleName?: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
}): UserRoleAssignmentItem {
  return {
    id: a.id,
    roleId: a.role.id,
    roleName: a.role.name,
    roleSlug: a.role.slug,
    roleType: a.role.roleType,
    scopeAllowed: a.role.scopeAllowed,
    departmentId: a.departmentId,
    departmentName: a.department?.name ?? null,
    status: a.status,
    assignedAt: a.assignedAt,
    assignedById: a.assignedById,
    assignedByName: a.assignedBy
      ? [a.assignedBy.firstName, a.assignedBy.lastName]
          .filter(Boolean)
          .join(" ") || a.assignedBy.email
      : null,
    assignedByEmail: a.assignedBy?.email ?? null,
    revokedAt: a.revokedAt,
    revokedById: a.revokedById,
    revokedByName: a.revokedBy
      ? [a.revokedBy.firstName, a.revokedBy.lastName]
          .filter(Boolean)
          .join(" ") || a.revokedBy.email
      : null,
    revokedByEmail: a.revokedBy?.email ?? null,
    revocationReason: a.revocationReason,
  };
}
