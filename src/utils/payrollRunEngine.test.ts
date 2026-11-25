import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculatePayrollRun,
  PayrollRunEmployee,
  PayrollRunPeriod,
} from './payrollRunEngine';
import type { PayrollInput } from './payrollEngine';

const period: PayrollRunPeriod = {
  runId: 'PAY-1405-01',
  fiscalYear: '1405',
  month: 1,
  monthDays: 31,
};

function makeInput(overrides: Partial<PayrollInput> = {}): PayrollInput {
  return {
    year: '1405',
    monthDays: 31,
    workDays: 31,
    dailyBaseWageRial: 5_541_850,
    dailySeniorityRial: 0,
    housingAllowanceRial: 30_000_000,
    workerCouponRial: 22_000_000,
    isMarried: false,
    childrenCount: 0,
    has720DaysInsurance: false,
    overtimeHours: 0,
    nightShiftHours: 0,
    holidayHours: 0,
    variableBonusRial: 0,
    annualWorkedDays: 365,
    serviceYearsForSeverance: 1,
    serviceExtraDaysForSeverance: 0,
    ...overrides,
  };
}

function makeEmployee(
  overrides: Partial<PayrollRunEmployee> = {}
): PayrollRunEmployee {
  return {
    employeeId: 'emp-001',
    personnelCode: 'P-001',
    fullName: 'کارمند اول',
    isActive: true,
    payrollInput: makeInput(),
    ...overrides,
  };
}

test('calculates every employee through the central engine and aggregates results', () => {
  const first = makeEmployee({
    jobTitle: 'کارشناس مالی',
    costCenter: 'اداری',
    bankAccountNumber: '0123456789',
    bankIban: 'IR000000000000000000000000',
    insuranceNumber: 'INS-001',
    hireDateJalali: '1400-01-01',
    leaveBalanceDays: 7.5,
  });
  const second = makeEmployee({
    employeeId: 'emp-002',
    personnelCode: 'P-002',
    fullName: 'کارمند دوم',
    payrollInput: makeInput({ dailyBaseWageRial: 10_000_000 }),
  });

  const run = calculatePayrollRun(period, [first, second]);

  assert.equal(run.status, 'ready-for-review');
  assert.equal(run.totals.employeeCount, 2);
  assert.equal(run.totals.calculatedCount, 2);
  assert.equal(run.totals.blockedCount, 0);
  assert.equal(run.lines[0].jobTitle, 'کارشناس مالی');
  assert.equal(run.lines[0].costCenter, 'اداری');
  assert.equal(run.lines[0].bankAccountNumber, '0123456789');
  assert.equal(run.lines[0].leaveBalanceDays, 7.5);
  assert.equal(
    run.totals.grossEarningsRial,
    run.lines.reduce((sum, line) => sum + (line.result?.grossEarningsRial ?? 0), 0)
  );
  assert.equal(
    run.totals.netPayRial,
    run.lines.reduce((sum, line) => sum + (line.result?.netPayRial ?? 0), 0)
  );
});

test('blocks every employee when personnel codes are duplicated', () => {
  const first = makeEmployee();
  const second = makeEmployee({
    employeeId: 'emp-002',
    fullName: 'کارمند دوم',
  });

  const run = calculatePayrollRun(period, [first, second]);

  assert.equal(run.status, 'validation-failed');
  assert.equal(run.totals.blockedCount, 2);
  assert.ok(run.lines.every((line) =>
    line.issues.some((issue) => issue.code === 'DUPLICATE_PERSONNEL_CODE')
  ));
  assert.equal(run.totals.grossEarningsRial, 0);
});

test('blocks employee input from a different fiscal period', () => {
  const employee = makeEmployee({
    payrollInput: makeInput({ year: '1404' as PayrollInput['year'] }),
  });

  const run = calculatePayrollRun(period, [employee]);

  assert.equal(run.status, 'validation-failed');
  assert.equal(run.lines[0].status, 'blocked');
  assert.ok(run.lines[0].issues.some((issue) => issue.code === 'EMPLOYEE_YEAR_MISMATCH'));
});

