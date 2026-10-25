import type { UserRole } from "@prisma/client";

export function getDashboardPath(role: UserRole): string {
  switch (role) {
    case "SYSTEM_ADMINISTRATOR":
      return "/admin";

    case "ORGANIZATION_ADMINISTRATOR":
    case "VICE_ORGANIZATION_ADMINISTRATOR":
      return "/organization";

    case "TRANSPORT_MANAGER":
    case "VICE_TRANSPORT_MANAGER":
      return "/transport";

    case "DEPARTMENT_USER":
      return "/department";

    case "DRIVER":
      return "/driver";

    default: {
      const exhaustiveCheck: never = role;
      return exhaustiveCheck;
    }
  }
}