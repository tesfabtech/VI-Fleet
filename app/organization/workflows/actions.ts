"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { StageApprovalPolicy, StageApproverType, WorkflowStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  PERMISSIONS,
  requirePermission,
  UnauthorizedError,
} from "@/lib/rbac";
import {
  addStageToDraft,
  createDraftFromVersion,
  createWorkflowDraft,
  publishWorkflowVersion,
  removeDraftStage,
  reorderDraftStages,
  updateDraftStage,
  validateWorkflowDraft,
  WorkflowError,
  WorkflowImmutableError,
  WorkflowNotFoundError,
  WorkflowValidationError,
} from "@/lib/workflow";
import type { StageApproverInput } from "@/lib/workflow";

const WORKFLOWS_PATH = "/organization/workflows";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRedirectError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { message?: string; digest?: string };
  return (
    e.message === "NEXT_REDIRECT" ||
    (typeof e.digest === "string" && e.digest.includes("NEXT_REDIRECT"))
  );
}

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

function revalidateWorkflowViews(workflowId?: string) {
  revalidatePath(WORKFLOWS_PATH);
  if (workflowId) {
    revalidatePath(`${WORKFLOWS_PATH}/${workflowId}`);
  }
  revalidatePath("/organization");
}

/**
 * Parses approvers from FormData.
 * Supports JSON string payload or repeated form inputs.
 */
function parseApprovers(formData: FormData): StageApproverInput[] {
  const approversJson = readText(formData, "approversJson");
  if (approversJson) {
    try {
      const parsed = JSON.parse(approversJson);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item && (item.approverType === "USER" || item.approverType === "ROLE"))
          .map((item) => ({
            approverType: item.approverType as StageApproverType,
            userId: item.userId?.trim() || undefined,
            roleId: item.roleId?.trim() || undefined,
          }));
      }
    } catch {
      throw new WorkflowValidationError("Invalid approver data format.");
    }
  }

  // Fallback: parse arrays from FormData
  const types = formData.getAll("approverType");
  const userIds = formData.getAll("userId");
  const roleIds = formData.getAll("roleId");

  const approvers: StageApproverInput[] = [];
  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    const userVal = userIds[i];
    const roleVal = roleIds[i];
    if (type === "USER") {
      const uId = typeof userVal === "string" ? userVal.trim() : "";
      if (uId && UUID_PATTERN.test(uId)) {
        approvers.push({ approverType: "USER", userId: uId });
      }
    } else if (type === "ROLE") {
      const rId = typeof roleVal === "string" ? roleVal.trim() : "";
      if (rId && UUID_PATTERN.test(rId)) {
        approvers.push({ approverType: "ROLE", roleId: rId });
      }
    }
  }

  return approvers;
}

/**
 * 1. Creates a new workflow draft with initial version (v1, DRAFT).
 */
export async function createWorkflowAction(formData: FormData) {
  let authContext;
  let authErrorType: "unauthorized" | "forbidden" | null = null;
  try {
    authContext = await requirePermission(PERMISSIONS.ORG_ROLES_MANAGE);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof UnauthorizedError) {
      authErrorType = "unauthorized";
    } else if (err instanceof ForbiddenError) {
      authErrorType = "forbidden";
    } else {
      throw err;
    }
  }

  if (authErrorType === "unauthorized") {
    redirect("/login");
  }
  if (authErrorType === "forbidden") {
    redirectWithError(WORKFLOWS_PATH, "unauthorized");
  }
  if (!authContext?.organizationId) {
    redirectWithError(WORKFLOWS_PATH, "organization-inactive");
  }

  const organizationId = authContext.organizationId;
  const userId = authContext.userId;

  const name = readText(formData, "name");
  const workflowType = readText(formData, "workflowType") || "TRANSPORTATION_REQUEST";
  const description = readText(formData, "description");

  if (!name) {
    redirectWithError(`${WORKFLOWS_PATH}/new`, "name-required");
  }

  if (name.length > 150) {
    redirectWithError(`${WORKFLOWS_PATH}/new`, "name-too-long");
  }

  if (workflowType.length > 100) {
    redirectWithError(`${WORKFLOWS_PATH}/new`, "type-too-long");
  }

  if (description.length > 1000) {
    redirectWithError(`${WORKFLOWS_PATH}/new`, "description-too-long");
  }

  let createdWorkflowId: string | null = null;
  let creationError: string | null = null;

  try {
    const result = await createWorkflowDraft({
      organizationId,
      name,
      description: description || null,
      workflowType,
      createdById: userId,
    });
    createdWorkflowId = result.workflow.id;
    revalidateWorkflowViews(createdWorkflowId);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof WorkflowValidationError) {
      creationError = err.message;
    } else {
      creationError = "creation-failed";
    }
  }

  if (creationError || !createdWorkflowId) {
    redirectWithError(`${WORKFLOWS_PATH}/new`, creationError || "creation-failed");
  }

  redirectWithSuccess(`${WORKFLOWS_PATH}/${createdWorkflowId}`, "created");
}

