import "server-only";

import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type {
  ActiveAssignment,
  AuthorizationContext,
  ResourceContext,
} from "./types";
import {
  ForbiddenError,
  UnauthorizedError,
} from "./types";
import { isPlatformOnlyPermission } from "./permissions";

/**
 * Evaluates whether a single eligible assignment independently grants the permission
 * within the required resource scope.
 *
 * Rules:
 * 1. The assignment must grant the exact permission code.
 * 2. If no resource context is specified, the assignment satisfies the check.
 * 3. If resource specifies organizationId, it must match user's organizationId.
 * 4. If assignment is ORGANIZATION-wide, it covers all resources in the organization.
 * 5. If assignment is DEPARTMENT-scoped:
 *    - Resource MUST belong to the assignment's department.
 *    - Resources with unknown, null, or undefined departmentId are DENIED.
 *    - Resources in another department are DENIED.
 */
export function evaluateAssignmentPermission(
  assignment: ActiveAssignment,
  permissionCode: string,
  resourceContext?: ResourceContext | null,
  userOrganizationId?: string | null,
): boolean {
  // 1. Must grant the permission
  if (!assignment.permissions.has(permissionCode)) {
    return false;
  }

  // 2. If no resource context is supplied, the permission is granted
  if (!resourceContext) {
    return true;
  }

  // 3. Organization tenant isolation check
  if (
    resourceContext.organizationId &&
    userOrganizationId &&
    resourceContext.organizationId !== userOrganizationId
  ) {
    return false;
  }

  // 4. Scope evaluation
  if (assignment.scope.type === "ORGANIZATION") {
    return true;
  }

  if (assignment.scope.type === "DEPARTMENT") {
    const resourceDeptId = resourceContext.departmentId;
    // Department-scoped assignments can authorize ONLY resources belonging to their assigned department.
    // A resource with unknown or unresolvable department ownership must be denied to department-scoped assignments.
    if (!resourceDeptId || typeof resourceDeptId !== "string") {
      return false;
    }

    return resourceDeptId === assignment.scope.departmentId;
  }

  return false;
}

/**
 * Resolves authorization data directly from PostgreSQL for a given userId.
 *
 * Does not trust client-supplied identity, roles, or scopes.
 * Rejects inactive, suspended, or deleted users and organizations.
 * Excludes platform-only permissions from organization roles.
 */
