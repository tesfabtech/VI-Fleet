import type { UserRole } from "@prisma/client";
import type {
  BuiltInRoleSlug,
  OrganizationPermissionCode,
  PermissionCode,
  PlatformPermissionCode,
} from "./types";

/**
 * Standard permission codes matching the Issue #42 catalog seed.
 */
export const PERMISSIONS = {
  // Organization Profile & Settings
  ORG_VIEW: "org:view" as OrganizationPermissionCode,
  ORG_UPDATE: "org:update" as OrganizationPermissionCode,

  // Role & Access Management
  ORG_ROLES_MANAGE: "org:roles:manage" as OrganizationPermissionCode,
  ORG_ROLES_ASSIGN: "org:roles:assign" as OrganizationPermissionCode,

  // User & Membership Management
  ORG_USERS_MANAGE: "org:users:manage" as OrganizationPermissionCode,

  // Department Management
  ORG_DEPARTMENTS_MANAGE: "org:departments:manage" as OrganizationPermissionCode,

  // Vehicle & Fleet Management
  VEHICLES_VIEW: "vehicles:view" as OrganizationPermissionCode,
  VEHICLES_CREATE: "vehicles:create" as OrganizationPermissionCode,
  VEHICLES_UPDATE: "vehicles:update" as OrganizationPermissionCode,
  VEHICLES_DELETE: "vehicles:delete" as OrganizationPermissionCode,

  // Driver Management
  DRIVERS_VIEW: "drivers:view" as OrganizationPermissionCode,
  DRIVERS_CREATE: "drivers:create" as OrganizationPermissionCode,
  DRIVERS_UPDATE: "drivers:update" as OrganizationPermissionCode,
  DRIVERS_DELETE: "drivers:delete" as OrganizationPermissionCode,

  // Transportation Requests
  REQUESTS_VIEW: "requests:view" as OrganizationPermissionCode,
  REQUESTS_CREATE: "requests:create" as OrganizationPermissionCode,
  REQUESTS_CANCEL: "requests:cancel" as OrganizationPermissionCode,
  REQUESTS_APPROVE: "requests:approve" as OrganizationPermissionCode,
  REQUESTS_REJECT: "requests:reject" as OrganizationPermissionCode,

  // Trip & Dispatch Management
  TRIPS_VIEW: "trips:view" as OrganizationPermissionCode,
  TRIPS_DISPATCH: "trips:dispatch" as OrganizationPermissionCode,
  TRIPS_CANCEL: "trips:cancel" as OrganizationPermissionCode,

  // Trip Execution & Driving
  TRIPS_EXECUTE: "trips:execute" as OrganizationPermissionCode,

  // Maintenance & Service
  MAINTENANCE_VIEW: "maintenance:view" as OrganizationPermissionCode,
  MAINTENANCE_CREATE: "maintenance:create" as OrganizationPermissionCode,
  MAINTENANCE_UPDATE: "maintenance:update" as OrganizationPermissionCode,
  MAINTENANCE_DELETE: "maintenance:delete" as OrganizationPermissionCode,

  // Fuel & Expenses
  FUEL_MANAGE: "fuel:manage" as OrganizationPermissionCode,

  // Platform Administration (Platform-Only)
  PLATFORM_ORGS_MANAGE: "platform:organizations:manage" as PlatformPermissionCode,
  PLATFORM_USERS_MANAGE: "platform:users:manage" as PlatformPermissionCode,
} as const;

/**
 * Built-in role slugs.
 */
export const BUILT_IN_ROLES = {
  ORG_ADMIN: "org-admin" as BuiltInRoleSlug,
  VICE_ORG_ADMIN: "vice-org-admin" as BuiltInRoleSlug,
  TRANSPORT_MANAGER: "transport-manager" as BuiltInRoleSlug,
  VICE_TRANSPORT_MANAGER: "vice-transport-manager" as BuiltInRoleSlug,
  DEPARTMENT_USER: "department-user" as BuiltInRoleSlug,
  DRIVER: "driver" as BuiltInRoleSlug,
} as const;

/**
 * Mapping from legacy UserRole enum to the corresponding built-in role slug.
 * SYSTEM_ADMINISTRATOR maps to null because platform administrators do not hold organization roles.
 */
export const LEGACY_ROLE_TO_BUILTIN_SLUG: Record<UserRole, BuiltInRoleSlug | null> = {
  ORGANIZATION_ADMINISTRATOR: BUILT_IN_ROLES.ORG_ADMIN,
  VICE_ORGANIZATION_ADMINISTRATOR: BUILT_IN_ROLES.VICE_ORG_ADMIN,
  TRANSPORT_MANAGER: BUILT_IN_ROLES.TRANSPORT_MANAGER,
  VICE_TRANSPORT_MANAGER: BUILT_IN_ROLES.VICE_TRANSPORT_MANAGER,
  DEPARTMENT_USER: BUILT_IN_ROLES.DEPARTMENT_USER,
  DRIVER: BUILT_IN_ROLES.DRIVER,
  SYSTEM_ADMINISTRATOR: null,
};

/**
 * Set of platform-only permission codes.
 * These permissions must never be assigned or granted through organization roles.
 */
export const PLATFORM_ONLY_PERMISSIONS: ReadonlySet<string> = new Set([
  PERMISSIONS.PLATFORM_ORGS_MANAGE,
  PERMISSIONS.PLATFORM_USERS_MANAGE,
]);

/**
 * Checks whether a given permission code is platform-only.
 */
export function isPlatformOnlyPermission(code: string): boolean {
  return PLATFORM_ONLY_PERMISSIONS.has(code);
}
