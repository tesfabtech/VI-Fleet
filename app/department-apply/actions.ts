"use server";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type DepartmentApplicationState = {
  error?: string;
  success?: string;
};

export async function submitDepartmentApplication(
  _previousState: DepartmentApplicationState,
  formData: FormData,
): Promise<DepartmentApplicationState> {
  const rawToken = String(formData.get("token") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const middleName = String(formData.get("middleName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const departmentId = String(formData.get("departmentId") ?? "").trim();

  if (
    !rawToken ||
    !firstName ||
    !middleName ||
    !lastName ||
    !email ||
    !departmentId
  ) {
    return { error: "Please complete all required fields." };
  }

  if (
    firstName.length > 150 ||
    middleName.length > 150 ||
    lastName.length > 150 ||
    email.length > 255 ||
    phone.length > 30
  ) {
    return { error: "One or more fields exceed the permitted length." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }

  try {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    const link = await prisma.departmentRegistrationLink.findUnique({
      where: { tokenHash },
    });

    if (
      !link ||
      link.revokedAt ||
      (link.expiresAt && link.expiresAt <= new Date())
    ) {
      return {
        error: "This registration link is invalid, expired, or revoked.",
      };
    }

    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        organizationId: link.organizationId,
        status: "ACTIVE",
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!department) {
      return {
        error: "Choose an active department belonging to this organization.",
      };
    }

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
      return {
        error: "An account already uses that email address.",
      };
    }

    const existingApplication =
      await prisma.departmentUserApplication.findFirst({
        where: {
          organizationId: link.organizationId,
          email: { equals: email, mode: "insensitive" },
          status: { in: ["PENDING", "UNDER_REVIEW", "APPROVED"] },
        },
        select: { id: true },
      });

    if (existingApplication) {
      return {
        error:
          "An application for this email already exists in this organization.",
      };
    }

    await prisma.departmentUserApplication.create({
      data: {
        organizationId: link.organizationId,
        departmentId: department.id,
        firstName,
        middleName,
        lastName,
        email,
        phone: phone || null,
        status: "PENDING",
      },
    });

    return {
      success:
        "Your application has been submitted. The organization administrator will review it.",
    };
  } catch (error) {
    console.error("Department User application failed:", error);

    return {
      error: "We could not submit your application. Please try again.",
    };
  }
}