export async function resolveAuthorizationContextForUser(
  userId: string,
): Promise<AuthorizationContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      email: true,
      role: true,
      status: true,
      deletedAt: true,
      organizationId: true,
      departmentId: true,
      organization: {
        select: {
          id: true,
          name: true,
          status: true,
          deletedAt: true,
        },
      },
      roleAssignments: {
        where: {
          status: "ACTIVE",
          role: {
            status: "ACTIVE",
            deletedAt: null,
          },
        },
        select: {
          id: true,
          roleId: true,
          departmentId: true,
          status: true,
          organizationId: true,
          department: {
            select: {
              id: true,
              status: true,
              deletedAt: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
              slug: true,
              roleType: true,
              status: true,
              scopeAllowed: true,
              isSystemRole: true,
              rolePermissions: {
                select: {
                  permission: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      isPlatformOnly: true,
                      category: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user || user.deletedAt !== null || user.status !== "ACTIVE") {
    return null;
  }

  const userName =
    [user.firstName, user.middleName, user.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    user.email ||
    "User";

  // System Administrator separation: System Administrator is outside organization RBAC.
  // They hold no organization role assignments and platform permissions are not granted through organization roles.
  if (user.role === "SYSTEM_ADMINISTRATOR") {
    return createAuthorizationContextObject({
      userId: user.id,
      userEmail: user.email,
      userName,
      legacyRole: user.role,
      organizationId: null,
      organizationName: null,
      departmentId: null,
      isSystemAdministrator: true,
      assignments: [],
      effectivePermissions: new Set(),
    });
  }

  // Organization users must belong to an active organization
  if (
    !user.organizationId ||
    !user.organization ||
    user.organization.deletedAt !== null ||
    user.organization.status !== "ACTIVE"
  ) {
    return null;
  }

  const organizationId = user.organizationId;
  const organizationName = user.organization.name;

  // Process eligible role assignments
  const activeAssignments: ActiveAssignment[] = [];
  const effectivePermissions = new Set<string>();

  for (const assignment of user.roleAssignments) {
    // Validate tenant ownership
    if (assignment.organizationId !== organizationId) {
      continue;
    }

    // If assignment is department-scoped, department must be active and not deleted
    if (assignment.departmentId !== null) {
      if (
        !assignment.department ||
        assignment.department.status !== "ACTIVE" ||
        assignment.department.deletedAt !== null
      ) {
        continue;
      }
    }

    // Collect valid organization permissions (strictly excluding platform-only permissions)
    const assignmentPermissions = new Set<string>();
    for (const rp of assignment.role.rolePermissions) {
      const perm = rp.permission;
      if (perm && !perm.isPlatformOnly && !isPlatformOnlyPermission(perm.code)) {
        assignmentPermissions.add(perm.code);
        effectivePermissions.add(perm.code);
      }
    }

    const scope =
      assignment.departmentId !== null
        ? ({ type: "DEPARTMENT", departmentId: assignment.departmentId } as const)
        : ({ type: "ORGANIZATION" } as const);

    activeAssignments.push({
      id: assignment.id,
      roleId: assignment.role.id,
      roleSlug: assignment.role.slug,
      roleName: assignment.role.name,
      scope,
      permissions: assignmentPermissions,
    });
  }

  return createAuthorizationContextObject({
    userId: user.id,
    userEmail: user.email,
    userName,
    legacyRole: user.role,
    organizationId,
    organizationName,
    departmentId: user.departmentId,
    isSystemAdministrator: false,
    assignments: activeAssignments,
    effectivePermissions,
  });
}

/**
 * Creates the AuthorizationContext instance with methods bound.
 */
function createAuthorizationContextObject(params: {
  userId: string;
  userEmail: string | null;
  userName: string;
  legacyRole: AuthorizationContext["legacyRole"];
  organizationId: string | null;
  organizationName: string | null;
  departmentId: string | null;
  isSystemAdministrator: boolean;
  assignments: ActiveAssignment[];
  effectivePermissions: Set<string>;
}): AuthorizationContext {
  const {
    userId,
    userEmail,
    userName,
    legacyRole,
    organizationId,
    organizationName,
    departmentId,
    isSystemAdministrator,
    assignments,
    effectivePermissions,
  } = params;

  const ctx: AuthorizationContext = {
    userId,
    userEmail,
    userName,
    legacyRole,
    organizationId,
    organizationName,
    departmentId,
    isSystemAdministrator,
    assignments,
    effectivePermissions,

    hasPermission(permissionCode: string, resourceContext?: ResourceContext | null): boolean {
      if (isSystemAdministrator) {
        return false;
      }
      return assignments.some((assignment) =>
        evaluateAssignmentPermission(
          assignment,
          permissionCode,
          resourceContext,
          organizationId,
        ),
      );
    },

    requirePermission(permissionCode: string, resourceContext?: ResourceContext | null): void {
      if (!ctx.hasPermission(permissionCode, resourceContext)) {
        throw new ForbiddenError(
          `Permission denied: Missing required permission "${permissionCode}".`,
        );
      }
    },

    requireResourceAccess<T extends ResourceContext>(
      permissionCode: string,
      resource: T | null | undefined,
    ): T {
      if (!resource) {
        throw new ForbiddenError("Resource not found or access denied.");
      }

      // Check organization isolation without exposing other tenant details
      if (
        resource.organizationId &&
        organizationId &&
        resource.organizationId !== organizationId
      ) {
        throw new ForbiddenError("Access denied.");
      }

      // Extract department ownership: direct or nested
      let resourceDeptId: string | null = null;
      if (typeof resource.departmentId === "string") {
        resourceDeptId = resource.departmentId;
      } else if (
        resource.transportationRequest &&
        typeof (resource.transportationRequest as { departmentId?: string }).departmentId ===
          "string"
      ) {
        resourceDeptId = (resource.transportationRequest as { departmentId: string }).departmentId;
      } else if (
        resource.trip &&
        typeof (resource.trip as { transportationRequest?: { departmentId?: string } })
          ?.transportationRequest?.departmentId === "string"
      ) {
        resourceDeptId = (
          resource.trip as { transportationRequest: { departmentId: string } }
        ).transportationRequest.departmentId;
      }

      if (
        !ctx.hasPermission(permissionCode, {
          organizationId: resource.organizationId ?? organizationId,
          departmentId: resourceDeptId,
        })
      ) {
        throw new ForbiddenError(
          `Access denied: Insufficient scope or permission for this resource.`,
        );
      }

      return resource;
    },

    getAuthorizedDepartmentIds(permissionCode: string): "ALL" | string[] {
      if (isSystemAdministrator) {
        return [];
      }

      const qualifyingAssignments = assignments.filter((a) =>
        a.permissions.has(permissionCode),
      );

      if (qualifyingAssignments.length === 0) {
        return [];
      }

      // If at least one assignment is organization-wide, user has access to all departments
      if (qualifyingAssignments.some((a) => a.scope.type === "ORGANIZATION")) {
        return "ALL";
      }

      // Otherwise, collect unique department IDs from qualifying assignments
      const deptIds = new Set<string>();
      for (const a of qualifyingAssignments) {
        if (a.scope.type === "DEPARTMENT") {
          deptIds.add(a.scope.departmentId);
        }
      }

      return Array.from(deptIds);
    },
  };

  return ctx;
}

/**
 * Resolves the authenticated user's authorization context.
 *
 * Memoized per server operation using React `cache()`.
 * Identity is obtained from the authenticated session, never from client parameters.
 */
export const getAuthorizationContext = cache(
  async (): Promise<AuthorizationContext | null> => {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return null;
    }
    return resolveAuthorizationContextForUser(userId);
  },
);

/**
 * Resolves authorization context or throws UnauthorizedError if unauthenticated.
 */
export async function requireAuthorizationContext(): Promise<AuthorizationContext> {
  const context = await getAuthorizationContext();
  if (!context) {
    throw new UnauthorizedError();
  }
  return context;
}

/**
 * Top-level permission check helper.
 * Returns true if an eligible assignment independently grants the permission within scope.
 */
export async function hasPermission(
  permissionCode: string,
  resourceContext?: ResourceContext | null,
): Promise<boolean> {
  const context = await getAuthorizationContext();
  if (!context) {
    return false;
  }
  return context.hasPermission(permissionCode, resourceContext);
}

/**
 * Top-level authorization guard.
 * Denies by default: throws UnauthorizedError if unauthenticated, ForbiddenError if unauthorized.
 */
export async function requirePermission(
  permissionCode: string,
  resourceContext?: ResourceContext | null,
): Promise<AuthorizationContext> {
  const context = await requireAuthorizationContext();
  context.requirePermission(permissionCode, resourceContext);
  return context;
}

/**
 * Top-level resource authorization guard.
 * Verifies permission, organization ownership, and department scope together.
 */
export async function requireResourceAccess<T extends ResourceContext>(
  permissionCode: string,
  resource: T | null | undefined,
): Promise<T> {
  const context = await requireAuthorizationContext();
  return context.requireResourceAccess(permissionCode, resource);
}

/**
 * System Administrator guard.
 * Verifies that the authenticated user is an active System Administrator.
 */
export async function requireSystemAdministrator(): Promise<AuthorizationContext> {
  const context = await requireAuthorizationContext();
  if (!context.isSystemAdministrator) {
    throw new ForbiddenError("Platform administrator privileges required.");
  }
  return context;
}

/**
 * Builds a Prisma `where` clause fragment that enforces tenant and department isolation
 * at the database query level for a given permission.
 */
export async function createResourceScopeFilter(
  permissionCode: string,
  options?: { departmentField?: string },
): Promise<Record<string, unknown>> {
  const context = await requireAuthorizationContext();

  if (!context.organizationId) {
    throw new ForbiddenError("Operation requires an active organization membership.");
  }

  const deptScope = context.getAuthorizedDepartmentIds(permissionCode);
  const deptField = options?.departmentField ?? "departmentId";

  if (deptScope === "ALL") {
    return {
      organizationId: context.organizationId,
    };
  }

  if (Array.isArray(deptScope) && deptScope.length > 0) {
    return {
      organizationId: context.organizationId,
      [deptField]: { in: deptScope },
    };
  }

  // No qualifying assignments: return impossible condition
  return {
    organizationId: context.organizationId,
    id: "00000000-0000-0000-0000-000000000000",
  };
}
