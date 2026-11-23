import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  evaluateAssignmentPermission,
  resolveAuthorizationContextForUser,
  createPendingRoleAssignment,
  createResourceScopeFilter,
  ForbiddenError,
  UnauthorizedError,
  isPlatformOnlyPermission,
  PERMISSIONS,
  BUILT_IN_ROLES,
  type ActiveAssignment,
} from "./index";
import { verifyAccountEmail } from "@/app/verify-email/actions";

function isRedirectError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { message?: string; digest?: string };
  return (
    e.message === "NEXT_REDIRECT" ||
    (typeof e.digest === "string" && e.digest.includes("NEXT_REDIRECT"))
  );
}

// ============================================================
// PART 1: UNIT TESTS - EVALUATION LOGIC & SCOPE RULES
// ============================================================

test("unit: assignment without the required permission is denied (Scenario 10)", () => {
  const assignment: ActiveAssignment = {
    id: "a1",
    roleId: "r1",
    roleSlug: "custom-role",
    roleName: "Custom Role",
    scope: { type: "ORGANIZATION" },
    permissions: new Set(["vehicles:view"]),
  };

  assert.equal(
    evaluateAssignmentPermission(assignment, "vehicles:create", null, "org-1"),
    false,
  );
});

test("unit: organization-wide assignment grants permission across organization (Scenario 16)", () => {
  const assignment: ActiveAssignment = {
    id: "a1",
    roleId: "r1",
    roleSlug: "transport-manager",
    roleName: "Transport Manager",
    scope: { type: "ORGANIZATION" },
    permissions: new Set(["vehicles:view", "requests:view"]),
  };

  // No resource context
  assert.equal(
    evaluateAssignmentPermission(assignment, "vehicles:view", null, "org-1"),
    true,
  );

  // With matching organization and arbitrary department
  assert.equal(
    evaluateAssignmentPermission(
      assignment,
      "requests:view",
      { organizationId: "org-1", departmentId: "dept-A" },
      "org-1",
    ),
    true,
  );

  // With matching organization and null department
  assert.equal(
    evaluateAssignmentPermission(
      assignment,
      "vehicles:view",
      { organizationId: "org-1", departmentId: null },
      "org-1",
    ),
    true,
  );
});

test("unit: department-scoped assignment grants permission ONLY to matching department (Scenario 13, 14)", () => {
  const assignment: ActiveAssignment = {
    id: "a1",
    roleId: "r1",
    roleSlug: "department-user",
    roleName: "Department User",
    scope: { type: "DEPARTMENT", departmentId: "dept-A" },
    permissions: new Set(["requests:view", "requests:create"]),
  };

  // Matching department A (Scenario 13)
  assert.equal(
    evaluateAssignmentPermission(
      assignment,
      "requests:view",
      { organizationId: "org-1", departmentId: "dept-A" },
      "org-1",
    ),
    true,
  );

  // Mismatched department B (Scenario 14)
  assert.equal(
    evaluateAssignmentPermission(
      assignment,
      "requests:view",
      { organizationId: "org-1", departmentId: "dept-B" },
      "org-1",
    ),
    false,
  );
});

test("unit: department-scoped assignment is DENIED for resources with unknown or null department (Scenario 15)", () => {
  const assignment: ActiveAssignment = {
    id: "a1",
    roleId: "r1",
    roleSlug: "department-user",
    roleName: "Department User",
    scope: { type: "DEPARTMENT", departmentId: "dept-A" },
    permissions: new Set(["vehicles:view", "requests:view"]),
  };

  // Unknown/null departmentId
  assert.equal(
    evaluateAssignmentPermission(
      assignment,
      "vehicles:view",
      { organizationId: "org-1", departmentId: null },
      "org-1",
    ),
    false,
  );

  // Missing departmentId property on resource
  assert.equal(
    evaluateAssignmentPermission(
      assignment,
      "vehicles:view",
      { organizationId: "org-1" },
      "org-1",
    ),
    false,
  );

  // Undefined departmentId property
  assert.equal(
    evaluateAssignmentPermission(
      assignment,
      "requests:view",
      { organizationId: "org-1", departmentId: undefined },
      "org-1",
    ),
    false,
  );
});

test("unit: cross-tenant resource context is always denied regardless of scope (Scenario 17, 19, 21)", () => {
  const orgWideAssignment: ActiveAssignment = {
    id: "a1",
    roleId: "r1",
    roleSlug: "org-admin",
    roleName: "Organization Administrator",
    scope: { type: "ORGANIZATION" },
    permissions: new Set(["vehicles:view"]),
  };

  // Client supplied or resource belongs to another tenant org-2
  assert.equal(
    evaluateAssignmentPermission(
      orgWideAssignment,
      "vehicles:view",
      { organizationId: "org-2" },
      "org-1",
    ),
    false,
  );

  const deptScopedAssignment: ActiveAssignment = {
    id: "a2",
    roleId: "r2",
    roleSlug: "department-user",
    roleName: "Department User",
    scope: { type: "DEPARTMENT", departmentId: "dept-A" },
    permissions: new Set(["requests:view"]),
  };

  assert.equal(
    evaluateAssignmentPermission(
      deptScopedAssignment,
      "requests:view",
      { organizationId: "org-2", departmentId: "dept-A" },
      "org-1",
    ),
    false,
  );
});

