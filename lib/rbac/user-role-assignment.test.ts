import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  activateAssignment,
  assignRolesToUser,
  deactivateAssignment,
  getOrganizationUserAssignments,
  getUserAssignmentDetails,
  revokeAssignment,
  resolveAuthorizationContextForUser,
  createCustomRole,
  PERMISSIONS,
} from "./index";
import { verifyAccountEmail } from "@/app/verify-email/actions";

// Helper to generate unique emails
function uniqueEmail(prefix = "test") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

// Helper to ensure an organization has built-in roles provisioned
async function createTestOrg(name: string) {
  const code = `ORG-${Date.now()}-${Math.floor(Math.random() * 1000)}`.slice(0, 20);
  const org = await prisma.organization.create({
    data: {
      name,
      code,
      status: "ACTIVE",
    },
  });

  // Provision baseline roles using the database procedure
  await prisma.$executeRawUnsafe(
    `SELECT provision_organization_built_in_roles('${org.id}'::uuid);`,
  );

  return org;
}

// Helper to create a test user
async function createTestUser(params: {
  organizationId: string;
  departmentId?: string | null;
  role?: "ORGANIZATION_ADMINISTRATOR" | "DEPARTMENT_USER" | "TRANSPORT_MANAGER" | "DRIVER";
  status?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  pendingEmail?: string | null;
}) {
  const email = uniqueEmail("user");
  const role = params.role ?? "ORGANIZATION_ADMINISTRATOR";
  let departmentId = params.departmentId ?? null;

  // The users_role_scope_check constraint requires DEPARTMENT_USER to have department_id != null,
  // and other organization roles to have department_id == null.
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
      email: params.status === "INACTIVE" && params.pendingEmail ? null : email,
      pendingEmail: params.pendingEmail ?? null,
      passwordHash: "hashed-pw",
      role,
      status: params.status ?? "ACTIVE",
    },
  });
  return user;
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

// ============================================================
// PHASE 7: USER ROLE ASSIGNMENT & SCOPING TEST SUITE
// ============================================================

test("1. Organization tenant isolation: directory and assignments isolated between Organization A and B", async () => {
  const orgA = await createTestOrg("Tenant Org A");
  const orgB = await createTestOrg("Tenant Org B");

  const adminA = await createTestUser({
    organizationId: orgA.id,
    role: "ORGANIZATION_ADMINISTRATOR",
    status: "ACTIVE",
  });
  const userA = await createTestUser({
    organizationId: orgA.id,
    role: "DEPARTMENT_USER",
    status: "ACTIVE",
  });

  const userB = await createTestUser({
    organizationId: orgB.id,
    role: "DEPARTMENT_USER",
    status: "ACTIVE",
  });

  const tmRoleA = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: orgA.id, slug: "transport-manager" },
  });

  // Assign role in Org A
  await assignRolesToUser(orgA.id, adminA.id, {
    userId: userA.id,
    assignments: [{ roleId: tmRoleA.id, scope: "ORGANIZATION" }],
  });

  // Listing in Org A must see userA, but NEVER userB
  const dirA = await getOrganizationUserAssignments(orgA.id);
  const foundUserA = dirA.users.find((u) => u.id === userA.id);
  const foundUserBInA = dirA.users.find((u) => u.id === userB.id);

  assert.ok(foundUserA, "User A must appear in Org A directory");
  assert.equal(foundUserBInA, undefined, "User B must NOT appear in Org A directory");
  assert.equal(
    foundUserA.assignments.some((a) => a.roleId === tmRoleA.id),
    true,
  );

  // Listing in Org B must see userB, but NEVER userA
  const dirB = await getOrganizationUserAssignments(orgB.id);
  const foundUserAInB = dirB.users.find((u) => u.id === userA.id);
  assert.equal(foundUserAInB, undefined, "User A must NOT appear in Org B directory");
});

