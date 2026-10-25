
"use server";

import { prisma } from "@/lib/prisma";
import {
  getAppUrl,
  sendEmailVerificationEmail,
} from "@/lib/gmail-email";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

export type PasswordSetupState = {
  success: boolean;
  message: string;
  verificationPath?: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function validEmail(email: string): boolean {
  return (
    email.length <= 255 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

const eligibleRoles = [
  "ORGANIZATION_ADMINISTRATOR",
  "DEPARTMENT_USER",
  "TRANSPORT_MANAGER",
  "VICE_TRANSPORT_MANAGER",
  "DRIVER",
] as const;


export async function setInitialPassword(
  _previousState: PasswordSetupState,
  formData: FormData,
): Promise<PasswordSetupState> {
  const token = getText(formData, "token");

  // Organization Administrators may enter details during setup.
  // Department Users, Transport Managers, and Drivers use saved details.
  const submittedFirstName = getText(formData, "firstName");
  const submittedMiddleName = getText(formData, "middleName");
  const submittedLastName = getText(formData, "lastName");
  const submittedEmail = getText(formData, "email").toLowerCase();

  const passwordValue = formData.get("password");
  const confirmationValue = formData.get("confirmPassword");

  const password =
    typeof passwordValue === "string" ? passwordValue : "";
  const confirmation =
    typeof confirmationValue === "string" ? confirmationValue : "";

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return {
      success: false,
      message: "Invalid invitation link.",
    };
  }

  if (password.length < 12 || password.length > 128) {
    return {
      success: false,
      message: "Your password must be between 12 and 128 characters.",
    };
  }

  if (password !== confirmation) {
    return {
      success: false,
      message: "The passwords do not match.",
    };
  }

  const tokenHash = hashToken(token);
  const verificationToken = randomBytes(32).toString("hex");
  const verificationHash = hashToken(verificationToken);
  const now = new Date();

  const expiresAt = new Date(
    now.getTime() + 48 * 60 * 60 * 1000,
  );

  const passwordHash = await bcrypt.hash(password, 12);

  let verificationEmail = "";
  let verificationName = "";

  try {
    await prisma.$transaction(async (tx) => {
      const invitation = await tx.organizationInvitation.findFirst({
        where: {
          tokenHash,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
          user: {
            deletedAt: null,
            passwordHash: null,
            status: "INACTIVE",
            role: { in: [...eligibleRoles] },
          },
        },
        select: {
          id: true,
          userId: true,
          user: {
            select: {
              role: true,
              organizationId: true,
              departmentId: true,
              firstName: true,
              middleName: true,
              lastName: true,
              email: true,
              pendingEmail: true,
            },
          },
        },
      });

      if (!invitation) {
        throw new Error("INVITATION_INVALID");
      }

      const invitedUser = invitation.user;

      if (
        invitedUser.role !== "ORGANIZATION_ADMINISTRATOR" &&
        invitedUser.role !== "DEPARTMENT_USER" &&
        invitedUser.role !== "TRANSPORT_MANAGER" &&
        invitedUser.role !== "VICE_TRANSPORT_MANAGER" &&
        invitedUser.role !== "DRIVER"
      ) {
        throw new Error("INVITATION_INVALID");
      }

      const isDepartmentUser =
        invitedUser.role === "DEPARTMENT_USER";

      const isTransportManager =
        invitedUser.role === "TRANSPORT_MANAGER" ||
        invitedUser.role === "VICE_TRANSPORT_MANAGER";

      const isDriver = invitedUser.role === "DRIVER";

      const usesSavedDetails =
        isDepartmentUser || isTransportManager || isDriver;

      // Enforce the required organization and department scope.
      if (
        !invitedUser.organizationId ||
        (invitedUser.role === "ORGANIZATION_ADMINISTRATOR" &&
          invitedUser.departmentId !== null) ||
        (isDepartmentUser && !invitedUser.departmentId) ||
        (isTransportManager && invitedUser.departmentId !== null) ||
        (isDriver && invitedUser.departmentId !== null)
      ) {
        throw new Error("INVITATION_INVALID");
      }

      // Drivers may have email stored in pendingEmail until verification.
      const savedEmail =
        invitedUser.pendingEmail ?? invitedUser.email;

      // Invited users must have complete details saved on their accounts.
      if (
        usesSavedDetails &&
        (
          !invitedUser.firstName?.trim() ||
          !invitedUser.middleName?.trim() ||
          !invitedUser.lastName?.trim() ||
          !savedEmail?.trim()
        )
      ) {
        throw new Error("PROFILE_INVALID");
      }

      const firstName = usesSavedDetails
        ? invitedUser.firstName!.trim()
        : submittedFirstName;

      const middleName = usesSavedDetails
        ? invitedUser.middleName!.trim()
        : submittedMiddleName;

      const lastName = usesSavedDetails
        ? invitedUser.lastName!.trim()
        : submittedLastName;

      const email = usesSavedDetails
        ? (savedEmail ?? "").trim().toLowerCase()
        : submittedEmail;

      if (
        !firstName ||
        !middleName ||
        !lastName ||
        firstName.length > 150 ||
        middleName.length > 150 ||
        lastName.length > 150
      ) {
        throw new Error("PROFILE_INVALID");
      }

      if (!validEmail(email)) {
        throw new Error("PROFILE_INVALID");
      }

      // Check for an account already using this verified email.
      const existingEmail = await tx.user.findFirst({
        where: {
          email: { equals: email, mode: "insensitive" },
        },
        select: { id: true },
      });

      if (
        existingEmail &&
        existingEmail.id !== invitation.userId
      ) {
        throw new Error("EMAIL_ALREADY_USED");
      }

      // Claim the invitation exactly once.
      const claimed = await tx.organizationInvitation.updateMany({
        where: {
          id: invitation.id,
          tokenHash,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date() },
      });

      if (claimed.count !== 1) {
        throw new Error("INVITATION_INVALID");
      }

      const updated = await tx.user.updateMany({
        where: {
          id: invitation.userId,
          role: invitedUser.role,
          passwordHash: null,
          deletedAt: null,
          status: "INACTIVE",
        },
        data: {
          firstName,
          middleName,
          lastName,
          pendingEmail: email,
          passwordHash,
        },
      });

      if (updated.count !== 1) {
        throw new Error("INVITATION_INVALID");
      }

      // Replace any previous verification token.
      await tx.emailVerificationToken.deleteMany({
        where: { userId: invitation.userId },
      });

      await tx.emailVerificationToken.create({
        data: {
          userId: invitation.userId,
          tokenHash: verificationHash,
          expiresAt,
        },
      });

      verificationEmail = email;
      verificationName = firstName;
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "EMAIL_ALREADY_USED"
    ) {
      return {
        success: false,
        message:
          "That email is already associated with another account. Please contact your organization administrator.",
      };
    }

    if (
      error instanceof Error &&
      error.message === "PROFILE_INVALID"
    ) {
      return {
        success: false,
        message:
          "The account details are incomplete or invalid. Please contact your organization administrator.",
      };
    }

    if (
      error instanceof Error &&
      error.message === "INVITATION_INVALID"
    ) {
      return {
        success: false,
        message:
          "This invitation is invalid, expired, or already used. Contact your organization administrator.",
      };
    }

    console.error("Initial account setup failed:", error);

    return {
      success: false,
      message: "We could not complete setup. Please try again.",
    };
  }

  try {
    await sendEmailVerificationEmail({
      to: verificationEmail,
      name: verificationName,
      verificationUrl: getAppUrl(
        `/verify-email?token=${verificationToken}`,
      ),
    });

    return {
      success: true,
      message:
        "Your account details have been saved. Check your email for the verification link. Your account will activate after verification.",
    };
  } catch {
    console.error("Verification email could not be sent.");

    if (process.env.NODE_ENV === "development") {
      return {
        success: true,
        message:
          "Your details were saved, but email delivery failed. Use this local development link to verify your email.",
        verificationPath:
          `/verify-email?token=${verificationToken}`,
      };
    }

    return {
      success: true,
      message:
        "Your details were saved, but we could not send the verification email. Request a new verification email or contact your organization administrator.",
    };
  }
}