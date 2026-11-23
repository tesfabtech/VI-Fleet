import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { verifyAccountEmail } from "@/app/verify-email/actions";

function isRedirectError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { message?: string; digest?: string };
  return e.message === "NEXT_REDIRECT" || (typeof e.digest === "string" && e.digest.includes("NEXT_REDIRECT"));
}

test("email verification: successfully activates User.status and UserRoleAssignment.status from PENDING_VERIFICATION to ACTIVE for Organization Administrator", async () => {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });
  const orgAdminRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "org-admin" },
    select: { id: true },
  });

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);
  const testEmail = `test-admin-${Date.now()}@example.com`;

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      role: "ORGANIZATION_ADMINISTRATOR",
      status: "INACTIVE",
      pendingEmail: testEmail,
      passwordHash: "dummy-hash",
    },
  });

  const assignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: orgAdminRole.id,
      status: "PENDING_VERIFICATION",
    },
  });

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  try {
    const formData = new FormData();
    formData.set("token", rawToken);

    try {
      await verifyAccountEmail({ success: false, message: "" }, formData);
    } catch (err) {
      assert.ok(isRedirectError(err), `Expected NEXT_REDIRECT, got: ${err}`);
    }

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(updatedUser.status, "ACTIVE");
    assert.equal(updatedUser.email, testEmail);
    assert.equal(updatedUser.pendingEmail, null);

    const updatedAssignment = await prisma.userRoleAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    assert.equal(updatedAssignment.status, "ACTIVE");
  } finally {
    await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    await prisma.userRoleAssignment.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("email verification: INACTIVE assignments remain INACTIVE and are never activated by verification", async () => {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });
  const orgAdminRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "org-admin" },
    select: { id: true },
  });

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);
  const testEmail = `test-inactive-only-${Date.now()}@example.com`;

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      role: "ORGANIZATION_ADMINISTRATOR",
      status: "INACTIVE",
      pendingEmail: testEmail,
      passwordHash: "dummy-hash",
    },
  });

  // Assignment is explicitly INACTIVE (e.g. disabled/paused)
  const assignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: orgAdminRole.id,
      status: "INACTIVE",
    },
  });

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  try {
    const formData = new FormData();
    formData.set("token", rawToken);

    try {
      await verifyAccountEmail({ success: false, message: "" }, formData);
    } catch (err) {
      assert.ok(isRedirectError(err), `Expected NEXT_REDIRECT, got: ${err}`);
    }

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(updatedUser.status, "ACTIVE");

    // INACTIVE assignment must remain INACTIVE!
    const updatedAssignment = await prisma.userRoleAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    assert.equal(updatedAssignment.status, "INACTIVE");
  } finally {
    await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    await prisma.userRoleAssignment.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("email verification: preserves REVOKED assignments and does not reactivate them", async () => {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });
  const orgAdminRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "org-admin" },
    select: { id: true },
  });
  const tmRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "transport-manager" },
    select: { id: true },
  });

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);
  const testEmail = `test-revoked-${Date.now()}@example.com`;

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      role: "ORGANIZATION_ADMINISTRATOR",
      status: "INACTIVE",
      pendingEmail: testEmail,
      passwordHash: "dummy-hash",
    },
  });

  const pendingAssignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: orgAdminRole.id,
      status: "PENDING_VERIFICATION",
    },
  });

  const revokedAssignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: tmRole.id,
      status: "REVOKED",
      revokedAt: new Date(),
      revocationReason: "Historical role revoked before verification",
    },
  });

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  try {
    const formData = new FormData();
    formData.set("token", rawToken);

    try {
      await verifyAccountEmail({ success: false, message: "" }, formData);
    } catch (err) {
      assert.ok(isRedirectError(err), `Expected NEXT_REDIRECT, got: ${err}`);
    }

    const updatedPendingAssignment = await prisma.userRoleAssignment.findUniqueOrThrow({
      where: { id: pendingAssignment.id },
    });
    assert.equal(updatedPendingAssignment.status, "ACTIVE");

    const updatedRevokedAssignment = await prisma.userRoleAssignment.findUniqueOrThrow({
      where: { id: revokedAssignment.id },
    });
    assert.equal(updatedRevokedAssignment.status, "REVOKED");
    assert.ok(updatedRevokedAssignment.revokedAt !== null);
    assert.equal(updatedRevokedAssignment.revocationReason, "Historical role revoked before verification");
  } finally {
    await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    await prisma.userRoleAssignment.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("email verification: driver activation activates Driver profile and Driver UserRoleAssignment in correct order", async () => {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });
  const driverRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "driver" },
    select: { id: true },
  });

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);
  const testEmail = `test-driver-${Date.now()}@example.com`;

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      role: "DRIVER",
      status: "INACTIVE",
      pendingEmail: testEmail,
      passwordHash: "dummy-hash",
    },
  });

  const driverProfile = await prisma.driver.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      firstName: "Test",
      lastName: "Driver",
      licenseNumber: `LIC-${Date.now()}`,
      status: "INACTIVE",
    },
  });

  const assignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: driverRole.id,
      status: "PENDING_VERIFICATION",
    },
  });

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  try {
    const formData = new FormData();
    formData.set("token", rawToken);

    try {
      await verifyAccountEmail({ success: false, message: "" }, formData);
    } catch (err) {
      assert.ok(isRedirectError(err), `Expected NEXT_REDIRECT, got: ${err}`);
    }

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(updatedUser.status, "ACTIVE");

    const updatedDriver = await prisma.driver.findUniqueOrThrow({ where: { id: driverProfile.id } });
    assert.equal(updatedDriver.status, "ACTIVE");

    const updatedAssignment = await prisma.userRoleAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    assert.equal(updatedAssignment.status, "ACTIVE");
  } finally {
    await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    await prisma.userRoleAssignment.deleteMany({ where: { userId: user.id } });
    await prisma.driver.delete({ where: { id: driverProfile.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("email verification: activates department user role assignment scoped to active department", async () => {
  const org = await prisma.organization.findFirstOrThrow({
    where: { departments: { some: { status: "ACTIVE", deletedAt: null } } },
    include: {
      departments: { where: { status: "ACTIVE", deletedAt: null }, take: 1 },
    },
  });
  const dept = org.departments[0];
  const deptUserRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "department-user" },
    select: { id: true },
  });

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);
  const testEmail = `test-dept-user-${Date.now()}@example.com`;

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      departmentId: dept.id,
      role: "DEPARTMENT_USER",
      status: "INACTIVE",
      pendingEmail: testEmail,
      passwordHash: "dummy-hash",
    },
  });

  const assignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: deptUserRole.id,
      departmentId: dept.id,
      status: "PENDING_VERIFICATION",
    },
  });

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  try {
    const formData = new FormData();
    formData.set("token", rawToken);

    try {
      await verifyAccountEmail({ success: false, message: "" }, formData);
    } catch (err) {
      assert.ok(isRedirectError(err), `Expected NEXT_REDIRECT, got: ${err}`);
    }

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(updatedUser.status, "ACTIVE");

    const updatedAssignment = await prisma.userRoleAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    assert.equal(updatedAssignment.status, "ACTIVE");
    assert.equal(updatedAssignment.departmentId, dept.id);
  } finally {
    await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    await prisma.userRoleAssignment.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("email verification: does not activate assignment if the assigned role is soft-deleted or inactive", async () => {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });

  // 1. Role is initially active when assigned
  const role = await prisma.organizationRole.create({
    data: {
      organizationId: org.id,
      name: `Custom Role ${Date.now()}`,
      slug: `custom-role-${Date.now()}`,
      roleType: "CUSTOM",
      status: "ACTIVE",
    },
  });

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);
  const testEmail = `test-inactive-role-${Date.now()}@example.com`;

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      role: "ORGANIZATION_ADMINISTRATOR",
      status: "INACTIVE",
      pendingEmail: testEmail,
      passwordHash: "dummy-hash",
    },
  });

  // 2. Assignment created as PENDING_VERIFICATION while role is active
  const assignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: role.id,
      status: "PENDING_VERIFICATION",
    },
  });

  // 3. Role is subsequently deactivated/soft-deleted before email is verified
  await prisma.organizationRole.update({
    where: { id: role.id },
    data: {
      status: "INACTIVE",
      deletedAt: new Date(),
    },
  });

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  try {
    const formData = new FormData();
    formData.set("token", rawToken);

    try {
      await verifyAccountEmail({ success: false, message: "" }, formData);
    } catch (err) {
      assert.ok(isRedirectError(err), `Expected NEXT_REDIRECT, got: ${err}`);
    }

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(updatedUser.status, "ACTIVE");

    // Assignment must REMAIN PENDING_VERIFICATION because role was deactivated/deleted!
    const updatedAssignment = await prisma.userRoleAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    assert.equal(updatedAssignment.status, "PENDING_VERIFICATION");
  } finally {
    await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    await prisma.userRoleAssignment.deleteMany({ where: { userId: user.id } });
    await prisma.organizationRole.delete({ where: { id: role.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("email verification: rejects suspended users and leaves assignments pending", async () => {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });
  const orgAdminRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "org-admin" },
    select: { id: true },
  });

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);
  const testEmail = `test-suspended-${Date.now()}@example.com`;

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      role: "ORGANIZATION_ADMINISTRATOR",
      status: "SUSPENDED",
      pendingEmail: testEmail,
      passwordHash: "dummy-hash",
    },
  });

  const assignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: orgAdminRole.id,
      status: "INACTIVE",
    },
  });

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  try {
    const formData = new FormData();
    formData.set("token", rawToken);

    const result = await verifyAccountEmail({ success: false, message: "" }, formData);
    assert.equal(result.success, false);
    assert.match(result.message, /invalid, expired, already used/i);

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(updatedUser.status, "SUSPENDED");

    const updatedAssignment = await prisma.userRoleAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    assert.equal(updatedAssignment.status, "INACTIVE");
  } finally {
    await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    await prisma.userRoleAssignment.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("email verification: rejects soft-deleted users and preserves assignment status", async () => {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });
  const orgAdminRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "org-admin" },
    select: { id: true },
  });

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);
  const testEmail = `test-deleted-${Date.now()}@example.com`;

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      role: "ORGANIZATION_ADMINISTRATOR",
      status: "INACTIVE",
      deletedAt: new Date(),
      pendingEmail: testEmail,
      passwordHash: "dummy-hash",
    },
  });

  const assignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: orgAdminRole.id,
      status: "INACTIVE",
    },
  });

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  try {
    const formData = new FormData();
    formData.set("token", rawToken);

    const result = await verifyAccountEmail({ success: false, message: "" }, formData);
    assert.equal(result.success, false);

    const updatedAssignment = await prisma.userRoleAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    assert.equal(updatedAssignment.status, "INACTIVE");
  } finally {
    await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    await prisma.userRoleAssignment.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("email verification: verifying one invitation does not activate unrelated inactive assignments for the same user", async () => {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });
  const orgAdminRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "org-admin" },
    select: { id: true },
  });
  const tmRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "transport-manager" },
    select: { id: true },
  });

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);
  const testEmail = `test-coexisting-${Date.now()}@example.com`;

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      role: "ORGANIZATION_ADMINISTRATOR",
      status: "INACTIVE",
      pendingEmail: testEmail,
      passwordHash: "dummy-hash",
    },
  });

  // Assignment 1: PENDING_VERIFICATION (linked to current invitation)
  const pendingAssignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: orgAdminRole.id,
      status: "PENDING_VERIFICATION",
    },
  });

  // Assignment 2: INACTIVE (deliberately disabled / paused role)
  const inactiveAssignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: tmRole.id,
      status: "INACTIVE",
    },
  });

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  try {
    const formData = new FormData();
    formData.set("token", rawToken);

    try {
      await verifyAccountEmail({ success: false, message: "" }, formData);
    } catch (err) {
      assert.ok(isRedirectError(err), `Expected NEXT_REDIRECT, got: ${err}`);
    }

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(updatedUser.status, "ACTIVE");

    // The PENDING_VERIFICATION assignment becomes ACTIVE
    const updatedPendingAssignment = await prisma.userRoleAssignment.findUniqueOrThrow({
      where: { id: pendingAssignment.id },
    });
    assert.equal(updatedPendingAssignment.status, "ACTIVE");

    // The INACTIVE assignment MUST REMAIN INACTIVE!
    const updatedInactiveAssignment = await prisma.userRoleAssignment.findUniqueOrThrow({
      where: { id: inactiveAssignment.id },
    });
    assert.equal(updatedInactiveAssignment.status, "INACTIVE");
  } finally {
    await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    await prisma.userRoleAssignment.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("email verification: transaction rollback leaves user and assignments unmodified on trigger failure", async () => {
  const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });
  const driverRole = await prisma.organizationRole.findFirstOrThrow({
    where: { organizationId: org.id, slug: "driver" },
    select: { id: true },
  });

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);
  const testEmail = `test-rollback-${Date.now()}@example.com`;

  // Create user as DRIVER with NO Driver profile record
  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      role: "DRIVER",
      status: "INACTIVE",
      pendingEmail: testEmail,
      passwordHash: "dummy-hash",
    },
  });

  // Assignment can be created as PENDING_VERIFICATION even without Driver profile
  const assignment = await prisma.userRoleAssignment.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: driverRole.id,
      status: "PENDING_VERIFICATION",
    },
  });

  const token = await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  try {
    const formData = new FormData();
    formData.set("token", rawToken);

    // During verification, tx.userRoleAssignment.updateMany attempts to set status: ACTIVE.
    // However, the database trigger trg_validate_user_role_assignment rejects activating a Driver
    // role assignment without an active driver profile.
    // This causes the entire transaction to abort and roll back.
    const result = await verifyAccountEmail({ success: false, message: "" }, formData);
    assert.equal(result.success, false);
    assert.match(result.message, /invalid, expired, already used, or the email could not be activated/i);

    // Verify User was rolled back and is STILL INACTIVE with pendingEmail intact
    const rolledBackUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(rolledBackUser.status, "INACTIVE");
    assert.equal(rolledBackUser.email, null);
    assert.equal(rolledBackUser.pendingEmail, testEmail);

    // Verify Assignment was rolled back and is STILL PENDING_VERIFICATION
    const rolledBackAssignment = await prisma.userRoleAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    assert.equal(rolledBackAssignment.status, "PENDING_VERIFICATION");

    // Verify token was NOT consumed
    const unconsumedToken = await prisma.emailVerificationToken.findUniqueOrThrow({ where: { id: token.id } });
    assert.equal(unconsumedToken.consumedAt, null);
  } finally {
    await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    await prisma.userRoleAssignment.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});
