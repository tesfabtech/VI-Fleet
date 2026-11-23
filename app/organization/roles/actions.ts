"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RoleStatus } from "@prisma/client";
import {
  createCustomRole,
  ForbiddenError,
  PERMISSIONS,
  requirePermission,
  setCustomRoleStatus,
  UnauthorizedError,
  updateCustomRole,
} from "@/lib/rbac";

const ROLES_PATH = "/organization/roles";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectWithError(basePath: string, error: string): never {
  redirect(`${basePath}?error=${encodeURIComponent(error)}`);
}

function redirectWithSuccess(basePath: string, success: string): never {
  redirect(`${basePath}?success=${encodeURIComponent(success)}`);
}

function revalidateRoleViews(roleId?: string) {
  revalidatePath(ROLES_PATH);
  if (roleId) {
    revalidatePath(`${ROLES_PATH}/${roleId}`);
    revalidatePath(`${ROLES_PATH}/${roleId}/edit`);
  }
  revalidatePath("/organization");
}

/**
 * Creates a new custom organization role with associated permissions.
 */
export async function createRole(formData: FormData) {
  let organizationId: string;
  let userId: string;

  try {
    const authContext = await requirePermission(PERMISSIONS.ORG_ROLES_MANAGE);
    if (!authContext.organizationId) {
      redirectWithError(ROLES_PATH, "organization-inactive");
    }
    organizationId = authContext.organizationId;
    userId = authContext.userId;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      redirect("/login");
    }
    if (err instanceof ForbiddenError) {
      redirectWithError(ROLES_PATH, "unauthorized");
    }
    throw err;
  }

  const name = readText(formData, "name");
  const description = readText(formData, "description");
  const rawPermissions = formData.getAll("permissions");
  const permissionCodes = rawPermissions
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => p.trim());

  if (!name) {
    redirectWithError(`${ROLES_PATH}/new`, "name-required");
  }

  if (name.length > 150) {
    redirectWithError(`${ROLES_PATH}/new`, "name-too-long");
  }

  if (description.length > 1000) {
    redirectWithError(`${ROLES_PATH}/new`, "description-too-long");
  }

  try {
    const newRole = await createCustomRole(organizationId, userId, {
      name,
      description: description || null,
      permissionCodes,
    });

    revalidateRoleViews(newRole.id);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      redirectWithError(`${ROLES_PATH}/new`, "unauthorized");
    }
    const message = err instanceof Error ? err.message : "";
    if (message.includes("already exists")) {
      redirectWithError(`${ROLES_PATH}/new`, "duplicate-name");
    }
    if (message.includes("reserved for system built-in roles")) {
      redirectWithError(`${ROLES_PATH}/new`, "reserved-name");
    }
    if (message.includes("platform-only permission")) {
      redirectWithError(`${ROLES_PATH}/new`, "platform-permission-rejected");
    }
    if (message.includes("permission codes")) {
      redirectWithError(`${ROLES_PATH}/new`, "invalid-permissions");
    }
    redirectWithError(`${ROLES_PATH}/new`, "creation-failed");
  }

  redirectWithSuccess(ROLES_PATH, "created");
}

/**
 * Updates an existing custom organization role's metadata and permissions.
 */
export async function updateRole(formData: FormData) {
  let organizationId: string;

  try {
    const authContext = await requirePermission(PERMISSIONS.ORG_ROLES_MANAGE);
    if (!authContext.organizationId) {
      redirectWithError(ROLES_PATH, "organization-inactive");
    }
    organizationId = authContext.organizationId;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      redirect("/login");
    }
    if (err instanceof ForbiddenError) {
      redirectWithError(ROLES_PATH, "unauthorized");
    }
    throw err;
  }

  const roleId = readText(formData, "roleId");
  if (!roleId || !UUID_PATTERN.test(roleId)) {
    redirectWithError(ROLES_PATH, "role-not-found");
  }

  const editPath = `${ROLES_PATH}/${roleId}/edit`;
  const name = readText(formData, "name");
  const description = readText(formData, "description");
  const rawPermissions = formData.getAll("permissions");
  const permissionCodes = rawPermissions
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => p.trim());

  if (!name) {
    redirectWithError(editPath, "name-required");
  }

  if (name.length > 150) {
    redirectWithError(editPath, "name-too-long");
  }

  if (description.length > 1000) {
    redirectWithError(editPath, "description-too-long");
  }

  try {
    await updateCustomRole(organizationId, roleId, {
      name,
      description: description || null,
      permissionCodes,
    });

    revalidateRoleViews(roleId);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      const msg = err.message || "";
      if (msg.includes("Built-in roles")) {
        redirectWithError(`${ROLES_PATH}/${roleId}`, "builtin-protected");
      }
      redirectWithError(editPath, "unauthorized");
    }
    const message = err instanceof Error ? err.message : "";
    if (message.includes("already exists")) {
      redirectWithError(editPath, "duplicate-name");
    }
    if (message.includes("reserved for system built-in roles")) {
      redirectWithError(editPath, "reserved-name");
    }
    if (message.includes("platform-only permission")) {
      redirectWithError(editPath, "platform-permission-rejected");
    }
    if (message.includes("permission codes")) {
      redirectWithError(editPath, "invalid-permissions");
    }
    if (message.includes("Role not found")) {
      redirectWithError(ROLES_PATH, "role-not-found");
    }
    redirectWithError(editPath, "update-failed");
  }

  redirectWithSuccess(`${ROLES_PATH}/${roleId}`, "updated");
}

/**
 * Activates or deactivates a custom role.
 */
export async function setRoleStatus(formData: FormData) {
  let organizationId: string;

  try {
    const authContext = await requirePermission(PERMISSIONS.ORG_ROLES_MANAGE);
    if (!authContext.organizationId) {
      redirectWithError(ROLES_PATH, "organization-inactive");
    }
    organizationId = authContext.organizationId;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      redirect("/login");
    }
    if (err instanceof ForbiddenError) {
      redirectWithError(ROLES_PATH, "unauthorized");
    }
    throw err;
  }

  const roleId = readText(formData, "roleId");
  const rawStatus = readText(formData, "status");
  const returnTo = readText(formData, "returnTo");
  const fallbackPath = roleId ? `${ROLES_PATH}/${roleId}` : ROLES_PATH;
  const targetPath = returnTo.startsWith(ROLES_PATH) ? returnTo : fallbackPath;

  if (!roleId || !UUID_PATTERN.test(roleId)) {
    redirectWithError(ROLES_PATH, "role-not-found");
  }

  if (rawStatus !== "ACTIVE" && rawStatus !== "INACTIVE") {
    redirectWithError(targetPath, "invalid-status");
  }

  const newStatus = rawStatus as RoleStatus;

  try {
    await setCustomRoleStatus(organizationId, roleId, newStatus);
    revalidateRoleViews(roleId);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      const msg = err.message || "";
      if (msg.includes("Built-in roles")) {
        redirectWithError(targetPath, "builtin-protected");
      }
      redirectWithError(targetPath, "unauthorized");
    }
    const message = err instanceof Error ? err.message : "";
    if (message.includes("not found")) {
      redirectWithError(ROLES_PATH, "role-not-found");
    }
    redirectWithError(targetPath, "status-update-failed");
  }

  const successKey = newStatus === "ACTIVE" ? "reactivated" : "deactivated";
  redirectWithSuccess(targetPath, successKey);
}
