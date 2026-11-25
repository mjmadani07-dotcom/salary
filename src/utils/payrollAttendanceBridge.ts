import type { MonthlyAttendanceDraft, MonthlyAttendanceRecord } from '../types/attendance';
import type { MonthlyLeaveRecord } from '../types/leave';
import type { PayrollRunEmployee } from './payrollRunEngine';

export const MONTHLY_UNPAID_LEAVE_REVIEW_ISSUE = {
  code: 'MONTHLY_UNPAID_LEAVE_REVIEW_REQUIRED',
  field: 'reviewedUnpaidLeaveDays',
  message: 'مرخصی بدون حقوق این ماه ثبت شده است. در صفحه ثبت کارکرد، تأیید کنید که روزهای مبنای پرداخت اثر این مرخصی را لحاظ کرده‌اند.',
} as const;

export function hydratePayrollEmployeeFromAttendance(
  employee: PayrollRunEmployee,
  attendance: MonthlyAttendanceRecord | undefined,
  leave: MonthlyLeaveRecord | undefined,
): PayrollRunEmployee {
  if (!attendance) {
    const unpaidLeaveDays = leave?.unpaidLeaveUsedDays ?? 0;
    const employeeWithLeaveBalance = {
      ...employee,
      leaveBalanceDays: leave?.closingBalanceDays,
    };
    if (unpaidLeaveDays <= 0) return employeeWithLeaveBalance;
    return {
      ...employeeWithLeaveBalance,
      masterDataIssues: [
        ...(employee.masterDataIssues ?? []).filter(
          (issue) => issue.code !== MONTHLY_UNPAID_LEAVE_REVIEW_ISSUE.code,
        ),
        MONTHLY_UNPAID_LEAVE_REVIEW_ISSUE,
      ],
    };
  }

  const unpaidLeaveDays = leave?.unpaidLeaveUsedDays ?? 0;
  const issues = (employee.masterDataIssues ?? []).filter(
    (issue) =>
      issue.code !== 'MONTHLY_WORK_DAYS_UNCONFIRMED' &&
      issue.code !== 'MONTHLY_ANNUAL_WORKED_DAYS_UNCONFIRMED' &&
      !(issue.code === 'MONTHLY_SHIFT_PATTERN_UNCONFIRMED' && attendance.shiftWorkPattern !== undefined) &&
      issue.code !== MONTHLY_UNPAID_LEAVE_REVIEW_ISSUE.code,
  );

  if (
    unpaidLeaveDays > 0 &&
    attendance.reviewedUnpaidLeaveDays !== unpaidLeaveDays
  ) {
    issues.push(MONTHLY_UNPAID_LEAVE_REVIEW_ISSUE);
  }

  return {
    ...employee,
    payrollInput: {
      ...employee.payrollInput,
      workDays: attendance.workedDays,
      overtimeHours: attendance.overtimeHours,
      nightShiftHours: attendance.nightShiftHours,
      shiftWorkPattern: attendance.shiftWorkPattern ?? employee.payrollInput.shiftWorkPattern,
      holidayHours: attendance.holidayHours,
      variableBonusRial: attendance.variableBonusRial,
      annualWorkedDays: attendance.annualWorkedDays,
      paidLeaveDays: leave?.paidLeaveUsedDays ?? attendance.paidLeaveDays ?? 0,
      sickLeaveDays: attendance.sickLeaveDays ?? 0,
      unpaidAbsenceDays: attendance.unpaidAbsenceDays ?? 0,
      fridayHours: attendance.fridayHours ?? 0,
      missionDays: attendance.missionDays ?? 0,
      insuredBenefitsRial: attendance.insuredBenefitsRial ?? 0,
      nonInsuredBenefitsRial: attendance.nonInsuredBenefitsRial ?? 0,
      loanDeductionRial: attendance.loanDeductionRial ?? 0,
      advanceDeductionRial: attendance.advanceDeductionRial ?? 0,
      otherDeductionsRial: attendance.otherDeductionsRial ?? 0,
      signedCorrectionRial: attendance.signedCorrectionRial ?? 0,
      payslipId: attendance.payslipId ?? employee.payrollInput.payslipId ??
        `${attendance.fiscalYear}-${String(attendance.month).padStart(2, '0')}-${employee.personnelCode}`,
      paymentDate: attendance.paymentDate ?? '',
      monthlyNotes: attendance.notes,
    },
    masterDataIssues: issues,
    leaveBalanceDays: leave?.closingBalanceDays,
  };
}

export function createMonthlyAttendanceDraftFromPayrollEmployee(
  employee: PayrollRunEmployee,
  fiscalYear: MonthlyAttendanceDraft['fiscalYear'],
  month: number,
  monthDays: MonthlyAttendanceDraft['monthDays'],
  previous: MonthlyAttendanceRecord | undefined,
): MonthlyAttendanceDraft {
  const workDaysChanged = Boolean(
    previous && previous.workedDays !== employee.payrollInput.workDays,
  );

  return {
    employeeId: employee.employeeId,
    personnelCode: employee.personnelCode,
    fiscalYear,
    month,
    monthDays,
    workedDays: employee.payrollInput.workDays,
    overtimeHours: employee.payrollInput.overtimeHours,
    nightShiftHours: employee.payrollInput.nightShiftHours,
    shiftWorkPattern: employee.payrollInput.shiftWorkPattern ?? previous?.shiftWorkPattern,
    holidayHours: employee.payrollInput.holidayHours,
    variableBonusRial: employee.payrollInput.variableBonusRial,
    annualWorkedDays: employee.payrollInput.annualWorkedDays,
    paidLeaveDays: employee.payrollInput.paidLeaveDays ?? previous?.paidLeaveDays,
    sickLeaveDays: employee.payrollInput.sickLeaveDays ?? 0,
    unpaidAbsenceDays: employee.payrollInput.unpaidAbsenceDays ?? 0,
    fridayHours: employee.payrollInput.fridayHours ?? 0,
    missionDays: employee.payrollInput.missionDays ?? 0,
    insuredBenefitsRial: employee.payrollInput.insuredBenefitsRial ?? 0,
    nonInsuredBenefitsRial: employee.payrollInput.nonInsuredBenefitsRial ?? 0,
    loanDeductionRial: employee.payrollInput.loanDeductionRial ?? 0,
    advanceDeductionRial: employee.payrollInput.advanceDeductionRial ?? 0,
    otherDeductionsRial: employee.payrollInput.otherDeductionsRial ?? 0,
    signedCorrectionRial: employee.payrollInput.signedCorrectionRial ?? 0,
    payslipId: employee.payrollInput.payslipId ??
      `${fiscalYear}-${String(month).padStart(2, '0')}-${employee.personnelCode}`,
    paymentDate: employee.payrollInput.paymentDate ?? '',
    reviewedUnpaidLeaveDays: workDaysChanged
      ? undefined
      : previous?.reviewedUnpaidLeaveDays,
    notes: employee.payrollInput.monthlyNotes ?? previous?.notes ?? '',
  };
}
