"use server";

import { prisma } from "@/lib/prisma";
import {
  getAppUrl,
  sendPasswordResetEmail,
} from "@/lib/gmail-email";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function requestPasswordReset(
  formData: FormData
): Promise<void> {
  const rawEmail = formData.get("email");
  const email =
    typeof rawEmail === "string" ? rawEmail.trim() : "";

  // Always use the same public response to avoid revealing accounts.
  if (!email || !isValidEmail(email)) {
    redirect("/forgot-password?submitted=1");
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        status: "ACTIVE",
        deletedAt: null,
        passwordHash: { not: null },
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (user?.email) {
      const token = randomBytes(32).toString("hex");
      const tokenHash = hashToken(token);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

      await prisma.$transaction(async (tx) => {
        // Invalidate any older, unused reset links for this user.
        await tx.passwordResetToken.updateMany({
          where: {
            userId: user.id,
            usedAt: null,
          },
          data: { usedAt: now },
        });

        await tx.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt,
          },
        });
      });

      try {
        const resetUrl = getAppUrl(
          `/reset-password?token=${encodeURIComponent(token)}`
        );

        await sendPasswordResetEmail({
          to: user.email,
          resetUrl,
        });
      } catch (error) {
        // Never expose account existence or email delivery errors publicly.
        console.error(
          "VI-Fleet password reset email could not be sent:",
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    }
  } catch (error) {
    console.error(
      "VI-Fleet password reset request failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  redirect("/forgot-password?submitted=1");
}

export async function resetPassword(
  formData: FormData
): Promise<void> {
  const rawToken = formData.get("token");
  const rawPassword = formData.get("password");
  const rawConfirmPassword = formData.get("confirmPassword");

  const token =
    typeof rawToken === "string" ? rawToken : "";
  const password =
    typeof rawPassword === "string" ? rawPassword : "";
  const confirmPassword =
    typeof rawConfirmPassword === "string"
      ? rawConfirmPassword
      : "";

  const tokenQuery = encodeURIComponent(token);

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    redirect("/reset-password?error=invalid");
  }

  if (password.length < 12 || password.length > 128) {
    redirect(`/reset-password?token=${tokenQuery}&error=password`);
  }

  if (password !== confirmPassword) {
    redirect(`/reset-password?token=${tokenQuery}&error=mismatch`);
  }

  const tokenHash = hashToken(token);
  const now = new Date();
  const passwordHash = await bcrypt.hash(password, 12);

  let resetSucceeded = false;

  try {
    await prisma.$transaction(async (tx) => {
      const resetToken = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          userId: true,
          expiresAt: true,
          usedAt: true,
        },
      });

      if (
        !resetToken ||
        resetToken.usedAt ||
        resetToken.expiresAt <= now
      ) {
        throw new Error("INVALID_RESET_TOKEN");
      }

      const user = await tx.user.findFirst({
        where: {
          id: resetToken.userId,
          status: "ACTIVE",
          deletedAt: null,
          passwordHash: { not: null },
        },
        select: { id: true },
      });

      if (!user) {
        throw new Error("INVALID_RESET_TOKEN");
      }

      // Claim the token exactly once, even if two requests arrive together.
      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (claimed.count !== 1) {
        throw new Error("INVALID_RESET_TOKEN");
      }

      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      resetSucceeded = true;
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message !== "INVALID_RESET_TOKEN"
    ) {
      console.error(
        "VI-Fleet password reset failed:",
        error.message
      );
    }
  }

  if (resetSucceeded) {
    redirect("/login?reset=success");
  }

  redirect("/reset-password?error=invalid");
}