test("2. Multiple role assignments for one user: user can hold multiple roles simultaneously", async () => {
  const org = await createTestOrg("Multi Role Org");
  const admin = await createTestUser({
    organizationId: org.id,
    role: "ORGANIZATION_ADMINISTRATOR",
    status: "ACTIVE",
  });
  const targetUser = await createTestUser({
    organizationId: org.id,
    role: "DEPARTMENT_USER",
    status: "ACTIVE",
  });
  const dept1 = await createTestDept(org.id, "Dept Alpha");
  const dept2 = await createTestDept(org.id, "Dept Beta");

  const tmRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "transport-manager" },
  });
  const deptUserRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "department-user" },
  });

  // Assign Transport Manager (Org-wide) AND Department User (Dept Alpha)
  await assignRolesToUser(org.id, admin.id, {
    userId: targetUser.id,
    assignments: [
      { roleId: tmRole.id, scope: "ORGANIZATION" },
      { roleId: deptUserRole.id, scope: "DEPARTMENT", departmentId: dept1.id },
    ],
  });

  // Also assign Department User in Dept Beta separately
  await assignRolesToUser(org.id, admin.id, {
    userId: targetUser.id,
    assignments: [
      { roleId: deptUserRole.id, scope: "DEPARTMENT", departmentId: dept2.id },
    ],
  });

  const details = await getUserAssignmentDetails(org.id, targetUser.id);
  assert.ok(details);
  const activeAssignments = details.assignments.filter((a) => a.status === "ACTIVE");
  assert.equal(activeAssignments.length, 3, "User must have 3 active assignments");

  // Verify authorization engine resolves all roles
  const authCtx = await resolveAuthorizationContextForUser(targetUser.id);
  assert.ok(authCtx);
  assert.equal(authCtx.assignments.length, 3);
});

test("3. Valid organization-level assignment succeeds", async () => {
  const org = await createTestOrg("Org Scope Org");
  const admin = await createTestUser({
    organizationId: org.id,
    role: "ORGANIZATION_ADMINISTRATOR",
  });
  const user = await createTestUser({
    organizationId: org.id,
  });

  const tmRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "transport-manager" },
  });

  const res = await assignRolesToUser(org.id, admin.id, {
    userId: user.id,
    assignments: [{ roleId: tmRole.id, scope: "ORGANIZATION" }],
  });

  assert.equal(res.count, 1);

  const asgn = await prisma.userRoleAssignment.findFirstOrThrow({
    where: { organizationId: org.id, userId: user.id, roleId: tmRole.id },
  });
  assert.equal(asgn.status, "ACTIVE");
  assert.equal(asgn.departmentId, null);
  assert.equal(asgn.assignedById, admin.id);
});

test("4. Valid department-level assignment succeeds", async () => {
  const org = await createTestOrg("Dept Scope Org");
  const admin = await createTestUser({
    organizationId: org.id,
    role: "ORGANIZATION_ADMINISTRATOR",
  });
  const user = await createTestUser({
    organizationId: org.id,
  });
  const dept = await createTestDept(org.id, "Operations");

  const deptUserRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "department-user" },
  });

  const res = await assignRolesToUser(org.id, admin.id, {
    userId: user.id,
    assignments: [
      { roleId: deptUserRole.id, scope: "DEPARTMENT", departmentId: dept.id },
    ],
  });

  assert.equal(res.count, 1);

  const asgn = await prisma.userRoleAssignment.findFirstOrThrow({
    where: { organizationId: org.id, userId: user.id, roleId: deptUserRole.id },
  });
  assert.equal(asgn.status, "ACTIVE");
  assert.equal(asgn.departmentId, dept.id);
  assert.equal(asgn.assignedById, admin.id);
});

test("5. Invalid scope according to RoleScopeAllowed is rejected", async () => {
  const org = await createTestOrg("Scope Validation Org");
  const admin = await createTestUser({
    organizationId: org.id,
    role: "ORGANIZATION_ADMINISTRATOR",
  });
  const user = await createTestUser({ organizationId: org.id });
  const dept = await createTestDept(org.id, "Operations");

  // ORGANIZATION_ONLY role (e.g. org-admin or custom role)
  const orgAdminRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "org-admin" },
  });
  assert.equal(orgAdminRole.scopeAllowed, "ORGANIZATION_ONLY");

  // Attempting department scope on ORGANIZATION_ONLY role must fail
  await assert.rejects(
    async () => {
      await assignRolesToUser(org.id, admin.id, {
        userId: user.id,
        assignments: [
          { roleId: orgAdminRole.id, scope: "DEPARTMENT", departmentId: dept.id },
        ],
      });
    },
    /organization-only and cannot be assigned to a department/,
  );

  // DEPARTMENT_ONLY role (e.g. department-user)
  const deptUserRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "department-user" },
  });
  assert.equal(deptUserRole.scopeAllowed, "DEPARTMENT_ONLY");

  // Attempting organization-wide scope on DEPARTMENT_ONLY role must fail
  await assert.rejects(
    async () => {
      await assignRolesToUser(org.id, admin.id, {
        userId: user.id,
        assignments: [{ roleId: deptUserRole.id, scope: "ORGANIZATION" }],
      });
    },
    /requires a specific department scope/,
  );
});

