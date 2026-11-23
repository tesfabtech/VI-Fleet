import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "@/lib/prisma";
import {
  createCustomRole,
  updateCustomRole,
  setCustomRoleStatus,
  getOrganizationRoles,
  getOrganizationRoleDetails,
  getRoleAssignedUsersCount,
  resolveAuthorizationContextForUser,
  isBuiltInRoleName,
  isBuiltInRoleSlug,
  generateRoleSlug,
  ForbiddenError,
  UnauthorizedError,
  PERMISSIONS,
  BUILT_IN_ROLES,
} from "./index";

// ============================================================
// PART 1: UNIT TESTS - HELPERS & SLUG GENERATION
// ============================================================

test("unit: role slug generator creates clean lowercase hyphenated slugs", () => {
  assert.equal(
    generateRoleSlug("Fleet Maintenance Supervisor"),
    "fleet-maintenance-supervisor",
  );
  assert.equal(
    generateRoleSlug("   Special Operations & Logistics!  "),
    "special-operations-logistics",
  );
  assert.equal(generateRoleSlug(""), "custom-role");
});

test("unit: built-in role name and slug recognizers identify protected baseline roles", () => {
  assert.equal(isBuiltInRoleName("Organization Administrator"), true);
  assert.equal(isBuiltInRoleName("organization administrator"), true);
  assert.equal(isBuiltInRoleName("VICE_ORGANIZATION_ADMINISTRATOR"), false);
  assert.equal(isBuiltInRoleName("Vice Organization Administrator"), true);
  assert.equal(isBuiltInRoleName("Transport Manager"), true);
  assert.equal(isBuiltInRoleName("Driver"), true);
  assert.equal(isBuiltInRoleName("Custom Dispatcher"), false);

  assert.equal(isBuiltInRoleSlug("org-admin"), true);
  assert.equal(isBuiltInRoleSlug("vice-org-admin"), true);
  assert.equal(isBuiltInRoleSlug("transport-manager"), true);
  assert.equal(isBuiltInRoleSlug("driver"), true);
  assert.equal(isBuiltInRoleSlug("custom-role"), false);
});

// ============================================================
// PART 2: INTEGRATION TESTS - ROLE DIRECTORY & TENANT ISOLATION
// ============================================================

test("integration: Organization Administrator can list organization roles", async () => {
  const org = await prisma.organization.findFirstOrThrow({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true },
  });

  const roles = await getOrganizationRoles(org.id);
  assert.ok(roles.length >= 6, "Expected at least 6 built-in roles");

  const builtInSlugs = roles
    .filter((r) => r.roleType === "BUILT_IN")
    .map((r) => r.slug);

  assert.ok(builtInSlugs.includes("org-admin"));
  assert.ok(builtInSlugs.includes("vice-org-admin"));
  assert.ok(builtInSlugs.includes("transport-manager"));
  assert.ok(builtInSlugs.includes("vice-transport-manager"));
  assert.ok(builtInSlugs.includes("department-user"));
  assert.ok(builtInSlugs.includes("driver"));

  // Check each role has valid permission counts
  const orgAdmin = roles.find((r) => r.slug === "org-admin");
  assert.ok(orgAdmin);
  assert.equal(orgAdmin.permissionCount, 28);
});

test("integration: Organization A cannot see Organization B roles (strict tenant isolation)", async () => {
  // Ensure we have two distinct organizations
  const orgs = await prisma.organization.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    take: 2,
    select: { id: true, name: true },
  });

  let orgA = orgs[0];
  let orgB = orgs[1];

  let createdOrgB = false;
  if (!orgB) {
    const testSuffix = Date.now();
    orgB = await prisma.organization.create({
      data: {
        name: `Test Tenant B ${testSuffix}`,
        code: `TTB-${testSuffix}`.slice(0, 20),
        status: "ACTIVE",
      },
      select: { id: true, name: true },
    });
    createdOrgB = true;
  }

  const testSuffix = Date.now();
  const customRoleOrgA = await prisma.organizationRole.create({
    data: {
      organizationId: orgA.id,
      name: `Org A Only Role ${testSuffix}`,
      slug: `org-a-role-${testSuffix}`,
      roleType: "CUSTOM",
      status: "ACTIVE",
      isSystemRole: false,
    },
  });

  try {
    const orgARoles = await getOrganizationRoles(orgA.id);
    const orgBRoles = await getOrganizationRoles(orgB.id);

    assert.ok(
      orgARoles.some((r) => r.id === customRoleOrgA.id),
      "Org A roles must include customRoleOrgA",
    );
    assert.equal(
      orgBRoles.some((r) => r.id === customRoleOrgA.id),
      false,
      "Org B roles MUST NOT include customRoleOrgA",
    );

    // Direct detail query for Org B on Org A role must return null
    const detailsInOrgB = await getOrganizationRoleDetails(
      orgB.id,
      customRoleOrgA.id,
    );
    assert.equal(detailsInOrgB, null);
  } finally {
    await prisma.organizationRole.delete({ where: { id: customRoleOrgA.id } });
    if (createdOrgB) {
      await prisma.organization.delete({ where: { id: orgB.id } });
    }
  }
});

