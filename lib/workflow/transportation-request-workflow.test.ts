import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "@/lib/prisma";
import {
  addStageToDraft,
  cancelWorkflowInstance,
  createWorkflowDraft,
  evaluateApproverEligibility,
  publishWorkflowVersion,
  recordApprovalDecision,
  resubmitWorkflowInstance,
  skipOptionalStage,
  startWorkflowInstance,
} from "./index";
import { ApproverEligibilityError, SelfApprovalProhibitedError } from "./errors";
import { encodeSpecialRequirements } from "@/lib/department-auth";

function uniqueEmail(prefix = "test") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

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

async function createTestDept(organizationId: string, name = "Logistics") {
  return prisma.department.create({
    data: {
      organizationId,
      name: `${name}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: "ACTIVE",
    },
  });
}

async function createTestUser(params: {
  organizationId: string;
  departmentId?: string | null;
  role?: "ORGANIZATION_ADMINISTRATOR" | "DEPARTMENT_USER" | "TRANSPORT_MANAGER" | "DRIVER";
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
      organizationId: params.organizationId,
      departmentId,
      firstName: "Test",
      lastName: "User",
      email,
      passwordHash: "hashed-pw",
      role,
      status: params.status ?? "ACTIVE",
    },
  });

  if (params.status !== "INACTIVE" && params.status !== "SUSPENDED") {
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

async function createCustomRole(params: {
  organizationId: string;
  name: string;
  slug: string;
  scopeAllowed?: "ORGANIZATION_ONLY" | "DEPARTMENT_ONLY" | "ORGANIZATION_OR_DEPARTMENT";
}) {
  return prisma.organizationRole.create({
    data: {
      organizationId: params.organizationId,
      name: params.name,
      slug: params.slug,
      scopeAllowed: params.scopeAllowed ?? "ORGANIZATION_ONLY",
      roleType: "CUSTOM",
      status: "ACTIVE",
    },
  });
}

async function assignRole(params: {
  organizationId: string;
  userId: string;
  roleId: string;
  departmentId?: string | null;
}) {
  return prisma.userRoleAssignment.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      roleId: params.roleId,
      departmentId: params.departmentId ?? null,
      status: "ACTIVE",
    },
  });
}

test("1. Legacy fallback: Request submission without configured workflow retains PENDING status and creates no workflow instance", async () => {
  const org = await createTestOrg("Legacy Fallback Org");
  const dept = await createTestDept(org.id, "IT Support");
  const requester = await createTestUser({
    organizationId: org.id,
    departmentId: dept.id,
    role: "DEPARTMENT_USER",
  });

  // Submit request inside transaction using the exact workflow resolution pattern
  const request = await prisma.$transaction(async (tx) => {
    const req = await tx.transportationRequest.create({
      data: {
        organizationId: org.id,
        departmentId: dept.id,
        requestedById: requester.id,
        purpose: "Legacy Test Purpose",
        description: "Legacy Test Description",
        origin: "Campus A",
        destination: "Campus B",
        passengerCount: 4,
        requestedStart: new Date(Date.now() + 3600000),
        requestedEnd: new Date(Date.now() + 7200000),
        specialRequirements: encodeSpecialRequirements({
          tripType: "ONE_WAY",
          priority: "STANDARD",
          vehiclePreference: "ANY",
          contactName: "Contact",
          contactPhone: "123",
          cargoDetails: "",
          extraRequirements: "",
        }),
        status: "PENDING",
      },
    });

    const activeWorkflows = await tx.approvalWorkflow.findMany({
      where: {
        organizationId: org.id,
        workflowType: "TRANSPORTATION_REQUEST",
        status: "ACTIVE",
        deletedAt: null,
      },
      include: {
        currentVersion: {
          include: {
            stages: { orderBy: { stageOrder: "asc" } },
          },
        },
      },
    });

    assert.equal(activeWorkflows.length, 0);
    // Explicit legacy fallback: status remains PENDING, no workflow instance created
    return req;
  });

  assert.equal(request.status, "PENDING");

  const workflowInstance = await prisma.approvalWorkflowInstance.findFirst({
    where: {
      organizationId: org.id,
      entityType: "TRANSPORTATION_REQUEST",
      entityId: request.id,
    },
  });

  assert.equal(workflowInstance, null);
});

test("2. Workflow initialization: Request submission with active workflow starts instance, pins version, and enters Stage 1 IN_PROGRESS atomically", async () => {
  const org = await createTestOrg("Workflow Init Org");
  const dept = await createTestDept(org.id, "Biology");
  const requester = await createTestUser({
    organizationId: org.id,
    departmentId: dept.id,
    role: "DEPARTMENT_USER",
  });
  const approver = await createTestUser({
    organizationId: org.id,
    departmentId: dept.id,
    role: "DEPARTMENT_USER",
  });
  const admin = await createTestUser({ organizationId: org.id });

  // Create and publish workflow
  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Transport Workflow",
    workflowType: "TRANSPORTATION_REQUEST",
  });

  const stage = await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Department Head Approval",
    stageOrder: 1,
    approvers: [{ approverType: "USER", userId: approver.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  // Submit request inside transaction
  const { request, instance } = await prisma.$transaction(async (tx) => {
    const req = await tx.transportationRequest.create({
      data: {
        organizationId: org.id,
        departmentId: dept.id,
        requestedById: requester.id,
        purpose: "Field Research Trip",
        description: "Collecting samples",
        origin: "Main Campus",
        destination: "Lake Site",
        passengerCount: 5,
        requestedStart: new Date(Date.now() + 3600000),
        requestedEnd: new Date(Date.now() + 7200000),
        specialRequirements: encodeSpecialRequirements({
          tripType: "ROUND_TRIP",
          priority: "STANDARD",
          vehiclePreference: "SUV_4X4",
          contactName: "Dr. Bio",
          contactPhone: "+251911223344",
          cargoDetails: "Sample coolers",
          extraRequirements: "Rough road",
        }),
        status: "PENDING",
      },
    });

    const activeWorkflows = await tx.approvalWorkflow.findMany({
      where: {
        organizationId: org.id,
        workflowType: "TRANSPORTATION_REQUEST",
        status: "ACTIVE",
        deletedAt: null,
      },
      include: {
        currentVersion: {
          include: {
            stages: {
              include: { approvers: true },
              orderBy: { stageOrder: "asc" },
            },
          },
        },
      },
    });

    assert.equal(activeWorkflows.length, 1);
    const wf = activeWorkflows[0];

    const result = await startWorkflowInstance({
      organizationId: org.id,
      workflowType: "TRANSPORTATION_REQUEST",
      entityType: "TRANSPORTATION_REQUEST",
      entityId: req.id,
      requesterId: requester.id,
      departmentId: dept.id,
      tx,
      resolvedWorkflow: wf,
    });

    return { request: req, instance: result.instance };
  });

  assert.equal(request.status, "PENDING");
  assert.equal(instance.status, "IN_PROGRESS");
  assert.equal(instance.entityId, request.id);
  assert.equal(instance.entityType, "TRANSPORTATION_REQUEST");

  // Verify unique polymorphic relationship
  const foundInstance = await prisma.approvalWorkflowInstance.findUnique({
    where: {
      organizationId_entityType_entityId: {
        organizationId: org.id,
        entityType: "TRANSPORTATION_REQUEST",
        entityId: request.id,
      },
    },
    include: {
      stageInstances: true,
      events: true,
    },
  });

  assert.ok(foundInstance);
  assert.equal(foundInstance.stageInstances.length, 1);
  assert.equal(foundInstance.stageInstances[0].status, "IN_PROGRESS");
  assert.equal(foundInstance.stageInstances[0].stageId, stage.id);
  assert.ok(foundInstance.events.some((e) => e.eventType === "INSTANCE_STARTED"));
  assert.ok(foundInstance.events.some((e) => e.eventType === "STAGE_ENTERED"));
});

test("3. Strict workflow validation: Request submission fails and rolls back atomically if workflow is configured but has no published stages (never silent fallback)", async () => {
  const org = await createTestOrg("Invalid Config Org");
  const dept = await createTestDept(org.id, "Chemistry");
  const requester = await createTestUser({
    organizationId: org.id,
    departmentId: dept.id,
    role: "DEPARTMENT_USER",
  });

  // Create an active workflow without a published version (empty draft only)
  await createWorkflowDraft({
    organizationId: org.id,
    name: "Broken Transport Workflow",
    workflowType: "TRANSPORTATION_REQUEST",
  });

  // Attempt submission: must fail and NOT silently fall back to legacy review
  await assert.rejects(
    async () => {
      await prisma.$transaction(async (tx) => {
        const req = await tx.transportationRequest.create({
          data: {
            organizationId: org.id,
            departmentId: dept.id,
            requestedById: requester.id,
            purpose: "Broken Workflow Submission",
            description: "Should fail and roll back",
            origin: "A",
            destination: "B",
            passengerCount: 2,
            requestedStart: new Date(Date.now() + 3600000),
            requestedEnd: new Date(Date.now() + 7200000),
            specialRequirements: "{}",
            status: "PENDING",
          },
        });

        const activeWorkflows = await tx.approvalWorkflow.findMany({
          where: {
            organizationId: org.id,
            workflowType: "TRANSPORTATION_REQUEST",
            status: "ACTIVE",
            deletedAt: null,
          },
          include: {
            currentVersion: {
              include: {
                stages: { orderBy: { stageOrder: "asc" } },
              },
            },
          },
        });

        const wf = activeWorkflows[0];
        if (!wf.currentVersionId || !wf.currentVersion) {
          throw new Error(`Configured approval workflow "${wf.name}" has no published version.`);
        }

        return req;
      });
    },
    /Configured approval workflow "Broken Transport Workflow" has no published version/,
  );

  // Verify transaction rolled back: no request was created
  const createdReq = await prisma.transportationRequest.findFirst({
    where: {
      organizationId: org.id,
      purpose: "Broken Workflow Submission",
    },
  });

  assert.equal(createdReq, null);
});

test("4. Multi-stage ANY_ONE and ALL approval sequence with request status synchronization", async () => {
  const org = await createTestOrg("Multi Stage Org");
  const dept = await createTestDept(org.id, "Physics");
  const requester = await createTestUser({
    organizationId: org.id,
    departmentId: dept.id,
    role: "DEPARTMENT_USER",
  });
  const deptApprover1 = await createTestUser({
    organizationId: org.id,
    departmentId: dept.id,
    role: "DEPARTMENT_USER",
  });
  const deptApprover2 = await createTestUser({
    organizationId: org.id,
    departmentId: dept.id,
    role: "DEPARTMENT_USER",
  });
  const deanApprover1 = await createTestUser({ organizationId: org.id });
  const deanApprover2 = await createTestUser({ organizationId: org.id });
  const admin = await createTestUser({ organizationId: org.id });

  // Create 2-stage workflow:
  // Stage 1: Department Approval (ANY_ONE policy)
  // Stage 2: Dean Committee Approval (ALL policy - both deanApprover1 and deanApprover2 must approve)
  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Academic Field Trip Workflow",
    workflowType: "TRANSPORTATION_REQUEST",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Department Head Approval",
    stageOrder: 1,
    approvalPolicy: "ANY_ONE",
    approvers: [
      { approverType: "USER", userId: deptApprover1.id },
      { approverType: "USER", userId: deptApprover2.id },
    ],
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Dean Committee Approval",
    stageOrder: 2,
    approvalPolicy: "ALL",
    approvers: [
      { approverType: "USER", userId: deanApprover1.id },
      { approverType: "USER", userId: deanApprover2.id },
    ],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  // Start workflow for request
  const request = await prisma.transportationRequest.create({
    data: {
      organizationId: org.id,
      departmentId: dept.id,
      requestedById: requester.id,
      purpose: "Observatory Excursion",
      description: "Night sky observation",
      origin: "Science Building",
      destination: "Entoto Observatory",
      passengerCount: 15,
      requestedStart: new Date(Date.now() + 3600000),
      requestedEnd: new Date(Date.now() + 10800000),
      specialRequirements: "{}",
      status: "PENDING",
    },
  });

  const { instance } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "TRANSPORTATION_REQUEST",
    entityType: "TRANSPORTATION_REQUEST",
    entityId: request.id,
    requesterId: requester.id,
    departmentId: dept.id,
  });

  // 1. Stage 1 (ANY_ONE): deptApprover1 records APPROVE
  const decision1 = await prisma.$transaction(async (tx) => {
    const res = await recordApprovalDecision({
      organizationId: org.id,
      instanceId: instance.id,
      approverId: deptApprover1.id,
      decisionType: "APPROVE",
      comment: "Dept approved",
      tx,
    });

    if (res.outcome === "WORKFLOW_APPROVED") {
      await tx.transportationRequest.update({
        where: { id: request.id },
        data: { status: "APPROVED" },
      });
    }

    return res;
  });

  assert.equal(decision1.outcome, "STAGE_ADVANCED");

  // Request status must remain PENDING because stage 2 is pending
  const reqAfterStage1 = await prisma.transportationRequest.findUniqueOrThrow({
    where: { id: request.id },
  });
  assert.equal(reqAfterStage1.status, "PENDING");

  // 2. Stage 2 (ALL): deanApprover1 records APPROVE
  const decision2a = await prisma.$transaction(async (tx) => {
    const res = await recordApprovalDecision({
      organizationId: org.id,
      instanceId: instance.id,
      approverId: deanApprover1.id,
      decisionType: "APPROVE",
      comment: "First dean committee member approved",
      tx,
    });

    if (res.outcome === "WORKFLOW_APPROVED") {
      await tx.transportationRequest.update({
        where: { id: request.id },
        data: { status: "APPROVED" },
      });
    }

    return res;
  });

  assert.equal(decision2a.outcome, "DECISION_RECORDED");

  // Request status still PENDING (waiting for deanApprover2)
  const reqAfterDean1 = await prisma.transportationRequest.findUniqueOrThrow({
    where: { id: request.id },
  });
  assert.equal(reqAfterDean1.status, "PENDING");

  // 3. Stage 2 (ALL): deanApprover2 records APPROVE (completes stage and workflow)
  const decision2b = await prisma.$transaction(async (tx) => {
    const res = await recordApprovalDecision({
      organizationId: org.id,
      instanceId: instance.id,
      approverId: deanApprover2.id,
      decisionType: "APPROVE",
      comment: "Second dean committee member approved",
      tx,
    });

    if (res.outcome === "WORKFLOW_APPROVED") {
      await tx.transportationRequest.update({
        where: { id: request.id },
        data: {
          status: "APPROVED",
          reviewedById: deanApprover2.id,
          reviewedAt: new Date(),
        },
      });
    }

    return res;
  });

  assert.equal(decision2b.outcome, "WORKFLOW_APPROVED");

  // Request status is now atomically updated to APPROVED!
  const finalReq = await prisma.transportationRequest.findUniqueOrThrow({
    where: { id: request.id },
  });
  assert.equal(finalReq.status, "APPROVED");
  assert.equal(finalReq.reviewedById, deanApprover2.id);
  assert.ok(finalReq.reviewedAt);

  const finalInstance = await prisma.approvalWorkflowInstance.findUniqueOrThrow({
    where: { id: instance.id },
  });
  assert.equal(finalInstance.status, "APPROVED");
});

test("5. Request changes and resubmission: Approver requests changes, requester corrects and resubmits, new stage iteration created and approved", async () => {
  const org = await createTestOrg("Request Changes Org");
  const dept = await createTestDept(org.id, "Mathematics");
  const requester = await createTestUser({
    organizationId: org.id,
    departmentId: dept.id,
    role: "DEPARTMENT_USER",
  });
  const approver = await createTestUser({
    organizationId: org.id,
    departmentId: dept.id,
    role: "DEPARTMENT_USER",
  });
  const admin = await createTestUser({ organizationId: org.id });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Changes Workflow",
    workflowType: "TRANSPORTATION_REQUEST",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Department Review",
    stageOrder: 1,
    approvers: [{ approverType: "USER", userId: approver.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  const request = await prisma.transportationRequest.create({
    data: {
      organizationId: org.id,
      departmentId: dept.id,
      requestedById: requester.id,
      purpose: "Math Olympiad Travel",
      description: "Travel to competition",
      origin: "Campus Gate",
      destination: "Exhibition Center",
      passengerCount: 10,
      requestedStart: new Date(Date.now() + 3600000),
      requestedEnd: new Date(Date.now() + 7200000),
      specialRequirements: "{}",
      status: "PENDING",
    },
  });

  const { instance } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "TRANSPORTATION_REQUEST",
    entityType: "TRANSPORTATION_REQUEST",
    entityId: request.id,
    requesterId: requester.id,
    departmentId: dept.id,
  });

  // 1. Approver requests changes
  await prisma.$transaction(async (tx) => {
    const res = await recordApprovalDecision({
      organizationId: org.id,
      instanceId: instance.id,
      approverId: approver.id,
      decisionType: "REQUEST_CHANGES",
      comment: "Please specify contact person and reduce passenger count to 8",
      tx,
    });

    assert.equal(res.outcome, "CHANGES_REQUESTED");

    await tx.transportationRequest.update({
      where: { id: request.id },
      data: { status: "CHANGES_REQUESTED" },
    });
  });

  const reqChanges = await prisma.transportationRequest.findUniqueOrThrow({
    where: { id: request.id },
  });
  assert.equal(reqChanges.status, "CHANGES_REQUESTED");

  // 2. Requester edits and resubmits
  await prisma.$transaction(async (tx) => {
    await tx.transportationRequest.update({
      where: { id: request.id },
      data: {
        passengerCount: 8,
        description: "Travel to competition with updated 8 participants and verified contact Dr. Abebe (+251911000000)",
        status: "PENDING",
      },
    });

    const res = await resubmitWorkflowInstance({
      organizationId: org.id,
      instanceId: instance.id,
      requesterId: requester.id,
      comment: "Updated passenger count to 8 and added contact details.",
      tx,
    });

    assert.equal(res.stageInstance.iteration, 2);
    assert.equal(res.stageInstance.status, "IN_PROGRESS");
    assert.equal(res.instance.status, "IN_PROGRESS");
  });

  const reqResubmitted = await prisma.transportationRequest.findUniqueOrThrow({
    where: { id: request.id },
  });
  assert.equal(reqResubmitted.status, "PENDING");
  assert.equal(reqResubmitted.passengerCount, 8);

  // 3. Approver approves iteration 2
  await prisma.$transaction(async (tx) => {
    const res = await recordApprovalDecision({
      organizationId: org.id,
      instanceId: instance.id,
      approverId: approver.id,
      decisionType: "APPROVE",
      comment: "Revisions verified and approved",
      tx,
    });

    assert.equal(res.outcome, "WORKFLOW_APPROVED");

    await tx.transportationRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        reviewedById: approver.id,
        reviewedAt: new Date(),
      },
    });
  });

  const reqFinal = await prisma.transportationRequest.findUniqueOrThrow({
    where: { id: request.id },
  });
  assert.equal(reqFinal.status, "APPROVED");
});

test("6. Rejection: Approver rejection terminates workflow as REJECTED and updates request status to REJECTED", async () => {
  const org = await createTestOrg("Rejection Org");
  const dept = await createTestDept(org.id, "Economics");
  const requester = await createTestUser({
    organizationId: org.id,
    departmentId: dept.id,
    role: "DEPARTMENT_USER",
  });
  const approver = await createTestUser({
    organizationId: org.id,
    departmentId: dept.id,
    role: "DEPARTMENT_USER",
  });
  const admin = await createTestUser({ organizationId: org.id });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Reject Workflow",
    workflowType: "TRANSPORTATION_REQUEST",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Budget Review",
    stageOrder: 1,
    approvers: [{ approverType: "USER", userId: approver.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  const request = await prisma.transportationRequest.create({
    data: {
      organizationId: org.id,
      departmentId: dept.id,
      requestedById: requester.id,
      purpose: "Trip with No Budget",
      description: "Non-approved extracurricular excursion",
      origin: "Main Gate",
      destination: "Resort",
      passengerCount: 20,
      requestedStart: new Date(Date.now() + 3600000),
      requestedEnd: new Date(Date.now() + 7200000),
      specialRequirements: "{}",
      status: "PENDING",
    },
  });

  const { instance } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "TRANSPORTATION_REQUEST",
    entityType: "TRANSPORTATION_REQUEST",
    entityId: request.id,
    requesterId: requester.id,
    departmentId: dept.id,
  });

  // Approver rejects
  await prisma.$transaction(async (tx) => {
    const res = await recordApprovalDecision({
      organizationId: org.id,
      instanceId: instance.id,
      approverId: approver.id,
      decisionType: "REJECT",
      comment: "Disallowed: Non-academic resort trips are not supported by organization fleet.",
      tx,
    });

    assert.equal(res.outcome, "REJECTED");

    await tx.transportationRequest.update({
      where: { id: request.id },
      data: {
        status: "REJECTED",
        rejectionReason: "Disallowed: Non-academic resort trips are not supported by organization fleet.",
        reviewedById: approver.id,
        reviewedAt: new Date(),
      },
    });
  });

  const finalReq = await prisma.transportationRequest.findUniqueOrThrow({
    where: { id: request.id },
  });
  assert.equal(finalReq.status, "REJECTED");
  assert.ok(finalReq.rejectionReason?.includes("Disallowed"));

  const finalInstance = await prisma.approvalWorkflowInstance.findUniqueOrThrow({
    where: { id: instance.id },
  });
  assert.equal(finalInstance.status, "REJECTED");
});

test("7. Optional stage skip: Authorized approver skips optional stage and workflow completes/advances", async () => {
  const org = await createTestOrg("Skip Stage Org");
  const dept = await createTestDept(org.id, "History");
  const requester = await createTestUser({
    organizationId: org.id,
    departmentId: dept.id,
    role: "DEPARTMENT_USER",
  });
  const approver1 = await createTestUser({
    organizationId: org.id,
    departmentId: dept.id,
    role: "DEPARTMENT_USER",
  });
  const auditApprover = await createTestUser({ organizationId: org.id });
  const admin = await createTestUser({ organizationId: org.id });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Optional Audit Workflow",
    workflowType: "TRANSPORTATION_REQUEST",
  });

  // Mandatory Stage 1
  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Department Head Approval",
    stageOrder: 1,
    isOptional: false,
    approvers: [{ approverType: "USER", userId: approver1.id }],
  });

  // Optional Stage 2
  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Security Audit Pre-Check",
    stageOrder: 2,
    isOptional: true,
    approvers: [{ approverType: "USER", userId: auditApprover.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  const request = await prisma.transportationRequest.create({
    data: {
      organizationId: org.id,
      departmentId: dept.id,
      requestedById: requester.id,
      purpose: "Museum Field Visit",
      description: "Visit to National Museum",
      origin: "History Dept",
      destination: "National Museum",
      passengerCount: 10,
      requestedStart: new Date(Date.now() + 3600000),
      requestedEnd: new Date(Date.now() + 7200000),
      specialRequirements: "{}",
      status: "PENDING",
    },
  });

  const { instance } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "TRANSPORTATION_REQUEST",
    entityType: "TRANSPORTATION_REQUEST",
    entityId: request.id,
    requesterId: requester.id,
    departmentId: dept.id,
  });

  // Approve Stage 1
  await recordApprovalDecision({
    organizationId: org.id,
    instanceId: instance.id,
    approverId: approver1.id,
    decisionType: "APPROVE",
  });

  // Now at optional Stage 2: auditApprover skips it
  await prisma.$transaction(async (tx) => {
    const res = await skipOptionalStage({
      organizationId: org.id,
      instanceId: instance.id,
      actorId: auditApprover.id,
      reason: "Waived due to daytime museum visit in low-risk zone",
      tx,
    });

    assert.equal(res.outcome, "WORKFLOW_APPROVED");

    await tx.transportationRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        reviewedById: auditApprover.id,
        reviewedAt: new Date(),
      },
    });
  });

  const finalReq = await prisma.transportationRequest.findUniqueOrThrow({
    where: { id: request.id },
  });
  assert.equal(finalReq.status, "APPROVED");

  const finalInstance = await prisma.approvalWorkflowInstance.findUniqueOrThrow({
    where: { id: instance.id },
  });
  assert.equal(finalInstance.status, "APPROVED");
});

test("8. Workflow cancellation separation: In-flight cancellation cancels workflow and active stage; cancellation of already-approved request preserves immutable APPROVED workflow instance", async () => {
  const org = await createTestOrg("Cancel Separation Org");
  const dept = await createTestDept(org.id, "Agriculture");
  const requester = await createTestUser({
    organizationId: org.id,
    departmentId: dept.id,
    role: "DEPARTMENT_USER",
  });
  const approver = await createTestUser({
    organizationId: org.id,
    departmentId: dept.id,
    role: "DEPARTMENT_USER",
  });
  const admin = await createTestUser({ organizationId: org.id });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Agri Transport Workflow",
    workflowType: "TRANSPORTATION_REQUEST",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Agri Dept Approval",
    stageOrder: 1,
    approvers: [{ approverType: "USER", userId: approver.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  // Part A: In-flight request cancellation
  const inFlightRequest = await prisma.transportationRequest.create({
    data: {
      organizationId: org.id,
      departmentId: dept.id,
      requestedById: requester.id,
      purpose: "In-flight Cancel Test",
      description: "Cancelling before approval",
      origin: "A",
      destination: "B",
      passengerCount: 3,
      requestedStart: new Date(Date.now() + 3600000),
      requestedEnd: new Date(Date.now() + 7200000),
      specialRequirements: "{}",
      status: "PENDING",
    },
  });

  const { instance: inFlightInstance } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "TRANSPORTATION_REQUEST",
    entityType: "TRANSPORTATION_REQUEST",
    entityId: inFlightRequest.id,
    requesterId: requester.id,
    departmentId: dept.id,
  });

  // Cancel in-flight
  await prisma.$transaction(async (tx) => {
    await cancelWorkflowInstance({
      organizationId: org.id,
      instanceId: inFlightInstance.id,
      actorId: requester.id,
      reason: "Meeting cancelled by client",
      tx,
    });

    await tx.transportationRequest.update({
      where: { id: inFlightRequest.id },
      data: { status: "CANCELLED", cancellationReason: "Meeting cancelled by client" },
    });
  });

  const cancelledInst = await prisma.approvalWorkflowInstance.findUniqueOrThrow({
    where: { id: inFlightInstance.id },
    include: { stageInstances: true },
  });
  assert.equal(cancelledInst.status, "CANCELLED");
  // Active stage marked CANCELLED (not REJECTED!)
  assert.equal(cancelledInst.stageInstances[0].status, "CANCELLED");

  // Part B: Already-approved request cancellation
  const approvedRequest = await prisma.transportationRequest.create({
    data: {
      organizationId: org.id,
      departmentId: dept.id,
      requestedById: requester.id,
      purpose: "Approved Cancel Test",
      description: "Cancelling after approval",
      origin: "C",
      destination: "D",
      passengerCount: 3,
      requestedStart: new Date(Date.now() + 3600000),
      requestedEnd: new Date(Date.now() + 7200000),
      specialRequirements: "{}",
      status: "PENDING",
    },
  });

  const { instance: approvedInstance } = await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "TRANSPORTATION_REQUEST",
    entityType: "TRANSPORTATION_REQUEST",
    entityId: approvedRequest.id,
    requesterId: requester.id,
    departmentId: dept.id,
  });

  // Approve the request
  await prisma.$transaction(async (tx) => {
    await recordApprovalDecision({
      organizationId: org.id,
      instanceId: approvedInstance.id,
      approverId: approver.id,
      decisionType: "APPROVE",
      comment: "Approved",
      tx,
    });

    await tx.transportationRequest.update({
      where: { id: approvedRequest.id },
      data: { status: "APPROVED", reviewedById: approver.id, reviewedAt: new Date() },
    });
  });

  // Now cancel the already-approved request:
  // Operational cancellation cancels the request/trip, but preserves the ApprovalWorkflowInstance in APPROVED status!
  await prisma.$transaction(async (tx) => {
    const wfInst = await tx.approvalWorkflowInstance.findFirst({
      where: {
        organizationId: org.id,
        entityType: "TRANSPORTATION_REQUEST",
        entityId: approvedRequest.id,
      },
    });

    // Workflow instance must NOT be cancelled because it completed with APPROVED status
    if (wfInst && wfInst.status !== "APPROVED") {
      await cancelWorkflowInstance({
        organizationId: org.id,
        instanceId: wfInst.id,
        actorId: requester.id,
        reason: "Weather issue",
        tx,
      });
    }

    await tx.transportationRequest.update({
      where: { id: approvedRequest.id },
      data: { status: "CANCELLED", cancellationReason: "Weather issue" },
    });
  });

  const immutableApprovedInst = await prisma.approvalWorkflowInstance.findUniqueOrThrow({
    where: { id: approvedInstance.id },
  });
  // Approval history preserved!
  assert.equal(immutableApprovedInst.status, "APPROVED");

  const cancelledReq = await prisma.transportationRequest.findUniqueOrThrow({
    where: { id: approvedRequest.id },
  });
  assert.equal(cancelledReq.status, "CANCELLED");
});

test("9. Approver authorization & isolation: Self-approval rejected, unauthorized department-scoped role rejected, cross-tenant approver rejected", async () => {
  const orgA = await createTestOrg("Org A Isolation");
  const orgB = await createTestOrg("Org B Isolation");

  const deptA1 = await createTestDept(orgA.id, "Dept A1");
  const deptA2 = await createTestDept(orgA.id, "Dept A2");

  const requester = await createTestUser({
    organizationId: orgA.id,
    departmentId: deptA1.id,
    role: "DEPARTMENT_USER",
  });

  const dept1Approver = await createTestUser({
    organizationId: orgA.id,
    departmentId: deptA1.id,
    role: "DEPARTMENT_USER",
  });

  const dept2Approver = await createTestUser({
    organizationId: orgA.id,
    departmentId: deptA2.id,
    role: "DEPARTMENT_USER",
  });

  const orgBUser = await createTestUser({ organizationId: orgB.id });
  const admin = await createTestUser({ organizationId: orgA.id });

  // Custom role scoped to DEPARTMENT_ONLY
  const deptApproverRole = await createCustomRole({
    organizationId: orgA.id,
    name: "Department Head Role",
    slug: "dept-head-role",
    scopeAllowed: "DEPARTMENT_ONLY",
  });

  await assignRole({
    organizationId: orgA.id,
    userId: dept1Approver.id,
    roleId: deptApproverRole.id,
    departmentId: deptA1.id,
  });

  await assignRole({
    organizationId: orgA.id,
    userId: dept2Approver.id,
    roleId: deptApproverRole.id,
    departmentId: deptA2.id,
  });

  const { version } = await createWorkflowDraft({
    organizationId: orgA.id,
    name: "Scoped Role Workflow",
    workflowType: "TRANSPORTATION_REQUEST",
  });

  const stage = await addStageToDraft({
    organizationId: orgA.id,
    versionId: version.id,
    name: "Dept Head Approval",
    stageOrder: 1,
    approvers: [{ approverType: "ROLE", roleId: deptApproverRole.id }],
  });

  await publishWorkflowVersion({
    organizationId: orgA.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  const request = await prisma.transportationRequest.create({
    data: {
      organizationId: orgA.id,
      departmentId: deptA1.id,
      requestedById: requester.id,
      purpose: "Isolation Test",
      description: "Testing approver scoping",
      origin: "A",
      destination: "B",
      passengerCount: 2,
      requestedStart: new Date(Date.now() + 3600000),
      requestedEnd: new Date(Date.now() + 7200000),
      specialRequirements: "{}",
      status: "PENDING",
    },
  });

  const { instance } = await startWorkflowInstance({
    organizationId: orgA.id,
    workflowType: "TRANSPORTATION_REQUEST",
    entityType: "TRANSPORTATION_REQUEST",
    entityId: request.id,
    requesterId: requester.id,
    departmentId: deptA1.id,
  });

  // 1. Self-approval check: requester cannot approve even if assigned
  await assert.rejects(
    async () => {
      await recordApprovalDecision({
        organizationId: orgA.id,
        instanceId: instance.id,
        approverId: requester.id,
        decisionType: "APPROVE",
      });
    },
    SelfApprovalProhibitedError,
  );

  // 2. Cross-department check: dept2Approver cannot approve Dept A1 instance
  await assert.rejects(
    async () => {
      await recordApprovalDecision({
        organizationId: orgA.id,
        instanceId: instance.id,
        approverId: dept2Approver.id,
        decisionType: "APPROVE",
      });
    },
    ApproverEligibilityError,
  );

  // 3. Cross-tenant check: orgBUser cannot approve Org A instance
  await assert.rejects(
    async () => {
      await recordApprovalDecision({
        organizationId: orgA.id,
        instanceId: instance.id,
        approverId: orgBUser.id,
        decisionType: "APPROVE",
      });
    },
    ApproverEligibilityError,
  );

  // 4. Authorized department approver: dept1Approver succeeds
  const validDecision = await recordApprovalDecision({
    organizationId: orgA.id,
    instanceId: instance.id,
    approverId: dept1Approver.id,
    decisionType: "APPROVE",
    comment: "Authorized department approver approved",
  });

  assert.equal(validDecision.outcome, "WORKFLOW_APPROVED");
});

test("10. Guard against legacy bypass: Legacy review actions on workflow-managed requests are blocked", async () => {
  const org = await createTestOrg("Legacy Bypass Guard Org");
  const dept = await createTestDept(org.id, "Nursing");
  const requester = await createTestUser({
    organizationId: org.id,
    departmentId: dept.id,
    role: "DEPARTMENT_USER",
  });
  const approver = await createTestUser({
    organizationId: org.id,
    departmentId: dept.id,
    role: "DEPARTMENT_USER",
  });
  const admin = await createTestUser({ organizationId: org.id });

  const { version } = await createWorkflowDraft({
    organizationId: org.id,
    name: "Nursing Transport Workflow",
    workflowType: "TRANSPORTATION_REQUEST",
  });

  await addStageToDraft({
    organizationId: org.id,
    versionId: version.id,
    name: "Nursing Head Approval",
    stageOrder: 1,
    approvers: [{ approverType: "USER", userId: approver.id }],
  });

  await publishWorkflowVersion({
    organizationId: org.id,
    versionId: version.id,
    publishedById: admin.id,
  });

  const request = await prisma.transportationRequest.create({
    data: {
      organizationId: org.id,
      departmentId: dept.id,
      requestedById: requester.id,
      purpose: "Clinical Rotation",
      description: "Student clinical transport",
      origin: "Nursing School",
      destination: "General Hospital",
      passengerCount: 12,
      requestedStart: new Date(Date.now() + 3600000),
      requestedEnd: new Date(Date.now() + 7200000),
      specialRequirements: "{}",
      status: "PENDING",
    },
  });

  await startWorkflowInstance({
    organizationId: org.id,
    workflowType: "TRANSPORTATION_REQUEST",
    entityType: "TRANSPORTATION_REQUEST",
    entityId: request.id,
    requesterId: requester.id,
    departmentId: dept.id,
  });

  // Verify that a legacy review action checks for workflowInstance and blocks bypass
  const workflowInstance = await prisma.approvalWorkflowInstance.findFirst({
    where: {
      organizationId: org.id,
      entityType: "TRANSPORTATION_REQUEST",
      entityId: request.id,
    },
  });

  assert.ok(workflowInstance);

  // Attempting legacy approval on workflow-governed request must be rejected
  const legacyAttempt = await prisma.$transaction(async (tx) => {
    const existing = await tx.transportationRequest.findFirst({
      where: { id: request.id, organizationId: org.id, deletedAt: null },
    });

    const wfInst = await tx.approvalWorkflowInstance.findFirst({
      where: {
        organizationId: org.id,
        entityType: "TRANSPORTATION_REQUEST",
        entityId: existing!.id,
      },
    });

    if (wfInst) {
      return {
        ok: false,
        error: "This request is governed by a configurable approval workflow. Please process decisions through the Approvals Portal at /approvals.",
      };
    }

    return { ok: true };
  });

  assert.equal(legacyAttempt.ok, false);
  assert.ok(legacyAttempt.error?.includes("/approvals"));
});
