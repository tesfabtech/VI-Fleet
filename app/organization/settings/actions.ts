"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const SETTINGS_PATH = "/organization/settings";

const ALLOWED_ROLES = [
  "ORGANIZATION_ADMINISTRATOR",
  "VICE_ORGANIZATION_ADMINISTRATOR",
] as const;

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readRawString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function redirectWithError(error: string): never {
  redirect(`${SETTINGS_PATH}?error=${encodeURIComponent(error)}`);
}

function redirectWithSuccess(success: string): never {
  redirect(`${SETTINGS_PATH}?success=${encodeURIComponent(success)}`);
}

async function getAuthorizedOrganizationAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (
    !session.user.role ||
    !ALLOWED_ROLES.includes(
      session.user.role as (typeof ALLOWED_ROLES)[number],
    ) ||
    !session.user.organizationId
  ) {
    redirect("/dashboard");
  }

  const adminUser = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      organizationId: session.user.organizationId,
      role: { in: [...ALLOWED_ROLES] },
      status: "ACTIVE",
      deletedAt: null,
      organization: {
        deletedAt: null,
      },
    },
    select: {
      id: true,
      role: true,
      passwordHash: true,
      organizationId: true,
      organization: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!adminUser || !adminUser.organizationId || !adminUser.organization) {
    redirect("/login");
  }

  return {
    userId: adminUser.id,
    role: adminUser.role,
    passwordHash: adminUser.passwordHash,
    organizationId: adminUser.organizationId,
    organizationStatus: adminUser.organization.status,
  };
}

/**
 * 1. Update permitted organization profile information.
 */
export async function updateOrganizationProfile(formData: FormData) {
  const admin = await getAuthorizedOrganizationAdmin();

  if (admin.organizationStatus !== "ACTIVE") {
    redirectWithError("organization-inactive");
  }

  const name = readText(formData, "name");
  const contactEmail = readText(formData, "contactEmail").toLowerCase();
  const phone = readText(formData, "phone");
  const description = readText(formData, "description");

  if (!name) {
    redirectWithError("name-required");
  }

  if (name.length > 150) {
    redirectWithError("name-too-long");
  }

  if (
    contactEmail &&
    (contactEmail.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))
  ) {
    redirectWithError("invalid-email");
  }

  if (phone.length > 30) {
    redirectWithError("phone-too-long");
  }

  if (description.length > 2000) {
    redirectWithError("description-too-long");
  }

  const result = await prisma.organization.updateMany({
    where: {
      id: admin.organizationId,
      status: "ACTIVE",
      deletedAt: null,
    },
    data: {
      name,
      contactEmail: contactEmail || null,
      phone: phone || null,
      description: description || null,
    },
  });

  if (result.count !== 1) {
    redirectWithError("organization-inactive");
  }

  revalidatePath(SETTINGS_PATH);
  revalidatePath("/organization");

  redirectWithSuccess("organization-updated");
}

/**
 * 2. Update the logged-in administrator's personal profile details.
 */
export async function updateAdministratorProfile(formData: FormData) {
  const admin = await getAuthorizedOrganizationAdmin();

  const firstName = readText(formData, "firstName");
  const middleName = readText(formData, "middleName");
  const lastName = readText(formData, "lastName");
  const phone = readText(formData, "phone");

  if (
    !firstName ||
    !middleName ||
    !lastName ||
    firstName.length > 150 ||
    middleName.length > 150 ||
    lastName.length > 150
  ) {
    redirectWithError("invalid-admin-name");
  }

  if (phone.length > 30) {
    redirectWithError("phone-too-long");
  }

  const updated = await prisma.user.updateMany({
    where: {
      id: admin.userId,
      organizationId: admin.organizationId,
      status: "ACTIVE",
      deletedAt: null,
    },
    data: {
      firstName,
      middleName,
      lastName,
      phone: phone || null,
    },
  });

  if (updated.count !== 1) {
    redirectWithError("profile-update-failed");
  }

  revalidatePath(SETTINGS_PATH);
  revalidatePath("/organization");

  redirectWithSuccess("admin-profile-updated");
}

/**
 * 3. Update the logged-in administrator's password after verifying current password.
 */
export async function updateAdministratorPassword(formData: FormData) {
  const admin = await getAuthorizedOrganizationAdmin();

  const currentPassword = readRawString(formData, "currentPassword");
  const newPassword = readRawString(formData, "newPassword");
  const confirmPassword = readRawString(formData, "confirmPassword");

  if (!currentPassword || !admin.passwordHash) {
    redirectWithError("current-password-incorrect");
  }

  if (newPassword.length < 12 || newPassword.length > 128) {
    redirectWithError("password-length");
  }

  if (newPassword !== confirmPassword) {
    redirectWithError("password-mismatch");
  }

  const matchesCurrent = await bcrypt.compare(
    currentPassword,
    admin.passwordHash,
  );

  if (!matchesCurrent) {
    redirectWithError("current-password-incorrect");
  }

  const isSameAsOld = await bcrypt.compare(newPassword, admin.passwordHash);

  if (isSameAsOld) {
    redirectWithError("password-unchanged");
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 12);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: {
        id: admin.userId,
        organizationId: admin.organizationId,
        status: "ACTIVE",
        deletedAt: null,
      },
      data: {
        passwordHash: newPasswordHash,
      },
    });

    if (updated.count !== 1) {
      throw new Error("PASSWORD_UPDATE_FAILED");
    }

    // Invalidate any unused password reset tokens for this account
    await tx.passwordResetToken.updateMany({
      where: {
        userId: admin.userId,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });
  });

  revalidatePath(SETTINGS_PATH);
  redirectWithSuccess("password-updated");
}
