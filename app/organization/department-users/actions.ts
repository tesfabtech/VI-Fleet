"use server";

import { createHash, randomBytes } from "node:crypto";
import { UserStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getAppUrl,
  sendDepartmentUserInvitationEmail,
  sendEmailVerificationEmail,
} from "@/lib/gmail-email";
import { prisma } from "@/lib/prisma";

const BASE_PATH = "/organization/department-users";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_ROLES = ["ORGANIZATION_ADMINISTRATOR", "VICE_ORGANIZATION_ADMINISTRATOR"] as const;
const COOLDOWN_MS = 2 * 60 * 1000; // 2-minute resend throttle

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const text = (fd: FormData, key: string) => (typeof fd.get(key) === "string" ? String(fd.get(key)).trim() : "");
const returnUrl = (fd: FormData) => {
  const path = text(fd, "returnTo");
  return path.startsWith(BASE_PATH) ? path : BASE_PATH;
};

function done(path: string, param: "message" | "error", code: string): never {
  if (param === "message") {
    [BASE_PATH, "/organization/departments", "/organization", path].forEach((p) => revalidatePath(p));
  }
  redirect(`${path}?${param}=${encodeURIComponent(code)}`);
}

async function requireAdmin(path = BASE_PATH) {
  const session = await auth();
  const { id, role, organizationId } = session?.user ?? {};
  if (!id) redirect("/login");
  if (!organizationId || !ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
    done(path, "error", "unauthorized");
  }

  const admin = await prisma.user.findFirst({
    where: {
      id,
      organizationId,
      role: { in: [...ALLOWED_ROLES] },
      status: "ACTIVE",
      deletedAt: null,
      organization: { status: "ACTIVE", deletedAt: null },
    },
    select: { id: true, organizationId: true, organization: { select: { name: true } } },
  });

  if (!admin?.organizationId || !admin.organization) done(path, "error", "inactive");
  return { userId: admin.id, organizationId: admin.organizationId, orgName: admin.organization.name };
}

export async function markDepartmentUserApplicationUnderReview(fd: FormData) {
  const path = returnUrl(fd);
  const { userId, organizationId } = await requireAdmin(path);
  const applicationId = text(fd, "applicationId");
  const reviewNotes = text(fd, "reviewNotes");

  if (!UUID_RE.test(applicationId)) done(path, "error", "invalid");
  if (reviewNotes.length > 2000) done(path, "error", "notes");

  const { count } = await prisma.departmentUserApplication.updateMany({
    where: { id: applicationId, organizationId, status: "PENDING", createdUserId: null },
    data: { status: "UNDER_REVIEW", reviewNotes: reviewNotes || null, reviewedById: userId, reviewedAt: new Date() },
  });

  if (count !== 1) done(path, "error", "reviewed");
  done(path, "message", "under-review");
}

export async function approveDepartmentUserApplication(fd: FormData) {
  const path = returnUrl(fd);
  const { userId, organizationId, orgName } = await requireAdmin(path);
  const applicationId = text(fd, "applicationId");
  const reviewNotes = text(fd, "reviewNotes");

  if (!UUID_RE.test(applicationId)) done(path, "error", "invalid");
  if (reviewNotes.length > 2000) done(path, "error", "notes");

  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);

  try {
    await prisma.$transaction(async (tx) => {
      const app = await tx.departmentUserApplication.findFirst({
        where: { id: applicationId, organizationId, status: { in: ["PENDING", "UNDER_REVIEW"] }, createdUserId: null },
        include: { department: { select: { name: true, status: true, deletedAt: true } } },
      });
      if (!app) throw new Error("REVIEWED");
      if (app.department.status !== "ACTIVE" || app.department.deletedAt) throw new Error("INACTIVE");

      const email = app.email.trim().toLowerCase();
      const taken = await tx.user.findFirst({
        where: { OR: [{ email: { equals: email, mode: "insensitive" } }, { pendingEmail: { equals: email, mode: "insensitive" } }] },
        select: { id: true },
      });
      if (taken) throw new Error("EMAIL_USED");

      const user = await tx.user.create({
        data: {
          organizationId,
          departmentId: app.departmentId,
          firstName: app.firstName,
          middleName: app.middleName,
          lastName: app.lastName,
          email,
          phone: app.phone,
          role: "DEPARTMENT_USER",
          status: "INACTIVE",
        },
      });

      await tx.organizationInvitation.create({
        data: { userId: user.id, createdById: userId, tokenHash: hash(rawToken), expiresAt },
      });

      const { count } = await tx.departmentUserApplication.updateMany({
        where: { id: app.id, organizationId, status: { in: ["PENDING", "UNDER_REVIEW"] }, createdUserId: null },
        data: { status: "APPROVED", reviewNotes: reviewNotes || null, reviewedById: userId, reviewedAt: new Date(), createdUserId: user.id },
      });
      if (count !== 1) throw new Error("REVIEWED");

      await sendDepartmentUserInvitationEmail({
        to: email,
        organizationName: orgName,
        departmentName: app.department.name,
        invitationUrl: getAppUrl(`/setup-password?token=${encodeURIComponent(rawToken)}`),
      });
    }, { timeout: 20000 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "EMAIL_USED") done(path, "error", "email-used");
    if (msg === "REVIEWED") done(path, "error", "reviewed");
    if (msg === "INACTIVE") done(path, "error", "inactive");
    done(path, "error", "approval-failed");
  }

  done(path, "message", "approved");
}

