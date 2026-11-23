import "server-only";

import {
  Prisma,
  RoleScopeAllowed,
  RoleStatus,
  RoleType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  BUILT_IN_ROLES,
  isPlatformOnlyPermission,
  PERMISSIONS,
} from "./permissions";
import { ForbiddenError } from "./types";

/**
 * Built-in role names matching the 6 baseline organization roles.
 */
export const BUILT_IN_ROLE_NAMES = [
  "Organization Administrator",
  "Vice Organization Administrator",
  "Transport Manager",
  "Vice Transport Manager",
  "Department User",
  "Driver",
] as const;

export const BUILT_IN_ROLE_SLUGS: readonly string[] =
  Object.values(BUILT_IN_ROLES);

/**
 * Checks whether a given slug belongs to a built-in role.
 */
export function isBuiltInRoleSlug(slug: string): boolean {
  return BUILT_IN_ROLE_SLUGS.includes(slug.toLowerCase().trim());
}

/**
 * Checks whether a given role name matches a built-in role name (case-insensitive).
 */
export function isBuiltInRoleName(name: string): boolean {
  const normalized = name.toLowerCase().trim();
  return BUILT_IN_ROLE_NAMES.some(
    (builtinName) => builtinName.toLowerCase() === normalized,
  );
}

/**
 * Converts a role name into a clean, URL-safe slug.
 */
export function generateRoleSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return base || "custom-role";
}

/**
 * Ensures slug uniqueness within the target organization among non-deleted roles.
 */
async function resolveUniqueRoleSlug(
  tx: Prisma.TransactionClient,
  organizationId: string,
  name: string,
  excludeRoleId?: string,
): Promise<string> {
  const baseSlug = generateRoleSlug(name);
  let candidate = baseSlug;
  let counter = 1;

  while (true) {
    // If candidate collides with a built-in role slug or existing slug, keep iterating
    const isBuiltin = isBuiltInRoleSlug(candidate);
    const existing = await tx.organizationRole.findFirst({
      where: {
        organizationId,
        slug: candidate,
        deletedAt: null,
        ...(excludeRoleId ? { id: { not: excludeRoleId } } : {}),
      },
      select: { id: true },
    });

    if (!existing && !isBuiltin) {
      return candidate;
    }

    candidate = `${baseSlug.slice(0, 70)}-${counter}`;
    counter++;
  }
}

export interface RoleListingItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  roleType: RoleType;
  status: RoleStatus;
  scopeAllowed: RoleScopeAllowed;
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
  permissionCount: number;
  assignedUsersCount: number;
}

export interface RoleListingFilters {
  query?: string;
  typeFilter?: "ALL" | RoleType;
  statusFilter?: "ALL" | RoleStatus;
  sort?: "name" | "users" | "permissions" | "newest";
}

/**
 * Lists all organization roles for the authenticated organization with permission and user counts.
 */
export async function getOrganizationRoles(
  organizationId: string,
  filters?: RoleListingFilters,
): Promise<RoleListingItem[]> {
  const query = filters?.query?.trim();
  const typeFilter =
    filters?.typeFilter && filters.typeFilter !== "ALL"
      ? filters.typeFilter
      : undefined;
  const statusFilter =
    filters?.statusFilter && filters.statusFilter !== "ALL"
      ? filters.statusFilter
      : undefined;

  const whereClause: Prisma.OrganizationRoleWhereInput = {
    organizationId,
    deletedAt: null,
    ...(typeFilter ? { roleType: typeFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
            { slug: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const roles = await prisma.organizationRole.findMany({
    where: whereClause,
    orderBy: [{ roleType: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      roleType: true,
      status: true,
      scopeAllowed: true,
      isSystemRole: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          rolePermissions: true,
          userAssignments: {
            where: {
              status: "ACTIVE",
            },
          },
        },
      },
    },
  });

  const items: RoleListingItem[] = roles.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    roleType: r.roleType,
    status: r.status,
    scopeAllowed: r.scopeAllowed,
    isSystemRole: r.isSystemRole,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    permissionCount: r._count.rolePermissions,
    assignedUsersCount: r._count.userAssignments,
  }));

  // Apply custom sorting if requested
  if (filters?.sort === "users") {
    items.sort((a, b) => b.assignedUsersCount - a.assignedUsersCount);
  } else if (filters?.sort === "permissions") {
    items.sort((a, b) => b.permissionCount - a.permissionCount);
  } else if (filters?.sort === "newest") {
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  return items;
}

export interface CatalogPermissionItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
}

