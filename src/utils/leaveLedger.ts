import type { MonthlyLeaveDraft } from '../types/leave';

export interface LeaveIssue {
  code: string;
  field: keyof MonthlyLeaveDraft;
  message: string;
}

export function calculateLeaveClosingBalance(record: Pick<MonthlyLeaveDraft,
  'openingBalanceDays' | 'accruedDays' | 'paidLeaveUsedDays' | 'adjustmentDays'
>): number {
  return Math.round((record.openingBalanceDays + record.accruedDays
    - record.paidLeaveUsedDays + record.adjustmentDays) * 100) / 100;
}

export function validateMonthlyLeave(record: MonthlyLeaveDraft): LeaveIssue[] {
  const issues: LeaveIssue[] = [];
  const add = (code: string, field: keyof MonthlyLeaveDraft, message: string) =>
    issues.push({ code, field, message });

  if (!record.employeeId.trim()) add('EMPLOYEE_REQUIRED', 'employeeId', 'انتخاب کارمند الزامی است.');
  if (!record.personnelCode.trim()) add('PERSONNEL_CODE_REQUIRED', 'personnelCode', 'کد پرسنلی الزامی است.');
  if (!Number.isInteger(record.month) || record.month < 1 || record.month > 12) {
    add('INVALID_MONTH', 'month', 'ماه باید بین ۱ تا ۱۲ باشد.');
  }
  for (const field of ['openingBalanceDays', 'accruedDays', 'paidLeaveUsedDays', 'unpaidLeaveUsedDays'] as const) {
    if (!Number.isFinite(record[field]) || record[field] < 0) {
      add('INVALID_' + field.toUpperCase(), field, 'تعداد روز باید عددی معتبر و غیرمنفی باشد.');
    }
  }
  if (!Number.isFinite(record.adjustmentDays)) {
    add('INVALID_ADJUSTMENT', 'adjustmentDays', 'تعدیل باید عددی معتبر باشد.');
  }
  const closing = calculateLeaveClosingBalance(record);
  if (closing < 0) {
    add('NEGATIVE_LEAVE_BALANCE', 'paidLeaveUsedDays', 'مرخصی باحقوق استفاده‌شده از مانده قابل دسترس بیشتر است.');
  }
  return issues;
}

export function createLeaveId(employeeId: string, fiscalYear: string, month: number): string {
  return [employeeId, fiscalYear, String(month).padStart(2, '0')].join(':');
}

export function getSuggestedLeaveOpeningBalance(
  records: Array<{ month: number; closingBalanceDays: number }>,
  month: number,
  initialOpeningBalanceDays = 0,
): number {
  const previous = records
    .filter(record => record.month < month)
    .sort((a, b) => b.month - a.month)[0];
  return previous?.closingBalanceDays ?? initialOpeningBalanceDays;
}
