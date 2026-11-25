import type {
  DebtPeriod,
  DebtScheduleSummary,
  EmployeeDebtAccount,
  EmployeeDebtAccountDraft,
  EmployeeDebtRepayment,
  EmployeeDebtRepaymentDraft,
  EmployeeOtherDeductionDraft,
  DebtIssue,
} from '../types/employeeDebt';

function isJalaliDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= (month <= 6 ? 31 : 30);
}

function isValidPeriod(year: string, month: number): boolean {
  return /^\d{4}$/.test(year) && Number.isInteger(month) && month >= 1 && month <= 12;
}

function periodIndex(period: DebtPeriod): number {
  return Number(period.fiscalYear) * 12 + period.month - 1;
}

function datePeriod(date: string): DebtPeriod {
  return { fiscalYear: date.slice(0, 4), month: Number(date.slice(5, 7)) };
}

export function validateEmployeeDebtAccount(input: EmployeeDebtAccountDraft): DebtIssue[] {
  const issues: DebtIssue[] = [];
  const add = (code: string, field: string, message: string) => issues.push({ code, field, message });

  if (!input.employeeId.trim()) add('EMPLOYEE_REQUIRED', 'employeeId', 'انتخاب کارمند الزامی است.');
  if (!input.personnelCode.trim()) add('PERSONNEL_CODE_REQUIRED', 'personnelCode', 'کد پرسنلی الزامی است.');
  if (!input.employeeName.trim()) add('EMPLOYEE_NAME_REQUIRED', 'employeeName', 'نام کارمند الزامی است.');
  if (!['advance', 'loan'].includes(input.debtType)) add('INVALID_DEBT_TYPE', 'debtType', 'نوع بدهی معتبر نیست.');
  if (!Number.isSafeInteger(input.principalRial) || input.principalRial <= 0) {
    add('INVALID_PRINCIPAL', 'principalRial', 'اصل مساعده/وام باید مبلغ ریالی صحیح و بزرگ‌تر از صفر باشد.');
  }
  if (!isJalaliDate(input.issueDateJalali)) add('INVALID_ISSUE_DATE', 'issueDateJalali', 'تاریخ پرداخت باید به شکل 1405-01-01 باشد.');
  if (!input.purpose.trim()) add('PURPOSE_REQUIRED', 'purpose', 'علت یا موضوع پرداخت را ثبت کنید.');

  if (input.repaymentPlan === 'fixed-installment') {
    if (!Number.isSafeInteger(input.monthlyInstallmentRial) || (input.monthlyInstallmentRial ?? 0) <= 0) {
      add('INVALID_INSTALLMENT_AMOUNT', 'monthlyInstallmentRial', 'مبلغ قسط ماهانه باید مبلغ ریالی صحیح و بزرگ‌تر از صفر باشد.');
    }
    if (!input.firstDueFiscalYear || !isValidPeriod(input.firstDueFiscalYear, input.firstDueMonth ?? 0)) {
      add('INVALID_FIRST_DUE_PERIOD', 'firstDueMonth', 'سال و ماه شروع اقساط معتبر نیست.');
    }
    if (input.installmentLimit !== null &&
        (!Number.isInteger(input.installmentLimit) || input.installmentLimit <= 0)) {
      add('INVALID_INSTALLMENT_LIMIT', 'installmentLimit', 'تعداد اقساط باید عدد صحیح و بزرگ‌تر از صفر باشد.');
    }
    if (isJalaliDate(input.issueDateJalali) && input.firstDueFiscalYear &&
        isValidPeriod(input.firstDueFiscalYear, input.firstDueMonth ?? 0)) {
      const firstIssuePeriod = datePeriod(input.issueDateJalali);
      if (periodIndex({ fiscalYear: input.firstDueFiscalYear, month: input.firstDueMonth! }) <
          periodIndex(firstIssuePeriod)) {
        add('FIRST_DUE_BEFORE_ISSUE', 'firstDueMonth', 'شروع بازپرداخت نمی‌تواند قبل از ماه پرداخت مساعده/وام باشد.');
      }
    }
  } else if (input.repaymentPlan === 'manual') {
    if (input.monthlyInstallmentRial !== null || input.firstDueFiscalYear !== null ||
        input.firstDueMonth !== null || input.installmentLimit !== null) {
      add('MANUAL_PLAN_HAS_INSTALLMENTS', 'repaymentPlan', 'در بازپرداخت دستی نباید برنامه قسط ماهانه ثبت شود.');
    }
  } else {
    add('INVALID_REPAYMENT_PLAN', 'repaymentPlan', 'روش بازپرداخت معتبر نیست.');
  }
  return issues;
}

