"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  activateAssignment,
  assignRolesToUser,
  deactivateAssignment,
  ForbiddenError,
  PERMISSIONS,
  requirePermission,
  revokeAssignment,
  RoleAssignmentInput,
  UnauthorizedError,
} from "@/lib/rbac";

const ASSIGNMENTS_PATH = "/organization/assignments";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectWithError(basePath: string, error: string): never {
  const separator = basePath.includes("?") ? "&" : "?";
  redirect(`${basePath}${separator}error=${encodeURIComponent(error)}`);
}

function redirectWithSuccess(basePath: string, success: string): never {
  const separator = basePath.includes("?") ? "&" : "?";
  redirect(`${basePath}${separator}success=${encodeURIComponent(success)}`);
}

function revalidateAssignmentViews(userId?: string) {
  revalidatePath(ASSIGNMENTS_PATH);
  if (userId) {
    revalidatePath(`${ASSIGNMENTS_PATH}/${userId}`);
  }
  revalidatePath("/organization/roles");
  revalidatePath("/organization");
}

/**
 * Assigns one or multiple roles to an organization user.
 */
export async function assignRolesAction(formData: FormData) {
  let organizationId: string;
  let adminUserId: string;

  const returnTo = readText(formData, "returnTo");
  const userId = readText(formData, "userId");
  const fallbackPath = userId
    ? `${ASSIGNMENTS_PATH}/${userId}`
    : ASSIGNMENTS_PATH;
  const targetBasePath = returnTo || fallbackPath;

  try {
    const authContext = await requirePermission(PERMISSIONS.ORG_ROLES_ASSIGN);
    if (!authContext.organizationId) {
      redirectWithError(targetBasePath, "organization-inactive");
    }
    organizationId = authContext.organizationId;
    adminUserId = authContext.userId;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      redirect("/login");
    }
    if (err instanceof ForbiddenError) {
      redirectWithError(targetBasePath, "unauthorized");
    }
    throw err;
  }

  if (!userId || !UUID_PATTERN.test(userId)) {
    redirectWithError(targetBasePath, "user-not-found");
  }

  // Parse assignments from FormData
  // Can be JSON payload in 'roleAssignmentsJson' or individual fields
  const roleAssignmentsJson = readText(formData, "roleAssignmentsJson");
  const assignments: RoleAssignmentInput[] = [];

  if (roleAssignmentsJson) {
    try {
      const parsed = JSON.parse(roleAssignmentsJson);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === "object" && typeof item.roleId === "string") {
            assignments.push({
              roleId: item.roleId,
              scope: item.scope === "DEPARTMENT" ? "DEPARTMENT" : "ORGANIZATION",
              departmentId: item.departmentId || null,
            });
          }
        }
      }
    } catch {
      redirectWithError(targetBasePath, "assignment-failed");
    }
  } else {
    // Single or multi form field inputs
    const roleIds = formData
      .getAll("roleId")
      .filter((r): r is string => typeof r === "string" && UUID_PATTERN.test(r.trim()))
      .map((r) => r.trim());

    for (const rId of roleIds) {
      const scopeField = readText(formData, `scope_${rId}`) || readText(formData, "scope");
      const scope = scopeField === "DEPARTMENT" ? "DEPARTMENT" : "ORGANIZATION";
      const deptField =
        readText(formData, `departmentId_${rId}`) ||
        readText(formData, "departmentId");
      const departmentId =
        scope === "DEPARTMENT" && UUID_PATTERN.test(deptField)
          ? deptField
          : null;

      assignments.push({
        roleId: rId,
        scope,
        departmentId,
      });
    }
  }

  if (assignments.length === 0) {
    redirectWithError(targetBasePath, "role-required");
  }

  try {
    await assignRolesToUser(organizationId, adminUserId, {
      userId,
      assignments,
    });

    revalidateAssignmentViews(userId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";

    if (err instanceof ForbiddenError) {
      redirectWithError(targetBasePath, "unauthorized");
    }
    if (msg.includes("Cannot assign roles to a suspended user")) {
      redirectWithError(targetBasePath, "user-suspended");
    }
    if (msg.includes("Target user not found")) {
      redirectWithError(targetBasePath, "user-not-found");
    }
    if (msg.includes("already has an active assignment")) {
      redirectWithError(targetBasePath, "duplicate-assignment");
    }
    if (msg.includes("Active Driver role assignment requires an active driver profile")) {
      redirectWithError(targetBasePath, "driver-profile-missing");
    }
    if (msg.includes("requires a specific department scope") || msg.includes("requires selecting a valid department")) {
      redirectWithError(targetBasePath, "department-required");
    }
    if (msg.includes("is organization-only and cannot be assigned to a department")) {
      redirectWithError(targetBasePath, "org-only-scope");
    }
    if (msg.includes("inactive and cannot be assigned")) {
      redirectWithError(targetBasePath, "role-inactive");
    }
    if (msg.includes("department is inactive")) {
      redirectWithError(targetBasePath, "dept-inactive");
    }
    if (msg.includes("department was not found")) {
      redirectWithError(targetBasePath, "invalid-department");
    }
    redirectWithError(targetBasePath, "assignment-failed");
  }

  redirectWithSuccess(targetBasePath, "assigned");
}

/**
 * Activates an inactive or pending role assignment.
 */
