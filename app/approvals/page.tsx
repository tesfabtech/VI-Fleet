import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { evaluateApproverEligibility } from "@/lib/workflow";
import { decodeSpecialRequirements } from "@/lib/department-auth";

function formatAddisDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Addis_Ababa",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export default async function ApprovalsInboxPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      status: "ACTIVE",
      deletedAt: null,
      organization: { deletedAt: null, status: "ACTIVE" },
    },
    select: {
      id: true,
      organizationId: true,
      role: true,
    },
  });

  if (!user || !user.organizationId) {
    notFound();
  }

  const organizationId = user.organizationId;

  // Load in-progress workflow instances in this organization
  const instances = await prisma.approvalWorkflowInstance.findMany({
    where: {
      organizationId,
      status: "IN_PROGRESS",
    },
    include: {
      workflow: { select: { id: true, name: true, workflowType: true } },
      workflowVersion: { select: { versionNumber: true } },
      requester: {
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          email: true,
        },
      },
      department: { select: { id: true, name: true } },
      stageInstances: {
        where: { status: "IN_PROGRESS" },
        include: {
          stage: {
            include: {
              approvers: true,
            },
          },
          decisions: true,
        },
      },
    },
    orderBy: { startedAt: "desc" },
  });

  // Filter instances where the current user is an eligible approver
  const pendingApprovals: Array<{
    instanceId: string;
    entityType: string;
    entityId: string;
    workflowName: string;
    currentStageName: string;
    stageOrder: number;
    iteration: number;
    approvalPolicy: string;
    isOptional: boolean;
    startedAt: Date;
    requesterName: string;
    departmentName: string;
    transportDetails?: {
      purpose: string;
      origin: string;
      destination: string;
      passengerCount: number;
      requestedStart: Date;
      requestedEnd: Date;
      priority: string;
    } | null;
  }> = [];

  for (const inst of instances) {
    const activeStage = inst.stageInstances[0];
    if (!activeStage) continue;

    // Self-approval prohibition
    if (inst.requesterId === user.id) continue;

    // Check if user already submitted decision on this iteration
    const alreadyDecided = activeStage.decisions.some(
      (d) => d.approverId === user.id,
    );
    if (alreadyDecided) continue;

    // Evaluate authoritative approver eligibility
    const eligibility = await evaluateApproverEligibility({
      organizationId,
      stageId: activeStage.stageId,
      userId: user.id,
      requesterId: inst.requesterId,
      departmentId: inst.departmentId,
    });

    if (!eligibility.eligible) continue;

    let transportDetails = null;
    if (inst.entityType === "TRANSPORTATION_REQUEST") {
      const tr = await prisma.transportationRequest.findUnique({
        where: { id: inst.entityId },
        select: {
          purpose: true,
          origin: true,
          destination: true,
          passengerCount: true,
          requestedStart: true,
          requestedEnd: true,
          specialRequirements: true,
        },
      });

      if (tr) {
        const meta = decodeSpecialRequirements(tr.specialRequirements);
        transportDetails = {
          purpose: tr.purpose,
          origin: tr.origin,
          destination: tr.destination,
          passengerCount: tr.passengerCount,
          requestedStart: tr.requestedStart,
          requestedEnd: tr.requestedEnd,
          priority: meta.priority,
        };
      }
    }

    const requesterName =
      [inst.requester.firstName, inst.requester.middleName, inst.requester.lastName]
        .filter(Boolean)
        .join(" ") ||
      inst.requester.email ||
      "Requester";

    pendingApprovals.push({
      instanceId: inst.id,
      entityType: inst.entityType,
      entityId: inst.entityId,
      workflowName: inst.workflow.name,
      currentStageName: activeStage.stage.name,
      stageOrder: activeStage.stageOrder,
      iteration: activeStage.iteration,
      approvalPolicy: activeStage.stage.approvalPolicy,
      isOptional: activeStage.stage.isOptional,
      startedAt: inst.startedAt,
      requesterName,
      departmentName: inst.department?.name ?? "General",
      transportDetails,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Approvals Inbox
            </h1>
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
              {pendingApprovals.length} pending
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Requests awaiting your review and authorization across configured approval workflows.
          </p>
        </div>
      </div>

      {pendingApprovals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-4">
            <svg
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            All caught up!
          </h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            You have no pending approvals requiring your decision at this time.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingApprovals.map((item) => (
            <div
              key={item.instanceId}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      {item.entityType === "TRANSPORTATION_REQUEST"
                        ? "Transportation Request"
                        : item.entityType}
                    </span>
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                      {item.departmentName}
                    </span>
                    {item.transportDetails?.priority === "URGENT" && (
                      <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                        URGENT
                      </span>
                    )}
                    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Stage {item.stageOrder}: {item.currentStageName}
                      {item.iteration > 1 ? ` (Rev ${item.iteration})` : ""}
                    </span>
                    {item.isOptional && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        Optional
                      </span>
                    )}
                  </div>

                  <h2 className="text-base font-semibold text-slate-900">
                    {item.transportDetails?.purpose ?? item.workflowName}
                  </h2>

                  {item.transportDetails && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                      <span>
                        Route: <strong>{item.transportDetails.origin}</strong> → <strong>{item.transportDetails.destination}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Passengers: <strong>{item.transportDetails.passengerCount}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Departure: <strong>{formatAddisDate(item.transportDetails.requestedStart)}</strong>
                      </span>
                    </div>
                  )}

                  <div className="text-xs text-slate-500">
                    Requested by <span className="font-medium text-slate-700">{item.requesterName}</span> • Submitted on {formatAddisDate(item.startedAt)}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/approvals/${item.instanceId}`}
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Review & Decide →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