test("6. Cross-organization role rejection: cannot assign Organization B role to Organization A user", async () => {
  const orgA = await createTestOrg("Tenant Org A6");
  const orgB = await createTestOrg("Tenant Org B6");

  const adminA = await createTestUser({
    organizationId: orgA.id,
    role: "ORGANIZATION_ADMINISTRATOR",
  });
  const userA = await createTestUser({ organizationId: orgA.id });

  // Role from Org B
  const tmRoleB = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: orgB.id, slug: "transport-manager" },
  });

  // Attempt to assign Org B role in Org A
  await assert.rejects(
    async () => {
      await assignRolesToUser(orgA.id, adminA.id, {
        userId: userA.id,
        assignments: [{ roleId: tmRoleB.id, scope: "ORGANIZATION" }],
      });
    },
    /was not found or does not belong to your organization/,
  );
});

test("7. Cross-organization department rejection: cannot scope assignment to Organization B department", async () => {
  const orgA = await createTestOrg("Tenant Org A7");
  const orgB = await createTestOrg("Tenant Org B7");

  const adminA = await createTestUser({
    organizationId: orgA.id,
    role: "ORGANIZATION_ADMINISTRATOR",
  });
  const userA = await createTestUser({ organizationId: orgA.id });
  const deptB = await createTestDept(orgB.id, "Dept in Org B");

  const deptUserRoleA = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: orgA.id, slug: "department-user" },
  });

  // Attempt to scope assignment to Org B department
  await assert.rejects(
    async () => {
      await assignRolesToUser(orgA.id, adminA.id, {
        userId: userA.id,
        assignments: [
          { roleId: deptUserRoleA.id, scope: "DEPARTMENT", departmentId: deptB.id },
        ],
      });
    },
    /selected department was not found or does not belong to your organization/,
  );
});

test("8. Inactive role assignment rejection: inactive custom role cannot be assigned", async () => {
  const org = await createTestOrg("Inactive Role Org");
  const admin = await createTestUser({
    organizationId: org.id,
    role: "ORGANIZATION_ADMINISTRATOR",
  });
  const user = await createTestUser({ organizationId: org.id });

  const customRole = await createCustomRole(org.id, admin.id, {
    name: "Archived Role",
    permissionCodes: [PERMISSIONS.VEHICLES_VIEW],
  });

  // Deactivate the custom role
  await prisma.organizationRole.update({
    where: { id: customRole.id },
    data: { status: "INACTIVE" },
  });

  await assert.rejects(
    async () => {
      await assignRolesToUser(org.id, admin.id, {
        userId: user.id,
        assignments: [{ roleId: customRole.id, scope: "ORGANIZATION" }],
      });
    },
    /is currently inactive and cannot be assigned/,
  );
});

test("9. Duplicate assignment prevention: duplicate active assignment for same role and scope is rejected", async () => {
  const org = await createTestOrg("Duplicate Org");
  const admin = await createTestUser({
    organizationId: org.id,
    role: "ORGANIZATION_ADMINISTRATOR",
  });
  const user = await createTestUser({ organizationId: org.id });

  const tmRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "transport-manager" },
  });

  // First assignment succeeds
  await assignRolesToUser(org.id, admin.id, {
    userId: user.id,
    assignments: [{ roleId: tmRole.id, scope: "ORGANIZATION" }],
  });

  // Second assignment of the exact same role and scope must be rejected
  await assert.rejects(
    async () => {
      await assignRolesToUser(org.id, admin.id, {
        userId: user.id,
        assignments: [{ roleId: tmRole.id, scope: "ORGANIZATION" }],
      });
    },
    /already has an active assignment for role/,
  );
});

