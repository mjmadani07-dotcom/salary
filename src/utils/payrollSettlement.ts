import { getPayrollRuleSet } from '../data/payrollRuleRegistry';
import { calculateServiceDurationJalali, isJalaliDate } from './employeeMaster';
import type {
  PayrollSettlementCalculationResult,
  PayrollSettlementInput,
  PayrollSettlementStatus,
} from '../types/payrollSettlement';

export interface PayrollSettlementIssue {
  code: string;
  field: keyof PayrollSettlementInput | 'serviceDuration';
  message: string;
}

export interface PayrollSettlementCalculation {
  issues: PayrollSettlementIssue[];
  warnings: string[];
  result?: PayrollSettlementCalculationResult;
}

const NON_NEGATIVE_FIELDS: Array<keyof PayrollSettlementInput> = [
  'monthsWorkedInYear',
  'annualWorkedDays',
  'eidDailyWageBasisRial',
  'severanceMonthlyWageBasisRial',
  'leaveBalanceDays',
  'leaveDailyBasisRial',
  'eidAdvancePaidRial',
  'priorSeverancePaidRial',
  'otherClaimsRial',
  'approvedDeductionsRial',
];

function isValidJalaliDate(value: string): boolean {
  return isJalaliDate(value);
}

export function calculatePayrollSettlement(
  input: PayrollSettlementInput
): PayrollSettlementCalculation {
  const issues: PayrollSettlementIssue[] = [];
  const warnings: string[] = [];
  const add = (
    code: string,
    field: PayrollSettlementIssue['field'],
    message: string
  ) => issues.push({ code, field, message });

  if (!input.settlementId.trim()) add('SETTLEMENT_ID_REQUIRED', 'settlementId', 'شناسه پرونده تسویه الزامی است.');
  if (!input.employeeId.trim()) add('EMPLOYEE_REQUIRED', 'employeeId', 'کارمند پرونده تسویه مشخص نشده است.');
  if (!input.personnelCode.trim()) add('PERSONNEL_CODE_REQUIRED', 'personnelCode', 'کد پرسنلی الزامی است.');
  if (!input.employeeName.trim()) add('EMPLOYEE_NAME_REQUIRED', 'employeeName', 'نام کارمند الزامی است.');
  if (!isValidJalaliDate(input.hireDateJalali)) {
    add('INVALID_HIRE_DATE', 'hireDateJalali', 'تاریخ شروع همکاری معتبر نیست.');
  }
  if (!isValidJalaliDate(input.terminationDateJalali)) {
    add('INVALID_TERMINATION_DATE', 'terminationDateJalali', 'تاریخ خاتمه همکاری باید به شکل 1405-12-29 باشد.');
  }
  if (!Number.isInteger(input.monthsWorkedInYear) || input.monthsWorkedInYear < 0 || input.monthsWorkedInYear > 12) {
    add('INVALID_MONTHS_WORKED', 'monthsWorkedInYear', 'ماه کارکرد سال باید عدد صحیح بین صفر تا ۱۲ باشد.');
  }
  if (![365, 366].includes(input.annualCalendarDays)) {
    add('INVALID_ANNUAL_CALENDAR_DAYS', 'annualCalendarDays', 'طول سال باید ۳۶۵ یا ۳۶۶ روز باشد.');
  }
  if (!Number.isFinite(input.annualWorkedDays) || input.annualWorkedDays < 0 || input.annualWorkedDays > input.annualCalendarDays) {
    add('INVALID_ANNUAL_WORKED_DAYS', 'annualWorkedDays', 'روز کارکرد سال باید بین صفر و روزهای تقویمی سال باشد.');
  }
  for (const field of NON_NEGATIVE_FIELDS) {
    const value = input[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      add('INVALID_NON_NEGATIVE_AMOUNT', field, 'مقدار باید عددی معتبر و غیرمنفی باشد.');
    }
  }

  if (input.annualWorkedDays > 0 && input.monthsWorkedInYear === 0) {
    add('MONTHS_WORKED_REQUIRED', 'monthsWorkedInYear', 'ماه کارکرد سال باید مستقل از روز کارکرد ثبت شود.');
  }
  if (input.monthsWorkedInYear > 0 && input.annualWorkedDays === 0) {
    add('ANNUAL_DAYS_REQUIRED', 'annualWorkedDays', 'روز کارکرد سال باید مستقل از ماه کارکرد ثبت شود.');
  }

  if (input.annualWorkedDays > 0 && !input.eidWageBasisConfirmed) {
    add('EID_WAGE_BASIS_UNCONFIRMED', 'eidWageBasisConfirmed', 'مبنای مزد عیدی باید بررسی و تأیید شود.');
  }
  if (input.annualWorkedDays > 0 && input.eidDailyWageBasisRial <= 0) {
    add('EID_WAGE_BASIS_REQUIRED', 'eidDailyWageBasisRial', 'مزد روزانه مبنای عیدی باید بیشتر از صفر باشد.');
  }
  if (input.annualWorkedDays > 0 && !input.eidWageBasisReference.trim()) {
    add('EID_WAGE_REFERENCE_REQUIRED', 'eidWageBasisReference', 'منبع مبنای مزد عیدی (فیش/حکم/قرارداد) را ثبت کنید.');
  }

  if (!input.severanceWageBasisConfirmed) {
    add('SEVERANCE_WAGE_BASIS_UNCONFIRMED', 'severanceWageBasisConfirmed', 'مبنای حقوق پایان کار باید بررسی و تأیید شود.');
  }
  if (input.severanceMonthlyWageBasisRial <= 0) {
    add('SEVERANCE_WAGE_BASIS_REQUIRED', 'severanceMonthlyWageBasisRial', 'حقوق ماهانه مبنای سنوات باید بیشتر از صفر باشد.');
  }
  if (!input.severanceWageBasisReference.trim()) {
    add('SEVERANCE_WAGE_REFERENCE_REQUIRED', 'severanceWageBasisReference', 'منبع مبنای حقوق سنوات را ثبت کنید.');
  }

  if (!input.leaveBalanceConfirmed) {
    add('LEAVE_BALANCE_UNCONFIRMED', 'leaveBalanceConfirmed', 'مانده مرخصی باید با دفتر مرخصی تطبیق و تأیید شود.');
  }
  if (input.leaveBalanceDays > 0) {
    if (!input.leaveBasisConfirmed) {
      add('LEAVE_WAGE_BASIS_UNCONFIRMED', 'leaveBasisConfirmed', 'مبنای مزد بازخرید مرخصی باید بررسی و تأیید شود.');
    }
    if (input.leaveDailyBasisRial <= 0) {
      add('LEAVE_WAGE_BASIS_REQUIRED', 'leaveDailyBasisRial', 'مزد روزانه مبنای بازخرید مرخصی باید بیشتر از صفر باشد.');
    }
    if (!input.leaveBasisReference.trim()) {
      add('LEAVE_WAGE_REFERENCE_REQUIRED', 'leaveBasisReference', 'منبع مبنای بازخرید مرخصی را ثبت کنید.');
    }
  }

  if (input.eidAdvancePaidRial > 0 && !input.eidAdvanceReference.trim()) {
    add('EID_ADVANCE_REFERENCE_REQUIRED', 'eidAdvanceReference', 'برای عیدی پرداخت‌شده علی‌الحساب، شناسه فیش یا سند پرداخت الزامی است.');
  }
  if (input.priorSeverancePaidRial > 0 && !input.priorSeveranceReference.trim()) {
    add('PRIOR_SEVERANCE_REFERENCE_REQUIRED', 'priorSeveranceReference', 'برای سنوات پرداخت‌شده قبلی، سند و دوره پوشش الزامی است.');
  }
  if (input.otherClaimsRial > 0 && !input.otherClaimsDescription.trim()) {
    add('OTHER_CLAIMS_DESCRIPTION_REQUIRED', 'otherClaimsDescription', 'شرح سایر مطالبات الزامی است.');
  }
  if (input.approvedDeductionsRial > 0 && !input.deductionAuthorizationReference.trim()) {
    add('DEDUCTION_AUTHORIZATION_REQUIRED', 'deductionAuthorizationReference', 'برای کسر از تسویه، مجوز قانونی/قراردادی یا سند معتبر الزامی است.');
  }
  if (input.reason === 'work-related-incapacity' && !input.medicalCommissionReference.trim()) {
    add('MEDICAL_COMMISSION_REFERENCE_REQUIRED', 'medicalCommissionReference', 'اعمال ضریب دوبرابری ماده ۳۲ نیازمند شماره رأی کمیسیون پزشکی است.');
  }
  if (input.reason === 'other' && !input.legalBasisReference.trim()) {
    add('LEGAL_BASIS_REFERENCE_REQUIRED', 'legalBasisReference', 'برای علت خاتمه با عنوان سایر، مبنای حقوقی/قراردادی باید ثبت شود.');
  }

  let serviceDuration: ReturnType<typeof calculateServiceDurationJalali> | undefined;
  if (isValidJalaliDate(input.hireDateJalali) && isValidJalaliDate(input.terminationDateJalali)) {
    try {
      serviceDuration = calculateServiceDurationJalali(
        input.hireDateJalali,
        input.terminationDateJalali
      );
    } catch (error) {
      add('INVALID_SERVICE_DURATION', 'serviceDuration', error instanceof Error ? error.message : 'مدت سابقه قابل محاسبه نیست.');
    }
  }

  if (serviceDuration) {
    const ruleSet = getPayrollRuleSet(input.fiscalYear);
    const recognizedServiceYears =
      serviceDuration.completedYears + serviceDuration.additionalDays / 365;
    const eidAnnualMaximum = Math.min(
      input.eidDailyWageBasisRial * 60,
      ruleSet.regulations.minDailyWageRial * 90
    );
    const eidEntitlementRial = Math.round(
      eidAnnualMaximum * (input.annualWorkedDays / input.annualCalendarDays)
    );
    const eidAdvancePaidRial = Math.round(input.eidAdvancePaidRial);
    const eidBalanceRial = eidEntitlementRial - eidAdvancePaidRial;

    const severanceMultiplier = input.reason === 'work-related-incapacity' ? 2 : 1;
    const severanceEntitlementRial = Math.round(
      input.severanceMonthlyWageBasisRial * recognizedServiceYears * severanceMultiplier
    );
    const priorSeverancePaidRial = Math.round(input.priorSeverancePaidRial);
    const severanceBalanceRial = severanceEntitlementRial - priorSeverancePaidRial;
    const leaveEncashmentRial = Math.round(input.leaveBalanceDays * input.leaveDailyBasisRial);
    const otherClaimsRial = Math.round(input.otherClaimsRial);
    const totalGrossEntitlementRial =
      eidEntitlementRial + severanceEntitlementRial + leaveEncashmentRial + otherClaimsRial;
    const approvedDeductionsRial = Math.round(input.approvedDeductionsRial);
    const totalOffsetsRial =
      eidAdvancePaidRial + priorSeverancePaidRial + approvedDeductionsRial;
    const payableBeforeTaxRial = totalGrossEntitlementRial - totalOffsetsRial;

    if (eidBalanceRial < 0) {
      add('EID_ADVANCE_EXCEEDS_ENTITLEMENT', 'eidAdvancePaidRial', 'عیدی علی‌الحساب ثبت‌شده از استحقاق این سال بیشتر است؛ مغایرت را جداگانه بررسی کنید.');
    }
    if (severanceBalanceRial < 0) {
      add('PRIOR_SEVERANCE_EXCEEDS_ENTITLEMENT', 'priorSeverancePaidRial', 'سنوات پرداخت‌شده قبلی از استحقاق محاسبه‌شده بیشتر است؛ سابقه و دوره‌های تسویه را بررسی کنید.');
    }
    if (payableBeforeTaxRial < 0) {
      add('NEGATIVE_SETTLEMENT_PAYABLE', 'approvedDeductionsRial', 'کسورات و پرداخت‌های علی‌الحساب از کل مطالبات بیشتر شده‌اند؛ تسویه مسدود است.');
    }

    if (Math.abs(input.annualWorkedDays - input.monthsWorkedInYear * input.annualCalendarDays / 12) > 31) {
      warnings.push('ماه کارکرد و روز کارکرد سال اختلاف قابل توجه دارند؛ هر دو مقدار مستقل حفظ شده‌اند و مبنای تناسب عیدی، روزهای کارکرد است.');
    }
    if (input.leaveBalanceDays > 9) {
      warnings.push('مانده مرخصی بیش از ۹ روز است. سقف ذخیره سالانه ماده ۶۶ باید در دفتر مرخصی بررسی شود؛ برای خاتمه قرارداد، مانده تأییدشده به‌طور خودکار به ۹ روز محدود نشده است.');
    }
    if (input.reason === 'work-related-incapacity') {
      warnings.push('ضریب دوبرابری سنوات فقط با رأی معتبر کمیسیون پزشکی و انطباق وضعیت با ماده ۳۲ قابل اعمال است.');
    }
    warnings.push('مبلغ نهایی نمایش‌داده‌شده قبل از مالیات و کسورات قانونی احتمالی است؛ مالیات و بیمه تسویه در این نسخه محاسبه نشده‌اند.');
    warnings.push('مبنای مزد عیدی، سنوات و بازخرید مرخصی باید جداگانه با آخرین حکم/فیش و اجزای مشمول مربوط تطبیق داده شود.');
    if (ruleSet.approvalStatus !== 'approved') {
      warnings.unshift(`RuleSet ${ruleSet.id} هنوز تأیید حقوقی نهایی ندارد.`);
    }

    if (issues.length === 0) {
      return {
        issues,
        warnings,
        result: {
          ruleSetId: ruleSet.id,
          ruleSetVersion: ruleSet.version,
          ruleSetApprovalStatus: ruleSet.approvalStatus,
          completedServiceYears: serviceDuration.completedYears,
          additionalServiceDays: serviceDuration.additionalDays,
          recognizedServiceYears,
          eidMaximumBeforeProrationRial: Math.round(eidAnnualMaximum),
          eidEntitlementRial,
          eidAdvancePaidRial,
          eidBalanceRial,
          severanceMultiplier,
          severanceEntitlementRial,
          priorSeverancePaidRial,
          severanceBalanceRial,
          leaveEncashmentRial,
          otherClaimsRial,
          totalGrossEntitlementRial,
          approvedDeductionsRial,
          payableBeforeTaxRial,
          legalReviewRequiredItems: warnings,
        },
      };
    }
  }

  return { issues, warnings };
}