/**
 * 2. Updates workflow metadata (name, description, active status).
 */
export async function updateWorkflowMetadataAction(formData: FormData) {
  const workflowId = readText(formData, "workflowId");
  const fallbackPath = workflowId ? `${WORKFLOWS_PATH}/${workflowId}` : WORKFLOWS_PATH;

  let authContext;
  let authErrorType: "unauthorized" | "forbidden" | null = null;
  try {
    authContext = await requirePermission(PERMISSIONS.ORG_ROLES_MANAGE);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof UnauthorizedError) {
      authErrorType = "unauthorized";
    } else if (err instanceof ForbiddenError) {
      authErrorType = "forbidden";
    } else {
      throw err;
    }
  }

  if (authErrorType === "unauthorized") {
    redirect("/login");
  }
  if (authErrorType === "forbidden") {
    redirectWithError(fallbackPath, "unauthorized");
  }
  if (!authContext?.organizationId) {
    redirectWithError(fallbackPath, "organization-inactive");
  }

  const organizationId = authContext.organizationId;

  if (!workflowId || !UUID_PATTERN.test(workflowId)) {
    redirectWithError(WORKFLOWS_PATH, "workflow-not-found");
  }

  const name = readText(formData, "name");
  const description = readText(formData, "description");
  const rawStatus = readText(formData, "status");

  if (!name) {
    redirectWithError(fallbackPath, "name-required");
  }

  if (name.length > 150) {
    redirectWithError(fallbackPath, "name-too-long");
  }

  if (description.length > 1000) {
    redirectWithError(fallbackPath, "description-too-long");
  }

  const status: WorkflowStatus = rawStatus === "INACTIVE" ? "INACTIVE" : "ACTIVE";

  let existing;
  let findError = false;
  try {
    existing = await prisma.approvalWorkflow.findFirst({
      where: { id: workflowId, organizationId, deletedAt: null },
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    findError = true;
  }

  if (findError) {
    redirectWithError(fallbackPath, "update-failed");
  }

  if (!existing) {
    redirectWithError(WORKFLOWS_PATH, "workflow-not-found");
  }

  let updateError: string | null = null;
  try {
    await prisma.approvalWorkflow.update({
      where: { id: workflowId },
      data: {
        name,
        description: description || null,
        status,
      },
    });

    revalidateWorkflowViews(workflowId);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof WorkflowError) {
      updateError = err.message;
    } else {
      updateError = "update-failed";
    }
  }

  if (updateError) {
    redirectWithError(fallbackPath, updateError);
  }

  redirectWithSuccess(fallbackPath, "metadata-updated");
}

/**
 * 3. Adds an approval stage to a draft workflow version.
 */