test("unit: one assignment's scope cannot be expanded by another department-scoped assignment (Scenario 12, 18)", () => {
  // Assignment 1: requests:view in Department A
  const assignment1: ActiveAssignment = {
    id: "a1",
    roleId: "r1",
    roleSlug: "role-1",
    roleName: "Role 1",
    scope: { type: "DEPARTMENT", departmentId: "dept-A" },
    permissions: new Set(["requests:view"]),
  };

  // Assignment 2: vehicles:view in Department B
  const assignment2: ActiveAssignment = {
    id: "a2",
    roleId: "r2",
    roleSlug: "role-2",
    roleName: "Role 2",
    scope: { type: "DEPARTMENT", departmentId: "dept-B" },
    permissions: new Set(["vehicles:view"]),
  };

  const assignments = [assignment1, assignment2];

  // Check requests:view in Department B
  // Assignment 1 has requests:view but is in dept-A -> false
  // Assignment 2 is in dept-B but lacks requests:view -> false
  const canViewRequestDeptB = assignments.some((a) =>
    evaluateAssignmentPermission(
      a,
      "requests:view",
      { organizationId: "org-1", departmentId: "dept-B" },
      "org-1",
    ),
  );
  assert.equal(canViewRequestDeptB, false);

  // Check vehicles:view in Department A -> false
  const canViewVehicleDeptA = assignments.some((a) =>
    evaluateAssignmentPermission(
      a,
      "vehicles:view",
      { organizationId: "org-1", departmentId: "dept-A" },
      "org-1",
    ),
  );
  assert.equal(canViewVehicleDeptA, false);

  // Independent access works
  assert.equal(
    assignments.some((a) =>
      evaluateAssignmentPermission(
        a,
        "requests:view",
        { organizationId: "org-1", departmentId: "dept-A" },
        "org-1",
      ),
    ),
    true,
  );
  assert.equal(
    assignments.some((a) =>
      evaluateAssignmentPermission(
        a,
        "vehicles:view",
        { organizationId: "org-1", departmentId: "dept-B" },
        "org-1",
      ),
    ),
    true,
  );
});

test("unit: platform-only permission identifier function (Scenario 8)", () => {
  assert.equal(isPlatformOnlyPermission("platform:organizations:manage"), true);
  assert.equal(isPlatformOnlyPermission("platform:users:manage"), true);
  assert.equal(isPlatformOnlyPermission("org:view"), false);
  assert.equal(isPlatformOnlyPermission("vehicles:view"), false);
  assert.equal(isPlatformOnlyPermission("trips:view"), false);
});

// ============================================================
// PART 2: POSTGRESQL INTEGRATION TESTS - DATABASE ENGINE & LIFECYCLE
// ============================================================

test("integration: Scenario 1 - Unauthenticated or non-existent user denied", async () => {
  const unauthCtx = await resolveAuthorizationContextForUser(
    "00000000-0000-0000-0000-000000000000",
  );
  assert.equal(unauthCtx, null);
});

