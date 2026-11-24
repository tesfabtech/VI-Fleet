import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { evaluateApproverEligibility } from "@/lib/workflow";
import { decodeSpecialRequirements } from "@/lib/department-auth";
import DecisionForm from "./decision-form";

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

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  PENDING: { label: "Pending", bg: "bg-slate-100", text: "text-slate-800" },
  IN_PROGRESS: { label: "In Progress", bg: "bg-blue-100", text: "text-blue-800" },
  APPROVED: { label: "Approved", bg: "bg-emerald-100", text: "text-emerald-800" },
  REJECTED: { label: "Rejected", bg: "bg-rose-100", text: "text-rose-800" },
  CHANGES_REQUESTED: { label: "Changes Requested", bg: "bg-amber-100", text: "text-amber-800" },
  CANCELLED: { label: "Cancelled", bg: "bg-slate-200", text: "text-slate-700" },
  SKIPPED: { label: "Skipped", bg: "bg-slate-100", text: "text-slate-600" },
};

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  // Find workflow instance by ID or by entityId
  let instance = await prisma.approvalWorkflowInstance.findFirst({
    where: {
      id,
      organizationId,
    },
    include: {
      workflow: true,
      workflowVersion: {
        include: {
          stages: {
            orderBy: { stageOrder: "asc" },
            include: { approvers: true },
          },
        },
      },
      department: true,
      requester: {
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          email: true,
        },
      },
      cancelledBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      stageInstances: {
        orderBy: [{ stageOrder: "asc" }, { iteration: "asc" }],
        include: {
          stage: true,
          decisions: {
            orderBy: { decidedAt: "asc" },
            include: {
              approver: {
                select: {
                  id: true,
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!instance) {
    // Check if the id passed was a TransportationRequest ID
    instance = await prisma.approvalWorkflowInstance.findFirst({
      where: {
        entityType: "TRANSPORTATION_REQUEST",
        entityId: id,
        organizationId,
      },
      include: {
        workflow: true,
        workflowVersion: {
          include: {
            stages: {
              orderBy: { stageOrder: "asc" },
              include: { approvers: true },
            },
          },
        },
        department: true,
        requester: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
          },
        },
        cancelledBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        stageInstances: {
          orderBy: [{ stageOrder: "asc" }, { iteration: "asc" }],
          include: {
            stage: true,
            decisions: {
              orderBy: { decidedAt: "asc" },
              include: {
                approver: {
                  select: {
                    id: true,
                    firstName: true,
                    middleName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  if (!instance) {
    notFound();
  }

  // Load associated transportation request if applicable
  let transportationRequest = null;
  if (instance.entityType === "TRANSPORTATION_REQUEST") {
    transportationRequest = await prisma.transportationRequest.findUnique({
      where: { id: instance.entityId },
      include: {
        department: { select: { name: true } },
        requestedBy: {
          select: { firstName: true, middleName: true, lastName: true, email: true },
        },
      },
    });
  }

  const activeStageInstance = instance.stageInstances.find(
    (si) => si.status === "IN_PROGRESS",
  );

  let isEligibleApprover = false;
  let eligibilityReason: string | undefined;
  let hasAlreadyDecided = false;

  if (activeStageInstance && instance.status === "IN_PROGRESS") {
    hasAlreadyDecided = activeStageInstance.decisions.some(
      (d) => d.approverId === user.id,
    );

    const check = await evaluateApproverEligibility({
      organizationId,
      stageId: activeStageInstance.stageId,
      userId: user.id,
      requesterId: instance.requesterId,
      departmentId: instance.departmentId,
    });

    isEligibleApprover = check.eligible;
    eligibilityReason = check.reason;
  }

  const requesterName =
    [instance.requester.firstName, instance.requester.middleName, instance.requester.lastName]
      .filter(Boolean)
      .join(" ") ||
    instance.requester.email ||
    "Requester";

  const meta = transportationRequest
    ? decodeSpecialRequirements(transportationRequest.specialRequirements)
    : null;

  const currentBadge = STATUS_BADGES[instance.status] ?? STATUS_BADGES.PENDING;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <Link
          href="/approvals"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 transition mb-3"
        >
          ← Back to Approvals Inbox
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {transportationRequest?.purpose ?? instance.workflow.name}
              </h1>
              <span
                className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold ${currentBadge.bg} ${currentBadge.text}`}
              >
                {currentBadge.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {instance.workflow.name} (v{instance.workflowVersion.versionNumber}) • Requested by{" "}
              <strong className="text-slate-700">{requesterName}</strong> ({instance.department?.name ?? "General"}) on{" "}
              {formatAddisDate(instance.startedAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Decision Panel if user is eligible */}
      {instance.status === "IN_PROGRESS" && activeStageInstance && (
        <>
          {isEligibleApprover && !hasAlreadyDecided ? (
            <DecisionForm
              instanceId={instance.id}
              stageName={activeStageInstance.stage.name}
              stageOrder={activeStageInstance.stageOrder}
              isOptional={activeStageInstance.stage.isOptional}
              approvalPolicy={activeStageInstance.stage.approvalPolicy}
            />
          ) : hasAlreadyDecided ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 text-sm text-blue-800">
              <div className="flex items-center gap-2 font-semibold">
                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Your Decision Has Been Recorded
              </div>
              <p className="mt-1 text-blue-700">
                You have approved Stage {activeStageInstance.stageOrder} ({activeStageInstance.stage.name}). Waiting for
                remaining required approvers under the ALL approval policy.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <span className="font-semibold text-slate-800">Review Status:</span> Currently active at{" "}
              <strong>
                Stage {activeStageInstance.stageOrder}: {activeStageInstance.stage.name}
              </strong>
              {eligibilityReason ? ` (${eligibilityReason})` : ". You are viewing this request in read-only mode."}
            </div>
          )}
        </>
      )}

      {instance.status === "APPROVED" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 text-sm text-emerald-900">
          <div className="flex items-center gap-2 font-bold text-emerald-800">
            <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Approval Complete
          </div>
          <p className="mt-1 text-emerald-800">
            This request has satisfied all required workflow stages and has been approved for Transport Manager
            scheduling and trip dispatch.
          </p>
        </div>
      )}

      {instance.status === "CHANGES_REQUESTED" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 text-sm text-amber-900">
          <div className="flex items-center gap-2 font-bold text-amber-800">
            <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Changes Requested
          </div>
          <p className="mt-1 text-amber-800">
            Clarifications or updates were requested from the requester. The workflow will resume once the requester
            submits corrections.
          </p>
        </div>
      )}

      {instance.status === "REJECTED" && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-5 text-sm text-rose-900">
          <div className="flex items-center gap-2 font-bold text-rose-800">
            <svg className="h-5 w-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Request Rejected
          </div>
          <p className="mt-1 text-rose-800">
            This request was rejected during workflow review. The workflow has been terminated.
          </p>
        </div>
      )}

      {instance.status === "CANCELLED" && (
        <div className="rounded-xl border border-slate-300 bg-slate-100 p-5 text-sm text-slate-800">
          <div className="font-bold">Workflow Cancelled</div>
          <p className="mt-1 text-slate-600">
            {instance.cancellationReason
              ? `Reason: ${instance.cancellationReason}`
              : "This workflow instance was cancelled."}
          </p>
        </div>
      )}

      {/* Transportation Request Details Card */}
      {transportationRequest && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">
            Transportation Request Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase">Purpose & Description</span>
              <p className="font-semibold text-slate-900 mt-0.5">{transportationRequest.purpose}</p>
              <p className="text-slate-600 mt-1 whitespace-pre-wrap">{transportationRequest.description}</p>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase">Route Details</span>
              <p className="font-semibold text-slate-900 mt-0.5">
                {transportationRequest.origin} → {transportationRequest.destination}
              </p>
              <div className="mt-2 space-y-1 text-slate-600">
                <div>Passengers: <strong>{transportationRequest.passengerCount}</strong></div>
                <div>Priority: <strong>{meta?.priority ?? "STANDARD"}</strong></div>
                <div>Trip Type: <strong>{meta?.tripType === "ONE_WAY" ? "One Way" : "Round Trip"}</strong></div>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase">Schedule (Africa/Addis_Ababa)</span>
              <div className="mt-1 space-y-1 text-slate-700">
                <div>Departure: <strong>{formatAddisDate(transportationRequest.requestedStart)}</strong></div>
                <div>Return / End: <strong>{formatAddisDate(transportationRequest.requestedEnd)}</strong></div>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase">Requirements & Contacts</span>
              <div className="mt-1 space-y-1 text-slate-700">
                <div>Vehicle Preference: <strong>{meta?.vehiclePreference ?? "ANY"}</strong></div>
                {meta?.contactName && (
                  <div>Contact: <strong>{meta.contactName} ({meta.contactPhone})</strong></div>
                )}
                {meta?.cargoDetails && (
                  <div>Cargo: <span className="text-slate-600">{meta.cargoDetails}</span></div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Stage Timeline and Decision History */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 mb-6">
          Approval Workflow Timeline
        </h2>

        <div className="space-y-6">
          {instance.stageInstances.map((si, idx) => {
            const badge = STATUS_BADGES[si.status] ?? STATUS_BADGES.PENDING;
            const isLast = idx === instance.stageInstances.length - 1;

            return (
              <div key={si.id} className="relative pl-8">
                {/* Connecting vertical line */}
                {!isLast && (
                  <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-slate-200" />
                )}

                {/* Node icon */}
                <div
                  className={`absolute left-0 top-1 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    si.status === "APPROVED"
                      ? "bg-emerald-600 text-white"
                      : si.status === "IN_PROGRESS"
                        ? "bg-blue-600 text-white animate-pulse"
                        : si.status === "REJECTED"
                          ? "bg-rose-600 text-white"
                          : si.status === "CHANGES_REQUESTED"
                            ? "bg-amber-600 text-white"
                            : "bg-slate-300 text-slate-700"
                  }`}
                >
                  {si.stageOrder}
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {si.stage.name}
                      </span>
                      {si.iteration > 1 && (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          Iteration {si.iteration}
                        </span>
                      )}
                      {si.stage.isOptional && (
                        <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                          Optional
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                      <span className="text-xs text-slate-400">
                        Entered {formatAddisDate(si.enteredAt)}
                      </span>
                    </div>
                  </div>

                  {si.decisionSummary && (
                    <p className="mt-2 text-xs font-medium text-slate-700 bg-white rounded p-2 border border-slate-200">
                      Summary: {si.decisionSummary}
                    </p>
                  )}

                  {/* Decisions recorded for this stage instance */}
                  {si.decisions.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase">
                        Decisions Recorded ({si.decisions.length})
                      </span>
                      {si.decisions.map((dec) => {
                        const decApprover =
                          [dec.approver.firstName, dec.approver.middleName, dec.approver.lastName]
                            .filter(Boolean)
                            .join(" ") ||
                          dec.approver.email ||
                          "Approver";

                        return (
                          <div
                            key={dec.id}
                            className="rounded-md bg-white p-3 text-xs border border-slate-200 space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-800">
                                {decApprover}
                              </span>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-2xs font-bold uppercase ${
                                    dec.decisionType === "APPROVE"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : dec.decisionType === "REJECT"
                                        ? "bg-rose-100 text-rose-800"
                                        : dec.decisionType === "REQUEST_CHANGES"
                                          ? "bg-amber-100 text-amber-800"
                                          : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {dec.decisionType}
                                </span>
                                <span className="text-slate-400">
                                  {formatAddisDate(dec.decidedAt)}
                                </span>
                              </div>
                            </div>
                            {dec.comment && (
                              <p className="text-slate-600 bg-slate-50 p-2 rounded mt-1 italic">
                                &ldquo;{dec.comment}&rdquo;
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