test('blocks invalid negative payroll inputs instead of silently calculating them', () => {
  const employee = makeEmployee({
    payrollInput: makeInput({ dailyBaseWageRial: -1 }),
  });

  const run = calculatePayrollRun(period, [employee]);

  assert.equal(run.status, 'validation-failed');
  assert.equal(run.lines[0].status, 'blocked');
  assert.ok(run.lines[0].issues.some((issue) => issue.code === 'INVALID_NON_NEGATIVE_NUMBER'));
});

test('blocks a payroll line when deductions make net pay negative', () => {
  const employee = makeEmployee({
    payrollInput: makeInput({ otherDeductionsRial: 999_999_999_999 }),
  });

  const run = calculatePayrollRun(period, [employee]);

  assert.equal(run.status, 'validation-failed');
  assert.equal(run.lines[0].status, 'blocked');
  assert.ok(run.lines[0].issues.some((issue) => issue.code === 'NEGATIVE_NET_PAY'));
  assert.ok((run.lines[0].result?.netPayRial ?? 0) < 0);
  assert.equal(run.totals.calculatedCount, 0);
  assert.equal(run.totals.netPayRial, 0);
});

test('excludes inactive employees and keeps them visible in run audit lines', () => {
  const active = makeEmployee();
  const inactive = makeEmployee({
    employeeId: 'emp-002',
    personnelCode: 'P-002',
    fullName: 'کارمند غیرفعال',
    isActive: false,
  });

  const run = calculatePayrollRun(period, [active, inactive]);

  assert.equal(run.status, 'ready-for-review');
  assert.equal(run.totals.employeeCount, 2);
  assert.equal(run.totals.calculatedCount, 1);
  assert.equal(run.totals.excludedCount, 1);
  assert.equal(run.lines[1].status, 'excluded');
  assert.ok(run.lines[1].issues.some((issue) => issue.code === 'EMPLOYEE_INACTIVE'));
});

test('requires a non-empty payroll period and at least one employee', () => {
  const run = calculatePayrollRun(
    { ...period, runId: '', month: 13 },
    []
  );

  assert.equal(run.status, 'validation-failed');
  assert.ok(run.periodIssues.some((issue) => issue.code === 'MISSING_RUN_ID'));
  assert.ok(run.periodIssues.some((issue) => issue.code === 'INVALID_PAYROLL_MONTH'));
  assert.ok(run.periodIssues.some((issue) => issue.code === 'EMPTY_PAYROLL_RUN'));
});

test('blocks payroll when effective employee master data is incomplete', () => {
  const employee = makeEmployee({
    masterDataIssues: [{
      code: 'NO_ACTIVE_CONTRACT',
      message: 'در ابتدای دوره، قرارداد معتبر ثبت نشده است.',
      field: 'contracts',
    }],
  });
  const run = calculatePayrollRun(period, [employee]);
  assert.equal(run.status, 'validation-failed');
  assert.equal(run.totals.blockedCount, 1);
  assert.ok(run.lines[0].issues.some((issue) => issue.code === 'NO_ACTIVE_CONTRACT'));
});


test('blocks an employee until unpaid-leave reconciliation is acknowledged', () => {
  const employee = makeEmployee({
    masterDataIssues: [{
      code: 'UNPAID_LEAVE_REVIEW_REQUIRED',
      message: 'روزهای کارکرد باید با مرخصی بدون حقوق ثبت‌شده تطبیق داده شود.',
      field: 'reviewedUnpaidLeaveDays',
    }],
  });

  const run = calculatePayrollRun(period, [employee]);

  assert.equal(run.status, 'validation-failed');
  assert.equal(run.totals.blockedCount, 1);
  assert.equal(run.lines[0].status, 'blocked');
  assert.ok(run.lines[0].issues.some(issue => issue.code === 'UNPAID_LEAVE_REVIEW_REQUIRED'));
});
