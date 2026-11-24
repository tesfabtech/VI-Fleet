import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "@/lib/prisma";
import { assignRolesToUser, PERMISSIONS } from "@/lib/rbac";
import {
  addStageToDraft,
  cancelWorkflowInstance,
  createDraftFromVersion,
  createWorkflowDraft,
  evaluateApproverEligibility,
  getEligibleApproverIdsForStage,
  getWorkflowHistory,
  getWorkflowInstanceState,
  publishWorkflowVersion,
  recordApprovalDecision,
  removeDraftStage,
  reorderDraftStages,
  resubmitWorkflowInstance,
  skipOptionalStage,
  startWorkflowInstance,
  updateDraftStage,
  validateWorkflowDraft,
} from "./index";
import {
  ApproverEligibilityError,
  DuplicateDecisionError,
  MandatoryStageCannotBeSkippedError,
  SelfApprovalProhibitedError,
  StageNotActiveError,
  WorkflowImmutableError,
  WorkflowNotFoundError,
  WorkflowValidationError,
} from "./errors";

// Helper to generate unique emails
function uniqueEmail(prefix = "test") {
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

// Helper to create a test department
async function createTestDept(organizationId: string, name = "Logistics") {
  return prisma.department.create({
    data: {
      organizationId,
      name: `${name}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: "ACTIVE",
    },
  });
}

// Helper to create a test user
async function createTestUser(params: {
  organizationId: string;
  departmentId?: string | null;
  role?: "ORGANIZATION_ADMINISTRATOR" | "DEPARTMENT_USER" | "TRANSPORT_MANAGER" | "DRIVER" | "SYSTEM_ADMINISTRATOR";
  status?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
}) {
  const email = uniqueEmail("user");
  const role = params.role ?? "ORGANIZATION_ADMINISTRATOR";
  let departmentId = params.departmentId ?? null;

  if (role === "DEPARTMENT_USER" && !departmentId) {
    const dept = await createTestDept(params.organizationId, "Default Dept");
    departmentId = dept.id;
  } else if (role !== "DEPARTMENT_USER") {
    departmentId = null;
  }

  const user = await prisma.user.create({
    data: {
      organizationId: role === "SYSTEM_ADMINISTRATOR" ? null : params.organizationId,
      departmentId,
      firstName: "Test",
      lastName: "User",
      email,
      passwordHash: "hashed-pw",
      role,
      status: params.status ?? "ACTIVE",
    },
  });

  if (
    role !== "SYSTEM_ADMINISTRATOR" &&
    params.status !== "INACTIVE" &&
    params.status !== "SUSPENDED"
  ) {
    const slugMap: Record<string, string> = {
      ORGANIZATION_ADMINISTRATOR: "org-admin",
      TRANSPORT_MANAGER: "transport-manager",
      DEPARTMENT_USER: "department-user",
      DRIVER: "driver",
    };
    const roleSlug = slugMap[role] ?? "org-admin";
    const orgRole = await prisma.organizationRole.findFirst({
      where: { organizationId: params.organizationId, slug: roleSlug },
    });
    if (orgRole) {
      // If DRIVER, ensure driver profile exists
      if (role === "DRIVER") {
        await prisma.driver.create({
          data: {
            organizationId: params.organizationId,
            userId: user.id,
            firstName: "Driver",
            lastName: "Test",
            licenseNumber: `DL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            status: "ACTIVE",
          },
        });
      }

      await prisma.userRoleAssignment.create({
        data: {
          organizationId: params.organizationId,
          userId: user.id,
          roleId: orgRole.id,
          departmentId: role === "DEPARTMENT_USER" ? departmentId : null,
          status: "ACTIVE",
        },
      });
    }
  }

  return user;
}

// ============================================================
// CONFIGURABLE APPROVAL WORKFLOW ENGINE TESTS
// ============================================================

test("1. Organization tenant isolation: workflows and instances isolated across organizations", async () => {
  const orgA = await createTestOrg("Tenant Workflow Org A");
  const orgB = await createTestOrg("Tenant Workflow Org B");

  const adminA = await createTestUser({ organizationId: orgA.id, role: "ORGANIZATION_ADMINISTRATOR" });
  const adminB = await createTestUser({ organizationId: orgB.id, role: "ORGANIZATION_ADMINISTRATOR" });

  // Create workflow in Org A
  const { workflow: wfA, version: vA } = await createWorkflowDraft({
    organizationId: orgA.id,
    name: "Org A Transportation Workflow",
    workflowType: "TRANSPORT_REQUEST",
    createdById: adminA.id,
  });

  // Adding Org B user to Org A workflow stage must be rejected
  await assert.rejects(
    async () => {
      await addStageToDraft({
        organizationId: orgA.id,
        versionId: vA.id,
        name: "Stage 1",
        approvers: [{ approverType: "USER", userId: adminB.id }],
      });
    },
    WorkflowValidationError,
  );

  // Add valid stage in Org A
  await addStageToDraft({
    organizationId: orgA.id,
    versionId: vA.id,
    name: "Stage 1",
    approvers: [{ approverType: "USER", userId: adminA.id }],
  });

  await publishWorkflowVersion({
    organizationId: orgA.id,
    versionId: vA.id,
    publishedById: adminA.id,
  });

  // Attempting to start Org A's workflow type within Org B must fail
  await assert.rejects(
    async () => {
      await startWorkflowInstance({
        organizationId: orgB.id,
        workflowType: "TRANSPORT_REQUEST",
        entityType: "TRANSPORT_REQUEST",
        entityId: "REQ-100",
        requesterId: adminB.id,
      });
    },
    WorkflowNotFoundError,
  );
});

test("2. Workflow creation and configuration: draft lifecycle and stage addition", async () => {
  const org = await createTestOrg("Config Org");
  const admin = await createTestUser({ organizationId: org.id });

  const { workflow, version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Multi-stage Approval",
    description: "Standard workflow",
    workflowType: "EXPENSE_APPROVAL",
    createdById: admin.id,
  });

  assert.equal(workflow.status, "ACTIVE");
  assert.equal(version.status, "DRAFT");
  assert.equal(version.versionNumber, 1);

  const stage1 = await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Initial Review",
    stageOrder: 1,
    approvalPolicy: "ANY_ONE",
    approvers: [{ approverType: "USER", userId: admin.id }],
  });

  assert.equal(stage1.name, "Initial Review");
  assert.equal(stage1.stageOrder, 1);
  assert.equal(stage1.approvers.length, 1);
});

