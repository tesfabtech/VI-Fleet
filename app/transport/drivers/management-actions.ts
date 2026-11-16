"use server";

import { createHash, randomBytes } from "node:crypto";
import { DriverStatus, UserStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getAppUrl,
  sendEmailVerificationEmail,
  sendTransportManagerInvitationEmail,
} from "@/lib/gmail-email";
import { prisma } from "@/lib/prisma";

const BASE_PATH = "/transport/drivers";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_ROLES = [
  "TRANSPORT_MANAGER",
  "VICE_TRANSPORT_MANAGER",
] as const;
const COOLDOWN_MS = 2 * 60 * 1000; // 2-minute resend throttle

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function resolveReturnPath(fd: FormData, fallback: string = BASE_PATH): string {
  const returnTo = normalizeText(fd.get("returnTo"));
  if (returnTo.startsWith(BASE_PATH)) {
    return returnTo;
  }
  return fallback;
}

function respond(
  path: string,
  param: "message" | "error",
  code: string,
): never {
  if (param === "message") {
    revalidatePath(BASE_PATH);
    revalidatePath(path);
  }
  redirect(`${path}?${param}=${encodeURIComponent(code)}`);
}

async function requireTransportManager(path: string = BASE_PATH) {
  const session = await auth();
  const sessionUser = session?.user;

  if (
    !sessionUser?.id ||
    !sessionUser.organizationId ||
    !sessionUser.role ||
    !ALLOWED_ROLES.includes(
      sessionUser.role as (typeof ALLOWED_ROLES)[number],
    )
  ) {
    redirect("/login");
  }

  const organization = await prisma.organization.findFirst({
    where: {
      id: sessionUser.organizationId,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!organization) {
    respond(path, "error", "organization-unavailable");
  }

  return {
    managerId: sessionUser.id,
    organizationId: sessionUser.organizationId,
    orgName: organization.name,
  };
}

export async function updateDriverProfile(formData: FormData): Promise<void> {
  const driverId = normalizeText(formData.get("driverId"));
  const defaultPath = driverId ? `${BASE_PATH}/${driverId}` : BASE_PATH;
  const path = resolveReturnPath(formData, defaultPath);
  const { organizationId } = await requireTransportManager(path);

  if (!UUID_RE.test(driverId)) {
    respond(path, "error", "invalid-id");
  }

  const firstName = normalizeText(formData.get("firstName"));
  const middleName = normalizeText(formData.get("middleName"));
  const lastName = normalizeText(formData.get("lastName"));
  const phone = normalizeText(formData.get("phone"));
  const licenseNumber = normalizeText(formData.get("licenseNumber"));
  const expiryInput = normalizeText(formData.get("licenseExpiryDate"));
  const notes = normalizeText(formData.get("notes"));

  if (!firstName || !lastName || !licenseNumber) {
    respond(path, "error", "missing-fields");
  }

  if (
    firstName.length > 100 ||
    middleName.length > 150 ||
    lastName.length > 100 ||
    phone.length > 30 ||
    licenseNumber.length > 100 ||
    notes.length > 2000
  ) {
    respond(path, "error", "invalid-length");
  }

  let licenseExpiryDate: Date | null = null;
  if (expiryInput) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryInput)) {
      respond(path, "error", "invalid-expiry");
    }

    const parsedDate = new Date(`${expiryInput}T00:00:00.000Z`);
    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== expiryInput
    ) {
      respond(path, "error", "invalid-expiry");
    }

    licenseExpiryDate = parsedDate;
  }

  const driver = await prisma.driver.findFirst({
    where: {
      id: driverId,
      organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!driver) {
    respond(path, "error", "driver-not-found");
  }

  // Validate license number uniqueness within this organization (excluding this driver)
  const duplicateLicense = await prisma.driver.findFirst({
    where: {
      organizationId,
      deletedAt: null,
      id: { not: driverId },
      licenseNumber: {
        equals: licenseNumber,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (duplicateLicense) {
    respond(path, "error", "license-exists");
  }

  let newPreferredVehicleId: string | null | undefined = undefined;
  if (formData.has("preferredVehicleId")) {
    const preferredInput = normalizeText(formData.get("preferredVehicleId"));
    if (!preferredInput || preferredInput === "none") {
      newPreferredVehicleId = null;
    } else if (UUID_RE.test(preferredInput)) {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: preferredInput,
          organizationId,
          deletedAt: null,
        },
        select: { id: true, status: true },
      });

      if (!vehicle) {
        respond(path, "error", "vehicle-not-found");
      }

      if (vehicle.status !== "ACTIVE") {
        respond(path, "error", "vehicle-not-active");
      }

      newPreferredVehicleId = vehicle.id;
    } else {
      respond(path, "error", "invalid-vehicle-id");
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.driver.update({
        where: { id: driver.id },
        data: {
          firstName,
          lastName,
          phone: phone || null,
          licenseNumber,
          licenseExpiryDate,
          notes: notes || null,
          ...(newPreferredVehicleId !== undefined
            ? { preferredVehicleId: newPreferredVehicleId }
            : {}),
        },
      });

      if (driver.userId) {
        await tx.user.update({
          where: { id: driver.userId },
          data: {
            firstName,
            middleName: middleName || null,
            lastName,
            phone: phone || null,
          },
        });
      }
    });
  } catch (error) {
    console.error("Failed to update driver profile:", error);
    respond(path, "error", "update-failed");
  }

  revalidatePath(BASE_PATH);
  revalidatePath(`${BASE_PATH}/${driverId}`);
  revalidatePath(`${BASE_PATH}/${driverId}/edit`);
  redirect(`${BASE_PATH}/${driverId}?message=profile-updated`);
}

export async function updateDriverStatus(formData: FormData): Promise<void> {
  const driverId = normalizeText(formData.get("driverId"));
  const defaultPath = driverId ? `${BASE_PATH}/${driverId}` : BASE_PATH;
  const path = resolveReturnPath(formData, defaultPath);
  const { organizationId } = await requireTransportManager(path);

  if (!UUID_RE.test(driverId)) {
    respond(path, "error", "invalid-id");
  }

  const status = normalizeText(formData.get("status")) as DriverStatus;
  if (![DriverStatus.ACTIVE, DriverStatus.INACTIVE, DriverStatus.SUSPENDED].includes(status)) {
    respond(path, "error", "invalid-status");
  }

  const driver = await prisma.driver.findFirst({
    where: {
      id: driverId,
      organizationId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!driver) {
    respond(path, "error", "driver-not-found");
  }

  await prisma.driver.update({
    where: { id: driver.id },
    data: { status },
  });

  revalidatePath(BASE_PATH);
  revalidatePath(`${BASE_PATH}/${driverId}`);
  respond(path, "message", "status-updated");
}

export async function updateDriverAccountStatus(formData: FormData): Promise<void> {
  const driverId = normalizeText(formData.get("driverId"));
  const defaultPath = driverId ? `${BASE_PATH}/${driverId}` : BASE_PATH;
  const path = resolveReturnPath(formData, defaultPath);
  const { organizationId } = await requireTransportManager(path);

  if (!UUID_RE.test(driverId)) {
    respond(path, "error", "invalid-id");
  }

  const userStatus = normalizeText(formData.get("userStatus")) as UserStatus;
  if (![UserStatus.ACTIVE, UserStatus.INACTIVE, UserStatus.SUSPENDED].includes(userStatus)) {
    respond(path, "error", "invalid-user-status");
  }

  const driver = await prisma.driver.findFirst({
    where: {
      id: driverId,
      organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      userId: true,
      user: {
        select: {
          id: true,
          email: true,
          pendingEmail: true,
          passwordHash: true,
        },
      },
    },
  });

  if (!driver || !driver.user) {
    respond(path, "error", "account-not-found");
  }

  if (userStatus === UserStatus.ACTIVE) {
    if (
      !driver.user.passwordHash ||
      !driver.user.email ||
      driver.user.pendingEmail
    ) {
      respond(path, "error", "setup-incomplete");
    }
  }

  await prisma.user.update({
    where: { id: driver.user.id },
    data: { status: userStatus },
  });

  revalidatePath(BASE_PATH);
  revalidatePath(`${BASE_PATH}/${driverId}`);
  respond(path, "message", "account-status-updated");
}

export async function resendDriverInvitation(formData: FormData): Promise<void> {
  const driverId = normalizeText(formData.get("driverId"));
  const defaultPath = driverId ? `${BASE_PATH}/${driverId}` : BASE_PATH;
  const path = resolveReturnPath(formData, defaultPath);
  const { managerId, organizationId, orgName } = await requireTransportManager(path);

  if (!UUID_RE.test(driverId)) {
    respond(path, "error", "invalid-id");
  }

  const driver = await prisma.driver.findFirst({
    where: {
      id: driverId,
      organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      user: {
        select: {
          id: true,
          email: true,
          pendingEmail: true,
          passwordHash: true,
          receivedInvitations: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      },
    },
  });

  if (!driver?.user) {
    respond(path, "error", "account-not-found");
  }

  const recipientEmail = driver.user.email ?? driver.user.pendingEmail;
  if (!recipientEmail) {
    respond(path, "error", "missing-email");
  }

  if (driver.user.passwordHash) {
    respond(path, "error", "password-already-set");
  }

  const now = new Date();
  const lastInvitation = driver.user.receivedInvitations[0];
  if (
    lastInvitation &&
    now.getTime() - lastInvitation.createdAt.getTime() < COOLDOWN_MS
  ) {
    respond(path, "error", "throttled");
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.organizationInvitation.updateMany({
        where: {
          userId: driver.user!.id,
          consumedAt: null,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      await tx.organizationInvitation.create({
        data: {
          userId: driver.user!.id,
          createdById: managerId,
          tokenHash,
          expiresAt,
        },
      });
    });

    const invitationUrl = getAppUrl(
      `/setup-password?token=${encodeURIComponent(rawToken)}`,
    );

    await sendTransportManagerInvitationEmail({
      to: recipientEmail,
      organizationName: orgName,
      roleLabel: "Driver",
      invitationUrl,
    });
  } catch (error) {
    console.error("Failed to resend driver invitation:", error);
    respond(path, "error", "invitation-send-failed");
  }

  revalidatePath(BASE_PATH);
  revalidatePath(`${BASE_PATH}/${driverId}`);
  respond(path, "message", "invitation-resent");
}

export async function resendDriverVerificationEmail(
  formData: FormData,
): Promise<void> {
  const driverId = normalizeText(formData.get("driverId"));
  const defaultPath = driverId ? `${BASE_PATH}/${driverId}` : BASE_PATH;
  const path = resolveReturnPath(formData, defaultPath);
  const { organizationId } = await requireTransportManager(path);

  if (!UUID_RE.test(driverId)) {
    respond(path, "error", "invalid-id");
  }

  const driver = await prisma.driver.findFirst({
    where: {
      id: driverId,
      organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      user: {
        select: {
          id: true,
          pendingEmail: true,
          passwordHash: true,
          emailVerificationTokens: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      },
    },
  });

  if (!driver?.user) {
    respond(path, "error", "account-not-found");
  }

  if (!driver.user.pendingEmail) {
    respond(path, "error", "already-verified");
  }

  if (!driver.user.passwordHash) {
    respond(path, "error", "password-not-set");
  }

  const now = new Date();
  const lastToken = driver.user.emailVerificationTokens[0];
  if (lastToken && now.getTime() - lastToken.createdAt.getTime() < COOLDOWN_MS) {
    respond(path, "error", "throttled");
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.emailVerificationToken.deleteMany({
        where: { userId: driver.user!.id },
      });

      await tx.emailVerificationToken.create({
        data: {
          userId: driver.user!.id,
          tokenHash,
          expiresAt,
        },
      });
    });

    const verificationUrl = getAppUrl(
      `/verify-email?token=${encodeURIComponent(rawToken)}`,
    );

    await sendEmailVerificationEmail({
      to: driver.user.pendingEmail,
      name: driver.firstName,
      verificationUrl,
    });
  } catch (error) {
    console.error("Failed to resend driver verification email:", error);
    respond(path, "error", "verification-send-failed");
  }

  revalidatePath(BASE_PATH);
  revalidatePath(`${BASE_PATH}/${driverId}`);
  respond(path, "message", "verification-resent");
}

export async function updateDriverPreferredVehicle(
  formData: FormData,
): Promise<void> {
  const driverId = normalizeText(formData.get("driverId"));
  const defaultPath = driverId ? `${BASE_PATH}/${driverId}` : BASE_PATH;
  const path = resolveReturnPath(formData, defaultPath);
  const { organizationId } = await requireTransportManager(path);

  if (!UUID_RE.test(driverId)) {
    respond(path, "error", "invalid-id");
  }

  const actionType = normalizeText(formData.get("action"));
  const vehicleIdInput = normalizeText(formData.get("vehicleId"));

  const driver = await prisma.driver.findFirst({
    where: {
      id: driverId,
      organizationId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!driver) {
    respond(path, "error", "driver-not-found");
  }

  // Handle Removal
  if (
    actionType === "remove" ||
    vehicleIdInput === "" ||
    vehicleIdInput === "none"
  ) {
    await prisma.driver.update({
      where: { id: driver.id },
      data: { preferredVehicleId: null },
    });

    revalidatePath(BASE_PATH);
    revalidatePath(`${BASE_PATH}/${driverId}`);
    revalidatePath(`${BASE_PATH}/${driverId}/edit`);
    respond(path, "message", "preferred-vehicle-removed");
  }

  // Handle Assignment / Update
  if (!UUID_RE.test(vehicleIdInput)) {
    respond(path, "error", "invalid-vehicle-id");
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleIdInput,
      organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!vehicle) {
    respond(path, "error", "vehicle-not-found");
  }

  if (vehicle.status !== "ACTIVE") {
    respond(path, "error", "vehicle-not-active");
  }

  await prisma.driver.update({
    where: { id: driver.id },
    data: {
      preferredVehicleId: vehicle.id,
    },
  });

  revalidatePath(BASE_PATH);
  revalidatePath(`${BASE_PATH}/${driverId}`);
  revalidatePath(`${BASE_PATH}/${driverId}/edit`);
  respond(path, "message", "preferred-vehicle-updated");
}

export async function removeDriverPreferredVehicle(
  formData: FormData,
): Promise<void> {
  const driverId = normalizeText(formData.get("driverId"));
  const defaultPath = driverId ? `${BASE_PATH}/${driverId}` : BASE_PATH;
  const path = resolveReturnPath(formData, defaultPath);
  const { organizationId } = await requireTransportManager(path);

  if (!UUID_RE.test(driverId)) {
    respond(path, "error", "invalid-id");
  }

  const driver = await prisma.driver.findFirst({
    where: {
      id: driverId,
      organizationId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!driver) {
    respond(path, "error", "driver-not-found");
  }

  await prisma.driver.update({
    where: { id: driver.id },
    data: {
      preferredVehicleId: null,
    },
  });

  revalidatePath(BASE_PATH);
  revalidatePath(`${BASE_PATH}/${driverId}`);
  revalidatePath(`${BASE_PATH}/${driverId}/edit`);
  respond(path, "message", "preferred-vehicle-removed");
}