test("integration: users without role-management permission are denied", async () => {
  const org = await prisma.organization.findFirstOrThrow({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { id: true },
  });
  const viceOrgAdminRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "vice-org-admin" },
    select: { id: true },
  });

  const testSuffix = Date.now();
  const viceUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: `vice-admin-${testSuffix}@example.com`,
      role: "VICE_ORGANIZATION_ADMINISTRATOR",
      status: "ACTIVE",
    },
  });

  const assignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: viceUser.id,
      roleId: viceOrgAdminRole.id,
      status: "ACTIVE",
    },
  });

  try {
    const authContext = await resolveAuthorizationContextForUser(viceUser.id);
    assert.ok(authContext);
    assert.equal(authContext.hasPermission(PERMISSIONS.ORG_ROLES_MANAGE), false);
    assert.throws(
      () => authContext.requirePermission(PERMISSIONS.ORG_ROLES_MANAGE),
      (err: unknown) => err instanceof ForbiddenError,
    );
  } finally {
    await prisma.userRoleAssignment.delete({ where: { id: assignment.id } });
    await prisma.user.delete({ where: { id: viceUser.id } });
  }
});

// ============================================================
// PART 3: INTEGRATION TESTS - CUSTOM ROLE CREATION
// ============================================================

test("integration: valid custom role creation succeeds with permissions in atomic transaction", async () => {
  const org = await prisma.organization.findFirstOrThrow({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { id: true },
  });

  const testSuffix = Date.now();
  const roleName = `Fleet Dispatch Assistant ${testSuffix}`;
  const permissionCodes = ["vehicles:view", "trips:view", "trips:dispatch"];

  const createdRole = await createCustomRole(org.id, null, {
    name: roleName,
    description: "Assists with dispatching trips and viewing fleet status.",
    permissionCodes,
  });

  try {
    assert.ok(createdRole.id);
    assert.equal(createdRole.name, roleName);
    assert.equal(createdRole.roleType, "CUSTOM");
    assert.equal(createdRole.status, "ACTIVE");
    assert.equal(createdRole.isSystemRole, false);

    // Verify role permissions were created with is_baseline = FALSE
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId: createdRole.id },
      include: { permission: true },
    });

    assert.equal(rolePermissions.length, 3);
    for (const rp of rolePermissions) {
      assert.equal(rp.isBaseline, false);
      assert.equal(rp.organizationId, org.id);
      assert.ok(permissionCodes.includes(rp.permission.code));
    }
  } finally {
    await prisma.rolePermission.deleteMany({
      where: { roleId: createdRole.id },
    });
    await prisma.organizationRole.delete({ where: { id: createdRole.id } });
  }
});

test("integration: duplicate role names within the same organization are rejected (case-insensitive)", async () => {
  const org = await prisma.organization.findFirstOrThrow({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { id: true },
  });

  const testSuffix = Date.now();
  const roleName = `Unique Safety Officer ${testSuffix}`;

  const role = await createCustomRole(org.id, null, {
    name: roleName,
    permissionCodes: ["vehicles:view"],
  });

  try {
    // Exact duplicate
    await assert.rejects(
      async () => {
        await createCustomRole(org.id, null, {
          name: roleName,
          permissionCodes: ["vehicles:view"],
        });
      },
      /already exists/,
    );

    // Case-insensitive duplicate (e.g. UPPERCASE)
    await assert.rejects(
      async () => {
        await createCustomRole(org.id, null, {
          name: roleName.toUpperCase(),
          permissionCodes: ["vehicles:view"],
        });
      },
      /already exists/,
    );
  } finally {
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.organizationRole.delete({ where: { id: role.id } });
  }
});

