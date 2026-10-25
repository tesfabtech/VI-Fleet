
"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getAppUrl,
  sendTransportManagerInvitationEmail,
} from "@/lib/gmail-email";

const pagePath = "/organization/transport-managers";

type TransportRole =
  | "TRANSPORT_MANAGER"
  | "VICE_TRANSPORT_MANAGER";

function isAllowedCreatorRole(role: UserRole): boolean {
  return (
    role === "ORGANIZATION_ADMINISTRATOR" ||
    role === "VICE_ORGANIZATION_ADMINISTRATOR"
  );
}

function isTransportRole(role: string): role is TransportRole {
  return (
    role === "TRANSPORT_MANAGER" ||
    role === "VICE_TRANSPORT_MANAGER"
  );
}

function getText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function finishWithError(error: string): never {
  redirect(`${pagePath}?error=${encodeURIComponent(error)}`);
}

export async function createTransportManager(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (
    !isAllowedCreatorRole(session.user.role) ||
    !session.user.organizationId
  ) {
    redirect("/organization");
  }

  const firstName = getText(formData, "firstName");
  const middleName = getText(formData, "middleName");
  const lastName = getText(formData, "lastName");
  const email = getText(formData, "email").toLowerCase();
  const phone = getText(formData, "phone");
  const roleInput = getText(formData, "role");

  if (
    !firstName ||
    !middleName ||
    !lastName ||
    !email ||
    !isTransportRole(roleInput)
  ) {
    finishWithError("invalid");
  }

  if (
    firstName.length > 150 ||
    middleName.length > 150 ||
    lastName.length > 150 ||
    email.length > 255 ||
    phone.length > 30 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    finishWithError("invalid");
  }

  const role: TransportRole = roleInput;
  const roleLabel =
    role === "VICE_TRANSPORT_MANAGER"
      ? "Vice Transport Manager"
      : "Transport Manager";

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  try {
    await prisma.$transaction(
      async (tx) => {
        const organization = await tx.organization.findFirst({
          where: {
            id: session.user.organizationId!,
            status: "ACTIVE",
            deletedAt: null,
          },
          select: {
            name: true,
          },
        });

        if (!organization) {
          throw new Error("ORGANIZATION_INACTIVE");
        }

        // Check globally, including soft-deleted accounts.
        const existingUser = await tx.user.findFirst({
          where: {
            email: {
              equals: email,
              mode: "insensitive",
            },
          },
          select: {
            id: true,
          },
        });

        if (existingUser) {
          throw new Error("EMAIL_ALREADY_USED");
        }

        const user = await tx.user.create({
          data: {
            organizationId: session.user.organizationId!,
            firstName,
            middleName,
            lastName,
            email,
            phone: phone || null,
            role,
            status: "INACTIVE",
            passwordHash: null,
          },
        });

        await tx.organizationInvitation.create({
  data: {
    userId: user.id,
    createdById: session.user.id,
    tokenHash,
    expiresAt,
  },
});

        await sendTransportManagerInvitationEmail({
          to: email,
          organizationName: organization.name,
          roleLabel,
          invitationUrl: getAppUrl(
            `/setup-password?token=${encodeURIComponent(rawToken)}`
          ),
        });
      },
      { timeout: 20000 }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "EMAIL_ALREADY_USED"
    ) {
      finishWithError("email-used");
    }

    if (
      error instanceof Error &&
      error.message === "ORGANIZATION_INACTIVE"
    ) {
      finishWithError("organization-inactive");
    }

    console.error("Transport Manager creation failed:", error);
    finishWithError("creation-failed");
  }

  revalidatePath(pagePath);
  revalidatePath("/organization");
  redirect(`${pagePath}?message=invitation-sent`);
}


export async function resendTransportManagerInvitation(
  formData: FormData
) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (
    !isAllowedCreatorRole(session.user.role) ||
    !session.user.organizationId
  ) {
    redirect("/organization");
  }

  const userId = getText(formData, "userId");

  if (!userId) {
    finishWithError("invalid");
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  try {
    await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.findFirst({
        where: {
          id: session.user.organizationId!,
          status: "ACTIVE",
          deletedAt: null,
        },
        select: { name: true },
      });

      if (!organization) {
        throw new Error("ORGANIZATION_INACTIVE");
      }

      const user = await tx.user.findFirst({
        where: {
          id: userId,
          organizationId: session.user.organizationId!,
          role: {
            in: ["TRANSPORT_MANAGER", "VICE_TRANSPORT_MANAGER"],
          },
          status: "INACTIVE",
          deletedAt: null,
          passwordHash: null,
          pendingEmail: null,
        },
        select: {
          id: true,
          email: true,
          role: true,
        },
      });

      if (!user?.email) {
        throw new Error("USER_NOT_ELIGIBLE");
      }

      // Invalidate previous unused invitations for this account.
      await tx.organizationInvitation.updateMany({
        where: {
          userId: user.id,
          consumedAt: null,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      await tx.organizationInvitation.create({
        data: {
          userId: user.id,
          createdById: session.user.id,
          tokenHash,
          expiresAt,
        },
      });

      const roleLabel =
        user.role === "VICE_TRANSPORT_MANAGER"
          ? "Vice Transport Manager"
          : "Transport Manager";

      await sendTransportManagerInvitationEmail({
        to: user.email,
        organizationName: organization.name,
        roleLabel,
        invitationUrl: getAppUrl(
          `/setup-password?token=${encodeURIComponent(rawToken)}`
        ),
      });
    }, { timeout: 20000 });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "ORGANIZATION_INACTIVE"
    ) {
      finishWithError("organization-inactive");
    }

    if (
      error instanceof Error &&
      error.message === "USER_NOT_ELIGIBLE"
    ) {
      finishWithError("invitation-unavailable");
    }

    console.error("Transport Manager invitation resend failed:", error);
    finishWithError("creation-failed");
  }

  revalidatePath(pagePath);
  revalidatePath("/organization");
  redirect(`${pagePath}?message=invitation-sent`);
}