export async function rejectDepartmentUserApplication(fd: FormData) {
  const path = returnUrl(fd);
  const { userId, organizationId } = await requireAdmin(path);
  const applicationId = text(fd, "applicationId");
  const reviewNotes = text(fd, "reviewNotes");

  if (!UUID_RE.test(applicationId)) done(path, "error", "invalid");
  if (reviewNotes.length > 2000) done(path, "error", "notes");

  const { count } = await prisma.departmentUserApplication.updateMany({
    where: { id: applicationId, organizationId, status: { in: ["PENDING", "UNDER_REVIEW"] }, createdUserId: null },
    data: { status: "REJECTED", reviewNotes: reviewNotes || null, reviewedById: userId, reviewedAt: new Date() },
  });

  if (count !== 1) done(path, "error", "reviewed");
  done(path, "message", "rejected");
}

export async function createDepartmentUserInvitation(fd: FormData) {
  const { userId, organizationId, orgName } = await requireAdmin(BASE_PATH);
  const [departmentId, firstName, middleName, lastName, email, phone] = [
    text(fd, "departmentId"),
    text(fd, "firstName"),
    text(fd, "middleName"),
    text(fd, "lastName"),
    text(fd, "email").toLowerCase(),
    text(fd, "phone"),
  ];

  if (
    !UUID_RE.test(departmentId) ||
    !firstName || !middleName || !lastName ||
    [firstName, middleName, lastName].some((n) => n.length > 150) ||
    email.length > 255 || phone.length > 30 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    done(BASE_PATH, "error", "invalid");
  }

  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);

  try {
    await prisma.$transaction(async (tx) => {
      const dept = await tx.department.findFirst({
        where: { id: departmentId, organizationId, status: "ACTIVE", deletedAt: null },
        select: { id: true, name: true },
      });
      if (!dept) throw new Error("INACTIVE");

      const taken = await tx.user.findFirst({
        where: { OR: [{ email: { equals: email, mode: "insensitive" } }, { pendingEmail: { equals: email, mode: "insensitive" } }] },
        select: { id: true },
      });
      if (taken) throw new Error("EMAIL_USED");

      const user = await tx.user.create({
        data: { organizationId, departmentId: dept.id, firstName, middleName, lastName, email, phone: phone || null, role: "DEPARTMENT_USER", status: "INACTIVE" },
      });

      await tx.organizationInvitation.create({
        data: { userId: user.id, createdById: userId, tokenHash: hash(rawToken), expiresAt },
      });

      await sendDepartmentUserInvitationEmail({
        to: email,
        organizationName: orgName,
        departmentName: dept.name,
        invitationUrl: getAppUrl(`/setup-password?token=${encodeURIComponent(rawToken)}`),
      });
    }, { timeout: 20000 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "EMAIL_USED") done(BASE_PATH, "error", "email-used");
    if (msg === "INACTIVE") done(BASE_PATH, "error", "inactive");
    done(BASE_PATH, "error", "approval-failed");
  }

  done(BASE_PATH, "message", "user-invited");
}