test("3. Stage ordering and reordering: consecutive sequencing and removal", async () => {
  const org = await createTestOrg("Ordering Org");
  const admin = await createTestUser({ organizationId: org.id });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Ordering Workflow",
    workflowType: "ORDERING_TEST",
  });

  const stage1 = await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Stage One",
    stageOrder: 1,
    approvers: [{ approverType: "USER", userId: admin.id }],
  });

  const stage2 = await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Stage Two",
    stageOrder: 2,
    approvers: [{ approverType: "USER", userId: admin.id }],
  });

  const stage3 = await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Stage Three",
    stageOrder: 3,
    approvers: [{ approverType: "USER", userId: admin.id }],
  });

  // Reorder stages: swap stage 1 and stage 3 -> [3, 2, 1]
  const reordered = await reorderDraftStages({
    organizationId: org.id,
    versionId: version.id,
    stageOrders: [
      { stageId: stage3.id, stageOrder: 1 },
      { stageId: stage2.id, stageOrder: 2 },
      { stageId: stage1.id, stageOrder: 3 },
    ],
  });

  assert.equal(reordered[0].id, stage3.id);
  assert.equal(reordered[0].stageOrder, 1);
  assert.equal(reordered[2].id, stage1.id);
  assert.equal(reordered[2].stageOrder, 3);

  // Remove middle stage (stage 2) -> remaining stages are renumbered 1 and 2
  await removeDraftStage({
    organizationId: org.id,
    stageId: stage2.id,
  });

  const remaining = await prisma.approvalWorkflowStage.findMany({
    where: { versionId: version.id },
    orderBy: { stageOrder: "asc" },
  });

  assert.equal(remaining.length, 2);
  assert.equal(remaining[0].stageOrder, 1);
  assert.equal(remaining[1].stageOrder, 2);
});

test("4. Invalid workflow configurations: validation rules", async () => {
  const org = await createTestOrg("Invalid Config Org");
  const admin = await createTestUser({ organizationId: org.id });
  const sysAdmin = await createTestUser({ organizationId: org.id, role: "SYSTEM_ADMINISTRATOR" });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Validation Test",
    workflowType: "VAL_TEST",
  });

  // Validating draft with 0 stages must fail
  const valResult1 = await validateWorkflowDraft({
    organizationId: org.id,
    versionId: version.id,
  });
  assert.equal(valResult1.valid, false);

  // Stage without approvers must be rejected
  await assert.rejects(
    async () => {
      await addStageToDraft({
        organizationId: org.id,
        versionId: version.id,
        name: "Stage Empty",
        approvers: [],
      });
    },
    WorkflowValidationError,
  );

  // Stage with platform-only permission must be rejected
  await assert.rejects(
    async () => {
      await addStageToDraft({
        organizationId: org.id,
        versionId: version.id,
        name: "Stage Platform",
        requiredPermissionCode: "platform:organizations:manage",
        approvers: [{ approverType: "USER", userId: admin.id }],
      });
    },
    WorkflowValidationError,
  );

  // Stage with System Administrator approver must be rejected
  await assert.rejects(
    async () => {
      await addStageToDraft({
        organizationId: org.id,
        versionId: version.id,
        name: "Stage SysAdmin",
        approvers: [{ approverType: "USER", userId: sysAdmin.id }],
      });
    },
    WorkflowValidationError,
  );
});

test("5. ANY_ONE approval behavior: first valid approval advances stage", async () => {
  const org = await createTestOrg("AnyOne Org");
  const admin = await createTestUser({ organizationId: org.id });
  const approver1 = await createTestUser({ organizationId: org.id });
  const approver2 = await createTestUser({ organizationId: org.id });
  const requester = await createTestUser({ organizationId: org.id });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Any One Test",
    workflowType: "ANY_ONE_WF",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Dual Approver Stage",
    approvalPolicy: "ANY_ONE",
    approvers: [
      { approverType: "USER", userId: approver1.id },
      { approverType: "USER", userId: approver2.id },
    ],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  const { instance } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "ANY_ONE_WF",
    entityType: "ITEM",
    entityId: "ITEM-1",
    requesterId: requester.id,
  });

  // Approver 1 approves
  const res = await recordApprovalDecision({
    organizationId: org.id,
    instanceId: instance.id,
    approverId: approver1.id,
    decisionType: "APPROVE",
  });

  assert.equal(res.outcome, "WORKFLOW_APPROVED");
  assert.equal(res.instance.status, "APPROVED");

  // Approver 2 attempting to record decision after stage completed must fail
  await assert.rejects(
    async () => {
      await recordApprovalDecision({
        organizationId: org.id,
        instanceId: instance.id,
        approverId: approver2.id,
        decisionType: "APPROVE",
      });
    },
    StageNotActiveError,
  );
});

test("6. ALL approval behavior: all required approvers must approve before stage completion", async () => {
  const org = await createTestOrg("AllPolicy Org");
  const admin = await createTestUser({ organizationId: org.id });
  const approver1 = await createTestUser({ organizationId: org.id });
  const approver2 = await createTestUser({ organizationId: org.id });
  const requester = await createTestUser({ organizationId: org.id });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "All Policy Test",
    workflowType: "ALL_WF",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Consensus Stage",
    approvalPolicy: "ALL",
    approvers: [
      { approverType: "USER", userId: approver1.id },
      { approverType: "USER", userId: approver2.id },
    ],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  const { instance } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "ALL_WF",
    entityType: "ITEM",
    entityId: "ITEM-ALL",
    requesterId: requester.id,
  });

  // Approver 1 approves -> stage remains IN_PROGRESS
  const res1 = await recordApprovalDecision({
    organizationId: org.id,
    instanceId: instance.id,
    approverId: approver1.id,
    decisionType: "APPROVE",
  });

  assert.equal(res1.outcome, "DECISION_RECORDED");
  assert.deepEqual(res1.pendingApproverIds, [approver2.id]);

  const state1 = await getWorkflowInstanceState({
    organizationId: org.id,
    instanceId: instance.id,
  });
  assert.equal(state1.instance.status, "IN_PROGRESS");
  assert.equal(state1.activeStageInstance?.status, "IN_PROGRESS");

  // Approver 2 approves -> stage completes and workflow completes
  const res2 = await recordApprovalDecision({
    organizationId: org.id,
    instanceId: instance.id,
    approverId: approver2.id,
    decisionType: "APPROVE",
  });

  assert.equal(res2.outcome, "WORKFLOW_APPROVED");
  assert.equal(res2.instance.status, "APPROVED");
});

test("7. Rejection termination: rejection terminates workflow immediately", async () => {
  const org = await createTestOrg("Reject Org");
  const admin = await createTestUser({ organizationId: org.id });
  const approver = await createTestUser({ organizationId: org.id });
  const requester = await createTestUser({ organizationId: org.id });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Reject Test",
    workflowType: "REJECT_WF",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Gate 1",
    approvers: [{ approverType: "USER", userId: approver.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  const { instance } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "REJECT_WF",
    entityType: "DOC",
    entityId: "DOC-1",
    requesterId: requester.id,
  });

  // Approver rejects
  const res = await recordApprovalDecision({
    organizationId: org.id,
    instanceId: instance.id,
    approverId: approver.id,
    decisionType: "REJECT",
    comment: "Does not meet requirements.",
  });

  assert.equal(res.outcome, "REJECTED");
  assert.equal(res.instance.status, "REJECTED");
  assert.notEqual(res.instance.completedAt, null);

  // Further decision attempt must fail
  await assert.rejects(
    async () => {
      await recordApprovalDecision({
        organizationId: org.id,
        instanceId: instance.id,
        approverId: approver.id,
        decisionType: "APPROVE",
      });
    },
    StageNotActiveError,
  );
});