export async function addStageAction(formData: FormData) {
  const workflowId = readText(formData, "workflowId");
  const versionId = readText(formData, "versionId");
  const targetBasePath = `${WORKFLOWS_PATH}/${workflowId}?v=${versionId}`;

  let authContext;
  let authErrorType: "unauthorized" | "forbidden" | null = null;
  try {
    authContext = await requirePermission(PERMISSIONS.ORG_ROLES_MANAGE);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof UnauthorizedError) {
      authErrorType = "unauthorized";
    } else if (err instanceof ForbiddenError) {
      authErrorType = "forbidden";
    } else {
      throw err;
    }
  }

  if (authErrorType === "unauthorized") {
    redirect("/login");
  }
  if (authErrorType === "forbidden") {
    redirectWithError(targetBasePath, "unauthorized");
  }
  if (!authContext?.organizationId) {
    redirectWithError(targetBasePath, "organization-inactive");
  }

  const organizationId = authContext.organizationId;

  if (!versionId || !UUID_PATTERN.test(versionId)) {
    redirectWithError(targetBasePath, "version-not-found");
  }

  const name = readText(formData, "name");
  const description = readText(formData, "description");
  const rawPolicy = readText(formData, "approvalPolicy");
  const approvalPolicy: StageApprovalPolicy = rawPolicy === "ALL" ? "ALL" : "ANY_ONE";
  const isOptional = formData.get("isOptional") === "true" || formData.get("isOptional") === "on";
  const requiredPermissionCode = readText(formData, "requiredPermissionCode") || null;

  if (!name) {
    redirectWithError(targetBasePath, "stage-name-required");
  }

  if (name.length > 150) {
    redirectWithError(targetBasePath, "stage-name-too-long");
  }

  let approvers: StageApproverInput[];
  let approverParseError: string | null = null;
  try {
    approvers = parseApprovers(formData);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    approverParseError = err instanceof Error ? err.message : "Invalid approver configuration.";
    approvers = [];
  }

  if (approverParseError) {
    redirectWithError(targetBasePath, approverParseError);
  }

  if (approvers.length === 0) {
    redirectWithError(targetBasePath, "approvers-required");
  }

  let addStageError: string | null = null;
  try {
    await addStageToDraft({
      organizationId,
      versionId,
      name,
      description: description || null,
      approvalPolicy,
      isOptional,
      requiredPermissionCode,
      approvers,
    });

    revalidateWorkflowViews(workflowId);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof WorkflowImmutableError) {
      addStageError = "version-immutable";
    } else if (err instanceof WorkflowValidationError) {
      addStageError = err.message;
    } else if (err instanceof WorkflowNotFoundError) {
      addStageError = err.message;
    } else {
      addStageError = "stage-add-failed";
    }
  }

  if (addStageError) {
    redirectWithError(targetBasePath, addStageError);
  }

  redirectWithSuccess(targetBasePath, "stage-added");
}

/**
 * 4. Updates an existing approval stage in a draft workflow version.
 */
export async function updateStageAction(formData: FormData) {
  const workflowId = readText(formData, "workflowId");
  const versionId = readText(formData, "versionId");
  const stageId = readText(formData, "stageId");
  const targetBasePath = `${WORKFLOWS_PATH}/${workflowId}?v=${versionId}`;

  let authContext;
  let authErrorType: "unauthorized" | "forbidden" | null = null;
  try {
    authContext = await requirePermission(PERMISSIONS.ORG_ROLES_MANAGE);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof UnauthorizedError) {
      authErrorType = "unauthorized";
    } else if (err instanceof ForbiddenError) {
      authErrorType = "forbidden";
    } else {
      throw err;
    }
  }

  if (authErrorType === "unauthorized") {
    redirect("/login");
  }
  if (authErrorType === "forbidden") {
    redirectWithError(targetBasePath, "unauthorized");
  }
  if (!authContext?.organizationId) {
    redirectWithError(targetBasePath, "organization-inactive");
  }

  const organizationId = authContext.organizationId;

  if (!stageId || !UUID_PATTERN.test(stageId)) {
    redirectWithError(targetBasePath, "stage-not-found");
  }

  const name = readText(formData, "name");
  const description = readText(formData, "description");
  const rawPolicy = readText(formData, "approvalPolicy");
  const approvalPolicy: StageApprovalPolicy = rawPolicy === "ALL" ? "ALL" : "ANY_ONE";
  const isOptional = formData.get("isOptional") === "true" || formData.get("isOptional") === "on";
  const requiredPermissionCode = readText(formData, "requiredPermissionCode") || null;

  if (!name) {
    redirectWithError(targetBasePath, "stage-name-required");
  }

  if (name.length > 150) {
    redirectWithError(targetBasePath, "stage-name-too-long");
  }

  let approvers: StageApproverInput[];
  let approverParseError: string | null = null;
  try {
    approvers = parseApprovers(formData);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    approverParseError = err instanceof Error ? err.message : "Invalid approver configuration.";
    approvers = [];
  }

  if (approverParseError) {
    redirectWithError(targetBasePath, approverParseError);
  }

  if (approvers.length === 0) {
    redirectWithError(targetBasePath, "approvers-required");
  }

  let updateStageError: string | null = null;
  try {
    await updateDraftStage({
      organizationId,
      stageId,
      name,
      description: description || null,
      approvalPolicy,
      isOptional,
      requiredPermissionCode,
      approvers,
    });

    revalidateWorkflowViews(workflowId);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof WorkflowImmutableError) {
      updateStageError = "version-immutable";
    } else if (err instanceof WorkflowValidationError) {
      updateStageError = err.message;
    } else if (err instanceof WorkflowNotFoundError) {
      updateStageError = err.message;
    } else {
      updateStageError = "stage-update-failed";
    }
  }

  if (updateStageError) {
    redirectWithError(targetBasePath, updateStageError);
  }

  redirectWithSuccess(targetBasePath, "stage-updated");
}