test("integration: Scenario 2 - Active user with valid active assignment granted", async () => {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true, name: true } });
  const orgAdminRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "org-admin" },
    select: { id: true },
  });

  const testSuffix = Date.now();
  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: `active-grant-${testSuffix}@example.com`,
      role: "ORGANIZATION_ADMINISTRATOR",
      status: "ACTIVE",
    },
  });

  const assignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: orgAdminRole.id,
      status: "ACTIVE",
    },
  });

  try {
    const ctx = await resolveAuthorizationContextForUser(user.id);
    assert.ok(ctx);
    assert.equal(ctx.userId, user.id);
    assert.equal(ctx.organizationId, org.id);
    assert.equal(ctx.assignments.length, 1);
    assert.equal(ctx.hasPermission("org:view"), true);
    assert.equal(ctx.hasPermission("vehicles:view"), true);

    // requirePermission succeeds without throwing
    ctx.requirePermission("org:view");

    // requireResourceAccess succeeds and returns resource
    const res = ctx.requireResourceAccess("vehicles:view", {
      id: "v-active",
      organizationId: org.id,
    });
    assert.equal(res.id, "v-active");
  } finally {
    await prisma.userRoleAssignment.delete({ where: { id: assignment.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("integration: Scenario 3, 4, 5 - INACTIVE, PENDING_VERIFICATION, REVOKED assignments grant nothing", async () => {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });
  const orgAdminRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "org-admin" },
    select: { id: true },
  });

  const testSuffix = Date.now();
  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: `status-lifecycle-${testSuffix}@example.com`,
      role: "ORGANIZATION_ADMINISTRATOR",
      status: "ACTIVE",
    },
  });

  try {
    // Scenario 3: INACTIVE assignment
    const inactiveAssignment = await prisma.userRoleAssignment.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        roleId: orgAdminRole.id,
        status: "INACTIVE",
      },
    });

    const ctxInactive = await resolveAuthorizationContextForUser(user.id);
    assert.ok(ctxInactive);
    assert.equal(ctxInactive.assignments.length, 0);
    assert.equal(ctxInactive.hasPermission("org:view"), false);
    assert.throws(
      () => ctxInactive.requirePermission("org:view"),
      (err: unknown) => err instanceof ForbiddenError,
    );
    await prisma.userRoleAssignment.delete({ where: { id: inactiveAssignment.id } });

    // Scenario 4: PENDING_VERIFICATION assignment
    const pendingAssignment = await prisma.userRoleAssignment.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        roleId: orgAdminRole.id,
        status: "PENDING_VERIFICATION",
      },
    });

    const ctxPending = await resolveAuthorizationContextForUser(user.id);
    assert.ok(ctxPending);
    assert.equal(ctxPending.assignments.length, 0);
    assert.equal(ctxPending.hasPermission("org:view"), false);
    await prisma.userRoleAssignment.delete({ where: { id: pendingAssignment.id } });

    // Scenario 5: REVOKED assignment
    const revokedAssignment = await prisma.userRoleAssignment.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        roleId: orgAdminRole.id,
        status: "REVOKED",
        revokedAt: new Date(),
        revocationReason: "Administrative revocation for testing",
      },
    });

    const ctxRevoked = await resolveAuthorizationContextForUser(user.id);
    assert.ok(ctxRevoked);
    assert.equal(ctxRevoked.assignments.length, 0);
    assert.equal(ctxRevoked.hasPermission("org:view"), false);
    await prisma.userRoleAssignment.delete({ where: { id: revokedAssignment.id } });
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("integration: Scenario 6 - Suspended or deleted user / organization denied", async () => {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });
  const testSuffix = Date.now();

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: `suspended-del-${testSuffix}@example.com`,
      role: "ORGANIZATION_ADMINISTRATOR",
      status: "SUSPENDED",
    },
  });

  try {
    // Suspended user returns null
    const ctxSuspended = await resolveAuthorizationContextForUser(user.id);
    assert.equal(ctxSuspended, null);

    // Soft-deleted user returns null
    await prisma.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE", deletedAt: new Date() },
    });
    const ctxDeleted = await resolveAuthorizationContextForUser(user.id);
    assert.equal(ctxDeleted, null);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("integration: Scenario 7 - Inactive or deleted role grants nothing", async () => {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });
  const testSuffix = Date.now();

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: `inactive-role-${testSuffix}@example.com`,
      role: "ORGANIZATION_ADMINISTRATOR",
      status: "ACTIVE",
    },
  });

  const customRole = await prisma.organizationRole.create({
    data: {
      organizationId: org.id,
      name: `Temp Role ${testSuffix}`,
      slug: `temp-role-${testSuffix}`,
      status: "ACTIVE",
    },
  });

  const assignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: customRole.id,
      status: "ACTIVE",
    },
  });

  try {
    // Active role loaded
    const ctxBefore = await resolveAuthorizationContextForUser(user.id);
    assert.ok(ctxBefore);
    assert.equal(ctxBefore.assignments.length, 1);

    // When role is marked INACTIVE, assignment is excluded
    await prisma.organizationRole.update({
      where: { id: customRole.id },
      data: { status: "INACTIVE" },
    });

    const ctxInactive = await resolveAuthorizationContextForUser(user.id);
    assert.ok(ctxInactive);
    assert.equal(ctxInactive.assignments.length, 0);

    // When role is soft-deleted, assignment is excluded
    await prisma.organizationRole.update({
      where: { id: customRole.id },
      data: { status: "ACTIVE", deletedAt: new Date() },
    });

    const ctxDeletedRole = await resolveAuthorizationContextForUser(user.id);
    assert.ok(ctxDeletedRole);
    assert.equal(ctxDeletedRole.assignments.length, 0);
  } finally {
    await prisma.userRoleAssignment.delete({ where: { id: assignment.id } });
    await prisma.organizationRole.delete({ where: { id: customRole.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("integration: Scenario 8 - Platform-only permission rejection", async () => {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });
  const orgAdminRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "org-admin" },
    select: { id: true },
  });

  const testSuffix = Date.now();
  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: `platform-reject-${testSuffix}@example.com`,
      role: "ORGANIZATION_ADMINISTRATOR",
      status: "ACTIVE",
    },
  });

  const assignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: orgAdminRole.id,
      status: "ACTIVE",
    },
  });

  // Also create a custom role with an explicit database link to a platform-only permission
  const platformPerm = await prisma.permission.findFirstOrThrow({
    where: { isPlatformOnly: true },
  });

  const customRole = await prisma.organizationRole.create({
    data: {
      organizationId: org.id,
      name: `Platform Leak Test Role ${testSuffix}`,
      slug: `platform-leak-test-${testSuffix}`,
      status: "ACTIVE",
    },
  });

  // Verify database constraint: PostgreSQL trigger prevents assigning platform-only permission to an organization role
  await assert.rejects(
    async () => {
      await prisma.rolePermission.create({
        data: {
          organizationId: org.id,
          roleId: customRole.id,
          permissionId: platformPerm.id,
        },
      });
    },
    (err: unknown) => {
      const message = String(err);
      return message.includes("Platform-only permissions cannot be assigned to organization roles");
    },
  );

  try {
    const ctx = await resolveAuthorizationContextForUser(user.id);
    assert.ok(ctx);

    // Platform-only permissions are never present in effectivePermissions
    assert.equal(ctx.effectivePermissions.has(platformPerm.code), false);
    assert.equal(ctx.effectivePermissions.has("platform:organizations:manage"), false);
    assert.equal(ctx.effectivePermissions.has("platform:users:manage"), false);

    // Platform-only permissions are never present in assignment permissions
    for (const a of ctx.assignments) {
      assert.equal(a.permissions.has(platformPerm.code), false);
    }

    // hasPermission returns false for platform permissions
    assert.equal(ctx.hasPermission("platform:organizations:manage"), false);
    assert.equal(ctx.hasPermission("platform:users:manage"), false);
    assert.equal(ctx.hasPermission(platformPerm.code), false);

    // requirePermission throws ForbiddenError for platform permissions
    assert.throws(
      () => ctx.requirePermission("platform:organizations:manage"),
      (err: unknown) => err instanceof ForbiddenError,
    );
    assert.throws(
      () => ctx.requirePermission(platformPerm.code),
      (err: unknown) => err instanceof ForbiddenError,
    );
  } finally {
    await prisma.organizationRole.delete({ where: { id: customRole.id } });
    await prisma.userRoleAssignment.delete({ where: { id: assignment.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("integration: Scenario 9 & 10 - Multiple active roles union and denial of ungranted permissions", async () => {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });
  const testSuffix = Date.now();

  const dept = await prisma.department.create({
    data: {
      organizationId: org.id,
      name: `Dept Union ${testSuffix}`,
      status: "ACTIVE",
    },
  });

  const deptUserRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "department-user" },
    select: { id: true },
  });

  const driverRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "driver" },
    select: { id: true },
  });

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: `multi-union-${testSuffix}@example.com`,
      role: "DEPARTMENT_USER",
      departmentId: dept.id,
      status: "ACTIVE",
    },
  });

  const driverProfile = await prisma.driver.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      firstName: "Union",
      lastName: "Driver",
      licenseNumber: `LIC-U-${testSuffix}`,
      status: "ACTIVE",
    },
  });

  // Assignment 1: department-user (requests:view, requests:create, requests:cancel)
  const a1 = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: deptUserRole.id,
      departmentId: dept.id,
      status: "ACTIVE",
    },
  });

  // Assignment 2: driver (trips:view, trips:execute)
  const a2 = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: driverRole.id,
      departmentId: null,
      status: "ACTIVE",
    },
  });

  try {
    const ctx = await resolveAuthorizationContextForUser(user.id);
    assert.ok(ctx);

    // Scenario 9: Union of permissions
    assert.equal(ctx.assignments.length, 2);
    assert.equal(ctx.effectivePermissions.has("requests:view"), true);
    assert.equal(ctx.effectivePermissions.has("requests:create"), true);
    assert.equal(ctx.effectivePermissions.has("trips:view"), true);
    assert.equal(ctx.effectivePermissions.has("trips:execute"), true);

    // Scenario 10: Permission absent from every active assignment is denied
    assert.equal(ctx.hasPermission("vehicles:delete"), false);
    assert.equal(ctx.hasPermission("maintenance:create"), false);
    assert.equal(ctx.hasPermission("org:update"), false);
    assert.throws(
      () => ctx.requirePermission("vehicles:delete"),
      (err: unknown) => err instanceof ForbiddenError,
    );
  } finally {
    await prisma.userRoleAssignment.deleteMany({ where: { userId: user.id } });
    await prisma.driver.delete({ where: { id: driverProfile.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.department.delete({ where: { id: dept.id } });
  }
});

test("integration: Scenario 11 - Inactive or revoked assignment cannot contribute permissions", async () => {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });
  const testSuffix = Date.now();

  const dept = await prisma.department.create({
    data: {
      organizationId: org.id,
      name: `Dept Contrib ${testSuffix}`,
      status: "ACTIVE",
    },
  });

  const deptUserRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "department-user" },
    select: { id: true },
  });

  const tmRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "transport-manager" },
    select: { id: true },
  });

  const orgAdminRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "org-admin" },
    select: { id: true },
  });

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: `inactive-contrib-${testSuffix}@example.com`,
      role: "DEPARTMENT_USER",
      departmentId: dept.id,
      status: "ACTIVE",
    },
  });

  // Active assignment: department-user (grants requests:view)
  const activeAssignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: deptUserRole.id,
      departmentId: dept.id,
      status: "ACTIVE",
    },
  });

  // Inactive assignment: transport-manager (grants vehicles:delete)
  const inactiveAssignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: tmRole.id,
      departmentId: null,
      status: "INACTIVE",
    },
  });

  // Revoked assignment: org-admin (grants org:update)
  const revokedAssignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: orgAdminRole.id,
      departmentId: null,
      status: "REVOKED",
      revokedAt: new Date(),
      revocationReason: "Testing revoked assignment non-contribution",
    },
  });

  try {
    const ctx = await resolveAuthorizationContextForUser(user.id);
    assert.ok(ctx);

    // Only 1 assignment is active
    assert.equal(ctx.assignments.length, 1);
    assert.equal(ctx.assignments[0].id, activeAssignment.id);

    // Active assignment permission is granted
    assert.equal(ctx.hasPermission("requests:view"), true);

    // Inactive assignment permission is NOT granted
    assert.equal(ctx.hasPermission("vehicles:delete"), false);
    assert.equal(ctx.effectivePermissions.has("vehicles:delete"), false);

    // Revoked assignment permission is NOT granted
    assert.equal(ctx.hasPermission("org:update"), false);
    assert.equal(ctx.effectivePermissions.has("org:update"), false);
  } finally {
    await prisma.userRoleAssignment.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.department.delete({ where: { id: dept.id } });
  }
});