test("10. Activation of eligible inactive assignments: transitions INACTIVE -> ACTIVE with preconditions", async () => {
  const org = await createTestOrg("Activation Org");
  const admin = await createTestUser({
    organizationId: org.id,
    role: "ORGANIZATION_ADMINISTRATOR",
  });
  const user = await createTestUser({ organizationId: org.id });

  const tmRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "transport-manager" },
  });

  await assignRolesToUser(org.id, admin.id, {
    userId: user.id,
    assignments: [{ roleId: tmRole.id, scope: "ORGANIZATION" }],
  });

  const asgn = await prisma.userRoleAssignment.findFirstOrThrow({
    where: { organizationId: org.id, userId: user.id, roleId: tmRole.id },
  });

  // Deactivate
  const deactivated = await deactivateAssignment(org.id, admin.id, asgn.id);
  assert.equal(deactivated.status, "INACTIVE");

  // Permissions should now be denied
  const authCtxInactive = await resolveAuthorizationContextForUser(user.id);
  assert.ok(authCtxInactive);
  assert.equal(authCtxInactive.hasPermission(PERMISSIONS.TRIPS_DISPATCH), false);

  // Activate back
  const reactivated = await activateAssignment(org.id, admin.id, asgn.id);
  assert.equal(reactivated.status, "ACTIVE");

  // Permissions restored
  const authCtxActive = await resolveAuthorizationContextForUser(user.id);
  assert.ok(authCtxActive);
  assert.equal(authCtxActive.hasPermission(PERMISSIONS.TRIPS_DISPATCH), true);
});

test("11. Revocation and terminal-state protection: REVOKED is terminal and cannot be reactivated", async () => {
  const org = await createTestOrg("Revocation Org");
  const admin = await createTestUser({
    organizationId: org.id,
    role: "ORGANIZATION_ADMINISTRATOR",
  });
  const user = await createTestUser({ organizationId: org.id });

  const tmRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "transport-manager" },
  });

  await assignRolesToUser(org.id, admin.id, {
    userId: user.id,
    assignments: [{ roleId: tmRole.id, scope: "ORGANIZATION" }],
  });

  const asgn = await prisma.userRoleAssignment.findFirstOrThrow({
    where: { organizationId: org.id, userId: user.id, roleId: tmRole.id },
  });

  // Revocation requires a reason
  await assert.rejects(
    async () => {
      await revokeAssignment(org.id, admin.id, asgn.id, "  ");
    },
    /revocation reason of at least 3 characters is required/,
  );

  // Valid revocation
  const revoked = await revokeAssignment(
    org.id,
    admin.id,
    asgn.id,
    "Employee transferred to another unit.",
  );
  assert.equal(revoked.status, "REVOKED");
  assert.equal(revoked.revokedById, admin.id);
  assert.ok(revoked.revokedAt);
  assert.equal(revoked.revocationReason, "Employee transferred to another unit.");

  // Attempting to reactivate a revoked assignment must fail via function
  await assert.rejects(
    async () => {
      await activateAssignment(org.id, admin.id, asgn.id);
    },
    /Cannot reactivate or modify the status of a permanently revoked role assignment/,
  );

  // Attempting to modify status of revoked assignment directly in DB is blocked by trigger
  await assert.rejects(
    async () => {
      await prisma.userRoleAssignment.update({
        where: { id: asgn.id },
        data: { status: "ACTIVE" },
      });
    },
    /Cannot reactivate or modify the status of a permanently revoked role assignment/,
  );
});

test("12. Unauthorized user rejection: role assignment requires org:roles:assign permission", async () => {
  const org = await createTestOrg("Unauthorized Org");
  const departmentUser = await createTestUser({
    organizationId: org.id,
    role: "DEPARTMENT_USER",
  });

  const authCtx = await resolveAuthorizationContextForUser(departmentUser.id);
  assert.ok(authCtx);

  // Department User has no org:roles:assign permission
  assert.equal(authCtx.hasPermission(PERMISSIONS.ORG_ROLES_ASSIGN), false);
  assert.throws(
    () => {
      authCtx.requirePermission(PERMISSIONS.ORG_ROLES_ASSIGN);
    },
    /Missing required permission "org:roles:assign"/,
  );
});

