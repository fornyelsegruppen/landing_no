export type CaseInvariantIssue = {
  action: string;
  blocksAutomation: boolean;
  code: string;
  entityId?: number;
  entityType: "contract" | "lead" | "message" | "quote" | "work-order";
  owner: "administrator" | "system";
  severity: "attention" | "critical";
};

type RecordLike = {
  id?: number;
  status?: string;
  [key: string]: unknown;
};

export type CaseInvariantInput = {
  contract?: RecordLike;
  deliveryJobs?: RecordLike[];
  lead: RecordLike;
  messages?: RecordLike[];
  quote?: RecordLike;
  workOrder?: RecordLike;
};

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "number") return (value as { id: number }).id;
  return undefined;
}

function snapshotValue(record: RecordLike | undefined, key: string) {
  if (!record?.snapshot || typeof record.snapshot !== "object") return undefined;
  return (record.snapshot as Record<string, unknown>)[key];
}

function issue(input: Omit<CaseInvariantIssue, "owner"> & { owner?: CaseInvariantIssue["owner"] }) {
  return { owner: "administrator" as const, ...input };
}

export function evaluateCaseInvariants(input: CaseInvariantInput): CaseInvariantIssue[] {
  const result: CaseInvariantIssue[] = [];
  const leadId = input.lead.id;
  const active = (input.lead.recordState || "active") === "active" && input.lead.status !== "closed";
  if (active && !input.lead.nextAction) result.push(issue({ code: "ACTIVE_CASE_NO_NEXT_ACTION", severity: "attention", blocksAutomation: false, entityType: "lead", entityId: leadId, action: "Choose and save the case next action." }));
  if (active && !input.lead.nextActionOwner) result.push(issue({ code: "ACTIVE_CASE_NO_OWNER", severity: "attention", blocksAutomation: false, entityType: "lead", entityId: leadId, action: "Assign the next action to administrator, customer, worker or system." }));
  if (active && !input.lead.nextActionAt) result.push(issue({ code: "ACTIVE_CASE_NO_DEADLINE", severity: "attention", blocksAutomation: false, entityType: "lead", entityId: leadId, action: "Set a deadline for the active case next action." }));

  if (input.contract?.status === "signed" && input.quote?.status !== "accepted") {
    result.push(issue({ code: "SIGNED_CONTRACT_WITHOUT_ACCEPTED_QUOTE", severity: "critical", blocksAutomation: true, entityType: "contract", entityId: input.contract.id, action: "Reconcile quote acceptance and the signed contract before continuing." }));
  }
  if (input.workOrder && (input.contract?.status !== "signed" || !input.contract.companySignedAt)) {
    result.push(issue({ code: "WORK_WITHOUT_FULLY_SIGNED_CONTRACT", severity: "critical", blocksAutomation: true, entityType: "work-order", entityId: input.workOrder.id, action: "Verify both signatures or cancel the invalid work order." }));
  }
  if (input.contract?.status === "signed" && input.contract.companySignedAt && !input.workOrder) {
    result.push(issue({ code: "FULLY_SIGNED_WITHOUT_WORK", severity: "attention", blocksAutomation: false, entityType: "contract", entityId: input.contract.id, action: "Create the work order and assign an employee." }));
  }
  if (input.workOrder?.status === "documented" && !input.workOrder.completionReviewedAt) {
    result.push(issue({ code: "DOCUMENTED_WITHOUT_COMPLETION_REVIEW", severity: "critical", blocksAutomation: true, entityType: "work-order", entityId: input.workOrder.id, action: "Complete the administrator completion review and verify documents." }));
  }
  if (["assigned", "scheduled", "on_way", "arrived", "precheck", "ready", "blocked", "in_progress", "completed", "documented"].includes(input.workOrder?.status || "") && !relationId(input.workOrder?.assignedWorker)) {
    result.push(issue({ code: "ACTIVE_WORK_WITHOUT_WORKER", severity: "critical", blocksAutomation: true, entityType: "work-order", entityId: input.workOrder?.id, action: "Assign an active employee with name and phone." }));
  }
  if (["scheduled", "on_way", "arrived", "precheck", "ready", "in_progress"].includes(input.workOrder?.status || "") && (!input.workOrder?.scheduledAt || !/^\d{2}:\d{2}[–-]\d{2}:\d{2}$/.test(String(input.workOrder.arrivalWindow || "")))) {
    result.push(issue({ code: "ACTIVE_WORK_WITHOUT_VALID_SCHEDULE", severity: "critical", blocksAutomation: true, entityType: "work-order", entityId: input.workOrder?.id, action: "Save a Norwegian date and a valid from–to arrival interval." }));
  }

  const quoteMeasurementHash = snapshotValue(input.quote, "measurementHash");
  const contractMeasurementHash = snapshotValue(input.contract, "measurementHash");
  const quoteMeasurementVersion = snapshotValue(input.quote, "measurementVersion");
  const contractMeasurementVersion = snapshotValue(input.contract, "measurementVersion");
  if (input.quote && input.contract && ((quoteMeasurementHash && contractMeasurementHash && quoteMeasurementHash !== contractMeasurementHash) || (quoteMeasurementVersion && contractMeasurementVersion && quoteMeasurementVersion !== contractMeasurementVersion))) {
    result.push(issue({ code: "QUOTE_CONTRACT_MEASUREMENT_MISMATCH", severity: "critical", blocksAutomation: true, entityType: "contract", entityId: input.contract.id, action: "Supersede the inconsistent package and regenerate quote and contract from one measurement snapshot." }));
  }

  const finishedMessageIds = new Set((input.messages || []).filter((message) => ["sent", "delivered"].includes(message.status || "")).map((message) => message.id));
  if ((input.deliveryJobs || []).some((job) => ["pending", "retry", "running"].includes(job.status || "") && finishedMessageIds.has(Number((job.payload as Record<string, unknown> | undefined)?.messageId)))) {
    result.push(issue({ code: "FINISHED_MESSAGE_WITH_ACTIVE_DELIVERY_JOB", severity: "attention", blocksAutomation: false, entityType: "message", action: "Cancel the stale delivery job without resending the message." }));
  }
  return result;
}