test("integration: invalid role names and reserved built-in names are rejected", async () => {
  const org = await prisma.organization.findFirstOrThrow({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { id: true },
  });

  // Empty role name
  await assert.rejects(
    async () => {
      await createCustomRole(org.id, null, {
        name: "   ",
        permissionCodes: ["vehicles:view"],
      });
    },
    /Role name is required/,
  );

  // Exceeds 150 characters
  await assert.rejects(
    async () => {
      await createCustomRole(org.id, null, {
        name: "A".repeat(151),
        permissionCodes: ["vehicles:view"],
      });
    },
    /150 characters/,
  );

  // Reserved built-in name
  await assert.rejects(
    async () => {
      await createCustomRole(org.id, null, {
        name: "Organization Administrator",
        permissionCodes: ["vehicles:view"],
      });
    },
    /reserved for system built-in roles/,
  );

  await assert.rejects(
    async () => {
      await createCustomRole(org.id, null, {
        name: "driver",
        permissionCodes: ["vehicles:view"],
      });
    },
    /reserved for system built-in roles/,
  );
});

test("integration: unknown permission codes and platform-only permissions are rejected", async () => {
  const org = await prisma.organization.findFirstOrThrow({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { id: true },
  });

  const testSuffix = Date.now();

  // Unknown permission code
  await assert.rejects(
    async () => {
      await createCustomRole(org.id, null, {
        name: `Role With Bogus Perm ${testSuffix}`,
        permissionCodes: ["vehicles:view", "fake:permission:code"],
      });
    },
    /Unknown or invalid permission codes/,
  );

  // Platform-only permission code
  await assert.rejects(
    async () => {
      await createCustomRole(org.id, null, {
        name: `Role With Platform Perm ${testSuffix}`,
        permissionCodes: ["platform:organizations:manage"],
      });
    },
    /platform-only permission/,
  );
});

// ============================================================
// PART 4: INTEGRATION TESTS - CUSTOM ROLE EDITING
// ============================================================

test("integration: custom role name, description, and permissions can be updated atomically", async () => {
  const org = await prisma.organization.findFirstOrThrow({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { id: true },
  });

  const testSuffix = Date.now();
  const initialName = `Initial Custom Role ${testSuffix}`;
  const updatedName = `Updated Custom Role ${testSuffix}`;

  const role = await createCustomRole(org.id, null, {
    name: initialName,
    description: "Initial description.",
    permissionCodes: ["vehicles:view", "trips:view"],
  });

  try {
    // Update role: change name, description, add "trips:dispatch", remove "trips:view"
    const updated = await updateCustomRole(org.id, role.id, {
      name: updatedName,
      description: "Updated description.",
      permissionCodes: ["vehicles:view", "trips:dispatch"],
    });

    assert.equal(updated.name, updatedName);
    assert.equal(updated.description, "Updated description.");

    const roleDetails = await getOrganizationRoleDetails(org.id, role.id);
    assert.ok(roleDetails);
    assert.equal(roleDetails.name, updatedName);

    const permissionCodes = roleDetails.permissions.map((p) => p.code);
    assert.ok(permissionCodes.includes("vehicles:view"));
    assert.ok(permissionCodes.includes("trips:dispatch"));
    assert.equal(permissionCodes.includes("trips:view"), false);
  } finally {
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.organizationRole.delete({ where: { id: role.id } });
  }
});

