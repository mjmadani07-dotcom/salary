import {
  CurrencyUnit,
  FiscalYear,
  TaxBracket,
} from '../data/payrollRegulations';
import { getPayrollRuleSet } from '../data/payrollRuleRegistry';
import {
  getPayrollPayItem,
  getPendingLegalReviewItems,
  PayrollPayItemLine,
  sumInsuranceBasis,
  sumOvertimeBase,
  sumTaxableIncome,
} from '../data/payrollPayItemCatalog';

export interface PayrollInput {
  year: FiscalYear;
  monthDays: 29 | 30 | 31;
  workDays: number;
  dailyBaseWageRial: number;
  dailySeniorityRial: number;
  housingAllowanceRial: number;
  workerCouponRial: number;
  isMarried: boolean;
  childrenCount: number;
  has720DaysInsurance: boolean;
  overtimeHours: number;
  nightShiftHours: number;
  holidayHours: number;
  variableBonusRial: number;
  /** Explicit Excel monthly inputs; optional for legacy saved payroll rows. */
  paidLeaveDays?: number;
  sickLeaveDays?: number;
  unpaidAbsenceDays?: number;
  fridayHours?: number;
  missionDays?: number;
  insuredBenefitsRial?: number;
  nonInsuredBenefitsRial?: number;
  loanDeductionRial?: number;
  advanceDeductionRial?: number;
  otherDeductionsRial?: number;
  /** Signed adjustment to gross earnings; negative values are valid. */
  signedCorrectionRial?: number;
  /** Employee-level flags from the employee master. Undefined is legacy behavior. */
  insuranceSubject?: boolean;
  taxSubject?: boolean;
  hourlyDivisor?: 220 | 191.6;
  // Annual Eid & Severance inputs
  annualWorkedDays: number;
  serviceYearsForSeverance: number;
  serviceExtraDaysForSeverance: number;
}

export interface PayrollInputIssue {
  field: keyof PayrollInput | 'year';
  code: string;
  message: string;
}

export class PayrollInputValidationError extends Error {
  readonly issues: PayrollInputIssue[];

  constructor(issues: PayrollInputIssue[]) {
    super('Payroll input validation failed.');
    this.name = 'PayrollInputValidationError';
    this.issues = issues;
  }
}

export function validatePayrollInput(input: PayrollInput): PayrollInputIssue[] {
  const issues: PayrollInputIssue[] = [];
  const add = (field: PayrollInputIssue['field'], code: string, message: string) => {
    issues.push({ field, code, message });
  };

  if (!['1404', '1405'].includes(input.year)) {
    add('year', 'UNSUPPORTED_FISCAL_YEAR', 'A registered fiscal year is required.');
  }

  if (![29, 30, 31].includes(input.monthDays)) {
    add('monthDays', 'INVALID_MONTH_LENGTH', 'Month length must be 29, 30 or 31 days.');
  }

  if (!Number.isFinite(input.workDays) || input.workDays < 0 || input.workDays > input.monthDays) {
    add('workDays', 'INVALID_WORK_DAYS', 'Work days must be between zero and the calendar month length.');
  }

  const nonNegativeFields: Array<keyof PayrollInput> = [
    'dailyBaseWageRial',
    'dailySeniorityRial',
    'housingAllowanceRial',
    'workerCouponRial',
    'childrenCount',
    'overtimeHours',
    'nightShiftHours',
    'holidayHours',
    'variableBonusRial',
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
    'annualWorkedDays',
    'serviceYearsForSeverance',
    'serviceExtraDaysForSeverance',
  ];

  for (const field of nonNegativeFields) {
    const value = input[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      add(field, 'INVALID_NON_NEGATIVE_NUMBER', `${String(field)} must be a finite non-negative number.`);
    }
  }

  if (
    input.signedCorrectionRial !== undefined &&
    (!Number.isFinite(input.signedCorrectionRial))
  ) {
    add('signedCorrectionRial', 'INVALID_SIGNED_CORRECTION', 'Signed payroll correction must be a finite number.');
  }

  if (!Number.isInteger(input.childrenCount)) {
    add('childrenCount', 'INVALID_CHILD_COUNT', 'Child count must be a whole number.');
  }

  if (input.annualWorkedDays > 366) {
    add('annualWorkedDays', 'INVALID_ANNUAL_WORK_DAYS', 'Annual worked days cannot exceed 366.');
  }

  if (!Number.isInteger(input.serviceYearsForSeverance)) {
    add('serviceYearsForSeverance', 'INVALID_SERVICE_YEARS', 'Completed service years must be a whole number.');
  }

  if (!Number.isInteger(input.serviceExtraDaysForSeverance) || input.serviceExtraDaysForSeverance > 364) {
    add('serviceExtraDaysForSeverance', 'INVALID_SERVICE_EXTRA_DAYS', 'Extra service days must be a whole number between zero and 364.');
  }

  if (input.hourlyDivisor !== undefined && input.hourlyDivisor !== 220 && input.hourlyDivisor !== 191.6) {
    add('hourlyDivisor', 'INVALID_HOURLY_DIVISOR', 'Hourly divisor must be one of the configured calculation bases.');
  }

  return issues;
}

