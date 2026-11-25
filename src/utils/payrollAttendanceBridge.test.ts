import assert from 'node:assert/strict';
import test from 'node:test';
import type { MonthlyAttendanceRecord } from '../types/attendance';
import type { MonthlyLeaveRecord } from '../types/leave';
import type { PayrollRunEmployee } from './payrollRunEngine';
import {
  createMonthlyAttendanceDraftFromPayrollEmployee,
  hydratePayrollEmployeeFromAttendance,
  MONTHLY_UNPAID_LEAVE_REVIEW_ISSUE,
} from './payrollAttendanceBridge';

function makeEmployee(): PayrollRunEmployee {
  return {
    employeeId: 'emp-001',
    personnelCode: 'P-001',
    fullName: 'علی رضایی',
    isActive: true,
    payrollInput: {
      year: '1405',
      monthDays: 31,
      workDays: 31,
      dailyBaseWageRial: 8_000_000,
      dailySeniorityRial: 100_000,
      housingAllowanceRial: 30_000_000,
      workerCouponRial: 22_000_000,
      isMarried: false,
      childrenCount: 0,
      has720DaysInsurance: false,
      overtimeHours: 0,
      nightShiftHours: 0,
      holidayHours: 0,
      variableBonusRial: 0,
      annualWorkedDays: 0,
      serviceYearsForSeverance: 1,
      serviceExtraDaysForSeverance: 0,
    },
    masterDataIssues: [
      { code: 'MONTHLY_WORK_DAYS_UNCONFIRMED', field: 'workDays', message: 'روز کارکرد' },
      { code: 'MONTHLY_ANNUAL_WORKED_DAYS_UNCONFIRMED', field: 'annualWorkedDays', message: 'کارکرد سال' },
    ],
  };
}

