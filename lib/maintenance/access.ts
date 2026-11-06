import "server-only";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const MAINTENANCE_ORGANIZATION_COOKIE = "vi-fleet-maintenance-organization";

const TRANSPORT_ROLES = [
  "TRANSPORT_MANAGER",
  "VICE_TRANSPORT_MANAGER",
] as const satisfies readonly UserRole[];

export type MaintenanceOrganizationContext = {
  userId: string;
  role: UserRole;
  organizationId: string;
  organizationName: string;
  isSystemAdministrator: boolean;
};

export type MaintenanceAccess =
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | {
      status: "select-organization";
      userId: string;
      role: "SYSTEM_ADMINISTRATOR";
    }
  | {
      status: "ready";
      context: MaintenanceOrganizationContext;
    };

export async function resolveMaintenanceAccess(): Promise<MaintenanceAccess> {
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

  if (user.role === "SYSTEM_ADMINISTRATOR") {
    const cookieStore = await cookies();
    const selectedId = cookieStore.get(MAINTENANCE_ORGANIZATION_COOKIE)?.value;
    if (!selectedId) {
      return {
        status: "select-organization",
        userId: user.id,
        role: user.role,
      };
    }

    const organization = await prisma.organization.findFirst({
      where: {
        id: selectedId,
        status: "ACTIVE",
        deletedAt: null,
      },
      select: { id: true, name: true },
    });

    if (!organization) {
      return {
        status: "select-organization",
        userId: user.id,
        role: user.role,
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

  if (!TRANSPORT_ROLES.includes(user.role as (typeof TRANSPORT_ROLES)[number])) {
    return { status: "forbidden" };
  }

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

export async function requireMaintenancePageContext(): Promise<
  | { status: "select-organization"; role: "SYSTEM_ADMINISTRATOR" }
  | { status: "ready"; context: MaintenanceOrganizationContext }
> {
  const access = await resolveMaintenanceAccess();
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status === "forbidden") notFound();
  if (access.status === "select-organization") {
    return { status: "select-organization", role: access.role };
  }
  return access;
}

export async function getMaintenancePageState() {
  const access = await requireMaintenancePageContext();
  const isSystemAdministrator =
    access.status === "select-organization" ||
    access.context.isSystemAdministrator;
  const organizations = isSystemAdministrator
    ? await listMaintenanceOrganizations()
    : [];
  return { access, organizations };
}

export async function listMaintenanceOrganizations() {
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

export async function setMaintenanceOrganization(organizationId: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, reason: "unauthenticated" };

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
  cookieStore.set(MAINTENANCE_ORGANIZATION_COOKIE, organization.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/transport/maintenance",
    maxAge: 60 * 60 * 8,
  });
  return { ok: true as const };
}
