"use server";

import { revalidatePath } from "next/cache";
import { setReportsOrganization } from "@/lib/reports/access";

export type ReportsActionState = {
  errors: {
    organizationId?: string[];
    general?: string[];
  };
};

export async function selectReportsOrganization(
  _prevState: ReportsActionState,
  formData: FormData,
): Promise<ReportsActionState> {
  const organizationId = formData.get("organizationId");

  if (typeof organizationId !== "string" || !organizationId.trim()) {
    return {
      errors: {
        organizationId: ["Please select an organization."],
      },
    };
  }

  const result = await setReportsOrganization(organizationId.trim());

  if (!result.ok) {
    if (result.reason === "unauthenticated") {
      return { errors: { general: ["Your session has expired. Please sign in again."] } };
    }
    if (result.reason === "forbidden") {
      return { errors: { general: ["You do not have permission to switch organizations."] } };
    }
    return { errors: { organizationId: ["Selected organization could not be found."] } };
  }

  revalidatePath("/transport/reports");
  revalidatePath("/organization/reports");
  return { errors: {} };
}
