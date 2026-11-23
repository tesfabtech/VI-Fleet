import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "@/lib/prisma";
import {
  assignRolesToUser,
  createCustomRole,
  ForbiddenError,
  PERMISSIONS,
  resolveAuthorizationContextForUser,
} from "@/lib/rbac";
import {
  addStageToDraft,
  createDraftFromVersion,
  createWorkflowDraft,
  publishWorkflowVersion,
  removeDraftStage,
  reorderDraftStages,
  startWorkflowInstance,
  updateDraftStage,
  validateWorkflowDraft,
} from "./index";
import {
  WorkflowImmutableError,
  WorkflowNotFoundError,
  WorkflowValidationError,
} from "./errors";

// Helper to generate unique emails
function uniqueEmail(prefix = "wf-cfg") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

// Helper to create an active test organization with baseline roles
async function createTestOrg(name: string) {
  const code = `ORG-${Date.now()}-${Math.floor(Math.random() * 1000)}`.slice(0, 20);
  const org = await prisma.organization.create({
    data: {
      name,
      code,
      status: "ACTIVE",
    },
  });

  await prisma.$executeRawUnsafe(
    `SELECT provision_organization_built_in_roles('${org.id}'::uuid);`,
  );

  return org;
}

// Helper to create a test user with active role assignment
async function createTestUserWithRole(params: {
  organizationId: string;
  roleSlug: string;
  departmentId?: string | null;
  userRole?: "ORGANIZATION_ADMINISTRATOR" | "DEPARTMENT_USER";
}) {
  const email = uniqueEmail("user");
  const legacyRole = params.userRole ?? (params.departmentId ? "DEPARTMENT_USER" : "ORGANIZATION_ADMINISTRATOR");
  const user = await prisma.user.create({
    data: {
      organizationId: params.organizationId,
      departmentId: legacyRole === "DEPARTMENT_USER" ? params.departmentId ?? null : null,
      firstName: "Test",
      lastName: "Approver",
      email,
      passwordHash: "hashed-pw",
      role: legacyRole,
      status: "ACTIVE",
    },
  });

  const role = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: params.organizationId, slug: params.roleSlug },
  });

  await assignRolesToUser(params.organizationId, user.id, {
    userId: user.id,
    assignments: [
      {
        roleId: role.id,
        scope: params.departmentId ? "DEPARTMENT" : "ORGANIZATION",
        departmentId: params.departmentId ?? null,
      },
    ],
  });

  return { user, role };
}