test("13. Department-scoped permissions remaining restricted: department scope never expands to org-wide", async () => {
  const org = await createTestOrg("Restricted Dept Org");
  const admin = await createTestUser({
    organizationId: org.id,
    role: "ORGANIZATION_ADMINISTRATOR",
  });
  const user = await createTestUser({ organizationId: org.id });
  const deptA = await createTestDept(org.id, "Department A");
  const deptB = await createTestDept(org.id, "Department B");

  const deptUserRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "department-user" },
  });

  // Assign department-user scoped strictly to Department A
  await assignRolesToUser(org.id, admin.id, {
    userId: user.id,
    assignments: [
      { roleId: deptUserRole.id, scope: "DEPARTMENT", departmentId: deptA.id },
    ],
  });

  const authCtx = await resolveAuthorizationContextForUser(user.id);
  assert.ok(authCtx);

  // Granted for Department A
  assert.equal(
    authCtx.hasPermission(PERMISSIONS.REQUESTS_CREATE, {
      organizationId: org.id,
      departmentId: deptA.id,
    }),
    true,
  );

  // Strictly denied for Department B
  assert.equal(
    authCtx.hasPermission(PERMISSIONS.REQUESTS_CREATE, {
      organizationId: org.id,
      departmentId: deptB.id,
    }),
    false,
  );

  // Strictly denied for org-wide resources (null or unknown department)
  assert.equal(
    authCtx.hasPermission(PERMISSIONS.REQUESTS_CREATE, {
      organizationId: org.id,
      departmentId: null,
    }),
    false,
  );
  assert.equal(
    authCtx.hasPermission(PERMISSIONS.REQUESTS_CREATE, {
      organizationId: org.id,
    }),
    false,
  );

  // Department IDs helper returns only Department A
  assert.deepEqual(
    authCtx.getAuthorizedDepartmentIds(PERMISSIONS.REQUESTS_CREATE),
    [deptA.id],
  );
});

test("14. Permission union across multiple assignments: separate assignments union permissions with per-assignment scope", async () => {
  const org = await createTestOrg("Permission Union Org");
  const admin = await createTestUser({
    organizationId: org.id,
    role: "ORGANIZATION_ADMINISTRATOR",
  });
  const user = await createTestUser({ organizationId: org.id });
  const deptFinance = await createTestDept(org.id, "Finance");
  const deptHR = await createTestDept(org.id, "Human Resources");

  const deptUserRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "department-user" },
  });

  // Create custom role with vehicles:view (org-wide)
  const vehicleViewerRole = await createCustomRole(org.id, admin.id, {
    name: "Fleet Viewer",
    permissionCodes: [PERMISSIONS.VEHICLES_VIEW],
  });

  // Assign DeptUser in Finance + Vehicle Viewer Org-Wide
  await assignRolesToUser(org.id, admin.id, {
    userId: user.id,
    assignments: [
      { roleId: deptUserRole.id, scope: "DEPARTMENT", departmentId: deptFinance.id },
      { roleId: vehicleViewerRole.id, scope: "ORGANIZATION" },
    ],
  });

  const authCtx = await resolveAuthorizationContextForUser(user.id);
  assert.ok(authCtx);

  // vehicles:view is org-wide: granted across all departments and org
  assert.equal(
    authCtx.hasPermission(PERMISSIONS.VEHICLES_VIEW, { organizationId: org.id }),
    true,
  );
  assert.equal(
    authCtx.hasPermission(PERMISSIONS.VEHICLES_VIEW, {
      organizationId: org.id,
      departmentId: deptHR.id,
    }),
    true,
  );

  // requests:create is ONLY for Finance: denied in HR
  assert.equal(
    authCtx.hasPermission(PERMISSIONS.REQUESTS_CREATE, {
      organizationId: org.id,
      departmentId: deptFinance.id,
    }),
    true,
  );
  assert.equal(
    authCtx.hasPermission(PERMISSIONS.REQUESTS_CREATE, {
      organizationId: org.id,
      departmentId: deptHR.id,
    }),
    false,
  );
});