export function validateDebtRepayment(
  repayment: EmployeeDebtRepaymentDraft,
  account: EmployeeDebtAccount,
  priorRepayments: EmployeeDebtRepayment[] = []
): DebtIssue[] {
  const issues: DebtIssue[] = [];
  const add = (code: string, field: string, message: string) => issues.push({ code, field, message });
  if (!repayment.debtId || repayment.debtId !== account.debtId) add('DEBT_ACCOUNT_MISMATCH', 'debtId', 'این وصولی به حساب بدهی انتخاب‌شده تعلق ندارد.');
  if (repayment.employeeId !== account.employeeId) add('EMPLOYEE_DEBT_MISMATCH', 'employeeId', 'کارمند وصولی با صاحب بدهی مطابقت ندارد.');
  if (!Number.isSafeInteger(repayment.amountRial) || repayment.amountRial <= 0) {
    add('INVALID_REPAYMENT_AMOUNT', 'amountRial', 'مبلغ وصول باید مبلغ ریالی صحیح و بزرگ‌تر از صفر باشد.');
  }
  if (!isJalaliDate(repayment.repaymentDateJalali)) add('INVALID_REPAYMENT_DATE', 'repaymentDateJalali', 'تاریخ وصول معتبر نیست.');
  if (isJalaliDate(repayment.repaymentDateJalali) &&
      (repayment.fiscalYear !== repayment.repaymentDateJalali.slice(0, 4) ||
       repayment.month !== Number(repayment.repaymentDateJalali.slice(5, 7)))) {
    add('REPAYMENT_PERIOD_MISMATCH', 'fiscalYear', 'سال و ماه وصول باید با تاریخ شمسی وصول مطابقت داشته باشد.');
  }
  if (!['cash', 'bank', 'other'].includes(repayment.paymentMethod)) add('INVALID_PAYMENT_METHOD', 'paymentMethod', 'روش وصول معتبر نیست.');
  if (isJalaliDate(repayment.repaymentDateJalali) &&
      periodIndex(datePeriod(repayment.repaymentDateJalali)) <
      periodIndex(datePeriod(account.issueDateJalali))) {
    add('REPAYMENT_BEFORE_ISSUE', 'repaymentDateJalali', 'تاریخ وصول نمی‌تواند قبل از تاریخ پرداخت اصل بدهی باشد.');
  }
  const totalPaid = priorRepayments
    .filter(item => item.debtId === account.debtId)
    .reduce((sum, item) => sum + item.amountRial, 0);
  if (Number.isSafeInteger(repayment.amountRial) && repayment.amountRial > account.principalRial - totalPaid) {
    add('REPAYMENT_EXCEEDS_OUTSTANDING', 'amountRial', 'مبلغ وصول از مانده بدهی بیشتر است.');
  }
  return issues;
}

