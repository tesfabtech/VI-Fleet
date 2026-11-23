export class WorkflowError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, code = "WORKFLOW_ERROR", statusCode = 400) {
    super(message);
    this.name = "WorkflowError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class WorkflowNotFoundError extends WorkflowError {
  constructor(message = "Workflow or related entity not found.") {
    super(message, "WORKFLOW_NOT_FOUND", 404);
    this.name = "WorkflowNotFoundError";
  }
}

export class WorkflowValidationError extends WorkflowError {
  readonly errors: string[];

  constructor(message: string, errors: string[] = []) {
    super(message, "WORKFLOW_VALIDATION_ERROR", 422);
    this.name = "WorkflowValidationError";
    this.errors = errors.length > 0 ? errors : [message];
  }
}

export class WorkflowImmutableError extends WorkflowError {
  constructor(message = "Cannot modify a published or archived workflow version.") {
    super(message, "WORKFLOW_IMMUTABLE", 409);
    this.name = "WorkflowImmutableError";
  }
}

export class StageNotActiveError extends WorkflowError {
  constructor(message = "The requested stage is not currently active for decisions.") {
    super(message, "STAGE_NOT_ACTIVE", 409);
    this.name = "StageNotActiveError";
  }
}

export class ApproverEligibilityError extends WorkflowError {
  constructor(message = "User is not authorized or eligible to approve this stage.") {
    super(message, "APPROVER_NOT_ELIGIBLE", 403);
    this.name = "ApproverEligibilityError";
  }
}

export class SelfApprovalProhibitedError extends WorkflowError {
  constructor(message = "Requesters are prohibited from approving their own workflow requests.") {
    super(message, "SELF_APPROVAL_PROHIBITED", 403);
    this.name = "SelfApprovalProhibitedError";
  }
}

export class DuplicateDecisionError extends WorkflowError {
  constructor(message = "Approver has already recorded a decision for this stage.") {
    super(message, "DUPLICATE_DECISION", 409);
    this.name = "DuplicateDecisionError";
  }
}

export class MandatoryStageCannotBeSkippedError extends WorkflowError {
  constructor(message = "Mandatory stages cannot be skipped. Only optional stages can be skipped.") {
    super(message, "MANDATORY_STAGE_CANNOT_BE_SKIPPED", 400);
    this.name = "MandatoryStageCannotBeSkippedError";
  }
}

export class WorkflowExecutionError extends WorkflowError {
  constructor(message: string) {
    super(message, "WORKFLOW_EXECUTION_ERROR", 400);
    this.name = "WorkflowExecutionError";
  }
}

export class UnauthorizedWorkflowActionError extends WorkflowError {
  constructor(message = "You do not have permission to perform this workflow action.") {
    super(message, "UNAUTHORIZED_WORKFLOW_ACTION", 403);
    this.name = "UnauthorizedWorkflowActionError";
  }
}