test("integration: Scenario 12, 13, 14 & 18 - Multiple assignments with different department scopes", async () => {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });
  const testSuffix = Date.now();

  const deptA = await prisma.department.create({
    data: {
      organizationId: org.id,
      name: `Dept A ${testSuffix}`,
      status: "ACTIVE",
    },
  });

  const deptB = await prisma.department.create({
    data: {
      organizationId: org.id,
      name: `Dept B ${testSuffix}`,
      status: "ACTIVE",
    },
  });

  const deptC = await prisma.department.create({
    data: {
      organizationId: org.id,
      name: `Dept C ${testSuffix}`,
      status: "ACTIVE",
    },
  });

  // Create custom role for Dept B with trips:dispatch permission only
  const dispatchPerm = await prisma.permission.findFirstOrThrow({
    where: { code: "trips:dispatch" },
  });
  const customDispatchRole = await prisma.organizationRole.create({
    data: {
      organizationId: org.id,
      name: `Dept Dispatcher ${testSuffix}`,
      slug: `dept-dispatcher-${testSuffix}`,
      scopeAllowed: "DEPARTMENT_ONLY",
      status: "ACTIVE",
    },
  });
  const dispatchRolePerm = await prisma.rolePermission.create({
    data: {
      organizationId: org.id,
      roleId: customDispatchRole.id,
      permissionId: dispatchPerm.id,
    },
  });

  const deptUserRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "department-user" },
    select: { id: true },
  });

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: `multi-dept-${testSuffix}@example.com`,
      role: "DEPARTMENT_USER",
      departmentId: deptA.id,
      status: "ACTIVE",
    },
  });

  // Assignment 1: department-user in Dept A (grants requests:view, requests:create, requests:cancel)
  const a1 = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: deptUserRole.id,
      departmentId: deptA.id,
      status: "ACTIVE",
    },
  });

  // Assignment 2: customDispatchRole in Dept B (grants trips:dispatch)
  const a2 = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: customDispatchRole.id,
      departmentId: deptB.id,
      status: "ACTIVE",
    },
  });

  try {
    const ctx = await resolveAuthorizationContextForUser(user.id);
    assert.ok(ctx);
    assert.equal(ctx.assignments.length, 2);

    // Scenario 13: Dept A assignment can access Dept A resource
    assert.equal(
      ctx.hasPermission("requests:view", {
        organizationId: org.id,
        departmentId: deptA.id,
      }),
      true,
    );
    const resA = ctx.requireResourceAccess("requests:view", {
      id: "req-A",
      organizationId: org.id,
      departmentId: deptA.id,
    });
    assert.equal(resA.id, "req-A");

    // Scenario 14: Dept A assignment CANNOT access Dept B resource for requests:view
    assert.equal(
      ctx.hasPermission("requests:view", {
        organizationId: org.id,
        departmentId: deptB.id,
      }),
      false,
    );
    assert.throws(
      () =>
        ctx.requireResourceAccess("requests:view", {
          id: "req-B",
          organizationId: org.id,
          departmentId: deptB.id,
        }),
      (err: unknown) => err instanceof ForbiddenError,
    );

    // Scenario 12 & 18: Dept B has trips:dispatch, but NOT requests:view
    // Dept A has requests:view, but NOT trips:dispatch
    assert.equal(
      ctx.hasPermission("trips:dispatch", {
        organizationId: org.id,
        departmentId: deptB.id,
      }),
      true,
    );
    assert.equal(
      ctx.hasPermission("trips:dispatch", {
        organizationId: org.id,
        departmentId: deptA.id,
      }),
      false,
    );

    // Unassigned Dept C is denied for BOTH permissions
    assert.equal(
      ctx.hasPermission("requests:view", {
        organizationId: org.id,
        departmentId: deptC.id,
      }),
      false,
    );
    assert.equal(
      ctx.hasPermission("trips:dispatch", {
        organizationId: org.id,
        departmentId: deptC.id,
      }),
      false,
    );

    // getAuthorizedDepartmentIds returns exact authorized department slices
    assert.deepEqual(ctx.getAuthorizedDepartmentIds("requests:view"), [deptA.id]);
    assert.deepEqual(ctx.getAuthorizedDepartmentIds("trips:dispatch"), [deptB.id]);
  } finally {
    await prisma.userRoleAssignment.deleteMany({ where: { userId: user.id } });
    await prisma.rolePermission.delete({ where: { id: dispatchRolePerm.id } });
    await prisma.organizationRole.delete({ where: { id: customDispatchRole.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.department.delete({ where: { id: deptA.id } });
    await prisma.department.delete({ where: { id: deptB.id } });
    await prisma.department.delete({ where: { id: deptC.id } });
  }
});

test("integration: Scenario 15 - Department-scoped access to resources with unknown ownership", async () => {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });
  const testSuffix = Date.now();

  const dept = await prisma.department.create({
    data: {
      organizationId: org.id,
      name: `Dept Unknown ${testSuffix}`,
      status: "ACTIVE",
    },
  });

  const deptUserRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "department-user" },
    select: { id: true },
  });

  const tmRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "transport-manager" },
    select: { id: true },
  });

  // Create department-scoped user
  const deptUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: `dept-unknown-${testSuffix}@example.com`,
      role: "DEPARTMENT_USER",
      departmentId: dept.id,
      status: "ACTIVE",
    },
  });

  const deptAssignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: deptUser.id,
      roleId: deptUserRole.id,
      departmentId: dept.id,
      status: "ACTIVE",
    },
  });

  // Create organization-wide user
  const tmUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: `tm-unknown-${testSuffix}@example.com`,
      role: "TRANSPORT_MANAGER",
      status: "ACTIVE",
    },
  });

  const tmAssignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: tmUser.id,
      roleId: tmRole.id,
      departmentId: null,
      status: "ACTIVE",
    },
  });

  try {
    const deptCtx = await resolveAuthorizationContextForUser(deptUser.id);
    assert.ok(deptCtx);

    const tmCtx = await resolveAuthorizationContextForUser(tmUser.id);
    assert.ok(tmCtx);

    // 1. Department-scoped user with departmentId: null -> DENIED
    assert.equal(
      deptCtx.hasPermission("requests:view", {
        organizationId: org.id,
        departmentId: null,
      }),
      false,
    );
    assert.throws(
      () =>
        deptCtx.requireResourceAccess("requests:view", {
          id: "r-null-dept",
          organizationId: org.id,
          departmentId: null,
        }),
      (err: unknown) => err instanceof ForbiddenError,
    );

    // 2. Department-scoped user with missing departmentId property -> DENIED
    assert.equal(
      deptCtx.hasPermission("requests:view", {
        organizationId: org.id,
      }),
      false,
    );
    assert.throws(
      () =>
        deptCtx.requireResourceAccess("requests:view", {
          id: "r-missing-dept",
          organizationId: org.id,
        }),
      (err: unknown) => err instanceof ForbiddenError,
    );

    // 3. Department-scoped user with unresolvable related record (e.g. nested transportationRequest has null dept) -> DENIED
    assert.throws(
      () =>
        deptCtx.requireResourceAccess("requests:view", {
          id: "r-nested-null",
          organizationId: org.id,
          transportationRequest: { departmentId: null },
        }),
      (err: unknown) => err instanceof ForbiddenError,
    );

    // 4. Department-scoped user with empty related record -> DENIED
    assert.throws(
      () =>
        deptCtx.requireResourceAccess("requests:view", {
          id: "r-nested-empty",
          organizationId: org.id,
          transportationRequest: {},
        }),
      (err: unknown) => err instanceof ForbiddenError,
    );

    // CONTRAST: Organization-wide user CAN access resources with departmentId: null
    assert.equal(
      tmCtx.hasPermission("vehicles:view", {
        organizationId: org.id,
        departmentId: null,
      }),
      true,
    );
    const tmRes = tmCtx.requireResourceAccess("vehicles:view", {
      id: "v-org-wide",
      organizationId: org.id,
      departmentId: null,
    });
    assert.equal(tmRes.id, "v-org-wide");
  } finally {
    await prisma.userRoleAssignment.delete({ where: { id: deptAssignment.id } });
    await prisma.userRoleAssignment.delete({ where: { id: tmAssignment.id } });
    await prisma.user.delete({ where: { id: deptUser.id } });
    await prisma.user.delete({ where: { id: tmUser.id } });
    await prisma.department.delete({ where: { id: dept.id } });
  }
});

