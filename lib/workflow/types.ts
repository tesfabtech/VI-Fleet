import type {
  ApprovalDecisionType,
  Prisma,
  StageApprovalPolicy,
  StageApproverType,
  StageInstanceStatus,
  WorkflowEventType,
  WorkflowInstanceStatus,
  WorkflowStatus,
  WorkflowVersionStatus,
} from "@prisma/client";

export type {
  WorkflowStatus,
  WorkflowVersionStatus,
  StageApprovalPolicy,
  StageApproverType,
  WorkflowInstanceStatus,
  StageInstanceStatus,
  ApprovalDecisionType,
  WorkflowEventType,
};

export interface StageApproverInput {
  approverType: StageApproverType;
  userId?: string;
  roleId?: string;
}

export interface CreateWorkflowDraftInput {
  organizationId: string;
  name: string;
  description?: string | null;
  workflowType: string;
  createdById?: string | null;
}

export interface AddStageInput {
  organizationId: string;
  versionId: string;
  name: string;
  description?: string | null;
  stageOrder?: number;
  isOptional?: boolean;
  approvalPolicy?: StageApprovalPolicy;
  requiredPermissionCode?: string | null;
  approvers: StageApproverInput[];
}

export interface UpdateStageInput {
  organizationId: string;
  stageId: string;
  name?: string;
  description?: string | null;
  isOptional?: boolean;
  approvalPolicy?: StageApprovalPolicy;
  requiredPermissionCode?: string | null;
  approvers?: StageApproverInput[];
}

export interface ReorderStagesInput {
  organizationId: string;
  versionId: string;
  stageOrders: Array<{ stageId: string; stageOrder: number }>;
}

export interface PublishVersionInput {
  organizationId: string;
  versionId: string;
  publishedById: string;
}

export interface CreateDraftFromVersionInput {
  organizationId: string;
  workflowId: string;
  fromVersionId?: string;
  createdById?: string;
}

export interface StartWorkflowInstanceInput {
  organizationId: string;
  workflowType: string;
  entityType: string;
  entityId: string;
  requesterId: string;
  departmentId?: string | null;
}

export interface RecordDecisionInput {
  organizationId: string;
  instanceId: string;
  approverId: string;
  decisionType: ApprovalDecisionType;
  comment?: string | null;
}

export interface SkipOptionalStageInput {
  organizationId: string;
  instanceId: string;
  actorId: string;
  reason: string;
}

export interface ResubmitWorkflowInput {
  organizationId: string;
  instanceId: string;
  requesterId: string;
  comment?: string | null;
}

export interface CancelWorkflowInput {
  organizationId: string;
  instanceId: string;
  actorId: string;
  reason: string;
}

export interface ApproverEligibilityResult {
  eligible: boolean;
  reason?: string;
  matchedBy?: "USER" | "ROLE";
  matchedRoleId?: string;
}

export interface EvaluateEligibilityParams {
  organizationId: string;
  stageId: string;
  userId: string;
  requesterId?: string;
  departmentId?: string | null;
  tx?: Prisma.TransactionClient;
}

export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
}
