"use server";

import { prisma } from "@/lib/prisma";
import { OrganizationType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  validateOfficialDocumentBuffer,
  uploadOfficialDocument,
  deleteOfficialDocument,
} from "@/lib/organization-application/document-service";

export type RegistrationState = {
  success: boolean;
  message: string;
  errors?: {
    organizationName?: string;
    organizationType?: string;
    contactEmail?: string;
    phone?: string;
    website?: string;
    country?: string;
    region?: string;
    city?: string;
    streetAddress?: string;
    estimatedFleetSize?: string;
    departmentCount?: string;
    description?: string;
    officialDocument?: string;
  };
};

const VALID_ORGANIZATION_TYPES: OrganizationType[] = [
  "PRIVATE_COMPANY",
  "GOVERNMENT",
  "NGO",
  "OTHER",
];

const VALID_FLEET_SIZES = [
  "1-10",
  "11-50",
  "51-100",
  "101-500",
  "500+",
] as const;

export async function submitOrganizationApplication(
  _previousState: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  const organizationName = String(
    formData.get("organizationName") ?? "",
  ).trim();

  const organizationType = String(
    formData.get("organizationType") ?? "",
  ).trim();

  const contactEmail = String(formData.get("contactEmail") ?? "")
    .trim()
    .toLowerCase();

  const phone = String(formData.get("phone") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();

  const country = String(formData.get("country") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const streetAddress = String(formData.get("streetAddress") ?? "").trim();

  const estimatedFleetSize = String(
    formData.get("estimatedFleetSize") ?? "",
  ).trim();

  const departmentCountRaw = String(
    formData.get("departmentCount") ?? "",
  ).trim();

  const description = String(formData.get("description") ?? "").trim();
  const officialDocumentFile = formData.get("officialDocument");

  const errors: NonNullable<RegistrationState["errors"]> = {};

  // 1. Organization name validation (required, <= 150)
  if (!organizationName) {
    errors.organizationName = "Organization name is required.";
  } else if (organizationName.length > 150) {
    errors.organizationName =
      "Organization name must be 150 characters or fewer.";
  }

  // 2. Organization type validation (required enum)
  if (!organizationType) {
    errors.organizationType = "Select an organization type.";
  } else if (
    !VALID_ORGANIZATION_TYPES.includes(organizationType as OrganizationType)
  ) {
    errors.organizationType = "Select a valid organization type.";
  }

  // 3. Contact email validation (required, <= 255, email regex)
  if (!contactEmail) {
    errors.contactEmail = "Contact email is required.";
  } else if (contactEmail.length > 255) {
    errors.contactEmail = "Contact email must be 255 characters or fewer.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    errors.contactEmail = "Enter a valid contact email address.";
  }

  // 4. Phone validation (required, <= 30)
  if (!phone) {
    errors.phone = "Phone number is required.";
  } else if (phone.length > 30) {
    errors.phone = "Phone number must be 30 characters or fewer.";
  }

  // 5. Website validation (optional, <= 255, valid URL format)
  if (website) {
    if (website.length > 255) {
      errors.website = "Website URL must be 255 characters or fewer.";
    } else {
      const urlToTest = /^https?:\/\//i.test(website)
        ? website
        : `https://${website}`;
      try {
        const parsed = new URL(urlToTest);
        if (!parsed.hostname || !parsed.hostname.includes(".")) {
          errors.website =
            "Enter a valid website address (e.g., https://example.com).";
        }
      } catch {
        errors.website =
          "Enter a valid website address (e.g., https://example.com).";
      }
    }
  }

  // 6. Country validation (required, <= 100)
  if (!country) {
    errors.country = "Country is required.";
  } else if (country.length > 100) {
    errors.country = "Country must be 100 characters or fewer.";
  }

  // 7. Region/State validation (required, <= 100)
  if (!region) {
    errors.region = "Region or state is required.";
  } else if (region.length > 100) {
    errors.region = "Region or state must be 100 characters or fewer.";
  }

  // 8. City validation (required, <= 100)
  if (!city) {
    errors.city = "City is required.";
  } else if (city.length > 100) {
    errors.city = "City must be 100 characters or fewer.";
  }

  // 9. Street address validation (optional, <= 255)
  if (streetAddress && streetAddress.length > 255) {
    errors.streetAddress = "Street address must be 255 characters or fewer.";
  }

  // 10. Estimated fleet size validation (required, exact stored values)
  if (!estimatedFleetSize) {
    errors.estimatedFleetSize = "Select an estimated fleet size.";
  } else if (
    !VALID_FLEET_SIZES.includes(
      estimatedFleetSize as (typeof VALID_FLEET_SIZES)[number],
    )
  ) {
    errors.estimatedFleetSize = "Select a valid fleet size range.";
  }

  // 11. Department count validation (optional integer)
  let departmentCountNum: number | null = null;
  if (departmentCountRaw) {
    if (!/^\d+$/.test(departmentCountRaw)) {
      errors.departmentCount =
        "Department count must be a non-negative whole number.";
    } else {
      const parsed = parseInt(departmentCountRaw, 10);
      if (isNaN(parsed) || parsed < 0 || parsed > 10000) {
        errors.departmentCount =
          "Department count must be between 0 and 10,000.";
      } else {
        departmentCountNum = parsed;
      }
    }
  }

  // 12. Description validation (optional, <= 5000)
  if (description && description.length > 5000) {
    errors.description = "Description must be 5,000 characters or fewer.";
  }

  // 13. Official document validation (required, PDF/JPG/PNG, signature check)
  let documentBuffer: Buffer | null = null;
  if (
    !officialDocumentFile ||
    typeof officialDocumentFile === "string" ||
    !(officialDocumentFile instanceof File) ||
    officialDocumentFile.size === 0
  ) {
    errors.officialDocument =
      "Please upload an official organization document (PDF, JPG, JPEG, or PNG).";
  } else {
    try {
      documentBuffer = Buffer.from(await officialDocumentFile.arrayBuffer());
      const validation = validateOfficialDocumentBuffer(
        officialDocumentFile.name,
        documentBuffer,
        officialDocumentFile.type,
      );

      if (!validation.valid) {
        errors.officialDocument = validation.error || "Invalid document file.";
      }
    } catch {
      errors.officialDocument = "Failed to process the uploaded document file.";
    }
  }

  // Return validation errors if any field is invalid
  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      message: "Please correct the highlighted fields before submitting.",
      errors,
    };
  }

  try {
    // Check for existing pending or under-review application with the same email
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

    const applicationId = randomUUID();

    // Upload document to secure Supabase storage
    let uploadResult: {
      storageKey: string;
      originalFileName: string;
      mimeType: string;
      fileSize: number;
    };

    try {
      uploadResult = await uploadOfficialDocument({
        applicationId,
        fileName: (officialDocumentFile as File).name,
        fileBuffer: documentBuffer!,
        clientMimeType: (officialDocumentFile as File).type,
      });
    } catch (uploadError) {
      console.error("Official document upload error:", uploadError);
      return {
        success: false,
        message:
          "Failed to upload the official document. Please verify the file and try again.",
      };
    }

    // Insert into database with storage metadata
    try {
      await prisma.organizationApplication.create({
        data: {
          id: applicationId,
          organizationName,
          organizationType: organizationType as OrganizationType,
          contactEmail,
          phone,
          website: website || null,
          country,
          region,
          city,
          streetAddress: streetAddress || null,
          estimatedFleetSize,
          departmentCount: departmentCountNum,
          description: description || null,
          officialDocumentKey: uploadResult.storageKey,
          officialDocumentFileName: uploadResult.originalFileName,
          officialDocumentMimeType: uploadResult.mimeType,
          officialDocumentSize: uploadResult.fileSize,
          status: "PENDING",
          paymentStatus: "NOT_REQUIRED",
        },
      });

      return {
        success: true,
        message:
          "Your application has been submitted successfully. The VI-Fleet team will review it before your organization is activated.",
      };
    } catch (dbError) {
      console.error(
        "Database insertion failed after document upload; cleaning up storage object:",
        dbError,
      );
      // Attempt cleanup of the uploaded document from storage
      await deleteOfficialDocument(uploadResult.storageKey);
      throw dbError;
    }
  } catch (error) {
    console.error("Organization application submission failed:", error);

    return {
      success: false,
      message:
        "We couldn't submit your application right now. Please try again later.",
    };
  }
}
