import "server-only";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const VEHICLE_ORGANIZATION_COOKIE = "vi-fleet-vehicle-organization";

export type VehicleAccessContext = {
  userId: string;
  role: UserRole;
  organizationId: string;
  organizationName: string;
  isSystemAdministrator: boolean;
};

export type VehicleAccess =
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | {
      status: "select-organization";
      role: "SYSTEM_ADMINISTRATOR";
    }
  | {
      status: "ready";
      context: VehicleAccessContext;
    };

export async function resolveVehicleAccess(): Promise<VehicleAccess> {
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
    const selectedId = cookieStore.get(VEHICLE_ORGANIZATION_COOKIE)?.value;
    const organization = selectedId
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
      return {
        status: "select-organization",
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

  if (
    user.role !== "TRANSPORT_MANAGER" &&
    user.role !== "VICE_TRANSPORT_MANAGER"
  ) {
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

export async function requireVehicleContext(): Promise<VehicleAccessContext> {
  const access = await resolveVehicleAccess();
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status === "forbidden") notFound();
  if (access.status === "select-organization") {
    redirect("/transport/vehicles");
  }
  return access.context;
}

export async function getVehiclePageState() {
  const access = await resolveVehicleAccess();
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status === "forbidden") notFound();

  const organizations =
    access.status === "select-organization"
      ? await listVehicleOrganizations()
      : [];
  return { access, organizations };
}

export async function listVehicleOrganizations() {
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

export async function setVehicleOrganization(organizationId: string) {
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
  cookieStore.set(VEHICLE_ORGANIZATION_COOKIE, organization.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/transport/vehicles",
    maxAge: 60 * 60 * 8,
  });
  return { ok: true as const };
}