test("integration: editing custom role leaves existing user assignments intact", async () => {
  const org = await prisma.organization.findFirstOrThrow({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { id: true },
  });

  const testSuffix = Date.now();
  const role = await createCustomRole(org.id, null, {
    name: `Assignment Preservation Role ${testSuffix}`,
    permissionCodes: ["vehicles:view"],
  });

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: `assignment-preserve-${testSuffix}@example.com`,
      role: "ORGANIZATION_ADMINISTRATOR",
      status: "ACTIVE",
    },
  });

  const assignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: role.id,
      status: "ACTIVE",
    },
  });

  try {
    // Verify assignment exists and grants vehicles:view
    const ctxBefore = await resolveAuthorizationContextForUser(user.id);
    assert.ok(ctxBefore);
    assert.equal(ctxBefore.hasPermission("vehicles:view"), true);
    assert.equal(ctxBefore.hasPermission("trips:view"), false);

    // Update role permissions: add trips:view
    await updateCustomRole(org.id, role.id, {
      name: role.name,
      permissionCodes: ["vehicles:view", "trips:view"],
    });

    // Verify assignment ID and status are completely unchanged
    const recheckedAssignment = await prisma.userRoleAssignment.findUniqueOrThrow({
      where: { id: assignment.id },
    });
    assert.equal(recheckedAssignment.status, "ACTIVE");
    assert.equal(recheckedAssignment.userId, user.id);
    assert.equal(recheckedAssignment.roleId, role.id);

    // The user now effectively gains the new permission from the updated role
    const ctxAfter = await resolveAuthorizationContextForUser(user.id);
    assert.ok(ctxAfter);
    assert.equal(ctxAfter.hasPermission("vehicles:view"), true);
    assert.equal(ctxAfter.hasPermission("trips:view"), true);
  } finally {
    await prisma.userRoleAssignment.delete({ where: { id: assignment.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.organizationRole.delete({ where: { id: role.id } });
  }
});

test("integration: cross-organization role modification attempts are rejected", async () => {
  const orgs = await prisma.organization.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    take: 2,
    select: { id: true },
  });

  let orgA = orgs[0];
  let orgB = orgs[1];
  let createdOrgB = false;

  if (!orgB) {
    const testSuffix = Date.now();
    orgB = await prisma.organization.create({
      data: {
        name: `Tenant B Mod Test ${testSuffix}`,
        code: `TBMT-${testSuffix}`.slice(0, 20),
        status: "ACTIVE",
      },
      select: { id: true },
    });
    createdOrgB = true;
  }

  const testSuffix = Date.now();
  const roleOrgA = await createCustomRole(orgA.id, null, {
    name: `Org A Protected Role ${testSuffix}`,
    permissionCodes: ["vehicles:view"],
  });

  try {
    // Attempt to update Org A's role passing Org B's organizationId
    await assert.rejects(
      async () => {
        await updateCustomRole(orgB.id, roleOrgA.id, {
          name: "Hacked Role Name",
          permissionCodes: ["vehicles:view"],
        });
      },
      /Role not found/,
    );

    // Attempt to change status passing Org B's organizationId
    await assert.rejects(
      async () => {
        await setCustomRoleStatus(orgB.id, roleOrgA.id, "INACTIVE");
      },
      /Role not found/,
    );
  } finally {
    await prisma.rolePermission.deleteMany({ where: { roleId: roleOrgA.id } });
    await prisma.organizationRole.delete({ where: { id: roleOrgA.id } });
    if (createdOrgB) {
      await prisma.organization.delete({ where: { id: orgB.id } });
    }
  }
});

// ============================================================
// PART 5: INTEGRATION TESTS - BUILT-IN ROLE PROTECTION
// ============================================================

test("integration: built-in roles cannot be modified, renamed, deactivated, or deleted", async () => {
  const org = await prisma.organization.findFirstOrThrow({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { id: true },
  });

  const builtInRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "transport-manager" },
  });

  // 1. Service-level check on updateCustomRole
  await assert.rejects(
    async () => {
      await updateCustomRole(org.id, builtInRole.id, {
        name: "Renamed Transport Manager",
        permissionCodes: ["vehicles:view"],
      });
    },
    (err: unknown) => err instanceof ForbiddenError,
  );

  // 2. Service-level check on setCustomRoleStatus
  await assert.rejects(
    async () => {
      await setCustomRoleStatus(org.id, builtInRole.id, "INACTIVE");
    },
    (err: unknown) => err instanceof ForbiddenError,
  );

  // 3. Database trigger check: direct UPDATE attempt on name/status blocked by PostgreSQL trigger
  await assert.rejects(
    async () => {
      await prisma.organizationRole.update({
        where: { id: builtInRole.id },
        data: { name: "Direct Hacked Name" },
      });
    },
    /Built-in organization roles are immutable/,
  );

  await assert.rejects(
    async () => {
      await prisma.organizationRole.update({
        where: { id: builtInRole.id },
        data: { status: "INACTIVE" },
      });
    },
    /Built-in organization roles are immutable/,
  );

  // 4. Database trigger check: direct DELETE attempt blocked by PostgreSQL trigger
  await assert.rejects(
    async () => {
      await prisma.organizationRole.delete({
        where: { id: builtInRole.id },
      });
    },
    /Built-in roles cannot be deleted/,
  );

  // 5. Database trigger check: direct DELETE of RolePermission on built-in role blocked
  const baselinePermission = await prisma.rolePermission.findFirstOrThrow({
    where: { roleId: builtInRole.id },
  });

  await assert.rejects(
    async () => {
      await prisma.rolePermission.delete({
        where: { id: baselinePermission.id },
      });
    },
    /Permissions of built-in roles cannot be removed or modified/,
  );
});

