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
    if (unpaidLeaveDays <= 0) return employee;
    return {
      ...employee,
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
      holidayHours: attendance.holidayHours,
      variableBonusRial: attendance.variableBonusRial,
      annualWorkedDays: attendance.annualWorkedDays,
    },
    masterDataIssues: issues,
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
    holidayHours: employee.payrollInput.holidayHours,
    variableBonusRial: employee.payrollInput.variableBonusRial,
    annualWorkedDays: employee.payrollInput.annualWorkedDays,
    reviewedUnpaidLeaveDays: workDaysChanged
      ? undefined
      : previous?.reviewedUnpaidLeaveDays,
    notes: previous?.notes ?? '',
  };
}
