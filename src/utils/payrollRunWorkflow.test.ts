import assert from 'node:assert/strict';
import test from 'node:test';
import type { PayrollRunResult } from './payrollRunEngine';
import {
  createInitialPayrollRunWorkflow,
  validatePayrollRunSnapshotDeletion,
  validatePayrollRunWorkflowTransition,
  validatePayrollRunWorkflowUpdate,
  validatePayrollCorrectionRun,
} from './payrollRunWorkflow';

function makeRun(overrides: Partial<PayrollRunResult> = {}): PayrollRunResult {
  return {
    runId: 'PAY-1405-01',
    fiscalYear: '1405',
    month: 1,
    monthDays: 31,
    status: 'ready-for-review',
    periodIssues: [],
    lines: [],
    totals: {
      employeeCount: 1,
      calculatedCount: 1,
      blockedCount: 0,
      excludedCount: 0,
      grossEarningsRial: 1000,
      employeeInsuranceRial: 70,
      payrollTaxRial: 0,
      totalDeductionsRial: 70,
      netPayRial: 930,
      employerInsuranceRial: 230,
      directEmployerCostRial: 1230,
      monthlyReservesRial: 100,
      ctcMonthlyRial: 1330,
      ctcAnnualRial: 15960,
    },
    ...overrides,
  };
}

test('initial workflow reflects calculation validation status', () => {
  assert.equal(createInitialPayrollRunWorkflow(makeRun()).status, 'ready-for-review');
  assert.equal(createInitialPayrollRunWorkflow(makeRun({ status: 'validation-failed' })).status, 'validation-failed');
});

test('correction snapshots retain their source run and mandatory reason in the initial audit event', () => {
  const workflow = createInitialPayrollRunWorkflow(
    makeRun({ runId: 'PAY-1405-01-CORR-1' }),
    '2026-11-25T15:00:00.000Z',
    'PAY-1405-01',
    'اصلاح روزهای کارکرد با استناد به لیست تأییدشده'
  );
  assert.equal(workflow.correctionOfRunId, 'PAY-1405-01');
  assert.equal(workflow.correctionReason, 'اصلاح روزهای کارکرد با استناد به لیست تأییدشده');
  assert.match(workflow.auditTrail[0].note ?? '', /PAY-1405-01/);
  assert.match(workflow.auditTrail[0].note ?? '', /لیست تأییدشده/);
});

test('correction run requires a locked source, identical period and non-empty reason', () => {
  const source = {
    ...makeRun({ runId: 'PAY-1405-01' }),
    workflow: { status: 'closed' as const },
  };
  const samePeriod = { fiscalYear: '1405', month: 1, monthDays: 31 };
  assert.deepEqual(
    validatePayrollCorrectionRun(source, samePeriod, 'اصلاح مستند'),
    []
  );

  assert.ok(validatePayrollCorrectionRun(source, samePeriod, ' ')
    .some((message) => message.includes('علت اصلاح')));
  assert.ok(validatePayrollCorrectionRun(source, { ...samePeriod, month: 2 }, 'اصلاح')
    .some((message) => message.includes('همان سال، ماه')));
  assert.ok(validatePayrollCorrectionRun(
    { ...source, workflow: { status: 'ready-for-review' as const } },
    samePeriod,
    'اصلاح'
  ).some((message) => message.includes('تأییدشده، پرداخت‌شده یا بسته‌شده')));
});

test('correction validation accepts approved, paid and closed source states', () => {
  const base = makeRun({ runId: 'PAY-1405-01' });
  const target = { fiscalYear: '1405', month: 1, monthDays: 31 };
  for (const status of ['approved', 'paid', 'closed'] as const) {
    assert.deepEqual(
      validatePayrollCorrectionRun({ ...base, workflow: { status } }, target, 'اصلاح مستند'),
      []
    );
  }
});

test('correction source and reason cannot be changed after a correction snapshot is created', () => {
  const run = makeRun({ runId: 'PAY-1405-01-CORR-1' });
  const current = createInitialPayrollRunWorkflow(
    run,
    '2026-11-25T15:00:00.000Z',
    'PAY-1405-01',
    'اصلاح مستند'
  );
  const changedSource = {
    ...current,
    correctionOfRunId: 'PAY-1405-01-OTHER',
  };
  const changedReason = {
    ...current,
    correctionReason: 'علت جدید',
  };
  assert.ok(validatePayrollRunWorkflowUpdate(run, current, changedSource)
    .some((issue) => issue.code === 'CORRECTION_METADATA_IMMUTABLE'));
  assert.ok(validatePayrollRunWorkflowUpdate(run, current, changedReason)
    .some((issue) => issue.code === 'CORRECTION_METADATA_IMMUTABLE'));
});


test('only validation-failed payroll snapshots may be discarded', () => {
  assert.deepEqual(validatePayrollRunSnapshotDeletion('validation-failed'), []);
  for (const status of ['ready-for-review', 'approved', 'paid', 'closed'] as const) {
    assert.ok(validatePayrollRunSnapshotDeletion(status).length > 0, status);
  }
});

