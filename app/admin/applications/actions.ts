
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getAppUrl,
  sendAdministratorInvitationEmail,
} from "@/lib/gmail-email"
import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

export type ApplicationActionState = {
  success: boolean;
  message: string;
  invitationPath?: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const INVITATION_LIFETIME_MS = 48 * 60 * 60 * 1000;

async function isSystemAdministrator() {
  const session = await auth();

  return session?.user?.role === "SYSTEM_ADMINISTRATOR"
    ? session.user
    : null;
}

function getApplicationId(formData: FormData) {
  const id = formData.get("applicationId");

  return typeof id === "string" && UUID_PATTERN.test(id) ? id : null;
}

function getText(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function refreshApplicationPages(id: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${id}`);
}

function getDevelopmentInvitationPath(rawToken: string) {
  return process.env.NODE_ENV === "development"
    ? `/setup-password?token=${rawToken}`
    : undefined;
}

async function sendInvitationEmailSafely(input: {
  to: string;
  organizationName: string;
  rawToken: string;
}): Promise<boolean> {
  try {
    const invitationUrl = getAppUrl(
      `/setup-password?token=${input.rawToken}`,
    );

    await sendAdministratorInvitationEmail({
      to: input.to,
      organizationName: input.organizationName,
      invitationUrl,
    });

    return true;
  } catch (error) {
    // Do not log invitation URLs, raw tokens, or API keys.
    console.error(
      "Administrator invitation email failed:",
      error instanceof Error ? error.message : "Unknown email error",
    );

    return false;
  }
}

/**
 * Allocate a sequential VIF-00000 organization code.
 *
 * Existing five-digit codes are preserved. If none exist, allocation
 * begins at VIF-00110.
 */
async function allocateOrganizationCode(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<string> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(710110)`;

  const rows = await tx.$queryRaw<Array<{ next_code: number }>>`
    SELECT (
      COALESCE(
        MAX(SUBSTRING(code FROM 5)::INTEGER),
        109
      ) + 1
    )::INTEGER AS next_code
    FROM organizations
    WHERE code ~ '^VIF-[0-9]{5}$'
  `;

  const nextCode = Number(rows[0]?.next_code);

  if (
    !Number.isInteger(nextCode) ||
    nextCode < 1 ||
    nextCode > 99999
  ) {
    throw new Error("ORGANIZATION_CODE_ALLOCATION_FAILED");
  }

  return `VIF-${String(nextCode).padStart(5, "0")}`;
}

/**
 * Mark a pending application as under review.
 */
export async function markApplicationUnderReview(
  _previousState: ApplicationActionState,
  formData: FormData,
): Promise<ApplicationActionState> {
  const administrator = await isSystemAdministrator();

  if (!administrator) {
    return {
      success: false,
      message: "You are not authorized to perform this action.",
    };
  }

  const applicationId = getApplicationId(formData);

  if (!applicationId) {
    return {
      success: false,
      message: "Invalid application.",
    };
  }

  try {
    const result = await prisma.organizationApplication.updateMany({
      where: {
        id: applicationId,
        status: "PENDING",
        organizationId: null,
      },
      data: {
        status: "UNDER_REVIEW",
        reviewedById: administrator.id,
        reviewedAt: new Date(),
      },
    });

    if (result.count !== 1) {
      return {
        success: false,
        message:
          "This application is no longer pending. Refresh the page and check its current status.",
      };
    }

    refreshApplicationPages(applicationId);

    return {
      success: true,
      message: "The application is now under review.",
    };
  } catch (error) {
    console.error("Mark application under review failed:", error);

    return {
      success: false,
      message: "Unable to update the application. Please try again.",
    };
  }
}

/**
 * Reject an application with a recorded reason.
 */
export async function rejectOrganizationApplication(
  _previousState: ApplicationActionState,
  formData: FormData,
): Promise<ApplicationActionState> {
  const administrator = await isSystemAdministrator();

  if (!administrator) {
    return {
      success: false,
      message: "You are not authorized to perform this action.",
    };
  }

  const applicationId = getApplicationId(formData);
  const reason = getText(formData, "reviewNotes");

  if (!applicationId) {
    return {
      success: false,
      message: "Invalid application.",
    };
  }

  if (reason.length < 10 || reason.length > 2000) {
    return {
      success: false,
      message:
        "Provide a rejection reason between 10 and 2,000 characters.",
    };
  }

  try {
    const result = await prisma.organizationApplication.updateMany({
      where: {
        id: applicationId,
        status: { in: ["PENDING", "UNDER_REVIEW"] },
        organizationId: null,
      },
      data: {
        status: "REJECTED",
        reviewNotes: reason,
        reviewedById: administrator.id,
        reviewedAt: new Date(),
      },
    });

    if (result.count !== 1) {
      return {
        success: false,
        message:
          "This application has already been processed. Refresh the page to see its current status.",
      };
    }

    refreshApplicationPages(applicationId);

    return {
      success: true,
      message: "The application has been rejected and the reason recorded.",
    };
  } catch (error) {
    console.error("Reject organization application failed:", error);

    return {
      success: false,
      message: "Unable to reject the application. Please try again.",
    };
  }
}

/**
 * Approve an application, create its organization and inactive
 * administrator, and create a hashed, expiring invitation.
 *
 * Email is sent only after the transaction commits.
 */
export async function approveOrganizationApplication(
  _previousState: ApplicationActionState,
  formData: FormData,
): Promise<ApplicationActionState> {
  const administrator = await isSystemAdministrator();

  if (!administrator) {
    return {
      success: false,
      message: "You are not authorized to perform this action.",
    };
  }

  const applicationId = getApplicationId(formData);
  const reviewNotes = getText(formData, "reviewNotes");

  if (!applicationId) {
    return {
      success: false,
      message: "Invalid application.",
    };
  }

  if (reviewNotes.length > 2000) {
    return {
      success: false,
      message: "Review notes must be 2,000 characters or fewer.",
    };
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS);

  let invitationRecipient = "";
  let approvedOrganizationName = "";

  try {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.organizationApplication.updateMany({
        where: {
          id: applicationId,
          status: { in: ["PENDING", "UNDER_REVIEW"] },
          organizationId: null,
        },
        data: {
          status: "APPROVED",
          reviewedById: administrator.id,
          reviewedAt: new Date(),
          reviewNotes: reviewNotes || null,
        },
      });

      if (claim.count !== 1) {
        throw new Error("APPLICATION_ALREADY_PROCESSED");
      }

      const application = await tx.organizationApplication.findUnique({
        where: { id: applicationId },
      });

      if (!application) {
        throw new Error("APPLICATION_NOT_FOUND");
      }

      const code = await allocateOrganizationCode(tx);

      const organization = await tx.organization.create({
        data: {
          name: application.organizationName,
          description: application.description,
          contactEmail: application.contactEmail,
          phone: application.phone,
          code,
        },
      });

      const user = await tx.user.create({
        data: {
          organization: {
            connect: { id: organization.id },
          },
          firstName: null,
          middleName: null,
          lastName: null,
          email: null,
          pendingEmail: null,
          passwordHash: null,
          phone: null,
          role: "ORGANIZATION_ADMINISTRATOR",
          status: "INACTIVE",
        },
      });

      await tx.organizationInvitation.create({
        data: {
          userId: user.id,
          createdById: administrator.id,
          tokenHash,
          expiresAt,
        },
      });

      await tx.organizationApplication.update({
        where: { id: applicationId },
        data: { organizationId: organization.id },
      });

      invitationRecipient = application.contactEmail;
      approvedOrganizationName = application.organizationName;
    });

    refreshApplicationPages(applicationId);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "APPLICATION_ALREADY_PROCESSED"
    ) {
      return {
        success: false,
        message:
          "This application has already been processed. Refresh the page before taking further action.",
      };
    }

    console.error("Approve organization application failed:", error);

    return {
      success: false,
      message:
        "Approval failed. No partial organization setup was committed. Check the server logs for details.",
    };
  }

  const emailSent = await sendInvitationEmailSafely({
    to: invitationRecipient,
    organizationName: approvedOrganizationName,
    rawToken,
  });

  if (emailSent) {
    return {
      success: true,
      message:
        "The organization has been approved and an administrator invitation email has been sent. The administrator must complete setup and verify their login email before signing in.",
    };
  }

  return {
    success: true,
    message:
      "The organization was approved and created, but the invitation email could not be sent. Check your Resend configuration and reissue the invitation when ready.",
    invitationPath: getDevelopmentInvitationPath(rawToken),
  };
}