export function calculateDebtScheduleSummary(
  account: EmployeeDebtAccount,
  repayments: EmployeeDebtRepayment[],
  period: DebtPeriod
): DebtScheduleSummary {
  if (!isValidPeriod(period.fiscalYear, period.month)) throw new Error('دوره انتخاب‌شده معتبر نیست.');
  const currentIndex = periodIndex(period);
  const relevant = repayments.filter(item =>
    item.debtId === account.debtId &&
    periodIndex({ fiscalYear: item.fiscalYear, month: item.month }) <= currentIndex
  );
  const paidToDateRial = relevant.reduce((sum, item) => sum + item.amountRial, 0);
  const outstandingRial = Math.max(0, account.principalRial - paidToDateRial);

  if (account.repaymentPlan !== 'fixed-installment' ||
      !account.firstDueFiscalYear || !account.firstDueMonth ||
      !account.monthlyInstallmentRial) {
    return {
      outstandingRial,
      paidToDateRial,
      currentInstallmentRial: 0,
      overdueRial: 0,
      totalDueRial: 0,
      installmentNumber: null,
      installmentsRemaining: null,
    };
  }

  const firstDue = { fiscalYear: account.firstDueFiscalYear, month: account.firstDueMonth };
  const elapsed = currentIndex - periodIndex(firstDue);
  if (elapsed < 0 || outstandingRial <= 0) {
    return {
      outstandingRial, paidToDateRial, currentInstallmentRial: 0,
      overdueRial: 0, totalDueRial: 0, installmentNumber: null,
      installmentsRemaining: account.installmentLimit,
    };
  }

  const dueInstallments = Math.min(elapsed + 1, account.installmentLimit ?? Number.MAX_SAFE_INTEGER);
  if (dueInstallments <= 0) {
    return {
      outstandingRial, paidToDateRial, currentInstallmentRial: 0,
      overdueRial: 0, totalDueRial: 0, installmentNumber: null,
      installmentsRemaining: account.installmentLimit,
    };
  }

  const installment = account.monthlyInstallmentRial;
  const previousScheduled = Math.min(account.principalRial, installment * Math.max(0, dueInstallments - 1));
  const currentScheduled = Math.min(installment, Math.max(0, account.principalRial - previousScheduled));
  const paidBeforeCurrent = repayments
    .filter(item => item.debtId === account.debtId &&
      periodIndex({ fiscalYear: item.fiscalYear, month: item.month }) < currentIndex)
    .reduce((sum, item) => sum + item.amountRial, 0);
  const cumulativeScheduled = Math.min(account.principalRial, previousScheduled + currentScheduled);
  const remainingCumulativeDue = Math.max(0, cumulativeScheduled - paidToDateRial);
  const remainingPreviousDue = Math.max(0, previousScheduled - paidBeforeCurrent);
  const overdueRial = Math.min(remainingCumulativeDue, remainingPreviousDue);
  const currentInstallmentRial = Math.min(
    outstandingRial,
    currentScheduled,
    Math.max(0, remainingCumulativeDue - overdueRial)
  );
  const totalDueRial = Math.min(outstandingRial, overdueRial + currentInstallmentRial);
  const installmentsRemaining = account.installmentLimit === null
    ? null
    : Math.max(0, account.installmentLimit - dueInstallments);

  return {
    outstandingRial,
    paidToDateRial,
    currentInstallmentRial,
    overdueRial,
    totalDueRial,
    installmentNumber: dueInstallments,
    installmentsRemaining,
  };
}

export function validateOtherDeduction(input: EmployeeOtherDeductionDraft): DebtIssue[] {
  const issues: DebtIssue[] = [];
  if (!input.employeeId.trim()) issues.push({ code: 'EMPLOYEE_REQUIRED', field: 'employeeId', message: 'انتخاب کارمند الزامی است.' });
  if (!input.personnelCode.trim()) issues.push({ code: 'PERSONNEL_CODE_REQUIRED', field: 'personnelCode', message: 'کد پرسنلی الزامی است.' });
  if (!input.employeeName.trim()) issues.push({ code: 'EMPLOYEE_NAME_REQUIRED', field: 'employeeName', message: 'نام کارمند الزامی است.' });
  if (!isValidPeriod(input.fiscalYear, input.month)) issues.push({ code: 'INVALID_DEDUCTION_PERIOD', field: 'month', message: 'دوره کسور معتبر نیست.' });
  if (!input.title.trim()) issues.push({ code: 'TITLE_REQUIRED', field: 'title', message: 'عنوان کسور الزامی است.' });
  if (!Number.isSafeInteger(input.amountRial) || input.amountRial <= 0) issues.push({ code: 'INVALID_DEDUCTION_AMOUNT', field: 'amountRial', message: 'مبلغ کسور باید مبلغ ریالی صحیح و بزرگ‌تر از صفر باشد.' });
  if (input.reviewStatus === 'reviewed' && !input.authorizationReference.trim()) {
    issues.push({ code: 'AUTHORIZATION_REFERENCE_REQUIRED', field: 'authorizationReference', message: 'برای علامت‌گذاری کسور به‌عنوان بررسی‌شده، مرجع توافق یا مستند را ثبت کنید.' });
  }
  return issues;
}

export function createEmployeeDebtId(): string {
  return crypto.randomUUID();
}

export function createDebtRepaymentId(): string {
  return crypto.randomUUID();
}

export function createOtherDeductionId(): string {
  return crypto.randomUUID();
}