export async function activateAssignmentAction(formData: FormData) {
  let organizationId: string;
  let adminUserId: string;

  const returnTo = readText(formData, "returnTo");
  const userId = readText(formData, "userId");
  const assignmentId = readText(formData, "assignmentId");
  const fallbackPath = userId
    ? `${ASSIGNMENTS_PATH}/${userId}`
    : ASSIGNMENTS_PATH;
  const targetBasePath = returnTo || fallbackPath;

  try {
    const authContext = await requirePermission(PERMISSIONS.ORG_ROLES_ASSIGN);
    if (!authContext.organizationId) {
      redirectWithError(targetBasePath, "organization-inactive");
    }
    organizationId = authContext.organizationId;
    adminUserId = authContext.userId;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      redirect("/login");
    }
    if (err instanceof ForbiddenError) {
      redirectWithError(targetBasePath, "unauthorized");
    }
    throw err;
  }

  if (!assignmentId || !UUID_PATTERN.test(assignmentId)) {
    redirectWithError(targetBasePath, "assignment-not-found");
  }

  try {
    await activateAssignment(organizationId, adminUserId, assignmentId);
    revalidateAssignmentViews(userId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";

    if (msg.includes("permanently revoked")) {
      redirectWithError(targetBasePath, "revoked-terminal");
    }
    if (msg.includes("active driver profile")) {
      redirectWithError(targetBasePath, "driver-profile-missing");
    }
    if (msg.includes("already has an active assignment")) {
      redirectWithError(targetBasePath, "duplicate-assignment");
    }
    if (msg.includes("inactive or deleted user")) {
      redirectWithError(targetBasePath, "user-inactive");
    }
    if (msg.includes("inactive or deleted role")) {
      redirectWithError(targetBasePath, "role-inactive");
    }
    if (msg.includes("inactive or deleted department")) {
      redirectWithError(targetBasePath, "dept-inactive");
    }
    redirectWithError(targetBasePath, "activation-failed");
  }

  redirectWithSuccess(targetBasePath, "activated");
}

/**
 * Deactivates an active role assignment.
 */
export async function deactivateAssignmentAction(formData: FormData) {
  let organizationId: string;
  let adminUserId: string;

  const returnTo = readText(formData, "returnTo");
  const userId = readText(formData, "userId");
  const assignmentId = readText(formData, "assignmentId");
  const fallbackPath = userId
    ? `${ASSIGNMENTS_PATH}/${userId}`
    : ASSIGNMENTS_PATH;
  const targetBasePath = returnTo || fallbackPath;

  try {
    const authContext = await requirePermission(PERMISSIONS.ORG_ROLES_ASSIGN);
    if (!authContext.organizationId) {
      redirectWithError(targetBasePath, "organization-inactive");
    }
    organizationId = authContext.organizationId;
    adminUserId = authContext.userId;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      redirect("/login");
    }
    if (err instanceof ForbiddenError) {
      redirectWithError(targetBasePath, "unauthorized");
    }
    throw err;
  }

  if (!assignmentId || !UUID_PATTERN.test(assignmentId)) {
    redirectWithError(targetBasePath, "assignment-not-found");
  }

  try {
    await deactivateAssignment(organizationId, adminUserId, assignmentId);
    revalidateAssignmentViews(userId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";

    if (msg.includes("permanently revoked")) {
      redirectWithError(targetBasePath, "revoked-terminal");
    }
    redirectWithError(targetBasePath, "deactivation-failed");
  }

  redirectWithSuccess(targetBasePath, "deactivated");
}

/**
 * Permanently revokes a role assignment with an audit reason.
 */
export async function revokeAssignmentAction(formData: FormData) {
  let organizationId: string;
  let adminUserId: string;

  const returnTo = readText(formData, "returnTo");
  const userId = readText(formData, "userId");
  const assignmentId = readText(formData, "assignmentId");
  const reason = readText(formData, "reason");
  const fallbackPath = userId
    ? `${ASSIGNMENTS_PATH}/${userId}`
    : ASSIGNMENTS_PATH;
  const targetBasePath = returnTo || fallbackPath;

  try {
    const authContext = await requirePermission(PERMISSIONS.ORG_ROLES_ASSIGN);
    if (!authContext.organizationId) {
      redirectWithError(targetBasePath, "organization-inactive");
    }
    organizationId = authContext.organizationId;
    adminUserId = authContext.userId;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      redirect("/login");
    }
    if (err instanceof ForbiddenError) {
      redirectWithError(targetBasePath, "unauthorized");
    }
    throw err;
  }

  if (!assignmentId || !UUID_PATTERN.test(assignmentId)) {
    redirectWithError(targetBasePath, "assignment-not-found");
  }

  if (!reason || reason.trim().length < 3) {
    redirectWithError(targetBasePath, "reason-required");
  }

  if (reason.length > 1000) {
    redirectWithError(targetBasePath, "reason-too-long");
  }

  try {
    await revokeAssignment(organizationId, adminUserId, assignmentId, reason);
    revalidateAssignmentViews(userId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";

    if (msg.includes("already been permanently revoked")) {
      redirectWithError(targetBasePath, "revoked-terminal");
    }
    redirectWithError(targetBasePath, "revocation-failed");
  }

  redirectWithSuccess(targetBasePath, "revoked");
}