export function validatePayrollSettlementTransition(
  currentStatus: PayrollSettlementStatus | null,
  nextStatus: PayrollSettlementStatus
): string[] {
  if (currentStatus === null) {
    return nextStatus === 'draft'
      ? []
      : ['پرونده تسویه جدید باید ابتدا به‌صورت پیش‌نویس ذخیره شود.'];
  }
  const allowed: Record<PayrollSettlementStatus, PayrollSettlementStatus[]> = {
    draft: ['draft', 'ready-for-review', 'cancelled'],
    'ready-for-review': ['draft', 'ready-for-review', 'approved', 'cancelled'],
    approved: ['paid'],
    paid: [],
    cancelled: [],
  };
  return allowed[currentStatus].includes(nextStatus)
    ? []
    : [currentStatus === 'paid'
      ? 'پرونده پرداخت‌شده قابل تغییر نیست.'
      : currentStatus === 'approved'
        ? 'پرونده تأییدشده فقط با ثبت پرداخت می‌تواند تغییر وضعیت دهد.'
        : 'انتقال وضعیت پرونده تسویه مجاز نیست.'];
}

export function validatePayrollSettlementWorkflow(
  settlement: {
    status: string;
    calculation?: PayrollSettlementCalculationResult;
    approverName?: string;
    approvalReference?: string;
    paymentDate?: string;
    paymentReference?: string;
    paidAmountRial?: number;
    paymentDifferenceReason?: string;
  }
): string[] {
  const issues: string[] = [];
  if (settlement.status === 'approved' || settlement.status === 'paid') {
    if (!settlement.calculation) issues.push('برای تأیید، نتیجه محاسبه معتبر لازم است.');
    if (!settlement.approverName?.trim()) issues.push('نام تأییدکننده ثبت نشده است.');
    if (!settlement.approvalReference?.trim()) issues.push('شماره صورتجلسه/مجوز تأیید ثبت نشده است.');
  }
  if (settlement.status === 'paid') {
    if (!isValidJalaliDate(settlement.paymentDate ?? '')) issues.push('تاریخ پرداخت معتبر نیست.');
    if (!settlement.paymentReference?.trim()) issues.push('شماره سند یا مرجع پرداخت ثبت نشده است.');
    if (!Number.isFinite(settlement.paidAmountRial) || (settlement.paidAmountRial ?? -1) < 0) {
      issues.push('مبلغ پرداخت واقعی باید عددی معتبر و غیرمنفی باشد.');
    }
    if (
      settlement.calculation &&
      Math.round(settlement.paidAmountRial ?? 0) !== settlement.calculation.payableBeforeTaxRial &&
      !settlement.paymentDifferenceReason?.trim()
    ) {
      issues.push('مبلغ پرداخت واقعی با مبلغ قبل از مالیات/کسورات یکسان نیست؛ علت اختلاف را ثبت کنید.');
    }
  }
  return issues;
}
