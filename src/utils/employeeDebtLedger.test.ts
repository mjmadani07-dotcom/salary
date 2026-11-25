import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateDebtScheduleSummary,
  validateDebtRepayment,
  validateEmployeeDebtAccount,
  validateOtherDeduction,
} from './employeeDebtLedger';
import type { EmployeeDebtAccount, EmployeeDebtRepayment } from '../types/employeeDebt';

const account: EmployeeDebtAccount = {
  debtId: 'debt-1', employeeId: 'emp-1', personnelCode: '1001', employeeName: 'Test Employee',
  debtType: 'advance', principalRial: 1_000_000, issueDateJalali: '1405-01-01',
  purpose: 'Emergency advance', repaymentPlan: 'fixed-installment',
  monthlyInstallmentRial: 250_000, firstDueFiscalYear: '1405', firstDueMonth: 1,
  installmentLimit: 4, notes: '', createdAt: '2026-03-21T00:00:00.000Z', updatedAt: '2026-03-21T00:00:00.000Z',
};

test('validates installment and manual repayment plans without introducing interest', () => {
  assert.deepEqual(validateEmployeeDebtAccount({
    employeeId: 'emp-1', personnelCode: '1001', employeeName: 'Test Employee',
    debtType: 'loan', principalRial: 2_000_000, issueDateJalali: '1405-01-01',
    purpose: 'Loan', repaymentPlan: 'fixed-installment', monthlyInstallmentRial: 200_000,
    firstDueFiscalYear: '1405', firstDueMonth: 2, installmentLimit: 10, notes: '',
  }), []);
  assert.deepEqual(validateEmployeeDebtAccount({
    employeeId: 'emp-1', personnelCode: '1001', employeeName: 'Test Employee',
    debtType: 'advance', principalRial: 100_000, issueDateJalali: '1405-01-01',
    purpose: 'Advance', repaymentPlan: 'manual', monthlyInstallmentRial: null,
    firstDueFiscalYear: null, firstDueMonth: null, installmentLimit: null, notes: '',
  }), []);
  assert.ok(validateEmployeeDebtAccount({
    employeeId: 'emp-1', personnelCode: '1001', employeeName: 'Test Employee',
    debtType: 'loan', principalRial: 1_000_000, issueDateJalali: '1405-01-01',
    purpose: 'Loan', repaymentPlan: 'fixed-installment', monthlyInstallmentRial: 200_000,
    firstDueFiscalYear: '1405', firstDueMonth: 2, installmentLimit: 3, notes: '',
  }).some(item => item.code === 'INSTALLMENT_SCHEDULE_SHORTFALL'));
});

test('blocks invalid amounts, invalid dates and an installment date before issue', () => {
  const issues = validateEmployeeDebtAccount({
    employeeId: 'emp-1', personnelCode: '1001', employeeName: 'Test Employee',
    debtType: 'advance', principalRial: 0, issueDateJalali: '1405-01-20',
    purpose: '', repaymentPlan: 'fixed-installment', monthlyInstallmentRial: 0,
    firstDueFiscalYear: '1404', firstDueMonth: 12, installmentLimit: 0, notes: '',
  });
  assert.ok(issues.some(item => item.code === 'INVALID_PRINCIPAL'));
  assert.ok(issues.some(item => item.code === 'INVALID_ISSUE_DATE'));
  assert.ok(issues.some(item => item.code === 'FIRST_DUE_BEFORE_ISSUE'));
});

const repayment = (amountRial: number, date = '1405-01-20'): EmployeeDebtRepayment => ({
  repaymentId: 'repay-' + amountRial, debtId: 'debt-1', employeeId: 'emp-1',
  personnelCode: '1001', amountRial, fiscalYear: date.slice(0, 4),
  month: Number(date.slice(5, 7)), repaymentDateJalali: date,
  paymentMethod: 'bank', reference: '', notes: '', createdAt: '2026-03-21T00:00:00.000Z',
});

test('prevents repayments above the outstanding balance', () => {
  const issues = validateDebtRepayment(repayment(250_000), account, [
    repayment(800_000, '1405-01-15'),
  ]);
  assert.ok(issues.some(item => item.code === 'REPAYMENT_EXCEEDS_OUTSTANDING'));
  assert.deepEqual(validateDebtRepayment(repayment(200_000), account, [
    repayment(800_000, '1405-01-15'),
  ]), []);
});

test('calculates current and overdue installments without auto-posting payroll deductions', () => {
  const monthThree = calculateDebtScheduleSummary(account, [], { fiscalYear: '1405', month: 3 });
  assert.equal(monthThree.currentInstallmentRial, 250_000);
  assert.equal(monthThree.overdueRial, 500_000);
  assert.equal(monthThree.totalDueRial, 750_000);
  assert.equal(monthThree.outstandingRial, 1_000_000);

  const partiallyPaid = calculateDebtScheduleSummary(account, [
    repayment(250_000, '1405-02-25'),
  ], { fiscalYear: '1405', month: 3 });
  assert.equal(partiallyPaid.overdueRial, 250_000);
  assert.equal(partiallyPaid.currentInstallmentRial, 250_000);
  assert.equal(partiallyPaid.totalDueRial, 500_000);
});

test('manual repayment plan has no automatic installment due', () => {
  const manual = { ...account, repaymentPlan: 'manual' as const, monthlyInstallmentRial: null,
    firstDueFiscalYear: null, firstDueMonth: null, installmentLimit: null };
  const summary = calculateDebtScheduleSummary(manual, [], { fiscalYear: '1405', month: 4 });
  assert.equal(summary.outstandingRial, 1_000_000);
  assert.equal(summary.totalDueRial, 0);
});

test('requires a documented authorization reference before an agreed deduction is reviewed', () => {
  const base = {
    employeeId: 'emp-1', personnelCode: '1001', employeeName: 'Test Employee',
    fiscalYear: '1405', month: 2, title: 'Agreed deduction', amountRial: 150_000,
    authorizationReference: '', reviewStatus: 'reviewed' as const, notes: '',
  };
  assert.ok(validateOtherDeduction(base).some(item => item.code === 'AUTHORIZATION_REFERENCE_REQUIRED'));
  assert.deepEqual(validateOtherDeduction({ ...base, authorizationReference: 'Agreement-01' }), []);
});

test('requires repayment year and month to match its Jalali date', () => {
  const invalid = { ...repayment(100_000), month: 2 };
  assert.ok(validateDebtRepayment(invalid, account, [])
    .some(item => item.code === 'REPAYMENT_PERIOD_MISMATCH'));
});

test('rejects a repayment dated before the issue date even within the same month', () => {
  const accountIssuedLater = { ...account, issueDateJalali: '1405-01-20' };
  const earlierRepayment = repayment(100_000, '1405-01-15');
  assert.ok(validateDebtRepayment(earlierRepayment, accountIssuedLater, [])
    .some(item => item.code === 'REPAYMENT_BEFORE_ISSUE'));
});