export interface TaxStepBreakdown {
  bracketId: string;
  label: string;
  rate: number;
  sliceAmountRial: number;
  taxAmountRial: number;
}

export interface PayrollResult {
  ruleSetId: string;
  ruleSetVersion: number;
  ruleSetApprovalStatus: string;
  legalReviewRequiredItems: string[];
  payItemBreakdown: Array<{
    itemId: string;
    amountRial: number;
    insuranceBasisRial: number;
    taxableBasisRial: number;
  }>;

  // Earnings
  basePayRial: number;
  seniorityPayRial: number;
  housingPayRial: number;
  couponPayRial: number;
  marriagePayRial: number;
  childAllowancePayRial: number;
  hourlyNormalRateRial: number;
  overtimePayRial: number;
  nightShiftPayRial: number;
  holidayPayRial: number;
  fridayWorkPayRial: number;
  missionPayRial: number;
  insuredBenefitsRial: number;
  nonInsuredBenefitsRial: number;
  variableBonusRial: number;
  signedCorrectionRial: number;
  grossEarningsRial: number;

  // Insurance
  insuranceSubjectEarningsRial: number;
  insuranceMonthlyCeilingRial: number;
  cappedInsuranceBasisRial: number;
  employeeInsuranceRial: number; // 7%
  employerInsuranceBaseRial: number; // 20%
  unemploymentInsuranceRial: number; // 3%
  totalEmployerInsuranceRial: number; // 23%
  totalSocialSecurityRial: number; // 30%

  // Tax
  taxableIncomeRial: number;
  taxSteps: TaxStepBreakdown[];
  totalPayrollTaxRial: number;
  effectiveTaxRate: number;

  // Totals
  loanDeductionRial: number;
  advanceDeductionRial: number;
  otherDeductionsRial: number;
  manualDeductionsRial: number;
  totalDeductionsRial: number;
  netPayRial: number;
  totalEmployerCostRial: number; // Immediate cash + 23% insurance

  // CTC (True Cost to Company including monthly reserves)
  monthlyEidReserveRial: number;
  monthlySeveranceReserveRial: number;
  monthlyLeaveReserveRial: number;
  totalMonthlyReservesRial: number;
  ctcMonthlyRial: number;
  ctcAnnualRial: number;
  employerCostOverGrossRatio: number;
  employerMultiplierToNet: number;

  // Eid & Severance
  eidMinAnnualRial: number;
  eidMaxCapAnnualRial: number;
  eidPayableRial: number;
  eidTaxableExcessRial: number;
  eidEstimatedTaxRial: number;
  severancePayableRial: number;
}