// ============================================================
// PART 6: INTEGRATION TESTS - ROLE LIFECYCLE (DEACTIVATION & REACTIVATION)
// ============================================================

test("integration: custom role deactivation immediately denies granted permissions", async () => {
  const org = await prisma.organization.findFirstOrThrow({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { id: true },
  });

  const testSuffix = Date.now();
  const customRole = await createCustomRole(org.id, null, {
    name: `Deactivation Test Role ${testSuffix}`,
    permissionCodes: ["fuel:manage"],
  });

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: `deactivation-user-${testSuffix}@example.com`,
      role: "ORGANIZATION_ADMINISTRATOR",
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
    // Initially granted fuel:manage
    const ctxActive = await resolveAuthorizationContextForUser(user.id);
    assert.ok(ctxActive);
    assert.equal(ctxActive.hasPermission("fuel:manage"), true);

    // Check assigned user count helper
    const assignedCount = await getRoleAssignedUsersCount(org.id, customRole.id);
    assert.equal(assignedCount, 1);

    // Deactivate the custom role
    const deactivationResult = await setCustomRoleStatus(
      org.id,
      customRole.id,
      "INACTIVE",
    );
    assert.equal(deactivationResult.role.status, "INACTIVE");
    assert.equal(deactivationResult.activeAssignedCount, 1);

    // Immediately after deactivation, user grants NO permissions from this role
    const ctxInactive = await resolveAuthorizationContextForUser(user.id);
    assert.ok(ctxInactive);
    assert.equal(ctxInactive.hasPermission("fuel:manage"), false);

    // UserRoleAssignment record itself remains intact with status ACTIVE
    const preservedAssignment = await prisma.userRoleAssignment.findUniqueOrThrow({
      where: { id: assignment.id },
    });
    assert.equal(preservedAssignment.status, "ACTIVE");

    // Reactivate the custom role
    const reactivationResult = await setCustomRoleStatus(
      org.id,
      customRole.id,
      "ACTIVE",
    );
    assert.equal(reactivationResult.role.status, "ACTIVE");

    // Permissions immediately restored
    const ctxReactivated = await resolveAuthorizationContextForUser(user.id);
    assert.ok(ctxReactivated);
    assert.equal(ctxReactivated.hasPermission("fuel:manage"), true);
  } finally {
    await prisma.userRoleAssignment.delete({ where: { id: assignment.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.rolePermission.deleteMany({ where: { roleId: customRole.id } });
    await prisma.organizationRole.delete({ where: { id: customRole.id } });
  }
});

test("integration: role reactivation does not reactivate inactive or revoked user assignments", async () => {
  const org = await prisma.organization.findFirstOrThrow({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { id: true },
  });

  const testSuffix = Date.now();
  const customRole = await createCustomRole(org.id, null, {
    name: `Revocation Preservation Role ${testSuffix}`,
    permissionCodes: ["fuel:manage"],
  });

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: `revoked-assignment-${testSuffix}@example.com`,
      role: "ORGANIZATION_ADMINISTRATOR",
      status: "ACTIVE",
    },
  });

  // Create an assignment that is explicitly REVOKED
  const revokedAssignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: customRole.id,
      status: "REVOKED",
      revokedAt: new Date(),
      revocationReason: "Administrative revocation",
    },
  });

  try {
    // Role is deactivated and reactivated
    await setCustomRoleStatus(org.id, customRole.id, "INACTIVE");
    await setCustomRoleStatus(org.id, customRole.id, "ACTIVE");

    // Assignment remains REVOKED and user receives zero permissions
    const recheckedAssignment = await prisma.userRoleAssignment.findUniqueOrThrow({
      where: { id: revokedAssignment.id },
    });
    assert.equal(recheckedAssignment.status, "REVOKED");

    const ctx = await resolveAuthorizationContextForUser(user.id);
    assert.ok(ctx);
    assert.equal(ctx.hasPermission("fuel:manage"), false);
  } finally {
    await prisma.userRoleAssignment.delete({
      where: { id: revokedAssignment.id },
    });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.rolePermission.deleteMany({ where: { roleId: customRole.id } });
    await prisma.organizationRole.delete({ where: { id: customRole.id } });
  }
});
