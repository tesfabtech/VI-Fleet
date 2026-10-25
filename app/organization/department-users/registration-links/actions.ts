
"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAppUrl } from "@/lib/gmail-email";
import { encryptRegistrationToken } from "@/lib/department-registration-token";

const allowedRoles = [
  "ORGANIZATION_ADMINISTRATOR",
  "VICE_ORGANIZATION_ADMINISTRATOR",
];

const linksPath =
  "/organization/department-users/registration-links";

async function getOrganizationAdmin() {
  const session = await auth();

  if (
    !session?.user?.id ||
    !allowedRoles.includes(session.user.role)
  ) {
    throw new Error(
      "You are not authorized to manage registration links.",
    );
  }

  if (!session.user.organizationId) {
    throw new Error(
      "Your account is not linked to an organization.",
    );
  }

  return {
    userId: session.user.id,
    organizationId: session.user.organizationId,
  };
}

export type RegistrationLinkState = {
  error?: string;
  registrationUrl?: string;
};

export async function createRegistrationLink(
  previousState: RegistrationLinkState,
  formData: FormData,
): Promise<RegistrationLinkState> {
  void previousState;
  void formData;

  try {
    const { userId, organizationId } =
      await getOrganizationAdmin();

    // An expired but unrevoked link must also be revoked before
    // another one can be created.
    const existingLink =
      await prisma.departmentRegistrationLink.findFirst({
        where: {
          organizationId,
          revokedAt: null,
        },
        select: { id: true },
      });

    if (existingLink) {
      return {
        error:
          "A registration link already exists. Copy the existing link or revoke it before generating another one.",
      };
    }

    const rawToken = randomBytes(32).toString("hex");

    const tokenHash = createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const tokenEncrypted =
      encryptRegistrationToken(rawToken);

    await prisma.departmentRegistrationLink.create({
      data: {
        organizationId,
        createdById: userId,
        tokenHash,
        tokenEncrypted,
      },
    });

    revalidatePath(linksPath);
    revalidatePath("/organization/department-users");

    return {
      registrationUrl: getAppUrl(
        `/department-apply?token=${encodeURIComponent(rawToken)}`,
      ),
    };
  } catch (error) {
    // The database unique index prevents two concurrent requests
    // from creating separate unrevoked links for one organization.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return {
        error:
          "A registration link already exists. Revoke it before generating another one.",
      };
    }

    console.error("Create registration link failed:", error);

    return {
      error:
        "Could not create the registration link. Please try again.",
    };
  }
}

export async function revokeRegistrationLink(
  formData: FormData,
) {
  const { organizationId } = await getOrganizationAdmin();

  const linkId = String(
    formData.get("linkId") ?? "",
  ).trim();

  if (!linkId) {
    throw new Error("Registration link ID is required.");
  }

  const result =
    await prisma.departmentRegistrationLink.updateMany({
      where: {
        id: linkId,
        organizationId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

  if (result.count === 0) {
    throw new Error(
      "The link was not found or has already been revoked.",
    );
  }

  revalidatePath(linksPath);
  revalidatePath("/organization/department-users");

  redirect(`${linksPath}?revoked=1`);
}