export interface PermissionGroup {
  category: string;
  permissions: CatalogPermissionItem[];
}

/**
 * Retrieves the application permission catalog, excluding platform-only permissions,
 * grouped by functional category.
 */
export async function getGroupedPermissionCatalog(): Promise<
  PermissionGroup[]
> {
  const permissions = await prisma.permission.findMany({
    where: {
      isPlatformOnly: false,
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      category: true,
    },
  });

  // Group by category in a stable order
  const groupMap = new Map<string, CatalogPermissionItem[]>();

  for (const perm of permissions) {
    if (isPlatformOnlyPermission(perm.code)) {
      continue;
    }
    const cat = perm.category || "General";
    if (!groupMap.has(cat)) {
      groupMap.set(cat, []);
    }
    groupMap.get(cat)!.push(perm);
  }

  const result: PermissionGroup[] = [];
  for (const [category, perms] of groupMap.entries()) {
    result.push({
      category,
      permissions: perms,
    });
  }

  return result;
}

export interface RoleDetailView {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  roleType: RoleType;
  status: RoleStatus;
  scopeAllowed: RoleScopeAllowed;
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
  assignedUsersCount: number;
  permissions: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    category: string;
  }[];
  groupedPermissions: PermissionGroup[];
}

/**
 * Retrieves detailed role information including granted permissions grouped by functional module.
 */
export async function getOrganizationRoleDetails(
  organizationId: string,
  roleId: string,
): Promise<RoleDetailView | null> {
  const role = await prisma.organizationRole.findFirst({
    where: {
      id: roleId,
      organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      slug: true,
      description: true,
      roleType: true,
      status: true,
      scopeAllowed: true,
      isSystemRole: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      rolePermissions: {
        select: {
          permission: {
            select: {
              id: true,
              code: true,
              name: true,
              description: true,
              category: true,
              isPlatformOnly: true,
            },
          },
        },
      },
      _count: {
        select: {
          userAssignments: {
            where: {
              status: "ACTIVE",
            },
          },
        },
      },
    },
  });

  if (!role) {
    return null;
  }

  const validPermissions = role.rolePermissions
    .map((rp) => rp.permission)
    .filter((p): p is NonNullable<typeof p> => p !== null && !p.isPlatformOnly)
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      category: p.category,
    }));

  // Group permissions by category
  const groupMap = new Map<string, CatalogPermissionItem[]>();
  for (const perm of validPermissions) {
    const cat = perm.category || "General";
    if (!groupMap.has(cat)) {
      groupMap.set(cat, []);
    }
    groupMap.get(cat)!.push(perm);
  }

  const groupedPermissions: PermissionGroup[] = [];
  for (const [category, perms] of groupMap.entries()) {
    groupedPermissions.push({
      category,
      permissions: perms,
    });
  }

  return {
    id: role.id,
    organizationId: role.organizationId,
    name: role.name,
    slug: role.slug,
    description: role.description,
    roleType: role.roleType,
    status: role.status,
    scopeAllowed: role.scopeAllowed,
    isSystemRole: role.isSystemRole,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
    createdBy: role.createdBy,
    assignedUsersCount: role._count.userAssignments,
    permissions: validPermissions,
    groupedPermissions,
  };
}

export interface CreateCustomRoleInput {
  name: string;
  description?: string | null;
  permissionCodes: string[];
  scopeAllowed?: RoleScopeAllowed;
}

/**
 * Validates and atomically creates a new custom organization role and its RolePermission records.
 */