/**
 * 5. Removes a stage from a draft workflow version and re-sequences remaining stages consecutively.
 */
export async function removeStageAction(formData: FormData) {
  const workflowId = readText(formData, "workflowId");
  const versionId = readText(formData, "versionId");
  const stageId = readText(formData, "stageId");
  const targetBasePath = `${WORKFLOWS_PATH}/${workflowId}?v=${versionId}`;

  let authContext;
  let authErrorType: "unauthorized" | "forbidden" | null = null;
  try {
    authContext = await requirePermission(PERMISSIONS.ORG_ROLES_MANAGE);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof UnauthorizedError) {
      authErrorType = "unauthorized";
    } else if (err instanceof ForbiddenError) {
      authErrorType = "forbidden";
    } else {
      throw err;
    }
  }

  if (authErrorType === "unauthorized") {
    redirect("/login");
  }
  if (authErrorType === "forbidden") {
    redirectWithError(targetBasePath, "unauthorized");
  }
  if (!authContext?.organizationId) {
    redirectWithError(targetBasePath, "organization-inactive");
  }

  const organizationId = authContext.organizationId;

  if (!stageId || !UUID_PATTERN.test(stageId)) {
    redirectWithError(targetBasePath, "stage-not-found");
  }

  let removeStageError: string | null = null;
  try {
    await removeDraftStage({ organizationId, stageId });
    revalidateWorkflowViews(workflowId);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof WorkflowImmutableError) {
      removeStageError = "version-immutable";
    } else if (err instanceof WorkflowNotFoundError) {
      removeStageError = err.message;
    } else {
      removeStageError = "stage-remove-failed";
    }
  }

  if (removeStageError) {
    redirectWithError(targetBasePath, removeStageError);
  }

  redirectWithSuccess(targetBasePath, "stage-removed");
}

/**
 * 6. Swaps a stage up or down within consecutive 1..N order.
 */
export async function moveStageAction(formData: FormData) {
  const workflowId = readText(formData, "workflowId");
  const versionId = readText(formData, "versionId");
  const stageId = readText(formData, "stageId");
  const direction = readText(formData, "direction"); // "up" | "down"
  const targetBasePath = `${WORKFLOWS_PATH}/${workflowId}?v=${versionId}`;

  let authContext;
  let authErrorType: "unauthorized" | "forbidden" | null = null;
  try {
    authContext = await requirePermission(PERMISSIONS.ORG_ROLES_MANAGE);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof UnauthorizedError) {
      authErrorType = "unauthorized";
    } else if (err instanceof ForbiddenError) {
      authErrorType = "forbidden";
    } else {
      throw err;
    }
  }

  if (authErrorType === "unauthorized") {
    redirect("/login");
  }
  if (authErrorType === "forbidden") {
    redirectWithError(targetBasePath, "unauthorized");
  }
  if (!authContext?.organizationId) {
    redirectWithError(targetBasePath, "organization-inactive");
  }

  const organizationId = authContext.organizationId;

  if (!versionId || !UUID_PATTERN.test(versionId) || !stageId || !UUID_PATTERN.test(stageId)) {
    redirectWithError(targetBasePath, "invalid-stage");
  }

  let version;
  let findError = false;
  try {
    version = await prisma.approvalWorkflowVersion.findFirst({
      where: { id: versionId, organizationId },
      include: { stages: { orderBy: { stageOrder: "asc" } } },
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    findError = true;
  }

  if (findError) {
    redirectWithError(targetBasePath, "reorder-failed");
  }

  if (!version) {
    redirectWithError(targetBasePath, "version-not-found");
  }

  if (version.status !== "DRAFT") {
    redirectWithError(targetBasePath, "version-immutable");
  }

  const stages = [...version.stages];
  const currentIndex = stages.findIndex((s) => s.id === stageId);
  if (currentIndex === -1) {
    redirectWithError(targetBasePath, "stage-not-found");
  }

  const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (swapIndex < 0 || swapIndex >= stages.length) {
    // Out of bounds, nothing to move
    redirect(targetBasePath);
  }

  // Swap elements
  const temp = stages[currentIndex];
  stages[currentIndex] = stages[swapIndex];
  stages[swapIndex] = temp;

  // Build consecutive 1..N orders
  const stageOrders = stages.map((s, index) => ({
    stageId: s.id,
    stageOrder: index + 1,
  }));

  let reorderError: string | null = null;
  try {
    await reorderDraftStages({ organizationId, versionId, stageOrders });
    revalidateWorkflowViews(workflowId);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof WorkflowImmutableError) {
      reorderError = "version-immutable";
    } else if (err instanceof WorkflowValidationError) {
      reorderError = err.message;
    } else {
      reorderError = "reorder-failed";
    }
  }

  if (reorderError) {
    redirectWithError(targetBasePath, reorderError);
  }

  redirectWithSuccess(targetBasePath, "stage-moved");
}