// Helper to create a test department
async function createTestDept(organizationId: string, name = "Operations") {
  return prisma.department.create({
    data: {
      organizationId,
      name: `${name}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: "ACTIVE",
    },
  });
}

// ============================================================
// 1. ORGANIZATION TENANT ISOLATION
// ============================================================

test("1. Workflow tenant isolation: workflows, versions and stages cannot cross organization boundaries", async () => {
  const orgA = await createTestOrg("Tenant A Workflows");
  const orgB = await createTestOrg("Tenant B Workflows");

  const { user: adminA } = await createTestUserWithRole({
    organizationId: orgA.id,
    roleSlug: "org-admin",
  });
  const { user: adminB } = await createTestUserWithRole({
    organizationId: orgB.id,
    roleSlug: "org-admin",
  });

  // Org A creates a workflow
  const { workflow: wfA, version: v1A } = await createWorkflowDraft({
    organizationId: orgA.id,
    name: "Org A Request Approval",
    workflowType: "TRANSPORTATION_REQUEST",
    createdById: adminA.id,
  });

  // 1. Org B cannot query Org A's workflow
  const foundByB = await prisma.approvalWorkflow.findFirst({
    where: { id: wfA.id, organizationId: orgB.id, deletedAt: null },
  });
  assert.equal(foundByB, null, "Org B must not be able to find Org A's workflow");

  // 2. Org B cannot add stages to Org A's workflow version
  await assert.rejects(
    async () => {
      await addStageToDraft({
        organizationId: orgB.id,
        versionId: v1A.id,
        name: "Malicious Cross-Tenant Stage",
        approvers: [{ approverType: "USER", userId: adminB.id }],
      });
    },
    (err: unknown) =>
      err instanceof WorkflowNotFoundError &&
      err.message.includes("Workflow version not found"),
  );

  // 3. Org B cannot publish Org A's workflow version
  await assert.rejects(
    async () => {
      await publishWorkflowVersion({
        organizationId: orgB.id,
        versionId: v1A.id,
        publishedById: adminB.id,
      });
    },
    (err: unknown) =>
      err instanceof WorkflowNotFoundError &&
      err.message.includes("Workflow version not found"),
  );
});

// ============================================================
// 2. WORKFLOW CREATION AND METADATA EDITING
// ============================================================

test("2. Workflow creation and metadata update: draft initialization and field validation", async () => {
  const org = await createTestOrg("Workflow Creation Org");
  const { user: admin } = await createTestUserWithRole({
    organizationId: org.id,
    roleSlug: "org-admin",
  });

  // Name is required
  await assert.rejects(
    async () => {
      await createWorkflowDraft({
        organizationId: org.id,
        name: "",
        workflowType: "TRANSPORTATION_REQUEST",
        createdById: admin.id,
      });
    },
    (err: unknown) =>
      err instanceof WorkflowValidationError &&
      err.message.includes("Workflow name is required"),
  );

  // Workflow type is required
  await assert.rejects(
    async () => {
      await createWorkflowDraft({
        organizationId: org.id,
        name: "Valid Name",
        workflowType: "",
        createdById: admin.id,
      });
    },
    (err: unknown) =>
      err instanceof WorkflowValidationError &&
      err.message.includes("Workflow type is required"),
  );

  // Valid draft creation
  const { workflow, version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Fleet Requisition Approval",
    description: "Main approval process for fleet vehicles",
    workflowType: "TRANSPORTATION_REQUEST",
    createdById: admin.id,
  });

  assert.equal(workflow.name, "Fleet Requisition Approval");
  assert.equal(workflow.workflowType, "TRANSPORTATION_REQUEST");
  assert.equal(workflow.status, "ACTIVE");
  assert.equal(version.versionNumber, 1);
  assert.equal(version.status, "DRAFT");

  // Update workflow metadata
  const updatedWorkflow = await prisma.approvalWorkflow.update({
    where: { id: workflow.id },
    data: {
      name: "Updated Fleet Requisition Approval",
      description: "Updated description",
      status: "ACTIVE",
    },
  });

  assert.equal(updatedWorkflow.name, "Updated Fleet Requisition Approval");
  assert.equal(updatedWorkflow.description, "Updated description");
});

// ============================================================
// 3. STAGE CREATION, EDITING, DELETION, AND REORDERING
// ============================================================

test("3. Stage configuration lifecycle: add, update, reorder, and remove stages", async () => {
  const org = await createTestOrg("Stage Lifecycle Org");
  const { user: user1, role: role1 } = await createTestUserWithRole({
    organizationId: org.id,
    roleSlug: "transport-manager",
  });
  const { user: user2, role: role2 } = await createTestUserWithRole({
    organizationId: org.id,
    roleSlug: "vice-org-admin",
  });

  const { workflow, version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Multi-Stage Workflow",
    workflowType: "TRANSPORTATION_REQUEST",
  });

  // 1. Add Stage 1 with USER approver
  const stage1 = await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Initial Screening",
    description: "Screening by transport manager",
    approvalPolicy: "ANY_ONE",
    isOptional: false,
    approvers: [{ approverType: "USER", userId: user1.id }],
  });

  assert.equal(stage1.stageOrder, 1);
  assert.equal(stage1.approvalPolicy, "ANY_ONE");
  assert.equal(stage1.isOptional, false);
  assert.equal(stage1.approvers.length, 1);
  assert.equal(stage1.approvers[0].approverType, "USER");
  assert.equal(stage1.approvers[0].userId, user1.id);

  // 2. Add Stage 2 with ROLE approver and required permission
  const stage2 = await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Executive Approval",
    approvalPolicy: "ALL",
    isOptional: true,
    requiredPermissionCode: PERMISSIONS.REQUESTS_APPROVE,
    approvers: [{ approverType: "ROLE", roleId: role2.id }],
  });

  assert.equal(stage2.stageOrder, 2);
  assert.equal(stage2.approvalPolicy, "ALL");
  assert.equal(stage2.isOptional, true);
  assert.equal(stage2.requiredPermissionCode, PERMISSIONS.REQUESTS_APPROVE);
  assert.equal(stage2.approvers.length, 1);
  assert.equal(stage2.approvers[0].approverType, "ROLE");
  assert.equal(stage2.approvers[0].roleId, role2.id);

  // 3. Add Stage 3 with mixed approvers
  const stage3 = await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Final Sign-off",
    approvers: [
      { approverType: "USER", userId: user2.id },
      { approverType: "ROLE", roleId: role1.id },
    ],
  });

  assert.equal(stage3.stageOrder, 3);
  assert.equal(stage3.approvers.length, 2);

  // 4. Update Stage 1: change name, policy, and approver
  const updatedStage1 = await updateDraftStage({
    organizationId: org.id,
    stageId: stage1.id,
    name: "Updated Initial Screening",
    approvalPolicy: "ALL",
    isOptional: true,
    approvers: [{ approverType: "ROLE", roleId: role1.id }],
  });

  assert.equal(updatedStage1.name, "Updated Initial Screening");
  assert.equal(updatedStage1.approvalPolicy, "ALL");
  assert.equal(updatedStage1.isOptional, true);
  assert.equal(updatedStage1.approvers[0].approverType, "ROLE");
  assert.equal(updatedStage1.approvers[0].roleId, role1.id);

  // 5. Reorder stages: swap Stage 1 and Stage 2
  // Current order: stage1 (1), stage2 (2), stage3 (3)
  // New order: stage2 (1), stage1 (2), stage3 (3)
  const reordered = await reorderDraftStages({
    organizationId: org.id,
    versionId: version.id,
    stageOrders: [
      { stageId: stage2.id, stageOrder: 1 },
      { stageId: stage1.id, stageOrder: 2 },
      { stageId: stage3.id, stageOrder: 3 },
    ],
  });

  const orderMap = new Map(reordered.map((s) => [s.id, s.stageOrder]));
  assert.equal(orderMap.get(stage2.id), 1);
  assert.equal(orderMap.get(stage1.id), 2);
  assert.equal(orderMap.get(stage3.id), 3);

  // 6. Remove Stage 1 (which is now at order 2)
  await removeDraftStage({
    organizationId: org.id,
    stageId: stage1.id,
  });

  // Verify remaining stages are re-sequenced consecutively 1..2
  const remainingStages = await prisma.approvalWorkflowStage.findMany({
    where: { versionId: version.id },
    orderBy: { stageOrder: "asc" },
  });

  assert.equal(remainingStages.length, 2);
  assert.equal(remainingStages[0].id, stage2.id);
  assert.equal(remainingStages[0].stageOrder, 1);
  assert.equal(remainingStages[1].id, stage3.id);
  assert.equal(remainingStages[1].stageOrder, 2);
});

// ============================================================
// 4. APPROVER ASSIGNMENT VALIDATION
// ============================================================

test("4. Approver validation: cross-tenant, inactive, system administrator and platform permissions rejected", async () => {
  const orgA = await createTestOrg("Approver Val Org A");
  const orgB = await createTestOrg("Approver Val Org B");

  const { user: userB, role: roleB } = await createTestUserWithRole({
    organizationId: orgB.id,
    roleSlug: "transport-manager",
  });

  const { workflow, version } = await createWorkflowDraft({
    organizationId: orgA.id,
    name: "Validation Org Workflow",
    workflowType: "TRANSPORTATION_REQUEST",
  });

  // 1. Cross-tenant user approver rejected
  await assert.rejects(
    async () => {
      await addStageToDraft({
        organizationId: orgA.id,
        versionId: version.id,
        name: "Invalid User Stage",
        approvers: [{ approverType: "USER", userId: userB.id }],
      });
    },
    (err: unknown) =>
      err instanceof WorkflowValidationError &&
      err.message.includes("not found in organization"),
  );

  // 2. Cross-tenant role approver rejected
  await assert.rejects(
    async () => {
      await addStageToDraft({
        organizationId: orgA.id,
        versionId: version.id,
        name: "Invalid Role Stage",
        approvers: [{ approverType: "ROLE", roleId: roleB.id }],
      });
    },
    (err: unknown) =>
      err instanceof WorkflowValidationError &&
      err.message.includes("not found in organization"),
  );

  // 3. System Administrator rejected as approver
  const sysAdmin = await prisma.user.create({
    data: {
      organizationId: null,
      firstName: "Platform",
      lastName: "Superadmin",
      email: uniqueEmail("sysadmin"),
      passwordHash: "hashed-pw",
      role: "SYSTEM_ADMINISTRATOR",
      status: "ACTIVE",
    },
  });

  await assert.rejects(
    async () => {
      await addStageToDraft({
        organizationId: orgA.id,
        versionId: version.id,
        name: "SysAdmin Approver Stage",
        approvers: [{ approverType: "USER", userId: sysAdmin.id }],
      });
    },
    (err: unknown) =>
      err instanceof WorkflowValidationError &&
      (err.message.includes("not found in organization") ||
        err.message.includes("System administrators cannot be configured")),
  );

  // 4. Inactive role rejected
  const inactiveRole = await createCustomRole(orgA.id, null, {
    name: "Inactive Finance Approver",
    permissionCodes: [PERMISSIONS.REQUESTS_APPROVE],
  });
  await prisma.organizationRole.update({
    where: { id: inactiveRole.id },
    data: { status: "INACTIVE" },
  });

  await assert.rejects(
    async () => {
      await addStageToDraft({
        organizationId: orgA.id,
        versionId: version.id,
        name: "Inactive Role Stage",
        approvers: [{ approverType: "ROLE", roleId: inactiveRole.id }],
      });
    },
    (err: unknown) =>
      err instanceof WorkflowValidationError &&
      err.message.includes("is inactive and cannot be assigned"),
  );

  // 5. Platform-only permission code rejected
  const { role: validRole } = await createTestUserWithRole({
    organizationId: orgA.id,
    roleSlug: "org-admin",
  });

  await assert.rejects(
    async () => {
      await addStageToDraft({
        organizationId: orgA.id,
        versionId: version.id,
        name: "Platform Perm Stage",
        requiredPermissionCode: PERMISSIONS.PLATFORM_ORGS_MANAGE,
        approvers: [{ approverType: "ROLE", roleId: validRole.id }],
      });
    },
    (err: unknown) =>
      err instanceof WorkflowValidationError &&
      err.message.includes("is platform-only"),
  );
});

// ============================================================
// 5. VALIDATION AND PUBLISHING
// ============================================================

test("5. Workflow draft validation and publishing: rules enforcement and version state transition", async () => {
  const org = await createTestOrg("Publishing Org");
  const { user: admin, role: adminRole } = await createTestUserWithRole({
    organizationId: org.id,
    roleSlug: "org-admin",
  });

  const { workflow, version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Validation Test Workflow",
    workflowType: "TRANSPORTATION_REQUEST",
    createdById: admin.id,
  });

  // 1. Validation fails when draft has 0 stages
  const emptyValidation = await validateWorkflowDraft({
    organizationId: org.id,
    versionId: version.id,
  });
  assert.equal(emptyValidation.valid, false);
  assert.ok(
    emptyValidation.errors.some((e) =>
      e.includes("Workflow must contain at least one approval stage"),
    ),
  );

  // Attempting to publish empty draft throws WorkflowValidationError
  await assert.rejects(
    async () => {
      await publishWorkflowVersion({
        organizationId: org.id,
        versionId: version.id,
        publishedById: admin.id,
      });
    },
    (err: unknown) =>
      err instanceof WorkflowValidationError &&
      err.message.includes("Workflow must contain at least one approval stage"),
  );

  // 2. Add valid stage
  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Valid Review Stage",
    approvalPolicy: "ANY_ONE",
    approvers: [{ approverType: "ROLE", roleId: adminRole.id }],
  });

  // Validation now passes
  const validValidation = await validateWorkflowDraft({
    organizationId: org.id,
    versionId: version.id,
  });
  assert.equal(validValidation.valid, true);
  assert.equal(validValidation.errors.length, 0);

  // 3. Publish Version 1
  const publishedV1 = await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  assert.equal(publishedV1.status, "PUBLISHED");
  assert.ok(publishedV1.publishedAt !== null);
  assert.equal(publishedV1.publishedById, admin.id);

  // Check workflow pointer
  const updatedWf = await prisma.approvalWorkflow.findUniqueOrThrow({
    where: { id: workflow.id },
  });
  assert.equal(updatedWf.currentVersionId, publishedV1.id);

  // 4. Create Version 2 from Version 1
  const v2 = await createDraftFromVersion({
    organizationId: org.id,
    workflowId: workflow.id,
    fromVersionId: publishedV1.id,
    createdById: admin.id,
  });

  assert.equal(v2.versionNumber, 2);
  assert.equal(v2.status, "DRAFT");
  assert.equal(v2.stages.length, 1);

  // Publish Version 2
  const publishedV2 = await publishWorkflowVersion({
    organizationId: org.id,
    versionId: v2.id,
    publishedById: admin.id,
  });

  assert.equal(publishedV2.status, "PUBLISHED");

  // Version 1 must now be ARCHIVED
  const archivedV1 = await prisma.approvalWorkflowVersion.findUniqueOrThrow({
    where: { id: publishedV1.id },
  });
  assert.equal(archivedV1.status, "ARCHIVED");
  assert.ok(archivedV1.archivedAt !== null);

  // Workflow currentVersionId must now point to V2
  const finalWf = await prisma.approvalWorkflow.findUniqueOrThrow({
    where: { id: workflow.id },
  });
  assert.equal(finalWf.currentVersionId, v2.id);
});

// ============================================================
// 6. PUBLISHED VERSION IMMUTABILITY
// ============================================================

test("6. Immutability: published and archived versions reject all stage modifications", async () => {
  const org = await createTestOrg("Immutability Org");
  const { user: admin, role: adminRole } = await createTestUserWithRole({
    organizationId: org.id,
    roleSlug: "org-admin",
  });

  const { workflow, version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Immutable Workflow",
    workflowType: "TRANSPORTATION_REQUEST",
    createdById: admin.id,
  });

  const stage = await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Stage 1",
    approvers: [{ approverType: "ROLE", roleId: adminRole.id }],
  });

  const published = await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  // 1. Cannot add stage to published version
  await assert.rejects(
    async () => {
      await addStageToDraft({
        organizationId: org.id,
        versionId: published.id,
        name: "Stage 2 Attempt",
        approvers: [{ approverType: "ROLE", roleId: adminRole.id }],
      });
    },
    (err: unknown) =>
      err instanceof WorkflowImmutableError &&
      err.message.includes("Cannot add stages to a published workflow version"),
  );

  // 2. Cannot update stage of published version
  await assert.rejects(
    async () => {
      await updateDraftStage({
        organizationId: org.id,
        stageId: stage.id,
        name: "Updated Stage Name",
      });
    },
    (err: unknown) =>
      err instanceof WorkflowImmutableError &&
      err.message.includes("Cannot update stage of a published workflow version"),
  );

  // 3. Cannot remove stage from published version
  await assert.rejects(
    async () => {
      await removeDraftStage({
        organizationId: org.id,
        stageId: stage.id,
      });
    },
    (err: unknown) =>
      err instanceof WorkflowImmutableError &&
      err.message.includes("Cannot remove stage from a published workflow version"),
  );

  // 4. Cannot reorder stages of published version
  await assert.rejects(
    async () => {
      await reorderDraftStages({
        organizationId: org.id,
        versionId: published.id,
        stageOrders: [{ stageId: stage.id, stageOrder: 1 }],
      });
    },
    (err: unknown) =>
      err instanceof WorkflowImmutableError &&
      err.message.includes("Cannot reorder stages of a published workflow version"),
  );

  // 5. Cannot re-publish already published version
  await assert.rejects(
    async () => {
      await publishWorkflowVersion({
        organizationId: org.id,
        versionId: published.id,
        publishedById: admin.id,
      });
    },
    (err: unknown) =>
      err instanceof WorkflowImmutableError &&
      err.message.includes("Only DRAFT versions can be published"),
  );
});

// ============================================================
// 7. VERSION MANAGEMENT & DRAFT CLONING
// ============================================================

test("7. Version management: deep clone to draft, single draft constraint, and instance pinning", async () => {
  const org = await createTestOrg("Version Mgmt Org");
  const dept = await createTestDept(org.id, "Logistics");
  const { user: admin, role: adminRole } = await createTestUserWithRole({
    organizationId: org.id,
    roleSlug: "org-admin",
  });
  const { user: requester } = await createTestUserWithRole({
    organizationId: org.id,
    roleSlug: "department-user",
    departmentId: dept.id,
  });

  const { workflow, version: v1 } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Versioned Workflow",
    workflowType: "TRANSPORTATION_REQUEST",
    createdById: admin.id,
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: v1.id,
    name: "Stage 1 Original",
    approvalPolicy: "ANY_ONE",
    approvers: [{ approverType: "ROLE", roleId: adminRole.id }],
  });

  const publishedV1 = await publishWorkflowVersion({
    organizationId: org.id,
    versionId: v1.id,
    publishedById: admin.id,
  });

  // Start an instance while V1 is active
  const { instance } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "TRANSPORTATION_REQUEST",
    entityType: "TRANSPORTATION_REQUEST",
    entityId: "req-pinned-test",
    requesterId: requester.id,
    departmentId: dept.id,
  });

  assert.equal(instance.workflowVersionId, publishedV1.id);

  // Clone V1 to create DRAFT V2
  const v2 = await createDraftFromVersion({
    organizationId: org.id,
    workflowId: workflow.id,
    fromVersionId: publishedV1.id,
    createdById: admin.id,
  });

  assert.equal(v2.versionNumber, 2);
  assert.equal(v2.status, "DRAFT");
  assert.equal(v2.stages.length, 1);
  assert.equal(v2.stages[0].name, "Stage 1 Original");

  // Attempting to create another draft while V2 is still DRAFT is rejected
  await assert.rejects(
    async () => {
      await createDraftFromVersion({
        organizationId: org.id,
        workflowId: workflow.id,
        fromVersionId: publishedV1.id,
        createdById: admin.id,
      });
    },
    (err: unknown) =>
      err instanceof WorkflowValidationError &&
      err.message.includes("already exists for this workflow"),
  );

  // Modify V2 stages and publish V2
  await updateDraftStage({
    organizationId: org.id,
    stageId: v2.stages[0].id,
    name: "Stage 1 Modified for V2",
  });

  const publishedV2 = await publishWorkflowVersion({
    organizationId: org.id,
    versionId: v2.id,
    publishedById: admin.id,
  });

  assert.equal(publishedV2.status, "PUBLISHED");

  // Verify the previously started instance remains pinned to V1
  const refreshedInstance = await prisma.approvalWorkflowInstance.findUniqueOrThrow({
    where: { id: instance.id },
  });
  assert.equal(
    refreshedInstance.workflowVersionId,
    publishedV1.id,
    "Existing instance must remain pinned to original version V1",
  );
});

// ============================================================
// 8. AUTHORIZATION AND PERMISSION CHECKS
// ============================================================

test("8. Authorization checks: only users with org:roles:manage can configure workflows", async () => {
  const org = await createTestOrg("RBAC Workflow Org");

  // User with org-admin (has org:roles:manage)
  const { user: adminUser } = await createTestUserWithRole({
    organizationId: org.id,
    roleSlug: "org-admin",
  });

  const adminAuth = await resolveAuthorizationContextForUser(adminUser.id);
  assert.ok(adminAuth);
  assert.equal(adminAuth.hasPermission(PERMISSIONS.ORG_ROLES_MANAGE), true);

  // User with vice-org-admin (excludes org:roles:manage)
  const { user: viceUser } = await createTestUserWithRole({
    organizationId: org.id,
    roleSlug: "vice-org-admin",
  });

  const viceAuth = await resolveAuthorizationContextForUser(viceUser.id);
  assert.ok(viceAuth);
  assert.equal(viceAuth.hasPermission(PERMISSIONS.ORG_ROLES_MANAGE), false);

  assert.throws(
    () => viceAuth.requirePermission(PERMISSIONS.ORG_ROLES_MANAGE),
    (err: unknown) => err instanceof ForbiddenError,
  );

  // System Administrator (has no organization permissions)
  const sysAdmin = await prisma.user.create({
    data: {
      organizationId: null,
      firstName: "Platform",
      lastName: "Superadmin",
      email: uniqueEmail("sysadmin-rbac"),
      passwordHash: "hashed-pw",
      role: "SYSTEM_ADMINISTRATOR",
      status: "ACTIVE",
    },
  });

  const sysAdminAuth = await resolveAuthorizationContextForUser(sysAdmin.id);
  assert.ok(sysAdminAuth);
  assert.equal(sysAdminAuth.isSystemAdministrator, true);
  assert.equal(sysAdminAuth.hasPermission(PERMISSIONS.ORG_ROLES_MANAGE), false);
});
