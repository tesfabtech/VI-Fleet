"use server";

import { prisma } from "@/lib/prisma";

export type RegistrationState = {
  success: boolean;
  message: string;
  errors?: {
    organizationName?: string;
    contactEmail?: string;
    phone?: string;
    description?: string;
  };
};

export async function submitOrganizationApplication(
  _previousState: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  const organizationName = String(
    formData.get("organizationName") ?? "",
  ).trim();

  const contactEmail = String(
    formData.get("contactEmail") ?? "",
  ).trim().toLowerCase();

  const phone = String(formData.get("phone") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  const errors: NonNullable<RegistrationState["errors"]> = {};

  if (!organizationName || organizationName.length > 150) {
    errors.organizationName =
      "Enter an organization name with no more than 150 characters.";
  }

  if (
    !contactEmail ||
    contactEmail.length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)
  ) {
    errors.contactEmail = "Enter a valid contact email address.";
  }

  if (phone.length > 30) {
    errors.phone = "Phone number must be 30 characters or fewer.";
  }

  if (description.length > 5000) {
    errors.description = "Description must be 5,000 characters or fewer.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      message: "Please correct the highlighted fields.",
      errors,
    };
  }

  try {
    const existingApplication = await prisma.organizationApplication.findFirst({
      where: {
        contactEmail,
        status: {
          in: ["PENDING", "UNDER_REVIEW"],
        },
      },
      select: { id: true },
    });

    if (existingApplication) {
      return {
        success: false,
        message:
          "An application using this email is already pending review. Please wait for the review process or contact the system administrator.",
      };
    }

    await prisma.organizationApplication.create({
      data: {
        organizationName,
        contactEmail,
        phone: phone || null,
        description: description || null,
        status: "PENDING",
        paymentStatus: "NOT_REQUIRED",
      },
    });

    return {
      success: true,
      message:
        "Your application has been submitted successfully. The VI-Fleet team will review it before your organization is activated.",
    };
  } catch (error) {
    console.error("Organization application submission failed:", error);

    return {
      success: false,
      message:
        "We couldn't submit your application right now. Please try again later.",
    };
  }
}