/**
 * 7. Publishes a draft workflow version.
 * Archives existing published version, validates draft, and marks version PUBLISHED.
 */
export async function publishWorkflowAction(formData: FormData) {
  const workflowId = readText(formData, "workflowId");
  const versionId = readText(formData, "versionId");
  const targetBasePath = `${WORKFLOWS_PATH}/${workflowId}?v=${versionId}`;

  let authContext;
  let authErrorType: "unauthorized" | "forbidden" | null = null;
  try {
    authContext = await requirePermission(PERMISSIONS.ORG_ROLES_MANAGE);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof UnauthorizedError) {
      authErrorType = "unauthorized";
    } else if (err instanceof ForbiddenError) {
      authErrorType = "forbidden";
    } else {
      throw err;
    }
  }

  if (authErrorType === "unauthorized") {
    redirect("/login");
  }
  if (authErrorType === "forbidden") {
    redirectWithError(targetBasePath, "unauthorized");
  }
  if (!authContext?.organizationId) {
    redirectWithError(targetBasePath, "organization-inactive");
  }

  const organizationId = authContext.organizationId;
  const userId = authContext.userId;

  if (!versionId || !UUID_PATTERN.test(versionId)) {
    redirectWithError(targetBasePath, "version-not-found");
  }

  let publishError: string | null = null;
  try {
    await publishWorkflowVersion({
      organizationId,
      versionId,
      publishedById: userId,
    });

    revalidateWorkflowViews(workflowId);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof WorkflowImmutableError) {
      publishError = "already-published";
    } else if (err instanceof WorkflowValidationError) {
      publishError = `publish-failed: ${err.message}`;
    } else if (err instanceof WorkflowNotFoundError) {
      publishError = err.message;
    } else {
      publishError = "publish-failed";
    }
  }

  if (publishError) {
    redirectWithError(targetBasePath, publishError);
  }

  redirectWithSuccess(`${WORKFLOWS_PATH}/${workflowId}?v=${versionId}`, "published");
}

/**
 * 8. Creates a new draft version from an existing version (or current published version).
 * Deep-copies stages and approvers.
 */
export async function createDraftFromVersionAction(formData: FormData) {
  const workflowId = readText(formData, "workflowId");
  const fromVersionId = readText(formData, "fromVersionId") || undefined;
  const targetBasePath = `${WORKFLOWS_PATH}/${workflowId}`;

  let authContext;
  let authErrorType: "unauthorized" | "forbidden" | null = null;
  try {
    authContext = await requirePermission(PERMISSIONS.ORG_ROLES_MANAGE);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof UnauthorizedError) {
      authErrorType = "unauthorized";
    } else if (err instanceof ForbiddenError) {
      authErrorType = "forbidden";
    } else {
      throw err;
    }
  }

  if (authErrorType === "unauthorized") {
    redirect("/login");
  }
  if (authErrorType === "forbidden") {
    redirectWithError(targetBasePath, "unauthorized");
  }
  if (!authContext?.organizationId) {
    redirectWithError(targetBasePath, "organization-inactive");
  }

  const organizationId = authContext.organizationId;
  const userId = authContext.userId;

  if (!workflowId || !UUID_PATTERN.test(workflowId)) {
    redirectWithError(WORKFLOWS_PATH, "workflow-not-found");
  }

  let newDraftVersionId: string | null = null;
  let creationError: string | null = null;

  try {
    const newVersion = await createDraftFromVersion({
      organizationId,
      workflowId,
      fromVersionId,
      createdById: userId,
    });

    newDraftVersionId = newVersion.id;
    revalidateWorkflowViews(workflowId);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof WorkflowValidationError) {
      creationError = err.message;
    } else if (err instanceof WorkflowNotFoundError) {
      creationError = err.message;
    } else {
      creationError = "draft-creation-failed";
    }
  }

  if (creationError || !newDraftVersionId) {
    redirectWithError(targetBasePath, creationError || "draft-creation-failed");
  }

  redirectWithSuccess(
    `${WORKFLOWS_PATH}/${workflowId}?v=${newDraftVersionId}`,
    "draft-created",
  );
}