test("integration: Scenario 16 & 18 - Organization-wide versus department-scoped assignments coexistence", async () => {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });
  const testSuffix = Date.now();

  const deptA = await prisma.department.create({
    data: {
      organizationId: org.id,
      name: `Dept Coexist A ${testSuffix}`,
      status: "ACTIVE",
    },
  });

  const deptB = await prisma.department.create({
    data: {
      organizationId: org.id,
      name: `Dept Coexist B ${testSuffix}`,
      status: "ACTIVE",
    },
  });

  const deptUserRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "department-user" },
    select: { id: true },
  });

  const driverRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "driver" },
    select: { id: true },
  });

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: `coexist-${testSuffix}@example.com`,
      role: "DEPARTMENT_USER",
      departmentId: deptA.id,
      status: "ACTIVE",
    },
  });

  const driverProfile = await prisma.driver.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      firstName: "Coexist",
      lastName: "Driver",
      licenseNumber: `LIC-C-${testSuffix}`,
      status: "ACTIVE",
    },
  });

  // Assignment 1: department-user scoped to Dept A (requests:view, requests:create, requests:cancel)
  const a1 = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: deptUserRole.id,
      departmentId: deptA.id,
      status: "ACTIVE",
    },
  });

  // Assignment 2: driver org-wide (trips:view, trips:execute)
  const a2 = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: driverRole.id,
      departmentId: null,
      status: "ACTIVE",
    },
  });

  try {
    const ctx = await resolveAuthorizationContextForUser(user.id);
    assert.ok(ctx);

    // Organization-wide assignment grants trips:view in Dept A, Dept B, and null dept
    assert.equal(
      ctx.hasPermission("trips:view", {
        organizationId: org.id,
        departmentId: deptA.id,
      }),
      true,
    );
    assert.equal(
      ctx.hasPermission("trips:view", {
        organizationId: org.id,
        departmentId: deptB.id,
      }),
      true,
    );
    assert.equal(
      ctx.hasPermission("trips:view", {
        organizationId: org.id,
        departmentId: null,
      }),
      true,
    );

    // Department-scoped assignment grants requests:view ONLY in Dept A
    assert.equal(
      ctx.hasPermission("requests:view", {
        organizationId: org.id,
        departmentId: deptA.id,
      }),
      true,
    );

    // CRITICAL: Organization-wide scope of trips does NOT bleed into requests:view
    assert.equal(
      ctx.hasPermission("requests:view", {
        organizationId: org.id,
        departmentId: deptB.id,
      }),
      false,
    );
    assert.equal(
      ctx.hasPermission("requests:view", {
        organizationId: org.id,
        departmentId: null,
      }),
      false,
    );

    // getAuthorizedDepartmentIds behaves correctly per permission
    assert.equal(ctx.getAuthorizedDepartmentIds("trips:view"), "ALL");
    assert.deepEqual(ctx.getAuthorizedDepartmentIds("requests:view"), [deptA.id]);
  } finally {
    await prisma.userRoleAssignment.deleteMany({ where: { userId: user.id } });
    await prisma.driver.delete({ where: { id: driverProfile.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.department.delete({ where: { id: deptA.id } });
    await prisma.department.delete({ where: { id: deptB.id } });
  }
});

test("integration: Scenario 17, 19 & 20 - Cross-organization resource access (reads and mutations denied)", async () => {
  const testSuffix = Date.now();

  // Create two separate organizations
  const org1 = await prisma.organization.create({
    data: {
      name: `Tenant Org 1 ${testSuffix}`,
      status: "ACTIVE",
    },
  });

  const org2 = await prisma.organization.create({
    data: {
      name: `Tenant Org 2 ${testSuffix}`,
      status: "ACTIVE",
    },
  });

  // Create organization role in Org 1
  const tmRole1 = await prisma.organizationRole.create({
    data: {
      organizationId: org1.id,
      name: `TM Org1 ${testSuffix}`,
      slug: `tm-org1-${testSuffix}`,
      scopeAllowed: "ORGANIZATION_ONLY",
      status: "ACTIVE",
    },
  });

  const viewPerm = await prisma.permission.findFirstOrThrow({ where: { code: "vehicles:view" } });
  const updatePerm = await prisma.permission.findFirstOrThrow({ where: { code: "vehicles:update" } });

  await prisma.rolePermission.createMany({
    data: [
      { organizationId: org1.id, roleId: tmRole1.id, permissionId: viewPerm.id },
      { organizationId: org1.id, roleId: tmRole1.id, permissionId: updatePerm.id },
    ],
  });

  // User belongs to Org 1
  const user1 = await prisma.user.create({
    data: {
      organizationId: org1.id,
      email: `user-org1-${testSuffix}@example.com`,
      role: "TRANSPORT_MANAGER",
      status: "ACTIVE",
    },
  });

  const assignment1 = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org1.id,
      userId: user1.id,
      roleId: tmRole1.id,
      departmentId: null,
      status: "ACTIVE",
    },
  });

  try {
    const ctx = await resolveAuthorizationContextForUser(user1.id);
    assert.ok(ctx);

    // Scenario 17: Organization-wide assignment does NOT grant access to another organization
    assert.equal(
      ctx.hasPermission("vehicles:view", { organizationId: org2.id }),
      false,
    );

    // Scenario 19: Cross-organization read denied via requireResourceAccess
    assert.throws(
      () => {
        ctx.requireResourceAccess("vehicles:view", {
          id: "veh-org-2",
          organizationId: org2.id,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.equal(err.message, "Access denied.");
        return true;
      },
    );

    // Scenario 20: Cross-organization mutation denied via requireResourceAccess
    assert.throws(
      () => {
        ctx.requireResourceAccess("vehicles:update", {
          id: "veh-org-2",
          organizationId: org2.id,
          payload: { licensePlate: "FORGED-PLATE" },
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.equal(err.message, "Access denied.");
        return true;
      },
    );

    // Own organization read & mutation succeeds
    const ownResource = ctx.requireResourceAccess("vehicles:view", {
      id: "veh-org-1",
      organizationId: org1.id,
    });
    assert.equal(ownResource.id, "veh-org-1");

    const ownMutation = ctx.requireResourceAccess("vehicles:update", {
      id: "veh-org-1",
      organizationId: org1.id,
      payload: { licensePlate: "VALID-PLATE" },
    });
    assert.equal(ownMutation.id, "veh-org-1");
  } finally {
    await prisma.userRoleAssignment.deleteMany({ where: { userId: user1.id } });
    await prisma.rolePermission.deleteMany({ where: { roleId: tmRole1.id } });
    await prisma.organizationRole.delete({ where: { id: tmRole1.id } });
    await prisma.user.delete({ where: { id: user1.id } });
    await prisma.organization.delete({ where: { id: org1.id } });
    await prisma.organization.delete({ where: { id: org2.id } });
  }
});

test("integration: Scenario 21 & 22 - Client-supplied organizationId and departmentId cannot bypass tenant checks", async () => {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });
  const testSuffix = Date.now();

  const deptA = await prisma.department.create({
    data: {
      organizationId: org.id,
      name: `Dept Bypass A ${testSuffix}`,
      status: "ACTIVE",
    },
  });

  const deptB = await prisma.department.create({
    data: {
      organizationId: org.id,
      name: `Dept Bypass B ${testSuffix}`,
      status: "ACTIVE",
    },
  });

  const deptUserRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "department-user" },
    select: { id: true },
  });

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: `bypass-${testSuffix}@example.com`,
      role: "DEPARTMENT_USER",
      departmentId: deptA.id,
      status: "ACTIVE",
    },
  });

  const assignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: deptUserRole.id,
      departmentId: deptA.id,
      status: "ACTIVE",
    },
  });

  try {
    const ctx = await resolveAuthorizationContextForUser(user.id);
    assert.ok(ctx);

    // Scenario 21: Client-supplied organizationId cannot bypass tenant checks
    // If client supplies spoofed organizationId, engine denies access
    assert.equal(
      ctx.hasPermission("requests:view", {
        organizationId: "spoofed-tenant-org-id",
        departmentId: deptA.id,
      }),
      false,
    );
    assert.throws(
      () =>
        ctx.requireResourceAccess("requests:view", {
          id: "req-1",
          organizationId: "spoofed-tenant-org-id",
          departmentId: deptA.id,
        }),
      (err: unknown) => err instanceof ForbiddenError,
    );

    // Scenario 22: Client-supplied departmentId cannot bypass department checks
    // If client supplies unassigned departmentId (deptB), engine denies access
    assert.equal(
      ctx.hasPermission("requests:view", {
        organizationId: org.id,
        departmentId: deptB.id,
      }),
      false,
    );
    assert.throws(
      () =>
        ctx.requireResourceAccess("requests:view", {
          id: "req-1",
          organizationId: org.id,
          departmentId: deptB.id,
        }),
      (err: unknown) => err instanceof ForbiddenError,
    );
  } finally {
    await prisma.userRoleAssignment.delete({ where: { id: assignment.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.department.delete({ where: { id: deptA.id } });
    await prisma.department.delete({ where: { id: deptB.id } });
  }
});

test("integration: Scenario 23 & 24 - System Administrator separation from organization RBAC", async () => {
  const testSuffix = Date.now();

  const sysAdmin = await prisma.user.create({
    data: {
      email: `sysadmin-${testSuffix}@example.com`,
      role: "SYSTEM_ADMINISTRATOR",
      status: "ACTIVE",
      organizationId: null,
      departmentId: null,
    },
  });

  try {
    const ctx = await resolveAuthorizationContextForUser(sysAdmin.id);
    assert.ok(ctx);

    // Scenario 23 & 24: System Administrator is outside organization role assignments
    assert.equal(ctx.isSystemAdministrator, true);
    assert.equal(ctx.assignments.length, 0);
    assert.equal(ctx.effectivePermissions.size, 0);

    // Organization RBAC permissions are not granted through organization roles to System Administrators
    assert.equal(ctx.hasPermission("vehicles:view"), false);
    assert.equal(ctx.hasPermission("org:view"), false);

    // System Administrator check throws when calling requirePermission for organization roles
    assert.throws(
      () => ctx.requirePermission("vehicles:view"),
      (err: unknown) => err instanceof ForbiddenError,
    );
  } finally {
    await prisma.user.delete({ where: { id: sysAdmin.id } });
  }
});

test("integration: Scenario 25, 26, 27 & 29 - Invitation lifecycle, preserved department scope, and email verification", async () => {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });
  const testSuffix = Date.now();

  const dept = await prisma.department.create({
    data: {
      organizationId: org.id,
      name: `Lifecycle Dept ${testSuffix}`,
      status: "ACTIVE",
    },
  });

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);
  const testEmail = `lifecycle-user-${testSuffix}@example.com`;

  // Scenario 25: Organization invitation creates PENDING_VERIFICATION assignment
  let createdUserId = "";
  let createdAssignmentId = "";

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        organizationId: org.id,
        departmentId: dept.id,
        role: "DEPARTMENT_USER",
        status: "INACTIVE",
        pendingEmail: testEmail,
        passwordHash: "initial-hash",
      },
    });
    createdUserId = user.id;

    const assignment = await createPendingRoleAssignment(tx, {
      organizationId: org.id,
      userId: user.id,
      roleSlug: "department-user",
      departmentId: dept.id,
    });
    createdAssignmentId = assignment.id;

    await tx.organizationInvitation.create({
      data: {
        userId: user.id,
        createdById: user.id,
        tokenHash: createHash("sha256").update(randomBytes(32)).digest("hex"),
        expiresAt,
      },
    });

    await tx.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });
  });

  try {
    const pendingAssignment = await prisma.userRoleAssignment.findUniqueOrThrow({
      where: { id: createdAssignmentId },
    });
    assert.equal(pendingAssignment.status, "PENDING_VERIFICATION");
    assert.equal(pendingAssignment.departmentId, dept.id);

    // Also add an INACTIVE assignment to test Scenario 27 (must remain unchanged)
    const tmRole = await prisma.organizationRole.findFirstOrThrow({
      where: { organizationId: org.id, slug: "transport-manager" },
      select: { id: true },
    });
    const inactiveAssignment = await prisma.userRoleAssignment.create({
      data: {
        organizationId: org.id,
        userId: createdUserId,
        roleId: tmRole.id,
        departmentId: null,
        status: "INACTIVE",
      },
    });

    // Scenario 26: Email verification activates only the intended pending assignment
    const formData = new FormData();
    formData.set("token", rawToken);

    try {
      await verifyAccountEmail({ success: false, message: "" }, formData);
    } catch (err) {
      assert.ok(isRedirectError(err));
    }

    const activatedAssignment = await prisma.userRoleAssignment.findUniqueOrThrow({
      where: { id: createdAssignmentId },
    });
    assert.equal(activatedAssignment.status, "ACTIVE");

    // Scenario 27: INACTIVE assignment remains unchanged
    const unchangedInactive = await prisma.userRoleAssignment.findUniqueOrThrow({
      where: { id: inactiveAssignment.id },
    });
    assert.equal(unchangedInactive.status, "INACTIVE");

    // Scenario 29: Department scope is preserved
    assert.equal(activatedAssignment.departmentId, dept.id);

    await prisma.userRoleAssignment.delete({ where: { id: inactiveAssignment.id } });
  } finally {
    await prisma.emailVerificationToken.deleteMany({ where: { userId: createdUserId } });
    await prisma.organizationInvitation.deleteMany({ where: { userId: createdUserId } });
    await prisma.userRoleAssignment.deleteMany({ where: { userId: createdUserId } });
    await prisma.user.delete({ where: { id: createdUserId } });
    await prisma.department.delete({ where: { id: dept.id } });
  }
});