test("8. Request-changes behavior: pausing, requester resubmission, and iteration advancement", async () => {
  const org = await createTestOrg("Changes Org");
  const admin = await createTestUser({ organizationId: org.id });
  const approver = await createTestUser({ organizationId: org.id });
  const requester = await createTestUser({ organizationId: org.id });
  const stranger = await createTestUser({ organizationId: org.id });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Changes Workflow",
    workflowType: "CHANGES_WF",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Review Stage",
    approvers: [{ approverType: "USER", userId: approver.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  const { instance } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "CHANGES_WF",
    entityType: "REQ",
    entityId: "REQ-CORRECT",
    requesterId: requester.id,
  });

  // Approver requests changes
  const changeRes = await recordApprovalDecision({
    organizationId: org.id,
    instanceId: instance.id,
    approverId: approver.id,
    decisionType: "REQUEST_CHANGES",
    comment: "Please provide supporting cost estimates.",
  });

  assert.equal(changeRes.outcome, "CHANGES_REQUESTED");
  assert.equal(changeRes.instance.status, "CHANGES_REQUESTED");

  // Non-requester cannot resubmit
  await assert.rejects(
    async () => {
      await resubmitWorkflowInstance({
        organizationId: org.id,
        instanceId: instance.id,
        requesterId: stranger.id,
        comment: "Trying to resubmit on someone else's behalf",
      });
    },
    /Only the original requester/,
  );

  // Requester resubmits
  const resubmitRes = await resubmitWorkflowInstance({
    organizationId: org.id,
    instanceId: instance.id,
    requesterId: requester.id,
    comment: "Estimates attached.",
  });

  assert.equal(resubmitRes.instance.status, "IN_PROGRESS");
  assert.equal(resubmitRes.stageInstance.iteration, 2);
  assert.equal(resubmitRes.stageInstance.status, "IN_PROGRESS");

  // Approver approves iteration 2
  const approveRes = await recordApprovalDecision({
    organizationId: org.id,
    instanceId: instance.id,
    approverId: approver.id,
    decisionType: "APPROVE",
  });

  assert.equal(approveRes.outcome, "WORKFLOW_APPROVED");
  assert.equal(approveRes.instance.status, "APPROVED");
});

test("9. Optional stage handling: explicit skipping vs mandatory stage enforcement", async () => {
  const org = await createTestOrg("Optional Org");
  const admin = await createTestUser({ organizationId: org.id });
  const approver1 = await createTestUser({ organizationId: org.id });
  const approver2 = await createTestUser({ organizationId: org.id });
  const requester = await createTestUser({ organizationId: org.id });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Optional Workflow",
    workflowType: "OPTIONAL_WF",
  });

  // Stage 1: Mandatory
  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Mandatory Stage 1",
    stageOrder: 1,
    isOptional: false,
    approvers: [{ approverType: "USER", userId: approver1.id }],
  });

  // Stage 2: Optional
  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Optional Audit Stage",
    stageOrder: 2,
    isOptional: true,
    approvers: [{ approverType: "USER", userId: approver2.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  const { instance } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "OPTIONAL_WF",
    entityType: "TRIP",
    entityId: "TRIP-OPT",
    requesterId: requester.id,
  });

  // Attempting to skip mandatory Stage 1 must be rejected
  await assert.rejects(
    async () => {
      await skipOptionalStage({
        organizationId: org.id,
        instanceId: instance.id,
        actorId: admin.id,
        reason: "Try to skip mandatory stage",
      });
    },
    MandatoryStageCannotBeSkippedError,
  );

  // Approve Stage 1
  await recordApprovalDecision({
    organizationId: org.id,
    instanceId: instance.id,
    approverId: approver1.id,
    decisionType: "APPROVE",
  });

  // Now at Stage 2 (Optional stage): explicitly skip it
  const skipRes = await skipOptionalStage({
    organizationId: org.id,
    instanceId: instance.id,
    actorId: approver2.id,
    reason: "Audit waived due to emergency priority.",
  });

  assert.equal(skipRes.outcome, "WORKFLOW_APPROVED");
  assert.equal(skipRes.decision.decisionType, "SKIP");
  assert.equal(skipRes.instance.status, "APPROVED");
});

test("10. Approver eligibility by user: direct user assignment validation", async () => {
  const org = await createTestOrg("User Eligibility Org");
  const admin = await createTestUser({ organizationId: org.id });
  const configuredApprover = await createTestUser({ organizationId: org.id });
  const unconfiguredUser = await createTestUser({ organizationId: org.id });
  const requester = await createTestUser({ organizationId: org.id });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "User Eligibility Test",
    workflowType: "USER_ELIG_WF",
  });

  const stage = await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Configured User Stage",
    approvers: [{ approverType: "USER", userId: configuredApprover.id }],
  });

  // Configured approver is eligible
  const check1 = await evaluateApproverEligibility({
    organizationId: org.id,
    stageId: stage.id,
    userId: configuredApprover.id,
    requesterId: requester.id,
  });
  assert.equal(check1.eligible, true);
  assert.equal(check1.matchedBy, "USER");

  // Unconfigured user is not eligible
  const check2 = await evaluateApproverEligibility({
    organizationId: org.id,
    stageId: stage.id,
    userId: unconfiguredUser.id,
    requesterId: requester.id,
  });
  assert.equal(check2.eligible, false);
});

test("11. Approver eligibility by role: organization role evaluation", async () => {
  const org = await createTestOrg("Role Eligibility Org");
  const admin = await createTestUser({ organizationId: org.id });
  const tmUser = await createTestUser({ organizationId: org.id, role: "TRANSPORT_MANAGER" });
  const driverUser = await createTestUser({ organizationId: org.id, role: "DRIVER" });
  const requester = await createTestUser({ organizationId: org.id });

  const tmRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "transport-manager" },
  });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Role Eligibility Test",
    workflowType: "ROLE_ELIG_WF",
  });

  const stage = await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "TM Role Stage",
    approvers: [{ approverType: "ROLE", roleId: tmRole.id }],
  });

  // TM user is eligible
  const tmCheck = await evaluateApproverEligibility({
    organizationId: org.id,
    stageId: stage.id,
    userId: tmUser.id,
    requesterId: requester.id,
  });
  assert.equal(tmCheck.eligible, true);
  assert.equal(tmCheck.matchedBy, "ROLE");

  // Driver user is not eligible
  const driverCheck = await evaluateApproverEligibility({
    organizationId: org.id,
    stageId: stage.id,
    userId: driverUser.id,
    requesterId: requester.id,
  });
  assert.equal(driverCheck.eligible, false);
});

test("12. Department scope restrictions: department-scoped roles cannot approve outside department", async () => {
  const org = await createTestOrg("Dept Scoping Org");
  const admin = await createTestUser({ organizationId: org.id });
  const deptA = await createTestDept(org.id, "Dept Alpha");
  const deptB = await createTestDept(org.id, "Dept Beta");

  const deptUserA = await createTestUser({
    organizationId: org.id,
    departmentId: deptA.id,
    role: "DEPARTMENT_USER",
  });

  const deptUserRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "department-user" },
  });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Dept Scoped Workflow",
    workflowType: "DEPT_SCOPED_WF",
  });

  const stage = await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Department Head Approval",
    approvers: [{ approverType: "ROLE", roleId: deptUserRole.id }],
  });

  // When instance is for Department A: deptUserA is ELIGIBLE
  const checkDeptA = await evaluateApproverEligibility({
    organizationId: org.id,
    stageId: stage.id,
    userId: deptUserA.id,
    departmentId: deptA.id,
  });
  assert.equal(checkDeptA.eligible, true);

  // When instance is for Department B: deptUserA is INELIGIBLE
  const checkDeptB = await evaluateApproverEligibility({
    organizationId: org.id,
    stageId: stage.id,
    userId: deptUserA.id,
    departmentId: deptB.id,
  });
  assert.equal(checkDeptB.eligible, false);
});

