import type { UserRole } from "@prisma/client";

/**
 * Valid permission codes established in the Issue #42 permission catalog.
 */
export type OrganizationPermissionCode =
  // Organization Profile & Settings
  | "org:view"
  | "org:update"
  // Role & Access Management
  | "org:roles:manage"
  | "org:roles:assign"
  // User & Membership Management
  | "org:users:manage"
  // Department Management
  | "org:departments:manage"
  // Vehicle & Fleet Management
  | "vehicles:view"
  | "vehicles:create"
  | "vehicles:update"
  | "vehicles:delete"
  // Driver Management
  | "drivers:view"
  | "drivers:create"
  | "drivers:update"
  | "drivers:delete"
  // Transportation Requests
  | "requests:view"
  | "requests:create"
  | "requests:cancel"
  | "requests:approve"
  | "requests:reject"
  // Trip & Dispatch Management
  | "trips:view"
  | "trips:dispatch"
  | "trips:cancel"
  // Trip Execution & Driving
  | "trips:execute"
  // Maintenance & Service
  | "maintenance:view"
  | "maintenance:create"
  | "maintenance:update"
  | "maintenance:delete"
  // Fuel & Expenses
  | "fuel:manage";

export type PlatformPermissionCode =
  | "platform:organizations:manage"
  | "platform:users:manage";

export type PermissionCode = OrganizationPermissionCode | PlatformPermissionCode;

/**
 * Built-in role slugs matching the 6 protected organization roles.
 */
export type BuiltInRoleSlug =
  | "org-admin"
  | "vice-org-admin"
  | "transport-manager"
  | "vice-transport-manager"
  | "department-user"
  | "driver";

/**
 * Assignment scope: either organization-wide or constrained to a specific department.
 */
export type AssignmentScope =
  | { type: "ORGANIZATION" }
  | { type: "DEPARTMENT"; departmentId: string };

/**
 * Represents an active, verified role assignment and its granted permissions.
 */
export interface ActiveAssignment {
  id: string;
  roleId: string;
  roleSlug: string;
  roleName: string;
  scope: AssignmentScope;
  permissions: Set<string>;
}

/**
 * Optional resource context used for scope-aware permission checks.
 */
export interface ResourceContext {
  organizationId?: string | null;
  departmentId?: string | null;
  [key: string]: unknown;
}

/**
 * Base authorization error class.
 */
export class AuthorizationError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode = 403, code = "FORBIDDEN") {
    super(message);
    this.name = "AuthorizationError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Thrown when an unauthenticated caller attempts a protected operation.
 */
export class UnauthorizedError extends AuthorizationError {
  constructor(message = "Authentication required. Please sign in.") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

/**
 * Thrown when an authenticated caller lacks necessary permissions or scope.
 */
export class ForbiddenError extends AuthorizationError {
  constructor(message = "You do not have permission to perform this action.") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

/**
 * Resolved server-side authorization context for an authenticated user.
 */
export interface AuthorizationContext {
  readonly userId: string;
  readonly userEmail: string | null;
  readonly userName: string;
  readonly legacyRole: UserRole;
  readonly organizationId: string | null;
  readonly organizationName: string | null;
  readonly departmentId: string | null;
  readonly isSystemAdministrator: boolean;
  readonly assignments: readonly ActiveAssignment[];
  readonly effectivePermissions: ReadonlySet<string>;

  /**
   * Evaluates whether an eligible assignment independently grants the permission within scope.
   */
  hasPermission(
    permissionCode: string,
    resourceContext?: ResourceContext | null,
  ): boolean;

  /**
   * Enforces permission and scope check, throwing ForbiddenError if not satisfied.
   */
  requirePermission(
    permissionCode: string,
    resourceContext?: ResourceContext | null,
  ): void;

  /**
   * Verifies permission, organization ownership, and department scope together on a resource.
   */
  requireResourceAccess<T extends ResourceContext>(
    permissionCode: string,
    resource: T | null | undefined,
  ): T;

  /**
   * Returns "ALL" if the user has an organization-wide assignment granting the permission,
   * an array of authorized department IDs if department-scoped, or an empty array if none.
   */
  getAuthorizedDepartmentIds(permissionCode: string): "ALL" | string[];
}
