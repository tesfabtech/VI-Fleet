
"use server";

import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";
import { redirect } from "next/navigation";

export type VerifyEmailState = {
  success: boolean;
  message: string;
};

const eligibleUserScope = {
  OR: [
    {
      role: "ORGANIZATION_ADMINISTRATOR" as const,
      organizationId: { not: null },
      departmentId: null,
    },
    {
      role: "DEPARTMENT_USER" as const,
      organizationId: { not: null },
      departmentId: { not: null },
    },
    {
      role: "TRANSPORT_MANAGER" as const,
      organizationId: { not: null },
      departmentId: null,
    },
    {
      role: "VICE_TRANSPORT_MANAGER" as const,
      organizationId: { not: null },
      departmentId: null,
    },
    {
      role: "DRIVER" as const,
      organizationId: { not: null },
      departmentId: null,
    },
  ],
};

export async function verifyAccountEmail(
  _previousState: VerifyEmailState,
  formData: FormData,
): Promise<VerifyEmailState> {
  const value = formData.get("token");
  const token = typeof value === "string" ? value.trim() : "";

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return { success: false, message: "Invalid verification link." };
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const verification = await tx.emailVerificationToken.findFirst({
        where: {
          tokenHash,
          consumedAt: null,
          expiresAt: { gt: now },
          user: {
            deletedAt: null,
            status: "INACTIVE",
            pendingEmail: { not: null },
            passwordHash: { not: null },
            ...eligibleUserScope,
          },
        },
        select: {
          id: true,
          userId: true,
        },
      });

      if (!verification) {
        throw new Error("TOKEN_INVALID");
      }

      const user = await tx.user.findFirst({
        where: {
          id: verification.userId,
          deletedAt: null,
          status: "INACTIVE",
          pendingEmail: { not: null },
          passwordHash: { not: null },
          ...eligibleUserScope,
        },
        select: {
          pendingEmail: true,
          role: true,
          organizationId: true,
        },
      });

      if (!user?.pendingEmail) {
        throw new Error("TOKEN_INVALID");
      }

      const claimed = await tx.emailVerificationToken.updateMany({
        where: {
          id: verification.id,
          tokenHash,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: {
          consumedAt: new Date(),
        },
      });

      if (claimed.count !== 1) {
        throw new Error("TOKEN_INVALID");
      }

      const changed = await tx.user.updateMany({
        where: {
          id: verification.userId,
          status: "INACTIVE",
          pendingEmail: user.pendingEmail,
          deletedAt: null,
          ...eligibleUserScope,
        },
        data: {
          email: user.pendingEmail,
          pendingEmail: null,
          status: "ACTIVE",
        },
      });

      if (changed.count !== 1) {
        throw new Error("TOKEN_INVALID");
      }

      // Activate the linked Driver record only after the user's email
      // has been verified successfully.
      if (user.role === "DRIVER" && user.organizationId) {
        await tx.driver.updateMany({
          where: {
            organizationId: user.organizationId,
            userId: verification.userId,
            status: "INACTIVE",
            deletedAt: null,
          },
          data: {
            status: "ACTIVE",
          },
        });
      }
    });
  } catch (error) {
    console.error("Account email verification failed:", error);

    return {
      success: false,
      message:
        "This verification link is invalid, expired, already used, or the email could not be activated.",
    };
  }

  redirect("/login?verified=1");
}