test("13. Self-approval prevention: requester cannot approve their own request", async () => {
  const org = await createTestOrg("SelfApproval Org");
  const admin = await createTestUser({ organizationId: org.id });
  const managerRequester = await createTestUser({ organizationId: org.id });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Self Approval Test",
    workflowType: "SELF_APP_WF",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Manager Stage",
    approvers: [{ approverType: "USER", userId: managerRequester.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  const { instance } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "SELF_APP_WF",
    entityType: "EXPENSE",
    entityId: "EXP-SELF",
    requesterId: managerRequester.id,
  });

  // Requester attempting to approve their own request must throw SelfApprovalProhibitedError
  await assert.rejects(
    async () => {
      await recordApprovalDecision({
        organizationId: org.id,
        instanceId: instance.id,
        approverId: managerRequester.id,
        decisionType: "APPROVE",
      });
    },
    SelfApprovalProhibitedError,
  );
});

test("14. Duplicate decision prevention: duplicate decision on same stage iteration rejected", async () => {
  const org = await createTestOrg("Duplicate Org");
  const admin = await createTestUser({ organizationId: org.id });
  const approver1 = await createTestUser({ organizationId: org.id });
  const approver2 = await createTestUser({ organizationId: org.id });
  const requester = await createTestUser({ organizationId: org.id });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Duplicate Test",
    workflowType: "DUP_WF",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Dual Stage",
    approvalPolicy: "ALL",
    approvers: [
      { approverType: "USER", userId: approver1.id },
      { approverType: "USER", userId: approver2.id },
    ],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  const { instance } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "DUP_WF",
    entityType: "ITEM",
    entityId: "ITEM-DUP",
    requesterId: requester.id,
  });

  // Approver 1 approves
  await recordApprovalDecision({
    organizationId: org.id,
    instanceId: instance.id,
    approverId: approver1.id,
    decisionType: "APPROVE",
  });

  // Approver 1 attempting a second decision on the same stage iteration must throw DuplicateDecisionError
  await assert.rejects(
    async () => {
      await recordApprovalDecision({
        organizationId: org.id,
        instanceId: instance.id,
        approverId: approver1.id,
        decisionType: "APPROVE",
      });
    },
    DuplicateDecisionError,
  );
});

test("15. Concurrent approval decisions: safe handling without corrupting stage state", async () => {
  const org = await createTestOrg("Concurrent Org");
  const admin = await createTestUser({ organizationId: org.id });
  const approver1 = await createTestUser({ organizationId: org.id });
  const approver2 = await createTestUser({ organizationId: org.id });
  const requester = await createTestUser({ organizationId: org.id });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Concurrent Test",
    workflowType: "CONCUR_WF",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "First Approver Wins",
    approvalPolicy: "ANY_ONE",
    approvers: [
      { approverType: "USER", userId: approver1.id },
      { approverType: "USER", userId: approver2.id },
    ],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  const { instance } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "CONCUR_WF",
    entityType: "REQ",
    entityId: "REQ-CONCUR",
    requesterId: requester.id,
  });

  // Execute two concurrent approvals
  const results = await Promise.allSettled([
    recordApprovalDecision({
      organizationId: org.id,
      instanceId: instance.id,
      approverId: approver1.id,
      decisionType: "APPROVE",
    }),
    recordApprovalDecision({
      organizationId: org.id,
      instanceId: instance.id,
      approverId: approver2.id,
      decisionType: "APPROVE",
    }),
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");

  // Exactly one succeeded in advancing the stage, and the other safely threw
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);

  const finalState = await getWorkflowInstanceState({
    organizationId: org.id,
    instanceId: instance.id,
  });
  assert.equal(finalState.instance.status, "APPROVED");
});

test("16. Published workflow immutability: published version cannot be modified", async () => {
  const org = await createTestOrg("Immutability Org");
  const admin = await createTestUser({ organizationId: org.id });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Immutable WF",
    workflowType: "IMMUTABLE_WF",
  });

  const stage = await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Original Stage",
    approvers: [{ approverType: "USER", userId: admin.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  // Adding stage to published version must throw WorkflowImmutableError
  await assert.rejects(
    async () => {
      await addStageToDraft({
        organizationId: org.id,
        versionId: version.id,
        name: "Sneaky New Stage",
        approvers: [{ approverType: "USER", userId: admin.id }],
      });
    },
    WorkflowImmutableError,
  );

  // Updating existing stage on published version must throw WorkflowImmutableError
  await assert.rejects(
    async () => {
      await updateDraftStage({
        organizationId: org.id,
        stageId: stage.id,
        name: "Renamed Stage",
      });
    },
    WorkflowImmutableError,
  );

  // Removing stage on published version must throw WorkflowImmutableError
  await assert.rejects(
    async () => {
      await removeDraftStage({
        organizationId: org.id,
        stageId: stage.id,
      });
    },
    WorkflowImmutableError,
  );
});

test("17. Version creation and publication: drafting from existing version archives previous", async () => {
  const org = await createTestOrg("Versioning Org");
  const admin = await createTestUser({ organizationId: org.id });

  const { workflow, version: v1 } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Versioning Test",
    workflowType: "VER_WF",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: v1.id,
    name: "V1 Stage",
    approvers: [{ approverType: "USER", userId: admin.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: v1.id,
    publishedById: admin.id,
  });

  // Create new draft from V1
  const v2 = await createDraftFromVersion({
    organizationId: org.id,
    workflowId: workflow.id,
  });

  assert.equal(v2.versionNumber, 2);
  assert.equal(v2.status, "DRAFT");
  assert.equal(v2.stages.length, 1);

  // Add a second stage to V2
  await addStageToDraft({
    organizationId: org.id,
    versionId: v2.id,
    name: "V2 Additional Stage",
    approvers: [{ approverType: "USER", userId: admin.id }],
  });

  // Publish V2
  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: v2.id,
    publishedById: admin.id,
  });

  // Verify V1 is now ARCHIVED
  const refreshedV1 = await prisma.approvalWorkflowVersion.findUniqueOrThrow({
    where: { id: v1.id },
  });
  assert.equal(refreshedV1.status, "ARCHIVED");

  // Verify workflow.currentVersionId is V2
  const refreshedWf = await prisma.approvalWorkflow.findUniqueOrThrow({
    where: { id: workflow.id },
  });
  assert.equal(refreshedWf.currentVersionId, v2.id);
});