export async function createCustomRole(
  organizationId: string,
  createdById: string | null,
  input: CreateCustomRoleInput,
) {
  const trimmedName = input.name?.trim() ?? "";
  const trimmedDescription = input.description?.trim() || null;
  const permissionCodes = Array.from(new Set(input.permissionCodes ?? []));

  // 1. Validate role name
  if (!trimmedName) {
    throw new Error("Role name is required.");
  }
  if (trimmedName.length > 150) {
    throw new Error("Role name must be 150 characters or fewer.");
  }

  // 2. Validate description
  if (trimmedDescription && trimmedDescription.length > 1000) {
    throw new Error("Description must be 1,000 characters or fewer.");
  }

  // 3. Reject built-in role names
  if (isBuiltInRoleName(trimmedName)) {
    throw new Error(
      "That role name is reserved for system built-in roles. Choose a different name.",
    );
  }

  // 4. Reject platform-only permissions
  for (const code of permissionCodes) {
    if (isPlatformOnlyPermission(code)) {
      throw new ForbiddenError(
        `Permission "${code}" is a platform-only permission and cannot be assigned to organization roles.`,
      );
    }
  }

  // 5. Validate permission codes against official catalog
  const catalogPermissions = await prisma.permission.findMany({
    where: {
      code: { in: permissionCodes },
      isPlatformOnly: false,
    },
    select: {
      id: true,
      code: true,
    },
  });

  if (catalogPermissions.length !== permissionCodes.length) {
    const foundCodes = new Set(catalogPermissions.map((p) => p.code));
    const missing = permissionCodes.filter((c) => !foundCodes.has(c));
    throw new Error(
      `Unknown or invalid permission codes: ${missing.join(", ")}`,
    );
  }

  // 6. Execute atomic creation in database transaction
  return prisma.$transaction(async (tx) => {
    // Check for case-insensitive duplicate role name within same organization
    const existingName = await tx.organizationRole.findFirst({
      where: {
        organizationId,
        name: {
          equals: trimmedName,
          mode: "insensitive",
        },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existingName) {
      throw new Error(
        "A role with that name already exists in your organization.",
      );
    }

    const uniqueSlug = await resolveUniqueRoleSlug(
      tx,
      organizationId,
      trimmedName,
    );

    const role = await tx.organizationRole.create({
      data: {
        organizationId,
        name: trimmedName,
        slug: uniqueSlug,
        description: trimmedDescription,
        roleType: RoleType.CUSTOM,
        status: RoleStatus.ACTIVE,
        scopeAllowed: input.scopeAllowed ?? RoleScopeAllowed.ORGANIZATION_ONLY,
        isSystemRole: false,
        createdById: createdById ?? undefined,
      },
    });

    if (catalogPermissions.length > 0) {
      await tx.rolePermission.createMany({
        data: catalogPermissions.map((perm) => ({
          organizationId,
          roleId: role.id,
          permissionId: perm.id,
          isBaseline: false,
        })),
      });
    }

    return role;
  });
}

export interface UpdateCustomRoleInput {
  name: string;
  description?: string | null;
  permissionCodes: string[];
}

/**
 * Validates and atomically updates an existing custom role's metadata and permissions.
 *
 * Requirements:
 * - Reject modification of built-in roles.
 * - Verify role belongs to organization.
 * - Update existing role without deleting and recreating it.
 * - Keep existing user assignments intact.
 */
export async function updateCustomRole(
  organizationId: string,
  roleId: string,
  input: UpdateCustomRoleInput,
) {
  const trimmedName = input.name?.trim() ?? "";
  const trimmedDescription = input.description?.trim() || null;
  const permissionCodes = Array.from(new Set(input.permissionCodes ?? []));

  // 1. Validate role name
  if (!trimmedName) {
    throw new Error("Role name is required.");
  }
  if (trimmedName.length > 150) {
    throw new Error("Role name must be 150 characters or fewer.");
  }

  // 2. Validate description
  if (trimmedDescription && trimmedDescription.length > 1000) {
    throw new Error("Description must be 1,000 characters or fewer.");
  }

  // 3. Reject built-in role names
  if (isBuiltInRoleName(trimmedName)) {
    throw new Error(
      "That role name is reserved for system built-in roles. Choose a different name.",
    );
  }

  // 4. Reject platform-only permissions
  for (const code of permissionCodes) {
    if (isPlatformOnlyPermission(code)) {
      throw new ForbiddenError(
        `Permission "${code}" is a platform-only permission and cannot be assigned to organization roles.`,
      );
    }
  }

  // 5. Validate permission codes against official catalog
  const catalogPermissions = await prisma.permission.findMany({
    where: {
      code: { in: permissionCodes },
      isPlatformOnly: false,
    },
    select: {
      id: true,
      code: true,
    },
  });

  if (catalogPermissions.length !== permissionCodes.length) {
    const foundCodes = new Set(catalogPermissions.map((p) => p.code));
    const missing = permissionCodes.filter((c) => !foundCodes.has(c));
    throw new Error(
      `Unknown or invalid permission codes: ${missing.join(", ")}`,
    );
  }

  const targetPermissionIds = new Set(catalogPermissions.map((p) => p.id));

  // 6. Execute atomic update in database transaction
  return prisma.$transaction(async (tx) => {
    // Verify target role exists, belongs to organization, and is CUSTOM
    const existingRole = await tx.organizationRole.findFirst({
      where: {
        id: roleId,
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        roleType: true,
        isSystemRole: true,
        name: true,
      },
    });

    if (!existingRole) {
      throw new Error("Role not found.");
    }

    if (
      existingRole.roleType === RoleType.BUILT_IN ||
      existingRole.isSystemRole
    ) {
      throw new ForbiddenError(
        "Built-in roles are protected system roles and cannot be modified.",
      );
    }

    // Check duplicate name within organization (excluding current role)
    const duplicate = await tx.organizationRole.findFirst({
      where: {
        organizationId,
        id: { not: roleId },
        name: {
          equals: trimmedName,
          mode: "insensitive",
        },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new Error(
        "Another role with that name already exists in your organization.",
      );
    }

    // Update role metadata
    const updatedRole = await tx.organizationRole.update({
      where: { id: roleId },
      data: {
        name: trimmedName,
        description: trimmedDescription,
        updatedAt: new Date(),
      },
    });

    // Sync RolePermission records
    const currentRolePermissions = await tx.rolePermission.findMany({
      where: { roleId },
      select: { id: true, permissionId: true },
    });

    const currentPermissionIds = new Set(
      currentRolePermissions.map((rp) => rp.permissionId),
    );

    const idsToRemove = currentRolePermissions
      .filter((rp) => !targetPermissionIds.has(rp.permissionId))
      .map((rp) => rp.permissionId);

    const idsToAdd = Array.from(targetPermissionIds).filter(
      (id) => !currentPermissionIds.has(id),
    );

    if (idsToRemove.length > 0) {
      await tx.rolePermission.deleteMany({
        where: {
          roleId,
          permissionId: { in: idsToRemove },
        },
      });
    }

    if (idsToAdd.length > 0) {
      await tx.rolePermission.createMany({
        data: idsToAdd.map((permissionId) => ({
          organizationId,
          roleId,
          permissionId,
          isBaseline: false,
        })),
      });
    }

    return updatedRole;
  });
}

/**
 * Activates or deactivates a custom role.
 *
 * Requirements:
 * - Built-in roles cannot be deactivated.
 * - Deactivated roles must not grant permissions.
 * - Deactivation preserves user assignments and historical records.
 * - Reactivation must not reactivate inactive or revoked assignments.
 */
export async function setCustomRoleStatus(
  organizationId: string,
  roleId: string,
  newStatus: RoleStatus,
) {
  const existingRole = await prisma.organizationRole.findFirst({
    where: {
      id: roleId,
      organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      roleType: true,
      isSystemRole: true,
      status: true,
      name: true,
    },
  });

  if (!existingRole) {
    throw new Error("Role not found.");
  }

  if (
    existingRole.roleType === RoleType.BUILT_IN ||
    existingRole.isSystemRole
  ) {
    throw new ForbiddenError(
      "Built-in roles are protected system roles and cannot be deactivated or have their status changed.",
    );
  }

  // Count active assigned users
  const activeAssignedCount = await prisma.userRoleAssignment.count({
    where: {
      organizationId,
      roleId,
      status: "ACTIVE",
    },
  });

  if (existingRole.status === newStatus) {
    return {
      role: existingRole,
      activeAssignedCount,
      statusChanged: false,
    };
  }

  const updatedRole = await prisma.organizationRole.update({
    where: { id: roleId },
    data: {
      status: newStatus,
      updatedAt: new Date(),
    },
  });

  return {
    role: updatedRole,
    activeAssignedCount,
    statusChanged: true,
  };
}

/**
 * Returns the count of active users currently assigned to a role.
 */
export async function getRoleAssignedUsersCount(
  organizationId: string,
  roleId: string,
): Promise<number> {
  return prisma.userRoleAssignment.count({
    where: {
      organizationId,
      roleId,
      status: "ACTIVE",
    },
  });
}
