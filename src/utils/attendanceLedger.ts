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
  for (const field of [
    'paidLeaveDays',
    'sickLeaveDays',
    'unpaidAbsenceDays',
    'fridayHours',
    'missionDays',
    'insuredBenefitsRial',
    'nonInsuredBenefitsRial',
    'loanDeductionRial',
    'advanceDeductionRial',
    'otherDeductionsRial',
  ] as const) {
    const value = record[field];
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      add('INVALID_' + field.toUpperCase(), field, 'مقدار این ورودی باید عددی و غیرمنفی باشد.');
    }
  }
  if (
    record.signedCorrectionRial !== undefined &&
    !Number.isFinite(record.signedCorrectionRial)
  ) {
    add('INVALID_SIGNED_CORRECTION', 'signedCorrectionRial', 'اصلاح حقوق باید عددی معتبر و می‌تواند مثبت یا منفی باشد.');
  }
  for (const field of ['paidLeaveDays', 'sickLeaveDays', 'unpaidAbsenceDays', 'missionDays'] as const) {
    const value = record[field];
    if (value !== undefined && value > record.monthDays) {
      add('INVALID_' + field.toUpperCase(), field, 'تعداد روز این ورودی نمی‌تواند از طول ماه بیشتر باشد.');
    }
  }
  if (record.payslipId !== undefined && record.payslipId.trim().length > 80) {
    add('INVALID_PAYSLIP_ID', 'payslipId', 'شناسه فیش نمی‌تواند بیش از ۸۰ نویسه باشد.');
  }
  if (record.reviewedUnpaidLeaveDays !== undefined &&
      (!Number.isFinite(record.reviewedUnpaidLeaveDays) || record.reviewedUnpaidLeaveDays < 0 || record.reviewedUnpaidLeaveDays > record.monthDays)) {
    add('INVALID_REVIEWED_UNPAID_LEAVE_DAYS', 'reviewedUnpaidLeaveDays', 'روزهای مرخصی بدون حقوق تأییدشده باید بین صفر و طول ماه باشد.');
  }
  if (!Number.isInteger(record.annualWorkedDays) || record.annualWorkedDays < 0 || record.annualWorkedDays > 366) {
    add('INVALID_ANNUAL_WORKED_DAYS', 'annualWorkedDays', 'کارکرد سالانه باید عددی بین صفر تا ۳۶۶ باشد.');
  }
  return issues;
}

export function createAttendanceId(employeeId: string, fiscalYear: string, month: number): string {
  return [employeeId, fiscalYear, String(month).padStart(2, '0')].join(':');
}


/**
 * A non-zero unpaid-leave entry must be explicitly reconciled with the
 * attendance/payroll-day input. The ledger does not deduct the days itself.
 */
export function getUnpaidLeavePayrollReviewIssue(
  unpaidLeaveUsedDays: number,
  reviewedUnpaidLeaveDays?: number
): AttendanceIssue | null {
  if (!Number.isFinite(unpaidLeaveUsedDays) || unpaidLeaveUsedDays <= 0) return null;
  const expected = Math.round(unpaidLeaveUsedDays * 100) / 100;
  const reviewed = reviewedUnpaidLeaveDays === undefined
    ? undefined
    : Math.round(reviewedUnpaidLeaveDays * 100) / 100;
  if (reviewed === expected) return null;
  return {
    code: 'UNPAID_LEAVE_REVIEW_REQUIRED',
    field: 'reviewedUnpaidLeaveDays',
    message: `در دفتر مرخصی ${expected} روز مرخصی بدون حقوق ثبت شده است. روزهای کارکرد/پرداختی را با سوابق تطبیق دهید و در دفتر کارکرد همین تعداد روز را صریحاً تأیید کنید. سامانه این روزها را خودکار از حقوق کم نمی‌کند.`,
  };
}
