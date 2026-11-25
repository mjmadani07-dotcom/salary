import assert from 'node:assert/strict';
import test from 'node:test';
import { createAttendanceId, getUnpaidLeavePayrollReviewIssue, validateMonthlyAttendance } from './attendanceLedger';

const valid = {
  employeeId: 'emp-1', personnelCode: '1001', fiscalYear: '1405' as const,
  month: 2, monthDays: 30 as const, workedDays: 26, overtimeHours: 12,
  nightShiftHours: 8, holidayHours: 0, variableBonusRial: 0,
  annualWorkedDays: 60, notes: '',
};

test('validates monthly attendance values and bounds', () => {
  assert.deepEqual(validateMonthlyAttendance(valid), []);
  assert.ok(validateMonthlyAttendance({ ...valid, workedDays: 31 }).some(x => x.code === 'INVALID_WORKED_DAYS'));
  assert.ok(validateMonthlyAttendance({ ...valid, overtimeHours: -1 }).some(x => x.code === 'INVALID_OVERTIMEHOURS'));
});

test('creates a stable employee-period attendance key', () => {
  assert.equal(createAttendanceId('emp-1', '1405', 2), 'emp-1:1405:02');
});


test('requires an explicit review when unpaid leave is recorded', () => {
  const issue = getUnpaidLeavePayrollReviewIssue(2);
  assert.equal(issue?.code, 'UNPAID_LEAVE_REVIEW_REQUIRED');
  assert.equal(getUnpaidLeavePayrollReviewIssue(2, 2), null);
  assert.equal(getUnpaidLeavePayrollReviewIssue(2, 1)?.code, 'UNPAID_LEAVE_REVIEW_REQUIRED');
  assert.equal(getUnpaidLeavePayrollReviewIssue(0), null);
});

test('validates the exact unpaid-leave quantity acknowledged for payroll', () => {
  assert.deepEqual(validateMonthlyAttendance({ ...valid, reviewedUnpaidLeaveDays: 2 }), []);
  assert.ok(validateMonthlyAttendance({ ...valid, reviewedUnpaidLeaveDays: 31 }).some(x => x.code === 'INVALID_REVIEWED_UNPAID_LEAVE_DAYS'));
  assert.ok(validateMonthlyAttendance({ ...valid, reviewedUnpaidLeaveDays: -1 }).some(x => x.code === 'INVALID_REVIEWED_UNPAID_LEAVE_DAYS'));
});

test('validates distinct monthly Excel inputs and permits signed corrections', () => {
  assert.deepEqual(validateMonthlyAttendance({
    ...valid,
    paidLeaveDays: 3,
    sickLeaveDays: 2,
    unpaidAbsenceDays: 1,
    fridayHours: 6,
    missionDays: 2,
    insuredBenefitsRial: 1_000_000,
    nonInsuredBenefitsRial: 500_000,
    loanDeductionRial: 200_000,
    advanceDeductionRial: 100_000,
    otherDeductionsRial: 50_000,
    signedCorrectionRial: -250_000,
    payslipId: 'PAY-1405-02-P001',
    paymentDate: '1405-03-01',
  }), []);

  assert.ok(validateMonthlyAttendance({ ...valid, sickLeaveDays: -1 })
    .some((issue) => issue.code === 'INVALID_SICKLEAVEDAYS'));
  assert.ok(validateMonthlyAttendance({ ...valid, missionDays: 31 })
    .some((issue) => issue.code === 'INVALID_MISSIONDAYS'));
  assert.ok(validateMonthlyAttendance({ ...valid, signedCorrectionRial: Number.NaN })
    .some((issue) => issue.code === 'INVALID_SIGNED_CORRECTION'));
});
