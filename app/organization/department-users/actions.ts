
"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getAppUrl,
  sendDepartmentUserInvitationEmail,
} from "@/lib/gmail-email";

const applicationsPath = "/organization/department-users";

const allowedRoles = [
  "ORGANIZATION_ADMINISTRATOR",
  "VICE_ORGANIZATION_ADMINISTRATOR",
];

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getFormText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function getReviewer() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!allowedRoles.includes(session.user.role)) {
    redirect(`${applicationsPath}?error=unauthorized`);
  }

  if (!session.user.organizationId) {
    redirect(`${applicationsPath}?error=unauthorized`);
  }

  return {
    userId: session.user.id,
    organizationId: session.user.organizationId,
  };
}

function finishWithMessage(message: string): never {
  revalidatePath(applicationsPath);
  redirect(`${applicationsPath}?message=${message}`);
}

function finishWithError(error: string): never {
  redirect(`${applicationsPath}?error=${error}`);
}

export async function approveDepartmentUserApplication(
  formData: FormData,
) {
  const reviewer = await getReviewer();
  const applicationId = getFormText(formData, "applicationId");
  const reviewNotes = getFormText(formData, "reviewNotes");

  if (!applicationId) {
    finishWithError("invalid");
  }

  if (reviewNotes.length > 2000) {
    finishWithError("notes");
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  try {
    await prisma.$transaction(
      async (tx) => {
        const application =
          await tx.departmentUserApplication.findFirst({
            where: {
              id: applicationId,
              organizationId: reviewer.organizationId,
              status: { in: ["PENDING", "UNDER_REVIEW"] },
              createdUserId: null,
            },
            include: {
              department: {
                select: { name: true, status: true, deletedAt: true },
              },
              organization: {
                select: { name: true, status: true, deletedAt: true },
              },
            },
          });

        if (!application) {
          throw new Error("APPLICATION_ALREADY_REVIEWED");
        }

        if (
          application.department.status !== "ACTIVE" ||
          application.department.deletedAt !== null ||
          application.organization.status !== "ACTIVE" ||
          application.organization.deletedAt !== null
        ) {
          throw new Error("ORGANIZATION_OR_DEPARTMENT_INACTIVE");
        }

        const email = application.email.trim().toLowerCase();

        // Check all accounts, including soft-deleted accounts.
        const existingUser = await tx.user.findFirst({
          where: {
            email: { equals: email, mode: "insensitive" },
          },
          select: { id: true },
        });

        if (existingUser) {
          throw new Error("EMAIL_ALREADY_USED");
        }

        const user = await tx.user.create({
          data: {
            organizationId: reviewer.organizationId,
            departmentId: application.departmentId,
            firstName: application.firstName,
            middleName: application.middleName,
            lastName: application.lastName,
            email,
            phone: application.phone,
            role: "DEPARTMENT_USER",
            status: "INACTIVE",
            passwordHash: null,
          },
        });

        await tx.organizationInvitation.create({
          data: {
            userId: user.id,
            createdById: reviewer.userId,
            tokenHash,
            expiresAt,
          },
        });

        const updated =
          await tx.departmentUserApplication.updateMany({
            where: {
              id: application.id,
              organizationId: reviewer.organizationId,
              status: { in: ["PENDING", "UNDER_REVIEW"] },
              createdUserId: null,
            },
            data: {
              status: "APPROVED",
              reviewNotes: reviewNotes || null,
              reviewedById: reviewer.userId,
              reviewedAt: now,
              createdUserId: user.id,
            },
          });

        if (updated.count !== 1) {
          throw new Error("APPLICATION_ALREADY_REVIEWED");
        }

        // Send before committing so a delivery failure rolls back
        // the account, invitation, and application approval together.
        await sendDepartmentUserInvitationEmail({
          to: email,
          organizationName: application.organization.name,
          departmentName: application.department.name,
          invitationUrl: getAppUrl(
            `/setup-password?token=${encodeURIComponent(rawToken)}`,
          ),
        });
      },
      { timeout: 20000 },
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
      error.message === "APPLICATION_ALREADY_REVIEWED"
    ) {
      finishWithError("reviewed");
    }

    if (
      error instanceof Error &&
      error.message === "ORGANIZATION_OR_DEPARTMENT_INACTIVE"
    ) {
      finishWithError("inactive");
    }

    console.error("Department User approval failed:", error);
    finishWithError("approval-failed");
  }

  finishWithMessage("approved");
}

export async function rejectDepartmentUserApplication(
  formData: FormData,
) {
  const reviewer = await getReviewer();
  const applicationId = getFormText(formData, "applicationId");
  const reviewNotes = getFormText(formData, "reviewNotes");

  if (!applicationId) {
    finishWithError("invalid");
  }

  if (reviewNotes.length > 2000) {
    finishWithError("notes");
  }

  try {
    const result =
      await prisma.departmentUserApplication.updateMany({
        where: {
          id: applicationId,
          organizationId: reviewer.organizationId,
          status: { in: ["PENDING", "UNDER_REVIEW"] },
          createdUserId: null,
        },
        data: {
          status: "REJECTED",
          reviewNotes: reviewNotes || null,
          reviewedById: reviewer.userId,
          reviewedAt: new Date(),
        },
      });

    if (result.count !== 1) {
      finishWithError("reviewed");
    }
  } catch (error) {
    console.error("Department User rejection failed:", error);
    finishWithError("rejection-failed");
  }

  finishWithMessage("rejected");
}
