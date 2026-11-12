import "server-only";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const REPORTS_ORGANIZATION_COOKIE = "vi-fleet-reports-organization";

export const ALLOWED_REPORTS_ROLES: readonly UserRole[] = [
  "SYSTEM_ADMINISTRATOR",
  "ORGANIZATION_ADMINISTRATOR",
  "VICE_ORGANIZATION_ADMINISTRATOR",
  "TRANSPORT_MANAGER",
  "VICE_TRANSPORT_MANAGER",
] as const;

export type ReportAccessContext = {
  userId: string;
  role: UserRole;
  organizationId: string;
  organizationName: string;
  isSystemAdministrator: boolean;
};

export type ReportAccess =
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | {
      status: "select-organization";
      userId: string;
      role: "SYSTEM_ADMINISTRATOR";
    }
  | {
      status: "ready";
      context: ReportAccessContext;
    };

export async function resolveReportsAccess(): Promise<ReportAccess> {
  const session = await auth();
  if (!session?.user?.id) return { status: "unauthenticated" };

  const user = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: {
      id: true,
      role: true,
      organizationId: true,
    },
  });

  if (!user) return { status: "forbidden" };

  if (!ALLOWED_REPORTS_ROLES.includes(user.role)) {
    return { status: "forbidden" };
  }

  if (user.role === "SYSTEM_ADMINISTRATOR") {
    const cookieStore = await cookies();
    const selectedId = cookieStore.get(REPORTS_ORGANIZATION_COOKIE)?.value;

    let organization = selectedId
      ? await prisma.organization.findFirst({
          where: {
            id: selectedId,
            status: "ACTIVE",
            deletedAt: null,
          },
          select: { id: true, name: true },
        })
      : null;

    if (!organization) {
      // Default to first active organization if available
      organization = await prisma.organization.findFirst({
        where: {
          status: "ACTIVE",
          deletedAt: null,
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
    }

    if (!organization) {
      return {
        status: "select-organization",
        userId: user.id,
        role: "SYSTEM_ADMINISTRATOR",
      };
    }

    return {
      status: "ready",
      context: {
        userId: user.id,
        role: user.role,
        organizationId: organization.id,
        organizationName: organization.name,
        isSystemAdministrator: true,
      },
    };
  }

  // Tenant-bound roles
  if (
    !user.organizationId ||
    session.user.organizationId !== user.organizationId
  ) {
    return { status: "forbidden" };
  }

  const organization = await prisma.organization.findFirst({
    where: {
      id: user.organizationId,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: { id: true, name: true },
  });

  if (!organization) return { status: "forbidden" };

  return {
    status: "ready",
    context: {
      userId: user.id,
      role: user.role,
      organizationId: organization.id,
      organizationName: organization.name,
      isSystemAdministrator: false,
    },
  };
}

export async function requireReportsContext(): Promise<ReportAccessContext> {
  const access = await resolveReportsAccess();
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status === "forbidden") notFound();
  if (access.status === "select-organization") {
    notFound();
  }
  return access.context;
}

export async function listReportsOrganizations() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const user = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      role: "SYSTEM_ADMINISTRATOR",
      status: "ACTIVE",
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!user) return [];

  return prisma.organization.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function setReportsOrganization(organizationId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, reason: "unauthenticated" };
  }

  const user = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      role: "SYSTEM_ADMINISTRATOR",
      status: "ACTIVE",
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!user) return { ok: false as const, reason: "forbidden" };

  const organization = await prisma.organization.findFirst({
    where: {
      id: organizationId,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!organization) return { ok: false as const, reason: "invalid" };

  const cookieStore = await cookies();
  cookieStore.set(REPORTS_ORGANIZATION_COOKIE, organization.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return { ok: true as const };
}