test("15. Assignment audit metadata: records assignedById, assignedAt, revokedById, revokedAt, revocationReason", async () => {
  const org = await createTestOrg("Audit Metadata Org");
  const admin1 = await createTestUser({
    organizationId: org.id,
    role: "ORGANIZATION_ADMINISTRATOR",
  });
  const admin2 = await createTestUser({
    organizationId: org.id,
    role: "ORGANIZATION_ADMINISTRATOR",
  });
  const user = await createTestUser({ organizationId: org.id });

  const tmRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "transport-manager" },
  });

  const beforeAssign = new Date();
  await assignRolesToUser(org.id, admin1.id, {
    userId: user.id,
    assignments: [{ roleId: tmRole.id, scope: "ORGANIZATION" }],
  });
  const afterAssign = new Date();

  let details = await getUserAssignmentDetails(org.id, user.id);
  assert.ok(details);
  const asgn1 = details.assignments[0];
  assert.equal(asgn1.assignedById, admin1.id);
  assert.equal(asgn1.assignedByName, `${admin1.firstName} ${admin1.lastName}`);
  assert.ok(asgn1.assignedAt >= beforeAssign && asgn1.assignedAt <= afterAssign);
  assert.equal(asgn1.revokedAt, null);
  assert.equal(asgn1.revokedById, null);
  assert.equal(asgn1.revocationReason, null);

  // Admin 2 revokes the assignment
  const beforeRevoke = new Date();
  await revokeAssignment(org.id, admin2.id, asgn1.id, "Audit verification test.");
  const afterRevoke = new Date();

  details = await getUserAssignmentDetails(org.id, user.id);
  assert.ok(details);
  const asgnRevoked = details.assignments[0];
  assert.equal(asgnRevoked.status, "REVOKED");
  assert.equal(asgnRevoked.assignedById, admin1.id);
  assert.equal(asgnRevoked.revokedById, admin2.id);
  assert.equal(asgnRevoked.revokedByName, `${admin2.firstName} ${admin2.lastName}`);
  assert.ok(asgnRevoked.revokedAt! >= beforeRevoke && asgnRevoked.revokedAt! <= afterRevoke);
  assert.equal(asgnRevoked.revocationReason, "Audit verification test.");
});

test("16. Regression of email verification lifecycle: verifying email activates pending assignments without activating inactive/revoked ones", async () => {
  const org = await createTestOrg("Verification Lifecycle Org");
  const admin = await createTestUser({
    organizationId: org.id,
    role: "ORGANIZATION_ADMINISTRATOR",
  });

  const pendingEmail = uniqueEmail("pending-verify");
  const user = await createTestUser({
    organizationId: org.id,
    role: "ORGANIZATION_ADMINISTRATOR",
    status: "INACTIVE",
    pendingEmail,
  });

  const orgAdminRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "org-admin" },
  });
  const tmRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "transport-manager" },
  });
  const vtmRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "vice-transport-manager" },
  });

  // 1. Pending assignment (should activate upon verification)
  const pendingAsgn = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: orgAdminRole.id,
      status: "PENDING_VERIFICATION",
      assignedById: admin.id,
    },
  });

  // 2. Inactive assignment (should NOT activate upon verification)
  const inactiveAsgn = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: tmRole.id,
      status: "INACTIVE",
      assignedById: admin.id,
    },
  });

  // 3. Revoked assignment (should NOT activate upon verification)
  const revokedAsgn = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: vtmRole.id,
      status: "REVOKED",
      assignedById: admin.id,
      revokedById: admin.id,
      revokedAt: new Date(),
      revocationReason: "Permanently revoked prior to verification.",
    },
  });

  // Create verification token
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  // Run email verification action
  const formData = new FormData();
  formData.append("token", rawToken);

  try {
    await verifyAccountEmail({ success: false, message: "" }, formData);
  } catch (err: unknown) {
    // verifyAccountEmail calls redirect("/login?verified=1"), which throws in Next.js
    if (!(err instanceof Error) || !err.message.includes("NEXT_REDIRECT")) {
      throw err;
    }
  }

  // Refresh records
  const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(updatedUser.status, "ACTIVE");
  assert.equal(updatedUser.email, pendingEmail);
  assert.equal(updatedUser.pendingEmail, null);

  const updatedPending = await prisma.userRoleAssignment.findUniqueOrThrow({
    where: { id: pendingAsgn.id },
  });
  const updatedInactive = await prisma.userRoleAssignment.findUniqueOrThrow({
    where: { id: inactiveAsgn.id },
  });
  const updatedRevoked = await prisma.userRoleAssignment.findUniqueOrThrow({
    where: { id: revokedAsgn.id },
  });

  // PENDING_VERIFICATION assignment transitioned to ACTIVE
  assert.equal(updatedPending.status, "ACTIVE");

  // INACTIVE assignment stayed INACTIVE
  assert.equal(updatedInactive.status, "INACTIVE");

  // REVOKED assignment stayed REVOKED
  assert.equal(updatedRevoked.status, "REVOKED");
});
