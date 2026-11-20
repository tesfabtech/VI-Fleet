import { NextRequest } from "next/server";
import { resolveAuthContext } from "@/lib/driver-trip/auth-context";
import { prisma } from "@/lib/prisma";
import { jsonSuccess, jsonError } from "@/lib/driver-trip/api-response";
import { isUuid } from "@/lib/department-auth";
import { ValidationError, NotFoundError, ForbiddenError, TRANSPORT_MANAGERS } from "@/lib/driver-trip/types";

type RouteProps = {
  params: Promise<{ tripId: string }>;
};

export async function GET(req: NextRequest, { params }: RouteProps) {
  try {
    const authContext = await resolveAuthContext(req);
    const { tripId } = await params;
    if (!isUuid(tripId)) {
      throw new ValidationError("Invalid trip ID format.");
    }

    const report = await prisma.tripCompletionReport.findFirst({
      where: {
        tripId,
        organizationId: authContext.organizationId,
      },
      include: {
        submittedByDriver: {
          select: { id: true, firstName: true, lastName: true },
        },
        reviewedBy: {
          select: { firstName: true, lastName: true, email: true },
        },
        revisions: {
          orderBy: { revisionNumber: "asc" },
        },
        trip: {
          select: { driverId: true, status: true },
        },
      },
    });

    if (!report) {
      throw new NotFoundError("Completion report not found for this trip.");
    }

    const isAssignedDriver =
      authContext.role === "DRIVER" && authContext.driver?.id === report.trip.driverId;
    const isManager = TRANSPORT_MANAGERS.includes(authContext.role);

    if (!isAssignedDriver && !isManager) {
      throw new ForbiddenError("Not authorized to view this completion report.");
    }

    return jsonSuccess(report);
  } catch (err) {
    return jsonError(err);
  }
}