test("18. Existing instances retaining original version: instances pinned to their start version", async () => {
  const org = await createTestOrg("Pinning Org");
  const admin = await createTestUser({ organizationId: org.id });
  const approver = await createTestUser({ organizationId: org.id });
  const requester = await createTestUser({ organizationId: org.id });

  const { workflow, version: v1 } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Pinning Test",
    workflowType: "PIN_WF",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: v1.id,
    name: "V1 Single Stage",
    approvers: [{ approverType: "USER", userId: approver.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: v1.id,
    publishedById: admin.id,
  });

  // Start instance on V1
  const { instance: inst1 } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "PIN_WF",
    entityType: "ORDER",
    entityId: "ORD-1",
    requesterId: requester.id,
  });

  assert.equal(inst1.workflowVersionId, v1.id);

  // Create and publish V2 with an additional stage
  const v2 = await createDraftFromVersion({
    organizationId: org.id,
    workflowId: workflow.id,
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: v2.id,
    name: "V2 Stage 2",
    approvers: [{ approverType: "USER", userId: admin.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: v2.id,
    publishedById: admin.id,
  });

  // Complete inst1's stage
  const completeRes = await recordApprovalDecision({
    organizationId: org.id,
    instanceId: inst1.id,
    approverId: approver.id,
    decisionType: "APPROVE",
  });

  // inst1 completes because V1 only had 1 stage, ignoring V2's 2nd stage!
  assert.equal(completeRes.outcome, "WORKFLOW_APPROVED");
  assert.equal(completeRes.instance.status, "APPROVED");

  // New instance started now uses V2
  const { instance: inst2 } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "PIN_WF",
    entityType: "ORDER",
    entityId: "ORD-2",
    requesterId: requester.id,
  });

  assert.equal(inst2.workflowVersionId, v2.id);
});

test("19. Out-of-order stage transition prevention: decisions confined to active stage", async () => {
  const org = await createTestOrg("OutOfOrder Org");
  const admin = await createTestUser({ organizationId: org.id });
  const approver1 = await createTestUser({ organizationId: org.id });
  const approver2 = await createTestUser({ organizationId: org.id });
  const requester = await createTestUser({ organizationId: org.id });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Multi-stage Sequence",
    workflowType: "SEQ_WF",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Stage 1",
    stageOrder: 1,
    approvers: [{ approverType: "USER", userId: approver1.id }],
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Stage 2",
    stageOrder: 2,
    approvers: [{ approverType: "USER", userId: approver2.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  const { instance } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "SEQ_WF",
    entityType: "TASK",
    entityId: "TASK-1",
    requesterId: requester.id,
  });

  // Approver 2 attempting to approve Stage 2 while workflow is at Stage 1 must be rejected
  await assert.rejects(
    async () => {
      await recordApprovalDecision({
        organizationId: org.id,
        instanceId: instance.id,
        approverId: approver2.id,
        decisionType: "APPROVE",
      });
    },
    ApproverEligibilityError,
  );
});

test("20. Unauthorized decision rejection: unauthorized user cannot approve", async () => {
  const org = await createTestOrg("Unauthorized Org");
  const admin = await createTestUser({ organizationId: org.id });
  const legitimateApprover = await createTestUser({ organizationId: org.id });
  const impostor = await createTestUser({ organizationId: org.id });
  const requester = await createTestUser({ organizationId: org.id });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Security Workflow",
    workflowType: "SEC_WF",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Restricted Stage",
    approvers: [{ approverType: "USER", userId: legitimateApprover.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  const { instance } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "SEC_WF",
    entityType: "DOCUMENT",
    entityId: "DOC-SEC",
    requesterId: requester.id,
  });

  // Impostor decision must throw ApproverEligibilityError
  await assert.rejects(
    async () => {
      await recordApprovalDecision({
        organizationId: org.id,
        instanceId: instance.id,
        approverId: impostor.id,
        decisionType: "APPROVE",
      });
    },
    ApproverEligibilityError,
  );
});

test("21. Workflow cancellation: in-flight cancellation and terminal state protection", async () => {
  const org = await createTestOrg("Cancellation Org");
  const admin = await createTestUser({ organizationId: org.id });
  const approver = await createTestUser({ organizationId: org.id });
  const requester = await createTestUser({ organizationId: org.id });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Cancel Workflow",
    workflowType: "CANCEL_WF",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Stage",
    approvers: [{ approverType: "USER", userId: approver.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  const { instance } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "CANCEL_WF",
    entityType: "SHIPMENT",
    entityId: "SHIP-1",
    requesterId: requester.id,
  });

  // Cancel workflow
  const cancelled = await cancelWorkflowInstance({
    organizationId: org.id,
    instanceId: instance.id,
    actorId: requester.id,
    reason: "No longer needed by department.",
  });

  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(cancelled.cancellationReason, "No longer needed by department.");

  // Attempting to cancel already cancelled workflow must fail
  await assert.rejects(
    async () => {
      await cancelWorkflowInstance({
        organizationId: org.id,
        instanceId: instance.id,
        actorId: requester.id,
        reason: "Cancel again",
      });
    },
    StageNotActiveError,
  );

  // Attempting to record decision on cancelled workflow must fail
  await assert.rejects(
    async () => {
      await recordApprovalDecision({
        organizationId: org.id,
        instanceId: instance.id,
        approverId: approver.id,
        decisionType: "APPROVE",
      });
    },
    StageNotActiveError,
  );
});

test("22. Audit history completeness: complete audit trail across lifecycle", async () => {
  const org = await createTestOrg("Audit Org");
  const admin = await createTestUser({ organizationId: org.id });
  const approver = await createTestUser({ organizationId: org.id });
  const requester = await createTestUser({ organizationId: org.id });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Audit Test Workflow",
    workflowType: "AUDIT_WF",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Audit Stage",
    approvers: [{ approverType: "USER", userId: approver.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  const { instance } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "AUDIT_WF",
    entityType: "INVOICE",
    entityId: "INV-999",
    requesterId: requester.id,
  });

  // 1. Request changes
  await recordApprovalDecision({
    organizationId: org.id,
    instanceId: instance.id,
    approverId: approver.id,
    decisionType: "REQUEST_CHANGES",
    comment: "Attach tax invoice",
  });

  // 2. Resubmit
  await resubmitWorkflowInstance({
    organizationId: org.id,
    instanceId: instance.id,
    requesterId: requester.id,
    comment: "Tax invoice attached",
  });

  // 3. Approve
  await recordApprovalDecision({
    organizationId: org.id,
    instanceId: instance.id,
    approverId: approver.id,
    decisionType: "APPROVE",
  });

  // Retrieve complete history
  const history = await getWorkflowHistory({
    organizationId: org.id,
    instanceId: instance.id,
  });

  const eventTypes = history.map((e) => e.eventType);

  // Verify all expected lifecycle events exist in the audit log
  assert.ok(eventTypes.includes("INSTANCE_STARTED"));
  assert.ok(eventTypes.includes("STAGE_ENTERED"));
  assert.ok(eventTypes.includes("DECISION_RECORDED"));
  assert.ok(eventTypes.includes("CHANGES_REQUESTED"));
  assert.ok(eventTypes.includes("REQUEST_RESUBMITTED"));
  assert.ok(eventTypes.includes("STAGE_COMPLETED"));
  assert.ok(eventTypes.includes("INSTANCE_APPROVED"));

  // Verify every event has an actorId and timestamp
  for (const event of history) {
    assert.ok(event.actorId);
    assert.ok(event.createdAt);
  }
});