export function calculateProgressiveTax(
  taxableIncomeRial: number,
  brackets: TaxBracket[]
): { totalTax: number; steps: TaxStepBreakdown[] } {
  const safeIncome = Math.max(0, Math.round(taxableIncomeRial));
  const steps: TaxStepBreakdown[] = [];
  let totalTax = 0;

  for (const bracket of brackets) {
    const upper = bracket.maxMonthlyRial ?? Infinity;
    if (safeIncome <= bracket.minMonthlyRial) {
      steps.push({
        bracketId: bracket.id,
        label: bracket.label,
        rate: bracket.rate,
        sliceAmountRial: 0,
        taxAmountRial: 0,
      });
      continue;
    }

    const slice = Math.min(safeIncome, upper) - bracket.minMonthlyRial;
    const taxForSlice = Math.round(slice * bracket.rate);
    totalTax += taxForSlice;

    steps.push({
      bracketId: bracket.id,
      label: bracket.label,
      rate: bracket.rate,
      sliceAmountRial: Math.round(slice),
      taxAmountRial: taxForSlice,
    });
  }

  return { totalTax, steps };
}

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const inputIssues = validatePayrollInput(input);
  if (inputIssues.length > 0) {
    throw new PayrollInputValidationError(inputIssues);
  }

  const ruleSet = getPayrollRuleSet(input.year);
  const reg = ruleSet.regulations;
  const clampedWorkDays = Math.max(0, Math.min(input.monthDays, input.workDays));
  const ratio = input.monthDays > 0 ? clampedWorkDays / input.monthDays : 0;

  // 1. Mandatory & Prorated Monthly Items
  const basePayRial = Math.round(input.dailyBaseWageRial * clampedWorkDays);
  const seniorityPayRial = Math.round(input.dailySeniorityRial * clampedWorkDays);
  const housingPayRial = Math.round(input.housingAllowanceRial * ratio);
  const couponPayRial = Math.round(input.workerCouponRial * ratio);
  const marriagePayRial = input.isMarried ? Math.round(reg.marriageAllowanceRial * ratio) : 0;

  const childAllowancePayRial =
    input.has720DaysInsurance && input.childrenCount > 0
      ? Math.round(input.childrenCount * reg.childAllowancePerChildRial * ratio)
      : 0;

  // 2. Hourly Rate & Overtime (30-day standard base / 220 hours, or optional 191.6)
  const divisor = input.hourlyDivisor ?? 220;
  const monthly30BaseAndSeniority = sumOvertimeBase([
    {
      itemId: 'base-salary',
      amountRial: input.dailyBaseWageRial * 30,
    },
    {
      itemId: 'base-seniority',
      amountRial: input.dailySeniorityRial * 30,
    },
  ]);
  const hourlyNormalRateRial = Math.round(monthly30BaseAndSeniority / divisor);

  const overtimePayRial = Math.round(
    input.overtimeHours * hourlyNormalRateRial * 1.4
  );
  const nightShiftPayRial = Math.round(
    input.nightShiftHours * hourlyNormalRateRial * 0.35
  );
  const holidayPayRial = Math.round(
    input.holidayHours * hourlyNormalRateRial * 1.4
  );
  const fridayHourlyRateRial = Math.round(
    (input.dailyBaseWageRial * 30) / divisor
  );
  const fridayWorkPayRial = Math.round(
    (input.fridayHours ?? 0) * fridayHourlyRateRial * reg.fridayWorkPremiumRate
  );
  const missionPayRial = Math.round(
    input.dailyBaseWageRial * (input.missionDays ?? 0)
  );
  const insuredBenefitsRial = Math.round(input.insuredBenefitsRial ?? 0);
  const nonInsuredBenefitsRial = Math.round(input.nonInsuredBenefitsRial ?? 0);
  const signedCorrectionRial = Math.round(input.signedCorrectionRial ?? 0);
  const variableBonusRial = Math.max(0, Math.round(input.variableBonusRial));

  const housingTaxableExcess = Math.max(
    0,
    housingPayRial - Math.round(reg.housingAllowanceRial * ratio)
  );
  const couponTaxableExcess = Math.max(
    0,
    couponPayRial - Math.round(reg.workerCouponRial * ratio)
  );

  const payItemLines: PayrollPayItemLine[] = [
    { itemId: 'base-salary', amountRial: basePayRial },
    { itemId: 'base-seniority', amountRial: seniorityPayRial },
    {
      itemId: 'housing-allowance',
      amountRial: housingPayRial,
      taxableAmountRial: housingTaxableExcess,
    },
    {
      itemId: 'worker-coupon',
      amountRial: couponPayRial,
      taxableAmountRial: couponTaxableExcess,
    },
    { itemId: 'marriage-allowance', amountRial: marriagePayRial },
    { itemId: 'child-allowance', amountRial: childAllowancePayRial },
    { itemId: 'overtime', amountRial: overtimePayRial },
    { itemId: 'night-shift', amountRial: nightShiftPayRial },
    { itemId: 'holiday-work', amountRial: holidayPayRial },
    { itemId: 'friday-work-premium', amountRial: fridayWorkPayRial },
    { itemId: 'mission-allowance', amountRial: missionPayRial },
    { itemId: 'insured-benefit', amountRial: insuredBenefitsRial },
    { itemId: 'non-insured-benefit', amountRial: nonInsuredBenefitsRial },
    { itemId: 'variable-bonus', amountRial: variableBonusRial },
    { itemId: 'signed-correction', amountRial: signedCorrectionRial },
  ];

  const grossEarningsRial = payItemLines.reduce((total, line) => {
    const definition = getPayrollPayItem(line.itemId);
    return definition.includedInMonthlyGross
      ? total + Math.max(0, Math.round(line.amountRial))
      : total;
  }, 0);

  // 3. Social Security Insurance: the central pay-item catalog controls inclusion.
  const insuranceSubjectEarningsRial = input.insuranceSubject === false
    ? 0
    : sumInsuranceBasis(payItemLines);

  const insuranceMonthlyCeilingRial =
    reg.minDailyWageRial * reg.insuranceCeilingMultiplier * input.monthDays;

  const cappedInsuranceBasisRial = Math.min(
    insuranceSubjectEarningsRial,
    insuranceMonthlyCeilingRial
  );

  const employeeInsuranceRial = Math.round(
    cappedInsuranceBasisRial * reg.insuranceEmployeeRate
  );
  const employerInsuranceBaseRial = Math.round(
    cappedInsuranceBasisRial * reg.insuranceEmployerBaseRate
  );
  const unemploymentInsuranceRial = Math.round(
    cappedInsuranceBasisRial * reg.unemploymentInsuranceRate
  );
  const totalEmployerInsuranceRial =
    employerInsuranceBaseRial + unemploymentInsuranceRial;
  const totalSocialSecurityRial =
    employeeInsuranceRial + totalEmployerInsuranceRial;

  // 4. Payroll Income Tax: tax treatment is controlled by the central pay-item catalog.
  const taxableIncomeRial = input.taxSubject === false
    ? 0
    : sumTaxableIncome(payItemLines);

  const { totalTax: totalPayrollTaxRial, steps: taxSteps } =
    calculateProgressiveTax(taxableIncomeRial, reg.taxBrackets);

  const effectiveTaxRate =
    taxableIncomeRial > 0 ? totalPayrollTaxRial / taxableIncomeRial : 0;

  const loanDeductionRial = Math.round(input.loanDeductionRial ?? 0);
  const advanceDeductionRial = Math.round(input.advanceDeductionRial ?? 0);
  const otherDeductionsRial = Math.round(input.otherDeductionsRial ?? 0);
  const manualDeductionsRial =
    loanDeductionRial + advanceDeductionRial + otherDeductionsRial;
  const totalDeductionsRial =
    employeeInsuranceRial + totalPayrollTaxRial + manualDeductionsRial;
  const netPayRial = grossEarningsRial - totalDeductionsRial;
  const totalEmployerCostRial = grossEarningsRial + totalEmployerInsuranceRial;

  // 5. Annual Eid & Severance Pay
  const eidMinAnnualRial = Math.round(input.dailyBaseWageRial * 60);
  const eidMaxCapAnnualRial = Math.round(reg.minDailyWageRial * 90);
  const effectiveAnnualEid = Math.min(eidMinAnnualRial, eidMaxCapAnnualRial);
  const clampedAnnualDays = Math.max(0, Math.min(366, input.annualWorkedDays));
  const eidPayableRial = Math.round((effectiveAnnualEid / 365) * clampedAnnualDays);

  const eidTaxableExcessRial = Math.max(
    0,
    eidPayableRial - reg.eidTaxExemptionCapRial
  );
  const eidEstimatedTaxRial = Math.round(eidTaxableExcessRial * 0.1);

  const totalServiceDays =
    Math.max(0, input.serviceYearsForSeverance) * 365 +
    Math.max(0, input.serviceExtraDaysForSeverance);
  const lastMonthlyBase30 =
    (input.dailyBaseWageRial + input.dailySeniorityRial) * 30;
  const severancePayableRial = Math.round(
    (lastMonthlyBase30 / 365) * totalServiceDays
  );

  // 6. CTC (Cost to Company) Monthly Reserves
  const monthlyEidReserveRial = Math.round((effectiveAnnualEid / 12) * ratio);
  const monthlySeveranceReserveRial = Math.round((lastMonthlyBase30 / 12) * ratio);
  // 26 work days annual leave (Article 64 Labor Law) = 2.16667 days/month
  const monthlyLeaveReserveRial = Math.round(
    (input.dailyBaseWageRial + input.dailySeniorityRial) * (26 / 12) * ratio
  );
  const totalMonthlyReservesRial =
    monthlyEidReserveRial +
    monthlySeveranceReserveRial +
    monthlyLeaveReserveRial;

  const ctcMonthlyRial = totalEmployerCostRial + totalMonthlyReservesRial;
  const ctcAnnualRial = ctcMonthlyRial * 12;
  const employerCostOverGrossRatio =
    grossEarningsRial > 0 ? ctcMonthlyRial / grossEarningsRial : 0;
  const employerMultiplierToNet =
    netPayRial > 0 ? ctcMonthlyRial / netPayRial : 0;

  const legalReviewRequiredItems = getPendingLegalReviewItems(payItemLines);
  if (ruleSet.approvalStatus !== 'approved') {
    legalReviewRequiredItems.unshift(
      `RuleSet ${ruleSet.id} is pending legal approval.`
    );
  }

  const payItemBreakdown = payItemLines.map((line) => {
    const definition = getPayrollPayItem(line.itemId);
    const insuranceBasisRial =
      definition.insuranceTreatment === 'included'
        ? Math.max(0, Math.round(line.amountRial))
        : 0;
    const taxableBasisRial =
      definition.taxTreatment === 'taxable'
        ? Math.max(0, Math.round(line.amountRial))
        : definition.taxTreatment === 'taxable-excess'
          ? Math.max(0, Math.round(line.taxableAmountRial ?? 0))
          : 0;

    return {
      itemId: line.itemId,
      amountRial: Math.max(0, Math.round(line.amountRial)),
      insuranceBasisRial,
      taxableBasisRial,
    };
  });

  return {
    ruleSetId: ruleSet.id,
    ruleSetVersion: ruleSet.version,
    ruleSetApprovalStatus: ruleSet.approvalStatus,
    legalReviewRequiredItems,
    payItemBreakdown,
    basePayRial,
    seniorityPayRial,
    housingPayRial,
    couponPayRial,
    marriagePayRial,
    childAllowancePayRial,
    hourlyNormalRateRial,
    overtimePayRial,
    nightShiftPayRial,
    holidayPayRial,
    fridayWorkPayRial,
    missionPayRial,
    insuredBenefitsRial,
    nonInsuredBenefitsRial,
    variableBonusRial,
    signedCorrectionRial,
    grossEarningsRial,
    insuranceSubjectEarningsRial,
    insuranceMonthlyCeilingRial,
    cappedInsuranceBasisRial,
    employeeInsuranceRial,
    employerInsuranceBaseRial,
    unemploymentInsuranceRial,
    totalEmployerInsuranceRial,
    totalSocialSecurityRial,
    taxableIncomeRial,
    taxSteps,
    totalPayrollTaxRial,
    effectiveTaxRate,
    loanDeductionRial,
    advanceDeductionRial,
    otherDeductionsRial,
    manualDeductionsRial,
    totalDeductionsRial,
    netPayRial,
    totalEmployerCostRial,
    monthlyEidReserveRial,
    monthlySeveranceReserveRial,
    monthlyLeaveReserveRial,
    totalMonthlyReservesRial,
    ctcMonthlyRial,
    ctcAnnualRial,
    employerCostOverGrossRatio,
    employerMultiplierToNet,
    eidMinAnnualRial,
    eidMaxCapAnnualRial,
    eidPayableRial,
    eidTaxableExcessRial,
    eidEstimatedTaxRial,
    severancePayableRial,
  };
}

export function toPersianDigits(input: string | number): string {
  const persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(input).replace(/\d/g, (d) => persian[Number(d)]);
}

export function formatMoney(
  amountInRial: number,
  unit: CurrencyUnit,
  includeUnit = true
): string {
  const value = unit === 'toman' ? Math.round(amountInRial / 10) : Math.round(amountInRial);
  const formatted = new Intl.NumberFormat('fa-IR').format(value);
  if (!includeUnit) return formatted;
  return `${formatted} ${unit === 'toman' ? 'تومان' : 'ریال'}`;
}

export function formatPercentFa(rate: number): string {
  return `${toPersianDigits((rate * 100).toFixed(1).replace(/\.0$/, ''))}٪`;
}
