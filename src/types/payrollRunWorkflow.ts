export type PayrollRunWorkflowStatus =
  | 'validation-failed'
  | 'ready-for-review'
  | 'approved'
  | 'paid'
  | 'closed';

export type PayrollRunWorkflowEventType =
  | 'calculated'
  | 'approved'
  | 'paid'
  | 'closed';

export interface PayrollRunWorkflowEvent {
  eventId: string;
  eventType: PayrollRunWorkflowEventType;
  occurredAt: string;
  status: PayrollRunWorkflowStatus;
  actorName?: string;
  reference?: string;
  note?: string;
}

export interface PayrollRunWorkflow {
  status: PayrollRunWorkflowStatus;
  auditTrail: PayrollRunWorkflowEvent[];
  approverName?: string;
  approvalReference?: string;
  approvedAt?: string;
  paymentDate?: string;
  paymentReference?: string;
  paidAmountRial?: number;
  paymentDifferenceReason?: string;
  paidAt?: string;
  closeReference?: string;
  closedAt?: string;
  /** Populated only when this is a separate correction run. */
  correctionOfRunId?: string;
}
