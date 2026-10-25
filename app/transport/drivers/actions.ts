"use server";

import { randomBytes, createHash } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getAppUrl,
  sendTransportManagerInvitationEmail,
} from "@/lib/gmail-email";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const ALLOWED_ROLES = [
  "TRANSPORT_MANAGER",
  "VICE_TRANSPORT_MANAGER",
] as const;

function normalizeText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createDriver(formData: FormData): Promise<void> {
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

  const organizationId = sessionUser.organizationId;
  const createdById = sessionUser.id;

  const firstName = normalizeText(formData.get("firstName"));
  const middleName = normalizeText(formData.get("middleName"));
  const lastName = normalizeText(formData.get("lastName"));
  const email = normalizeEmail(normalizeText(formData.get("email")));
  const phone = normalizeText(formData.get("phone"));
  const licenseNumber = normalizeText(formData.get("licenseNumber"));
  const expiryInput = normalizeText(formData.get("licenseExpiryDate"));

  if (
    !firstName ||
    !middleName ||
    !lastName ||
    !email ||
    !licenseNumber
  ) {
    redirect("/transport/drivers/new?error=missing-fields");
  }

  if (
    firstName.length > 150 ||
    middleName.length > 150 ||
    lastName.length > 150 ||
    email.length > 255 ||
    phone.length > 30 ||
    licenseNumber.length > 100
  ) {
    redirect("/transport/drivers/new?error=invalid-length");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/transport/drivers/new?error=invalid-email");
  }

  let licenseExpiryDate: Date | null = null;

  if (expiryInput) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryInput)) {
      redirect("/transport/drivers/new?error=invalid-expiry");
    }

    const parsedDate = new Date(`${expiryInput}T00:00:00.000Z`);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== expiryInput
    ) {
      redirect("/transport/drivers/new?error=invalid-expiry");
    }

    licenseExpiryDate = parsedDate;
  }

  const organization = await prisma.organization.findFirst({
    where: {
      id: organizationId,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!organization) {
    redirect("/transport/drivers/new?error=organization-unavailable");
  }

  // Email addresses must not be reused by another account, including
  // accounts whose email is awaiting verification.
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: email, mode: "insensitive" } },
        { pendingEmail: { equals: email, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });

  if (existingUser) {
    redirect("/transport/drivers/new?error=email-exists");
  }

  // License numbers are checked within this organization.
  const existingDriver = await prisma.driver.findFirst({
    where: {
      organizationId,
      deletedAt: null,
      licenseNumber: {
        equals: licenseNumber,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (existingDriver) {
    redirect("/transport/drivers/new?error=license-exists");
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  try {
    await prisma.$transaction(async (tx) => {
      // Recheck inside the transaction to reduce duplicate-creation races.
      const duplicateUser = await tx.user.findFirst({
        where: {
          OR: [
            { email: { equals: email, mode: "insensitive" } },
            { pendingEmail: { equals: email, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });

      if (duplicateUser) {
        throw new Error("DRIVER_EMAIL_EXISTS");
      }

      const duplicateLicense = await tx.driver.findFirst({
        where: {
          organizationId,
          deletedAt: null,
          licenseNumber: {
            equals: licenseNumber,
            mode: "insensitive",
          },
        },
        select: { id: true },
      });

      if (duplicateLicense) {
        throw new Error("DRIVER_LICENSE_EXISTS");
      }

      const user = await tx.user.create({
        data: {
          organizationId,
          departmentId: null,
          firstName,
          middleName,
          lastName,
          // Keep the email pending until the verification flow confirms it.
          email: null,
          pendingEmail: email,
          phone: phone || null,
          passwordHash: null,
          role: "DRIVER",
          status: "INACTIVE",
        },
        select: { id: true },
      });

      await tx.driver.create({
        data: {
          organizationId,
          userId: user.id,
          firstName,
          lastName,
          phone: phone || null,
          licenseNumber,
          licenseExpiryDate,
          status: "INACTIVE",
        },
      });

      await tx.organizationInvitation.create({
        data: {
          userId: user.id,
          createdById,
          tokenHash,
          expiresAt,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "DRIVER_EMAIL_EXISTS") {
      redirect("/transport/drivers/new?error=email-exists");
    }

    if (
      error instanceof Error &&
      error.message === "DRIVER_LICENSE_EXISTS"
    ) {
      redirect("/transport/drivers/new?error=license-exists");
    }

    console.error("Failed to create driver account:", error);
    redirect("/transport/drivers/new?error=create-failed");
  }

  const invitationUrl = getAppUrl(
    `/setup-password?token=${encodeURIComponent(rawToken)}`,
  );

  try {
    await sendTransportManagerInvitationEmail({
      to: email,
      organizationName: organization.name,
      roleLabel: "Driver",
      invitationUrl,
    });
  } catch (error) {
    console.error("Driver invitation email could not be sent:", error);

    revalidatePath("/transport/drivers");
    redirect("/transport/drivers?invitation=failed");
  }

  revalidatePath("/transport/drivers");
  redirect("/transport/drivers?created=1");
}