test("23. Resubmission concurrency: concurrent state change before resubmission safely rejected and rolled back", async () => {
  const org = await createTestOrg("Resubmit Concurrency Org");
  const admin = await createTestUser({ organizationId: org.id });
  const approver = await createTestUser({ organizationId: org.id });
  const requester = await createTestUser({ organizationId: org.id });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Resubmit Concurrency WF",
    workflowType: "RESUBMIT_CONCUR_WF",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Review Stage",
    approvers: [{ approverType: "USER", userId: approver.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  const { instance } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "RESUBMIT_CONCUR_WF",
    entityType: "CONTRACT",
    entityId: "CTR-1",
    requesterId: requester.id,
  });

  // Approver requests changes
  await recordApprovalDecision({
    organizationId: org.id,
    instanceId: instance.id,
    approverId: approver.id,
    decisionType: "REQUEST_CHANGES",
    comment: "Add signature page",
  });

  // Simulate concurrent cancellation right before resubmission
  await cancelWorkflowInstance({
    organizationId: org.id,
    instanceId: instance.id,
    actorId: admin.id,
    reason: "Contract cancelled concurrently",
  });

  // Calling resubmitWorkflowInstance on the concurrently cancelled instance must fail
  await assert.rejects(
    async () => {
      await resubmitWorkflowInstance({
        organizationId: org.id,
        instanceId: instance.id,
        requesterId: requester.id,
        comment: "Attempting to resubmit cancelled workflow",
      });
    },
    StageNotActiveError,
  );

  // Verify that the transaction rolled back: no new stage instance iteration was created
  const stageInstances = await prisma.approvalStageInstance.findMany({
    where: { instanceId: instance.id },
  });
  assert.equal(stageInstances.length, 1);
  assert.equal(stageInstances[0].iteration, 1);

  // Now test two simultaneous resubmissions on another instance
  const { instance: instance2 } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "RESUBMIT_CONCUR_WF",
    entityType: "CONTRACT",
    entityId: "CTR-2",
    requesterId: requester.id,
  });

  await recordApprovalDecision({
    organizationId: org.id,
    instanceId: instance2.id,
    approverId: approver.id,
    decisionType: "REQUEST_CHANGES",
    comment: "Please revise clause 4",
  });

  const results = await Promise.allSettled([
    resubmitWorkflowInstance({
      organizationId: org.id,
      instanceId: instance2.id,
      requesterId: requester.id,
      comment: "Concurrent resubmit 1",
    }),
    resubmitWorkflowInstance({
      organizationId: org.id,
      instanceId: instance2.id,
      requesterId: requester.id,
      comment: "Concurrent resubmit 2",
    }),
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");

  // Exactly one succeeded in updating status and creating iteration 2
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);

  // In database, exactly one iteration 2 stage instance exists
  const stageInstances2 = await prisma.approvalStageInstance.findMany({
    where: { instanceId: instance2.id },
    orderBy: { iteration: "asc" },
  });
  assert.equal(stageInstances2.length, 2);
  assert.equal(stageInstances2[0].iteration, 1);
  assert.equal(stageInstances2[1].iteration, 2);
  assert.equal(stageInstances2[1].status, "IN_PROGRESS");
});

test("24. Database invariant: workflow cannot reference another workflow's version as currentVersion", async () => {
  const org = await createTestOrg("WF Invariant 1 Org");
  const admin = await createTestUser({ organizationId: org.id });

  const { workflow: wf1 } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Workflow One",
    workflowType: "WF_INV_1",
    createdById: admin.id,
  });

  const { version: v2 } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Workflow Two",
    workflowType: "WF_INV_2",
    createdById: admin.id,
  });

  // Attempt direct DB update to set wf1's currentVersionId to v2 (which belongs to wf2)
  await assert.rejects(
    async () => {
      await prisma.approvalWorkflow.update({
        where: { id: wf1.id },
        data: {
          currentVersionId: v2.id,
        },
      });
    },
    (err: any) => {
      return (
        err.message?.includes("approval_workflows_id_current_version_id_fkey") ||
        err.code === "P2003"
      );
    },
  );
});

test("25. Database invariant: workflow instance cannot reference a version belonging to another workflow", async () => {
  const org = await createTestOrg("WF Invariant 2 Org");
  const requester = await createTestUser({ organizationId: org.id });

  const { workflow: wf1 } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Workflow One",
    workflowType: "WF_INV_2A",
  });

  const { version: v2 } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Workflow Two",
    workflowType: "WF_INV_2B",
  });

  // Attempt direct DB insert of an instance with workflowId = wf1.id, but workflowVersionId = v2.id (belongs to wf2)
  await assert.rejects(
    async () => {
      await prisma.approvalWorkflowInstance.create({
        data: {
          organizationId: org.id,
          workflowId: wf1.id,
          workflowVersionId: v2.id,
          entityType: "ORDER",
          entityId: "ORD-INVALID",
          requesterId: requester.id,
          status: "IN_PROGRESS",
        },
      });
    },
    (err: any) => {
      return (
        err.message?.includes("approval_workflow_instances_workflow_id_workflow_version_i_fkey") ||
        err.code === "P2003"
      );
    },
  );
});

test("26. Database invariant: stage instance cannot reference a stage from another workflow version", async () => {
  const org = await createTestOrg("WF Invariant 3 Org");
  const admin = await createTestUser({ organizationId: org.id });
  const approver = await createTestUser({ organizationId: org.id });
  const requester = await createTestUser({ organizationId: org.id });

  const { workflow, version: v1 } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Workflow Version Integrity",
    workflowType: "STAGE_INV_WF",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: v1.id,
    name: "V1 Stage",
    approvers: [{ approverType: "USER", userId: approver.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: v1.id,
    publishedById: admin.id,
  });

  // Create V2 with a different stage
  const v2 = await createDraftFromVersion({
    organizationId: org.id,
    workflowId: workflow.id,
  });

  const stage2 = await addStageToDraft({
    organizationId: org.id,
    versionId: v2.id,
    name: "V2 Stage",
    approvers: [{ approverType: "USER", userId: approver.id }],
  });

  // Start instance on V1
  const { instance } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "STAGE_INV_WF",
    entityType: "ASSET",
    entityId: "AST-1",
    requesterId: requester.id,
  });

  // Attempt direct DB insert of a stage instance referencing stage2 (belongs to V2, while instance is pinned to V1)
  await assert.rejects(
    async () => {
      await prisma.approvalStageInstance.create({
        data: {
          organizationId: org.id,
          instanceId: instance.id,
          stageId: stage2.id,
          stageOrder: 2,
          iteration: 1,
          status: "IN_PROGRESS",
        },
      });
    },
    (err: any) => {
      return (
        err.message?.includes("Stage version mismatch") ||
        err.message?.includes("trg_approval_stage_instances_validate_version") ||
        err.code === "P2010" ||
        err.code === "P2002" ||
        err.code === "P2003"
      );
    },
  );
});

test("27. Database invariant: instance pinned version cannot be changed once stage instances exist", async () => {
  const org = await createTestOrg("WF Invariant 4 Org");
  const admin = await createTestUser({ organizationId: org.id });
  const approver = await createTestUser({ organizationId: org.id });
  const requester = await createTestUser({ organizationId: org.id });

  const { workflow, version: v1 } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Instance Mutability Test",
    workflowType: "INST_MUT_WF",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: v1.id,
    name: "Stage 1",
    approvers: [{ approverType: "USER", userId: approver.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: v1.id,
    publishedById: admin.id,
  });

  // Start instance on V1
  const { instance } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "INST_MUT_WF",
    entityType: "EXPENSE",
    entityId: "EXP-101",
    requesterId: requester.id,
  });

  // Create and publish V2
  const v2 = await createDraftFromVersion({
    organizationId: org.id,
    workflowId: workflow.id,
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: v2.id,
    publishedById: admin.id,
  });

  // Instance now has a stage instance in DB.
  // Attempt to mutate instance.workflowVersionId from v1 to v2:
  await assert.rejects(
    async () => {
      await prisma.approvalWorkflowInstance.update({
        where: { id: instance.id },
        data: {
          workflowVersionId: v2.id,
        },
      });
    },
    (err: any) => {
      return (
        err.message?.includes("Cannot modify pinned workflow version") ||
        err.message?.includes("trg_workflow_instances_protect_pinned_version") ||
        err.code === "P2010"
      );
    },
  );
});