function makeAttendance(overrides: Partial<MonthlyAttendanceRecord> = {}): MonthlyAttendanceRecord {
  return {
    attendanceId: 'emp-001:1405:01',
    employeeId: 'emp-001',
    personnelCode: 'P-001',
    fiscalYear: '1405',
    month: 1,
    monthDays: 31,
    workedDays: 27,
    overtimeHours: 8,
    nightShiftHours: 4,
    holidayHours: 2,
    variableBonusRial: 5_000_000,
    annualWorkedDays: 180,
    notes: 'تأییدشده',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeLeave(overrides: Partial<MonthlyLeaveRecord> = {}): MonthlyLeaveRecord {
  return {
    leaveId: 'emp-001:1405:01',
    employeeId: 'emp-001',
    personnelCode: 'P-001',
    fiscalYear: '1405',
    month: 1,
    openingBalanceDays: 0,
    accruedDays: 2.5,
    paidLeaveUsedDays: 1,
    unpaidLeaveUsedDays: 2,
    adjustmentDays: 0,
    closingBalanceDays: 1.5,
    notes: '',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('hydrates period payroll inputs from the selected monthly attendance record', () => {
  const employee = makeEmployee();
  const hydrated = hydratePayrollEmployeeFromAttendance(employee, makeAttendance(), makeLeave());

  assert.equal(hydrated.payrollInput.workDays, 27);
  assert.equal(hydrated.payrollInput.overtimeHours, 8);
  assert.equal(hydrated.payrollInput.nightShiftHours, 4);
  assert.equal(hydrated.payrollInput.holidayHours, 2);
  assert.equal(hydrated.payrollInput.variableBonusRial, 5_000_000);
  assert.equal(hydrated.payrollInput.annualWorkedDays, 180);
  assert.equal(hydrated.leaveBalanceDays, 1.5);
  assert.equal(hydrated.masterDataIssues?.some((issue) => issue.code === 'MONTHLY_WORK_DAYS_UNCONFIRMED'), false);
  assert.equal(hydrated.masterDataIssues?.some((issue) => issue.code === 'MONTHLY_ANNUAL_WORKED_DAYS_UNCONFIRMED'), false);
  assert.ok(hydrated.masterDataIssues?.some((issue) => issue.code === MONTHLY_UNPAID_LEAVE_REVIEW_ISSUE.code));
});

test('hydrates and round-trips every added Excel monthly input independently', () => {
  const attendance = makeAttendance({
    paidLeaveDays: 3,
    sickLeaveDays: 1.5,
    unpaidAbsenceDays: 2,
    fridayHours: 4,
    missionDays: 1,
    insuredBenefitsRial: 1_200_000,
    nonInsuredBenefitsRial: 800_000,
    loanDeductionRial: 300_000,
    advanceDeductionRial: 150_000,
    otherDeductionsRial: 50_000,
    signedCorrectionRial: -250_000,
    payslipId: 'PAY-1405-01-P001',
    paymentDate: '1405-02-01',
    notes: 'کارکرد و اقلام تکمیلی',
  });
  const leave = makeLeave({ paidLeaveUsedDays: 3, unpaidLeaveUsedDays: 0 });
  const hydrated = hydratePayrollEmployeeFromAttendance(makeEmployee(), attendance, leave);

  assert.equal(hydrated.payrollInput.paidLeaveDays, 3);
  assert.equal(hydrated.payrollInput.sickLeaveDays, 1.5);
  assert.equal(hydrated.payrollInput.unpaidAbsenceDays, 2);
  assert.equal(hydrated.payrollInput.fridayHours, 4);
  assert.equal(hydrated.payrollInput.missionDays, 1);
  assert.equal(hydrated.payrollInput.insuredBenefitsRial, 1_200_000);
  assert.equal(hydrated.payrollInput.nonInsuredBenefitsRial, 800_000);
  assert.equal(hydrated.payrollInput.loanDeductionRial, 300_000);
  assert.equal(hydrated.payrollInput.advanceDeductionRial, 150_000);
  assert.equal(hydrated.payrollInput.otherDeductionsRial, 50_000);
  assert.equal(hydrated.payrollInput.signedCorrectionRial, -250_000);
  assert.equal(hydrated.payrollInput.payslipId, 'PAY-1405-01-P001');
  assert.equal(hydrated.payrollInput.paymentDate, '1405-02-01');
  assert.equal(hydrated.payrollInput.monthlyNotes, 'کارکرد و اقلام تکمیلی');

  const draft = createMonthlyAttendanceDraftFromPayrollEmployee(
    hydrated, '1405', 1, 31, attendance,
  );
  assert.equal(draft.paidLeaveDays, 3);
  assert.equal(draft.sickLeaveDays, 1.5);
  assert.equal(draft.unpaidAbsenceDays, 2);
  assert.equal(draft.fridayHours, 4);
  assert.equal(draft.missionDays, 1);
  assert.equal(draft.insuredBenefitsRial, 1_200_000);
  assert.equal(draft.nonInsuredBenefitsRial, 800_000);
  assert.equal(draft.loanDeductionRial, 300_000);
  assert.equal(draft.advanceDeductionRial, 150_000);
  assert.equal(draft.otherDeductionsRial, 50_000);
  assert.equal(draft.signedCorrectionRial, -250_000);
  assert.equal(draft.payslipId, 'PAY-1405-01-P001');
  assert.equal(draft.paymentDate, '1405-02-01');
  assert.equal(draft.notes, 'کارکرد و اقلام تکمیلی');
});

test('accepts unpaid-leave reconciliation only when the exact quantity was reviewed', () => {
  const employee = makeEmployee();
  const hydrated = hydratePayrollEmployeeFromAttendance(
    employee,
    makeAttendance({ reviewedUnpaidLeaveDays: 2 }),
    makeLeave(),
  );

  assert.equal(
    hydrated.masterDataIssues?.some((issue) => issue.code === MONTHLY_UNPAID_LEAVE_REVIEW_ISSUE.code),
    false,
  );
});

test('requires a review when unpaid leave exists but no attendance record is present', () => {
  const hydrated = hydratePayrollEmployeeFromAttendance(makeEmployee(), undefined, makeLeave());

  assert.ok(
    hydrated.masterDataIssues?.some((issue) => issue.code === MONTHLY_UNPAID_LEAVE_REVIEW_ISSUE.code),
  );
  assert.equal(hydrated.leaveBalanceDays, 1.5);
});

test('a changed payable-day value invalidates the previous unpaid-leave acknowledgement', () => {
  const employee = makeEmployee();
  employee.payrollInput.workDays = 26;
  const draft = createMonthlyAttendanceDraftFromPayrollEmployee(
    employee,
    '1405',
    1,
    31,
    makeAttendance({ reviewedUnpaidLeaveDays: 2 }),
  );

  assert.equal(draft.workedDays, 26);
  assert.equal(draft.reviewedUnpaidLeaveDays, undefined);
  assert.equal(draft.notes, 'تأییدشده');
});

test('an unchanged payable-day value preserves the prior review and notes', () => {
  const employee = makeEmployee();
  employee.payrollInput.workDays = 27;
  const draft = createMonthlyAttendanceDraftFromPayrollEmployee(
    employee,
    '1405',
    1,
    31,
    makeAttendance({ reviewedUnpaidLeaveDays: 2 }),
  );

  assert.equal(draft.reviewedUnpaidLeaveDays, 2);
  assert.equal(draft.notes, 'تأییدشده');
});
