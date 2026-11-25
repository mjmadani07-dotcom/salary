import { isJalaliDate } from './employeeMaster';
import type { PayrollRunResult } from './payrollRunEngine';

export function createInitialPayrollRunWorkflow(
  run: Pick<PayrollRunResult, 'status' | 'runId'>,
  occurredAt = new Date().toISOString(),
  correctionOfRunId?: string,
  correctionReason?: string
): PayrollRunWorkflow {
  const status: PayrollRunWorkflowStatus = run.status === 'ready-for-review'
    ? 'ready-for-review'
    : 'validation-failed';
  return {
    status,
    auditTrail: [{
      eventId: crypto.randomUUID(),
      eventType: 'calculated',
      occurredAt,
      status,
      note: correctionOfRunId
        ? `Correction snapshot ${run.runId} references ${correctionOfRunId}. Reason: ${correctionReason?.trim() ?? ''}`
        : `Snapshot ${run.runId} created from the central payroll engine`,
    }],
    ...(correctionOfRunId ? { correctionOfRunId } : {}),
    ...(correctionOfRunId && correctionReason?.trim() ? { correctionReason: correctionReason.trim() } : {}),
  };
}


import type { PayrollRunWorkflow, PayrollRunWorkflowStatus } from '../types/payrollRunWorkflow';

export interface PayrollRunWorkflowValidationIssue {
  code: string;
  message: string;
}

/**
 * A failed calculation may be discarded before review. Once a run is ready
 * for review, its snapshot is retained as an audit record and must be
 * corrected through a new, separately identified run.
 */
export function validatePayrollRunSnapshotDeletion(
  status: PayrollRunWorkflowStatus
): string[] {
  return status === 'validation-failed'
    ? []
    : ['Snapshot آماده بررسی، تأییدشده، پرداخت‌شده یا بسته‌شده قابل حذف نیست؛ برای اصلاح، Snapshot مستقل بسازید.'];
}

export function validatePayrollRunWorkflowTransition(
  currentStatus: PayrollRunWorkflowStatus,
  nextStatus: PayrollRunWorkflowStatus
): string[] {
  const allowed: Record<PayrollRunWorkflowStatus, PayrollRunWorkflowStatus[]> = {
    'validation-failed': [],
    'ready-for-review': ['approved'],
    approved: ['paid'],
    paid: ['closed'],
    closed: [],
  };
  return allowed[currentStatus].includes(nextStatus)
    ? []
    : [currentStatus === 'closed'
      ? 'دوره بسته‌شده قابل تغییر نیست؛ برای اصلاح باید Snapshot اصلاحی مستقل ایجاد شود.'
      : currentStatus === 'paid'
        ? 'دوره پرداخت‌شده فقط با بستن دوره تغییر وضعیت می‌دهد.'
        : currentStatus === 'approved'
          ? 'دوره تأییدشده فقط با ثبت پرداخت تغییر وضعیت می‌دهد.'
          : currentStatus === 'validation-failed'
            ? 'دوره دارای خطای اعتبارسنجی قابل تأیید نیست.'
            : 'انتقال وضعیت دوره حقوق مجاز نیست.'];
}

export function validatePayrollRunWorkflowUpdate(
  run: PayrollRunResult,
  current: PayrollRunWorkflow,
  next: PayrollRunWorkflow
): PayrollRunWorkflowValidationIssue[] {
  const issues: PayrollRunWorkflowValidationIssue[] = [];
  const add = (code: string, message: string) => issues.push({ code, message });

  if (
    current.correctionOfRunId !== next.correctionOfRunId ||
    current.correctionReason !== next.correctionReason
  ) {
    add('CORRECTION_METADATA_IMMUTABLE', 'مرجع و علت Snapshot اصلاحی پس از ایجاد قابل تغییر نیست.');
  }
  if (current.status !== next.status) {
    validatePayrollRunWorkflowTransition(current.status, next.status)
      .forEach((message) => add('INVALID_WORKFLOW_TRANSITION', message));
  }


  if (current.status === 'approved') {
    if (
      next.approverName !== current.approverName ||
      next.approvalReference !== current.approvalReference ||
      next.approvedAt !== current.approvedAt
    ) {
      add('APPROVAL_METADATA_IMMUTABLE', 'اطلاعات تأیید پس از ثبت قابل تغییر نیست.');
    }
  }
  if (current.status === 'paid') {
    const immutableFields: Array<keyof PayrollRunWorkflow> = [
      'approverName', 'approvalReference', 'approvedAt',
      'paymentDate', 'paymentReference', 'paidAmountRial',
      'paymentDifferenceReason', 'paidAt',
    ];
    if (immutableFields.some((field) => current[field] !== next[field])) {
      add('PAYMENT_METADATA_IMMUTABLE', 'اطلاعات تأیید و پرداخت پس از ثبت قابل تغییر نیست.');
    }
  }

  if (next.status === 'approved') {
    if (run.status !== 'ready-for-review' || run.totals.blockedCount > 0 || run.totals.calculatedCount === 0) {
      add('RUN_NOT_APPROVABLE', 'دوره باید بدون ردیف مسدود و با حداقل یک کارمند محاسبه‌شده آماده بررسی باشد.');
    }
    if (!next.approverName?.trim()) add('APPROVER_REQUIRED', 'نام تأییدکننده مالی الزامی است.');
    if (!next.approvalReference?.trim()) add('APPROVAL_REFERENCE_REQUIRED', 'شماره صورتجلسه یا مجوز تأیید الزامی است.');
    if (!next.approvedAt || !Number.isFinite(Date.parse(next.approvedAt))) {
      add('APPROVAL_DATE_REQUIRED', 'زمان ثبت تأیید معتبر نیست.');
    }
  }

  if (next.status === 'paid') {
    if (!isJalaliDate(next.paymentDate ?? '')) {
      add('PAYMENT_DATE_REQUIRED', 'تاریخ پرداخت شمسی معتبر الزامی است.');
    }
    if (!next.paymentReference?.trim()) add('PAYMENT_REFERENCE_REQUIRED', 'شماره سند یا مرجع پرداخت الزامی است.');
    if (!Number.isSafeInteger(next.paidAmountRial) || (next.paidAmountRial ?? -1) < 0) {
      add('PAID_AMOUNT_INVALID', 'مبلغ پرداخت واقعی باید عدد صحیح ریالی و غیرمنفی باشد.');
    }
    if (
      next.paidAmountRial !== undefined &&
      Math.round(next.paidAmountRial) !== run.totals.netPayRial &&
      !next.paymentDifferenceReason?.trim()
    ) {
      add('PAYMENT_DIFFERENCE_REASON_REQUIRED', 'مبلغ پرداخت واقعی با خالص حقوق متفاوت است؛ علت اختلاف را ثبت کنید.');
    }
    if (!next.paidAt || !Number.isFinite(Date.parse(next.paidAt))) {
      add('PAID_AT_REQUIRED', 'زمان ثبت پرداخت معتبر نیست.');
    }
  }

  if (next.status === 'closed') {
    if (!next.closeReference?.trim()) {
      add('CLOSE_REFERENCE_REQUIRED', 'شماره سند بستن دوره یا مرجع بایگانی الزامی است.');
    }
    if (!next.closedAt || !Number.isFinite(Date.parse(next.closedAt))) {
      add('CLOSED_AT_REQUIRED', 'زمان بستن دوره معتبر نیست.');
    }
  }

  return issues;
}