export async function updateDepartmentUserAssignment(fd: FormData) {
  const path = returnUrl(fd);
  const { organizationId } = await requireAdmin(path);
  const userId = text(fd, "userId");
  const departmentId = text(fd, "departmentId");

  if (!UUID_RE.test(userId) || !UUID_RE.test(departmentId)) done(path, "error", "invalid");

  const dept = await prisma.department.findFirst({
    where: { id: departmentId, organizationId, status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });
  if (!dept) done(path, "error", "invalid-department");

  // Updates User.departmentId only; existing TransportationRequests keep their original departmentId
  const { count } = await prisma.user.updateMany({
    where: { id: userId, organizationId, role: "DEPARTMENT_USER", deletedAt: null },
    data: { departmentId: dept.id },
  });

  if (count !== 1) done(path, "error", "user-not-found");
  done(path, "message", "department-updated");
}

export async function updateDepartmentUserStatus(fd: FormData) {
  const path = returnUrl(fd);
  const { organizationId } = await requireAdmin(path);
  const userId = text(fd, "userId");
  const status = text(fd, "status") as UserStatus;

  if (!UUID_RE.test(userId)) done(path, "error", "invalid");
  if (![UserStatus.ACTIVE, UserStatus.INACTIVE, UserStatus.SUSPENDED].includes(status)) {
    done(path, "error", "invalid-status");
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId, role: "DEPARTMENT_USER", deletedAt: null },
    select: { id: true, passwordHash: true, email: true, pendingEmail: true, department: { select: { status: true, deletedAt: true } } },
  });
  if (!user) done(path, "error", "user-not-found");

  if (!user.passwordHash || !user.email || user.pendingEmail) {
    done(path, "error", "setup-incomplete");
  }
  if (status === "ACTIVE" && (user.department?.status !== "ACTIVE" || user.department?.deletedAt)) {
    done(path, "error", "invalid-department");
  }

  await prisma.user.updateMany({
    where: { id: user.id, organizationId, role: "DEPARTMENT_USER", deletedAt: null },
    data: { status },
  });

  done(path, "message", "status-updated");
}

export async function resendDepartmentUserInvitation(fd: FormData) {
  const path = returnUrl(fd);
  const { userId: adminId, organizationId, orgName } = await requireAdmin(path);
  const userId = text(fd, "userId");
  if (!UUID_RE.test(userId)) done(path, "error", "invalid");

  const rawToken = randomBytes(32).toString("hex");
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId, organizationId, role: "DEPARTMENT_USER", status: "INACTIVE", passwordHash: null, deletedAt: null },
        include: {
          department: { select: { name: true, status: true, deletedAt: true } },
          receivedInvitations: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
        },
      });

      const to = user?.email ?? user?.pendingEmail;
      if (!user || !to || user.department?.status !== "ACTIVE" || user.department.deletedAt) throw new Error("INACTIVE");

      const lastSent = user.receivedInvitations[0]?.createdAt;
      if (lastSent && now.getTime() - lastSent.getTime() < COOLDOWN_MS) throw new Error("THROTTLED");

      await tx.organizationInvitation.updateMany({
        where: { userId: user.id, consumedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });

      await tx.organizationInvitation.create({
        data: { userId: user.id, createdById: adminId, tokenHash: hash(rawToken), expiresAt: new Date(now.getTime() + 48 * 3600 * 1000) },
      });

      await sendDepartmentUserInvitationEmail({
        to,
        organizationName: orgName,
        departmentName: user.department.name,
        invitationUrl: getAppUrl(`/setup-password?token=${encodeURIComponent(rawToken)}`),
      });
    }, { timeout: 20000 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "THROTTLED") done(path, "error", "throttled");
    if (msg === "INACTIVE") done(path, "error", "inactive");
    done(path, "error", "approval-failed");
  }

  done(path, "message", "invitation-resent");
}

export async function resendDepartmentUserVerificationEmail(fd: FormData) {
  const path = returnUrl(fd);
  const { organizationId } = await requireAdmin(path);
  const userId = text(fd, "userId");
  if (!UUID_RE.test(userId)) done(path, "error", "invalid");

  const rawToken = randomBytes(32).toString("hex");
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId, organizationId, role: "DEPARTMENT_USER", status: "INACTIVE", passwordHash: { not: null }, pendingEmail: { not: null }, deletedAt: null },
        include: { emailVerificationTokens: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
      });
      if (!user?.pendingEmail) throw new Error("INELIGIBLE");

      const lastSent = user.emailVerificationTokens[0]?.createdAt;
      if (lastSent && now.getTime() - lastSent.getTime() < COOLDOWN_MS) throw new Error("THROTTLED");

      await tx.emailVerificationToken.deleteMany({ where: { userId: user.id } });
      await tx.emailVerificationToken.create({
        data: { userId: user.id, tokenHash: hash(rawToken), expiresAt: new Date(now.getTime() + 48 * 3600 * 1000) },
      });

      await sendEmailVerificationEmail({
        to: user.pendingEmail,
        name: user.firstName ?? "User",
        verificationUrl: getAppUrl(`/verify-email?token=${encodeURIComponent(rawToken)}`),
      });
    }, { timeout: 20000 });
  } catch (e) {
    if (e instanceof Error && e.message === "THROTTLED") done(path, "error", "throttled");
    done(path, "error", "approval-failed");
  }

  done(path, "message", "verification-resent");
}