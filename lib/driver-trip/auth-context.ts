import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import {
  UnauthorizedError,
  ForbiddenError,
  type AuthContext,
  type AuthenticatedDriverProfile,
  TRANSPORT_MANAGERS,
} from "./types";

export async function resolveAuthContext(req?: Request | NextRequest): Promise<AuthContext> {
  let userId: string | null = null;

  // 1. Check Bearer token in Authorization header for API / mobile requests
  const authHeader = req?.headers?.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const rawToken = authHeader.slice(7).trim();
    if (rawToken) {
      try {
        const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
        if (secret && req && "cookies" in req) {
          const decoded = await getToken({
            req: req as NextRequest,
            secret,
          });
          if (decoded?.sub) {
            userId = decoded.sub;
          }
        }
      } catch (err) {
        console.warn("Failed to decode Bearer token:", err);
      }
    }
  }

  // 2. Fall back to standard Auth.js session cookie
  if (!userId) {
    const session = await auth();
    if (session?.user?.id) {
      userId = session.user.id;
    }
  }

  if (!userId) {
    throw new UnauthorizedError("Session expired or invalid authentication token. Please sign in.");
  }

  // 3. Resolve user and active organization from DB (never trust client payload)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          status: true,
          deletedAt: true,
        },
      },
      driver: {
        select: {
          id: true,
          userId: true,
          organizationId: true,
          firstName: true,
          lastName: true,
          phone: true,
          licenseNumber: true,
          status: true,
          preferredVehicleId: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!user || user.deletedAt !== null || user.status !== "ACTIVE") {
    throw new UnauthorizedError("Account is inactive or has been suspended.");
  }

  if (!user.organizationId || !user.organization || user.organization.deletedAt !== null || user.organization.status !== "ACTIVE") {
    throw new ForbiddenError("Your organization is inactive or not found.");
  }

  let driverProfile: AuthenticatedDriverProfile | null = null;
  if (user.role === "DRIVER") {
    if (user.driver && user.driver.deletedAt === null) {
      driverProfile = {
        id: user.driver.id,
        userId: user.id,
        organizationId: user.organizationId,
        firstName: user.driver.firstName,
        lastName: user.driver.lastName,
        phone: user.driver.phone,
        licenseNumber: user.driver.licenseNumber,
        status: user.driver.status,
        preferredVehicleId: user.driver.preferredVehicleId,
      };
    }
  }

  const userName =
    [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.email ||
    "User";

  return {
    userId: user.id,
    userName,
    userEmail: user.email,
    role: user.role,
    organizationId: user.organizationId,
    organizationName: user.organization.name,
    driver: driverProfile,
  };
}

export function requireDriverRole(ctx: AuthContext): AuthenticatedDriverProfile {
  if (ctx.role !== "DRIVER" || !ctx.driver) {
    throw new ForbiddenError("Only assigned drivers can perform this operation.");
  }
  return ctx.driver;
}

export function requireTransportManagerRole(ctx: AuthContext): void {
  if (!TRANSPORT_MANAGERS.includes(ctx.role)) {
    throw new ForbiddenError("Only authorized Transport Managers can perform this operation.");
  }
}