/**
 * Create a replacement invitation for an existing inactive
 * organization administrator whose initial setup has not started.
 */
export async function reissueAdministratorInvitation(
  _previousState: ApplicationActionState,
  formData: FormData,
): Promise<ApplicationActionState> {
  const administrator = await isSystemAdministrator();

  if (!administrator) {
    return {
      success: false,
      message: "You are not authorized to perform this action.",
    };
  }

  const applicationId = getApplicationId(formData);

  if (!applicationId) {
    return {
      success: false,
      message: "Invalid application.",
    };
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS);

  let invitationRecipient = "";
  let organizationName = "";

  try {
    await prisma.$transaction(async (tx) => {
      const application = await tx.organizationApplication.findUnique({
        where: { id: applicationId },
        select: {
          status: true,
          organizationId: true,
          organizationName: true,
          contactEmail: true,
        },
      });

      if (
        !application ||
        application.status !== "APPROVED" ||
        !application.organizationId
      ) {
        throw new Error("APPROVED_ORGANIZATION_NOT_FOUND");
      }

      const user = await tx.user.findFirst({
        where: {
          organizationId: application.organizationId,
          role: "ORGANIZATION_ADMINISTRATOR",
          status: "INACTIVE",
          deletedAt: null,
        },
        select: {
          id: true,
          email: true,
          pendingEmail: true,
          passwordHash: true,
        },
      });

      if (!user) {
        throw new Error("INACTIVE_ADMINISTRATOR_NOT_FOUND");
      }

      if (user.passwordHash || user.email || user.pendingEmail) {
        throw new Error("ADMINISTRATOR_SETUP_ALREADY_STARTED");
      }

      await tx.organizationInvitation.updateMany({
        where: {
          userId: user.id,
          consumedAt: null,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      await tx.organizationInvitation.create({
        data: {
          userId: user.id,
          createdById: administrator.id,
          tokenHash,
          expiresAt,
        },
      });

      invitationRecipient = application.contactEmail;
      organizationName = application.organizationName;
    });

    refreshApplicationPages(applicationId);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "APPROVED_ORGANIZATION_NOT_FOUND") {
        return {
          success: false,
          message:
            "No approved organization is linked to this application.",
        };
      }

      if (error.message === "INACTIVE_ADMINISTRATOR_NOT_FOUND") {
        return {
          success: false,
          message:
            "No inactive organization administrator was found for this organization.",
        };
      }

      if (error.message === "ADMINISTRATOR_SETUP_ALREADY_STARTED") {
        return {
          success: false,
          message:
            "The administrator's setup has already started. Do not issue a setup invitation through this action.",
        };
      }
    }

    console.error("Reissue administrator invitation failed:", error);

    return {
      success: false,
      message:
        "Unable to create a replacement invitation. Check the server logs for details.",
    };
  }

  const emailSent = await sendInvitationEmailSafely({
    to: invitationRecipient,
    organizationName,
    rawToken,
  });

  if (emailSent) {
    return {
      success: true,
      message:
        "A replacement administrator invitation email has been sent. The previous unused invitation has been revoked.",
    };
  }

  return {
    success: true,
    message:
      "The replacement invitation was created, but its email could not be sent. Check your Resend configuration.",
    invitationPath: getDevelopmentInvitationPath(rawToken),
  };
}