test("integration: Scenario 28 - Driver profile activation ordering enforced by database trigger", async () => {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });
  const testSuffix = Date.now();

  const driverRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "driver" },
    select: { id: true },
  });

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: `driver-ordering-${testSuffix}@example.com`,
      role: "DRIVER",
      status: "ACTIVE",
    },
  });

  try {
    // 1. Attempting to activate driver assignment WITHOUT a Driver profile must fail via database trigger
    await assert.rejects(
      async () => {
        await prisma.userRoleAssignment.create({
          data: {
            organizationId: org.id,
            userId: user.id,
            roleId: driverRole.id,
            departmentId: null,
            status: "ACTIVE",
          },
        });
      },
      (err: unknown) => {
        const message = String(err);
        return (
          message.includes("trg_enforce_user_role_assignment_driver_profile") ||
          message.toLowerCase().includes("driver role assignment requires an active driver profile")
        );
      },
    );

    // 2. Create the driver profile first
    const driverProfile = await prisma.driver.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        firstName: "Ordered",
        lastName: "Driver",
        licenseNumber: `ORD-${testSuffix}`,
        status: "ACTIVE",
      },
    });

    // 3. Now activating driver assignment succeeds
    const activeDriverAssignment = await prisma.userRoleAssignment.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        roleId: driverRole.id,
        departmentId: null,
        status: "ACTIVE",
      },
    });
    assert.equal(activeDriverAssignment.status, "ACTIVE");

    await prisma.userRoleAssignment.delete({ where: { id: activeDriverAssignment.id } });
    await prisma.driver.delete({ where: { id: driverProfile.id } });
  } finally {
    await prisma.userRoleAssignment.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("integration: Scenario 30 - Transaction rollback leaves database completely unmodified on failure", async () => {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });
  const testSuffix = Date.now();

  const dept = await prisma.department.create({
    data: {
      organizationId: org.id,
      name: `Rollback Dept ${testSuffix}`,
      status: "ACTIVE",
    },
  });

  await assert.rejects(async () => {
    await prisma.$transaction(async (tx) => {
      const failUser = await tx.user.create({
        data: {
          organizationId: org.id,
          email: `rollback-${testSuffix}@example.com`,
          role: "DEPARTMENT_USER",
          status: "INACTIVE",
        },
      });

      await createPendingRoleAssignment(tx, {
        organizationId: org.id,
        userId: failUser.id,
        roleSlug: "department-user",
        departmentId: dept.id,
      });

      // Intentional failure to trigger transaction rollback
      throw new Error("INTENTIONAL_TRANSACTION_FAILURE");
    });
  });

  try {
    // Verify rollback-user was not committed
    const rolledBackUser = await prisma.user.findFirst({
      where: { email: `rollback-${testSuffix}@example.com` },
    });
    assert.equal(rolledBackUser, null);
  } finally {
    await prisma.department.delete({ where: { id: dept.id } });
  }
});
