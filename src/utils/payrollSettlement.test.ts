import assert from 'node:assert/strict';
import test from 'node:test';
import type { PayrollSettlementInput } from '../types/payrollSettlement';
import { calculatePayrollSettlement, validatePayrollSettlementWorkflow } from './payrollSettlement';

function makeInput(overrides: Partial<PayrollSettlementInput> = {}): PayrollSettlementInput {
  return {
    settlementId: 'emp-001:1405-06-31',
    employeeId: 'emp-001',
    personnelCode: 'P-001',
    employeeName: 'کارمند آزمون',
    fiscalYear: '1405',
    hireDateJalali: '1400-01-01',
    terminationDateJalali: '1405-06-31',
    reason: 'contract-end',
    monthsWorkedInYear: 6,
    annualWorkedDays: 184,
    annualCalendarDays: 365,
    eidDailyWageBasisRial: 8_000_000,
    eidWageBasisReference: 'حکم مزد 1405',
    eidWageBasisConfirmed: true,
    severanceMonthlyWageBasisRial: 240_000_000,
    severanceWageBasisReference: 'فیش آخرین ماه',
    severanceWageBasisConfirmed: true,
    leaveBalanceDays: 12,
    leaveBalanceConfirmed: true,
    leaveDailyBasisRial: 9_000_000,
    leaveBasisReference: 'ریز حق‌السعی روزانه',
    leaveBasisConfirmed: true,
    eidAdvancePaidRial: 10_000_000,
    eidAdvanceReference: 'فیش 1405-03',
    priorSeverancePaidRial: 0,
    priorSeveranceReference: '',
    otherClaimsRial: 15_000_000,
    otherClaimsDescription: 'مطالبات تأییدشده',
    approvedDeductionsRial: 0,
    deductionAuthorizationReference: '',
    medicalCommissionReference: '',
    legalBasisReference: '',
    notes: '',
    ...overrides,
  };
}

test('calculates prorated Eid, service-based severance and the full verified leave balance', () => {
  const result = calculatePayrollSettlement(makeInput());
  assert.deepEqual(result.issues, []);
  assert.ok(result.result);
  assert.equal(result.result.eidMaximumBeforeProrationRial, 480_000_000);
  assert.equal(result.result.eidEntitlementRial, Math.round(480_000_000 * 184 / 365));
  assert.equal(result.result.eidBalanceRial, result.result.eidEntitlementRial - 10_000_000);
  assert.equal(result.result.completedServiceYears, 5);
  assert.equal(result.result.recognizedServiceYears, 5 + 183 / 365);
  assert.equal(result.result.severanceEntitlementRial, Math.round(240_000_000 * (5 + 183 / 365)));
  assert.equal(result.result.leaveEncashmentRial, 108_000_000);
  assert.equal(result.result.totalGrossEntitlementRial,
    result.result.eidEntitlementRial + result.result.severanceEntitlementRial + 108_000_000 + 15_000_000);
  assert.ok(result.warnings.some((warning) => warning.includes('به‌طور خودکار به ۹ روز محدود نشده')));
});

test('does not apply the special double severance rate without a medical commission reference', () => {
  const result = calculatePayrollSettlement(makeInput({
    reason: 'work-related-incapacity',
    medicalCommissionReference: '',
  }));
  assert.ok(result.issues.some((issue) => issue.code === 'MEDICAL_COMMISSION_REFERENCE_REQUIRED'));
});

test('requires wage-basis evidence and confirmation for all three independent bases', () => {
  const result = calculatePayrollSettlement(makeInput({
    eidWageBasisConfirmed: false,
    severanceWageBasisReference: '',
    leaveBasisConfirmed: false,
  }));
  assert.ok(result.issues.some((issue) => issue.code === 'EID_WAGE_BASIS_UNCONFIRMED'));
  assert.ok(result.issues.some((issue) => issue.code === 'SEVERANCE_WAGE_REFERENCE_REQUIRED'));
  assert.ok(result.issues.some((issue) => issue.code === 'LEAVE_WAGE_BASIS_UNCONFIRMED'));
});

test('preserves months-worked and days-worked independently and reports a large mismatch', () => {
  const result = calculatePayrollSettlement(makeInput({
    monthsWorkedInYear: 12,
    annualWorkedDays: 100,
  }));
  assert.deepEqual(result.issues, []);
  assert.ok(result.warnings.some((warning) => warning.includes('اختلاف قابل توجه')));
});

test('blocks unsupported overpayments and unauthorized deductions instead of netting them silently', () => {
  const result = calculatePayrollSettlement(makeInput({
    eidAdvancePaidRial: 300_000_000,
    approvedDeductionsRial: 20_000_000,
    deductionAuthorizationReference: '',
  }));
  assert.ok(result.issues.some((issue) => issue.code === 'DEDUCTION_AUTHORIZATION_REQUIRED'));
  assert.ok(result.issues.some((issue) => issue.code === 'EID_ADVANCE_EXCEEDS_ENTITLEMENT'));
});

test('requires a legal basis for an unclassified termination reason', () => {
  const result = calculatePayrollSettlement(makeInput({
    reason: 'other',
    legalBasisReference: '',
  }));
  assert.ok(result.issues.some((issue) => issue.code === 'LEGAL_BASIS_REFERENCE_REQUIRED'));
});

test('approval and payment transitions require named references and payment reconciliation', () => {
  assert.ok(validatePayrollSettlementWorkflow({
    status: 'approved',
    calculation: undefined,
    approverName: '',
    approvalReference: '',
  }).length >= 3);
  assert.ok(validatePayrollSettlementWorkflow({
    status: 'paid',
    calculation: {
      ruleSetId: 'test',
      ruleSetVersion: 1,
      ruleSetApprovalStatus: 'pending',
      completedServiceYears: 1,
      additionalServiceDays: 0,
      recognizedServiceYears: 1,
      eidMaximumBeforeProrationRial: 1,
      eidEntitlementRial: 1,
      eidAdvancePaidRial: 0,
      eidBalanceRial: 1,
      severanceMultiplier: 1,
      severanceEntitlementRial: 1,
      priorSeverancePaidRial: 0,
      severanceBalanceRial: 1,
      leaveEncashmentRial: 0,
      otherClaimsRial: 0,
      totalGrossEntitlementRial: 2,
      approvedDeductionsRial: 0,
      payableBeforeTaxRial: 2,
      legalReviewRequiredItems: [],
    },
    approverName: 'مدیر مالی',
    approvalReference: 'FIN-001',
    paymentDate: '1405-06-31',
    paymentReference: 'BANK-001',
    paidAmountRial: 1,
    paymentDifferenceReason: '',
  }).some((issue) => issue.includes('علت اختلاف')));
});