test('monthly payroll lifecycle only allows ready → approved → paid → closed', () => {
  assert.deepEqual(validatePayrollRunWorkflowTransition('ready-for-review', 'approved'), []);
  assert.deepEqual(validatePayrollRunWorkflowTransition('approved', 'paid'), []);
  assert.deepEqual(validatePayrollRunWorkflowTransition('paid', 'closed'), []);
  assert.ok(validatePayrollRunWorkflowTransition('ready-for-review', 'paid').length > 0);
  assert.ok(validatePayrollRunWorkflowTransition('approved', 'ready-for-review').length > 0);
  assert.ok(validatePayrollRunWorkflowTransition('paid', 'approved').length > 0);
  assert.ok(validatePayrollRunWorkflowTransition('closed', 'approved').length > 0);
  assert.ok(validatePayrollRunWorkflowTransition('validation-failed', 'approved').length > 0);
});

test('approval requires a valid calculation, finance approver and authorization reference', () => {
  const run = makeRun();
  const current = createInitialPayrollRunWorkflow(run);
  const next = {
    ...current,
    status: 'approved' as const,
    approverName: '',
    approvalReference: '',
    approvedAt: new Date().toISOString(),
  };
  const issues = validatePayrollRunWorkflowUpdate(run, current, next);
  assert.ok(issues.some((issue) => issue.code === 'APPROVER_REQUIRED'));
  assert.ok(issues.some((issue) => issue.code === 'APPROVAL_REFERENCE_REQUIRED'));
});

test('payment requires a Jalali date, bank reference, exact amount or documented difference', () => {
  const run = makeRun();
  const current = {
    ...createInitialPayrollRunWorkflow(run),
    status: 'approved' as const,
    approverName: 'مدیر مالی',
    approvalReference: 'FIN-001',
    approvedAt: new Date().toISOString(),
  };
  const invalid = {
    ...current,
    status: 'paid' as const,
    paymentDate: '1405-01-31',
    paymentReference: 'BANK-001',
    paidAmountRial: 900,
    paidAt: new Date().toISOString(),
  };
  assert.ok(validatePayrollRunWorkflowUpdate(run, current, invalid)
    .some((issue) => issue.code === 'PAYMENT_DIFFERENCE_REASON_REQUIRED'));

  const valid = { ...invalid, paymentDifferenceReason: 'کسور بانکی مستند' };
  assert.deepEqual(validatePayrollRunWorkflowUpdate(run, current, valid), []);
});

test('approval and payment records become immutable as the payroll run advances', () => {
  const run = makeRun();
  const ready = createInitialPayrollRunWorkflow(run);
  const approved = {
    ...ready,
    status: 'approved' as const,
    approverName: 'مدیر مالی',
    approvalReference: 'FIN-001',
    approvedAt: '2026-11-25T15:00:00.000Z',
  };
  const mutatedApproval = {
    ...approved,
    status: 'paid' as const,
    approverName: 'کاربر دیگر',
    paymentDate: '1405-01-31',
    paymentReference: 'BANK-001',
    paidAmountRial: 930,
    paidAt: '2026-11-25T15:10:00.000Z',
  };
  assert.ok(validatePayrollRunWorkflowUpdate(run, approved, mutatedApproval)
    .some((issue) => issue.code === 'APPROVAL_METADATA_IMMUTABLE'));

  const paid = {
    ...approved,
    status: 'paid' as const,
    paymentDate: '1405-01-31',
    paymentReference: 'BANK-001',
    paidAmountRial: 930,
    paidAt: '2026-11-25T15:10:00.000Z',
  };
  const mutatedPayment = {
    ...paid,
    status: 'closed' as const,
    paidAmountRial: 900,
    closeReference: 'ARCHIVE-001',
    closedAt: '2026-11-25T15:20:00.000Z',
  };
  assert.ok(validatePayrollRunWorkflowUpdate(run, paid, mutatedPayment)
    .some((issue) => issue.code === 'PAYMENT_METADATA_IMMUTABLE'));

  const validClose = {
    ...paid,
    status: 'closed' as const,
    closeReference: 'ARCHIVE-001',
    closedAt: '2026-11-25T15:20:00.000Z',
  };
  assert.deepEqual(validatePayrollRunWorkflowUpdate(run, paid, validClose), []);
});

test('closing requires a close reference', () => {
  const run = makeRun();
  const current = {
    ...createInitialPayrollRunWorkflow(run),
    status: 'paid' as const,
    paymentDate: '1405-01-31',
    paymentReference: 'BANK-001',
    paidAmountRial: 930,
    paidAt: new Date().toISOString(),
  };
  const issues = validatePayrollRunWorkflowUpdate(run, current, {
    ...current,
    status: 'closed',
    closedAt: new Date().toISOString(),
    closeReference: '',
  });
  assert.ok(issues.some((issue) => issue.code === 'CLOSE_REFERENCE_REQUIRED'));
});
