import type { MonthlyAttendanceDraft } from '../types/attendance';

export interface AttendanceIssue {
  code: string;
  field: keyof MonthlyAttendanceDraft;
  message: string;
}

export function validateMonthlyAttendance(record: MonthlyAttendanceDraft): AttendanceIssue[] {
  const issues: AttendanceIssue[] = [];
  const add = (code: string, field: keyof MonthlyAttendanceDraft, message: string) =>
    issues.push({ code, field, message });

  if (!record.employeeId.trim()) add('EMPLOYEE_REQUIRED', 'employeeId', 'انتخاب کارمند الزامی است.');
  if (!record.personnelCode.trim()) add('PERSONNEL_CODE_REQUIRED', 'personnelCode', 'کد پرسنلی الزامی است.');
  if (!Number.isInteger(record.month) || record.month < 1 || record.month > 12) {
    add('INVALID_MONTH', 'month', 'ماه باید بین ۱ تا ۱۲ باشد.');
  }
  if (![29, 30, 31].includes(record.monthDays)) {
    add('INVALID_MONTH_LENGTH', 'monthDays', 'طول ماه باید ۲۹، ۳۰ یا ۳۱ روز باشد.');
  }
  if (!Number.isFinite(record.workedDays) || record.workedDays < 0 || record.workedDays > record.monthDays) {
    add('INVALID_WORKED_DAYS', 'workedDays', 'روزهای کارکرد باید بین صفر و طول ماه باشد.');
  }
  for (const field of ['overtimeHours', 'nightShiftHours', 'holidayHours', 'variableBonusRial'] as const) {
    if (!Number.isFinite(record[field]) || record[field] < 0) {
      add('INVALID_' + field.toUpperCase(), field, 'مقدار این قلم نمی‌تواند منفی یا نامعتبر باشد.');
    }
  }
  if (!Number.isInteger(record.annualWorkedDays) || record.annualWorkedDays < 0 || record.annualWorkedDays > 366) {
    add('INVALID_ANNUAL_WORKED_DAYS', 'annualWorkedDays', 'کارکرد سالانه باید عددی بین صفر تا ۳۶۶ باشد.');
  }
  return issues;
}

export function createAttendanceId(employeeId: string, fiscalYear: string, month: number): string {
  return [employeeId, fiscalYear, String(month).padStart(2, '0')].join(':');
}