test("28. PostgreSQL concurrency regression: stage insertion first blocks and rejects concurrent pinned version update", async () => {
  const org = await createTestOrg("Concurrency Test Org 1");
  const admin = await createTestUser({ organizationId: org.id });
  const requester = await createTestUser({ organizationId: org.id });

  const { workflow, version: v1 } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Conc Workflow 1",
    workflowType: "CONC_WF_1",
    createdById: admin.id,
  });

  const s1 = await addStageToDraft({
    organizationId: org.id,
    versionId: v1.id,
    name: "Stage 1",
    approvers: [{ approverType: "USER", userId: admin.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: v1.id,
    publishedById: admin.id,
  });

  const v2 = await createDraftFromVersion({
    organizationId: org.id,
    workflowId: workflow.id,
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: v2.id,
    name: "Stage 2",
    approvers: [{ approverType: "USER", userId: admin.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: v2.id,
    publishedById: admin.id,
  });

  // Create an instance without stage instances (as a base)
  const instance = await prisma.approvalWorkflowInstance.create({
    data: {
      organizationId: org.id,
      workflowId: workflow.id,
      workflowVersionId: v1.id,
      requesterId: requester.id,
      entityType: "EXPENSE",
      entityId: "EXP-CONC-1",
      status: "IN_PROGRESS",
    },
  });

  // T1: Inserts stage instance with S1 (belongs to V1). Trigger executes SELECT ... FOR SHARE on instance row.
  // T2: Concurrently attempts to update instance.workflowVersionId to V2.
  // Because T1 holds FOR SHARE lock, T2's UPDATE blocks until T1 commits.
  // When T1 commits, T2 unblocks, re-evaluates trg_protect_workflow_instance_pinned_version,
  // detects the newly committed stage instance, and throws 23514.

  let t1InsertedSignal!: () => void;
  const t1Inserted = new Promise<void>((resolve) => {
    t1InsertedSignal = resolve;
  });

  let allowT1CommitSignal!: () => void;
  const allowT1Commit = new Promise<void>((resolve) => {
    allowT1CommitSignal = resolve;
  });

  let t2Error: any = null;

  const t1Promise = prisma.$transaction(async (tx1) => {
    await tx1.approvalStageInstance.create({
      data: {
        organizationId: org.id,
        instanceId: instance.id,
        stageId: s1.id,
        stageOrder: 1,
        iteration: 1,
        status: "IN_PROGRESS",
      },
    });
    t1InsertedSignal();
    await allowT1Commit;
  });

  const t2Promise = (async () => {
    await t1Inserted;

    try {
      await prisma.$transaction(async (tx2) => {
        // T2 will block on the row lock held by T1. Allow T1 to commit after a small delay.
        setTimeout(() => allowT1CommitSignal(), 100);

        await tx2.approvalWorkflowInstance.update({
          where: { id: instance.id },
          data: { workflowVersionId: v2.id },
        });
      });
    } catch (err) {
      t2Error = err;
    }
  })();

  await Promise.all([t1Promise, t2Promise]);

  // Assert T2 failed with trigger rejection
  assert.ok(t2Error, "T2 must be rejected by trigger");
  assert.match(
    t2Error.message,
    /Cannot modify pinned workflow version|trg_workflow_instances_protect_pinned_version|23514/
  );

  // Assert final state in database:
  const finalInstance = await prisma.approvalWorkflowInstance.findUniqueOrThrow({
    where: { id: instance.id },
  });
  const finalStages = await prisma.approvalStageInstance.findMany({
    where: { instanceId: instance.id },
    include: { stage: true },
  });

  assert.equal(finalInstance.workflowVersionId, v1.id, "Instance pinned version must remain V1");
  assert.equal(finalStages.length, 1, "Exactly one stage instance must exist");
  assert.equal(finalStages[0].stage.versionId, v1.id, "Stage must belong to instance pinned version V1");
});

test("29. PostgreSQL concurrency regression: version update first blocks and rejects concurrent mismatched stage insertion", async () => {
  const org = await createTestOrg("Concurrency Test Org 2");
  const admin = await createTestUser({ organizationId: org.id });
  const requester = await createTestUser({ organizationId: org.id });

  const { workflow, version: v1 } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Conc Workflow 2",
    workflowType: "CONC_WF_2",
    createdById: admin.id,
  });

  const s1 = await addStageToDraft({
    organizationId: org.id,
    versionId: v1.id,
    name: "Stage 1",
    approvers: [{ approverType: "USER", userId: admin.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: v1.id,
    publishedById: admin.id,
  });

  const v2 = await createDraftFromVersion({
    organizationId: org.id,
    workflowId: workflow.id,
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: v2.id,
    name: "Stage 2",
    approvers: [{ approverType: "USER", userId: admin.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: v2.id,
    publishedById: admin.id,
  });

  // Create an instance without stage instances (initially pinned to v1)
  const instance = await prisma.approvalWorkflowInstance.create({
    data: {
      organizationId: org.id,
      workflowId: workflow.id,
      workflowVersionId: v1.id,
      requesterId: requester.id,
      entityType: "EXPENSE",
      entityId: "EXP-CONC-2",
      status: "IN_PROGRESS",
    },
  });

  // T2: Updates instance.workflowVersionId to V2 (acquires exclusive row lock on instance).
  // T1: Concurrently attempts to insert a stage instance referencing S1 (V1).
  // T1's trigger runs SELECT ... FOR SHARE, which blocks waiting on T2.
  // Once T2 commits to V2, T1 unblocks, reads V2, detects mismatch with S1 (V1), and fails.

  let t2UpdatedSignal!: () => void;
  const t2Updated = new Promise<void>((resolve) => {
    t2UpdatedSignal = resolve;
  });

  let allowT2CommitSignal!: () => void;
  const allowT2Commit = new Promise<void>((resolve) => {
    allowT2CommitSignal = resolve;
  });

  let t1Error: any = null;

  // Run T2 (version update)
  const t2Promise = prisma.$transaction(async (tx2) => {
    await tx2.approvalWorkflowInstance.update({
      where: { id: instance.id },
      data: { workflowVersionId: v2.id },
    });
    t2UpdatedSignal();
    await allowT2Commit;
  });

  // Run T1 (stage insert)
  const t1Promise = (async () => {
    await t2Updated;

    try {
      await prisma.$transaction(async (tx1) => {
        // T1 will block on T2's lock. Allow T2 to commit after a short delay.
        setTimeout(() => allowT2CommitSignal(), 100);

        await tx1.approvalStageInstance.create({
          data: {
            organizationId: org.id,
            instanceId: instance.id,
            stageId: s1.id,
            stageOrder: 1,
            iteration: 1,
            status: "IN_PROGRESS",
          },
        });
      });
    } catch (err) {
      t1Error = err;
    }
  })();

  await Promise.all([t2Promise, t1Promise]);

  // Assert T1 failed with mismatch rejection
  assert.ok(t1Error, "T1 stage insert must be rejected due to version mismatch");
  assert.match(
    t1Error.message,
    /Stage version mismatch|trg_validate_stage_instance_version|23514/
  );

  // Assert final state in database:
  const finalInstance = await prisma.approvalWorkflowInstance.findUniqueOrThrow({
    where: { id: instance.id },
  });
  const finalStages = await prisma.approvalStageInstance.findMany({
    where: { instanceId: instance.id },
  });

  assert.equal(finalInstance.workflowVersionId, v2.id, "Instance pinned version must be V2");
  assert.equal(finalStages.length, 0, "No invalid stage instances from V1 must exist");
});

test("30. Concurrency: ALL approval policy with simultaneous remaining approvers advances/approves without getting stuck", async () => {
  const org = await createTestOrg("ALL Concurrency Org");
  const admin = await createTestUser({ organizationId: org.id });
  const approver1 = await createTestUser({ organizationId: org.id });
  const approver2 = await createTestUser({ organizationId: org.id });
  const requester = await createTestUser({ organizationId: org.id });

  // Part A: Single-stage workflow with ALL policy reaching APPROVED
  const { version: v1 } = await createWorkflowDraft({
    organizationId: org.id,
    name: "ALL Policy Single Stage WF",
    workflowType: "CONCUR_ALL_WF_1",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: v1.id,
    name: "Both Must Approve Stage",
    approvalPolicy: "ALL",
    approvers: [
      { approverType: "USER", userId: approver1.id },
      { approverType: "USER", userId: approver2.id },
    ],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: v1.id,
    publishedById: admin.id,
  });

  const { instance: instance1 } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "CONCUR_ALL_WF_1",
    entityType: "REQ",
    entityId: "REQ-ALL-1",
    requesterId: requester.id,
  });

  // Simultaneously approve by both approver1 and approver2
  const [res1, res2] = await Promise.all([
    recordApprovalDecision({
      organizationId: org.id,
      instanceId: instance1.id,
      approverId: approver1.id,
      decisionType: "APPROVE",
    }),
    recordApprovalDecision({
      organizationId: org.id,
      instanceId: instance1.id,
      approverId: approver2.id,
      decisionType: "APPROVE",
    }),
  ]);

  // One decision was recorded first, and the second completed and approved the workflow
  const outcomes1 = [res1.outcome, res2.outcome].sort();
  assert.deepEqual(outcomes1, ["DECISION_RECORDED", "WORKFLOW_APPROVED"]);

  const finalState1 = await getWorkflowInstanceState({
    organizationId: org.id,
    instanceId: instance1.id,
  });
  assert.equal(finalState1.instance.status, "APPROVED", "Workflow must reach APPROVED, not remain stuck in IN_PROGRESS");
  assert.equal(finalState1.activeStageInstance, null);
  assert.equal(finalState1.instance.stageInstances[0].status, "APPROVED");

  // Verify both decisions exist in database
  const decisions1 = await prisma.approvalDecision.findMany({
    where: { instanceId: instance1.id },
  });
  assert.equal(decisions1.length, 2);
  const decidedUsers1 = new Set(decisions1.map((d) => d.approverId));
  assert.ok(decidedUsers1.has(approver1.id));
  assert.ok(decidedUsers1.has(approver2.id));

  // Part B: Two-stage workflow with ALL policy on Stage 1 reaching Stage 2
  const approver3 = await createTestUser({ organizationId: org.id });

  const { version: v2 } = await createWorkflowDraft({
    organizationId: org.id,
    name: "ALL Policy Multi-Stage WF",
    workflowType: "CONCUR_ALL_WF_2",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: v2.id,
    name: "Stage 1 Both Required",
    approvalPolicy: "ALL",
    approvers: [
      { approverType: "USER", userId: approver1.id },
      { approverType: "USER", userId: approver2.id },
    ],
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: v2.id,
    name: "Stage 2 Final Approval",
    approvalPolicy: "ANY_ONE",
    approvers: [{ approverType: "USER", userId: approver3.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: v2.id,
    publishedById: admin.id,
  });

  const { instance: instance2 } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "CONCUR_ALL_WF_2",
    entityType: "REQ",
    entityId: "REQ-ALL-2",
    requesterId: requester.id,
  });

  // Simultaneously approve Stage 1 by both approver1 and approver2
  const [resA, resB] = await Promise.all([
    recordApprovalDecision({
      organizationId: org.id,
      instanceId: instance2.id,
      approverId: approver1.id,
      decisionType: "APPROVE",
    }),
    recordApprovalDecision({
      organizationId: org.id,
      instanceId: instance2.id,
      approverId: approver2.id,
      decisionType: "APPROVE",
    }),
  ]);

  const outcomes2 = [resA.outcome, resB.outcome].sort();
  assert.deepEqual(outcomes2, ["DECISION_RECORDED", "STAGE_ADVANCED"]);

  const finalState2 = await getWorkflowInstanceState({
    organizationId: org.id,
    instanceId: instance2.id,
  });
  assert.equal(finalState2.instance.status, "IN_PROGRESS");
  assert.ok(finalState2.activeStageInstance);
  assert.equal(finalState2.activeStageInstance.stageOrder, 2, "Workflow must advance to Stage 2 rather than getting stuck");
  assert.equal(finalState2.instance.stageInstances[0].status, "APPROVED");
});

test("31. Concurrency: Simultaneous decision and cancellation safely serializes without state corruption", async () => {
  const org = await createTestOrg("Decision Cancel Concurrency Org");
  const admin = await createTestUser({ organizationId: org.id });
  const approver = await createTestUser({ organizationId: org.id });
  const requester = await createTestUser({ organizationId: org.id });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Decision vs Cancel WF",
    workflowType: "CONCUR_DECIDE_CANCEL_WF",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Single Review Stage",
    approvalPolicy: "ANY_ONE",
    approvers: [{ approverType: "USER", userId: approver.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  const { instance } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "CONCUR_DECIDE_CANCEL_WF",
    entityType: "REQ",
    entityId: "REQ-CANCEL-CONCUR",
    requesterId: requester.id,
  });

  // Concurrently approve and cancel
  const results = await Promise.allSettled([
    recordApprovalDecision({
      organizationId: org.id,
      instanceId: instance.id,
      approverId: approver.id,
      decisionType: "APPROVE",
    }),
    cancelWorkflowInstance({
      organizationId: org.id,
      instanceId: instance.id,
      actorId: admin.id,
      reason: "Concurrent administrative cancellation",
    }),
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");

  // Exactly one succeeded, and the second was safely rejected due to serialized state transition
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0].status === "rejected" && rejected[0].reason instanceof StageNotActiveError);

  const finalState = await getWorkflowInstanceState({
    organizationId: org.id,
    instanceId: instance.id,
  });

  if (results[0].status === "fulfilled") {
    // Approval won
    assert.equal(finalState.instance.status, "APPROVED");
    assert.equal(finalState.instance.stageInstances[0].status, "APPROVED");
  } else {
    // Cancellation won
    assert.equal(finalState.instance.status, "CANCELLED");
    assert.equal(finalState.instance.stageInstances[0].status, "CANCELLED");
  }
});
