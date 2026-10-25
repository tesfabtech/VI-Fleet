
import "next-auth";
import "next-auth";
import "next-auth/jwt";

import type { DefaultSession } from "next-auth";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role: UserRole;
    organizationId: string | null;
    departmentId: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
      organizationId: string | null;
      departmentId: string | null;
    } & NonNullable<DefaultSession["user"]>;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    organizationId?: string | null;
    departmentId?: string | null;
  }
}
