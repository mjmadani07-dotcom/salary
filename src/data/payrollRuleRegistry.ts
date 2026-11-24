export type FiscalYear = '1405' | '1404';

export interface TaxBracket {
  id: string;
  label: string;
  minMonthlyRial: number;
  maxMonthlyRial: number | null;
  rate: number;
}

export interface YearRegulation {
  year: FiscalYear;
  label: string;
  minDailyWageRial: number;
  minMonthlyWage30Rial: number;
  housingAllowanceRial: number;
  workerCouponRial: number;
  marriageAllowanceRial: number;
  childAllowancePerChildRial: number;
  baseSeniorityDaily1YrRial: number;
  baseSeniorityMonthly1YrRial: number;
  otherLevelsIncreaseRate: number;
  otherLevelsDailyFixedIncreaseRial: number;
  insuranceEmployeeRate: number;
  insuranceEmployerBaseRate: number;
  unemploymentInsuranceRate: number;
  insuranceCeilingMultiplier: number;
  taxMonthlyExemptionRial: number;
  taxAnnualExemptionRial: number;
  eidTaxExemptionCapRial: number;
  taxBrackets: TaxBracket[];
}

export type RuleApprovalStatus = 'pending-legal-review' | 'approved' | 'superseded';

export interface PayrollRuleSet {
  id: string;
  version: number;
  year: FiscalYear;
  calendar: 'jalali';
  effectiveFromJalali: string;
  effectiveToJalali: string | null;
  approvalStatus: RuleApprovalStatus;
  regulations: YearRegulation;
  sourceRefs: string[];
  reviewNotes: string[];
}

export const RULE_SETS: Record<FiscalYear, PayrollRuleSet> = {
  '1405': {
    id: 'IR-LABOR-PAYROLL-1405',
    version: 1,
    year: '1405',
    calendar: 'jalali',
    effectiveFromJalali: '1405-01-01',
    effectiveToJalali: null,
    approvalStatus: 'pending-legal-review',
    sourceRefs: ['SRC-001', 'SRC-003', 'SRC-004', 'SRC-005', 'SRC-008', 'SRC-009', 'SRC-010', 'SRC-011'],
    reviewNotes: [
      'Amounts and brackets are the current application baseline and must be reconciled against the final official circulars before operational approval.',
      'Tax treatment of welfare benefits must follow the applicable 1405 tax circular and its limits; see SRC-008.',
      'Eid tax treatment, non-cash benefits, special insurance groups and employer exemptions require separate legal review.',
      'The 1405 RuleSet is not legally approved by this application release.',
    ],
    regulations: {
      year: '1405',
      label: 'مصوبه سال ۱۴۰۵',
      minDailyWageRial: 5_541_850,
      minMonthlyWage30Rial: 166_255_500,
      housingAllowanceRial: 30_000_000,
      workerCouponRial: 22_000_000,
      marriageAllowanceRial: 5_000_000,
      childAllowancePerChildRial: 16_625_550,
      baseSeniorityDaily1YrRial: 166_667,
      baseSeniorityMonthly1YrRial: 5_000_000,
      otherLevelsIncreaseRate: 0.45,
      otherLevelsDailyFixedIncreaseRial: 519_549,
      insuranceEmployeeRate: 0.07,
      insuranceEmployerBaseRate: 0.20,
      unemploymentInsuranceRate: 0.03,
      insuranceCeilingMultiplier: 7,
      taxMonthlyExemptionRial: 400_000_000,
      taxAnnualExemptionRial: 4_800_000_000,
      eidTaxExemptionCapRial: 400_000_000,
      taxBrackets: [
        { id: 'b0', label: 'پله معافیت پایه', minMonthlyRial: 0, maxMonthlyRial: 400_000_000, rate: 0 },
        { id: 'b1', label: 'پله اول (۱۰٪)', minMonthlyRial: 400_000_000, maxMonthlyRial: 800_000_000, rate: 0.10 },
        { id: 'b2', label: 'پله دوم (۱۵٪)', minMonthlyRial: 800_000_000, maxMonthlyRial: 1_000_000_000, rate: 0.15 },
        { id: 'b3', label: 'پله سوم (۲۰٪)', minMonthlyRial: 1_000_000_000, maxMonthlyRial: 1_200_000_000, rate: 0.20 },
        { id: 'b4', label: 'پله چهارم (۲۵٪)', minMonthlyRial: 1_200_000_000, maxMonthlyRial: 1_400_000_000, rate: 0.25 },
        { id: 'b5', label: 'پله پنجم (۳۰٪)', minMonthlyRial: 1_400_000_000, maxMonthlyRial: null, rate: 0.30 },
      ],
    },
  },
  '1404': {
    id: 'IR-LABOR-PAYROLL-1404',
    version: 1,
    year: '1404',
    calendar: 'jalali',
    effectiveFromJalali: '1404-01-01',
    effectiveToJalali: null,
    approvalStatus: 'pending-legal-review',
    sourceRefs: ['SRC-007', 'SRC-009', 'SRC-010', 'SRC-011'],
    reviewNotes: [
      'Retained for historical calculations. The complete official source pack for 1404 has not yet been attached to this RuleSet.',
      'The 1404 RuleSet is not legally approved by this application release.',
    ],
    regulations: {
      year: '1404',
      label: 'مصوبه سال ۱۴۰۴',
      minDailyWageRial: 3_463_656,
      minMonthlyWage30Rial: 103_909_680,
      housingAllowanceRial: 9_000_000,
      workerCouponRial: 22_000_000,
      marriageAllowanceRial: 5_000_000,
      childAllowancePerChildRial: 10_390_968,
      baseSeniorityDaily1YrRial: 94_000,
      baseSeniorityMonthly1YrRial: 2_820_000,
      otherLevelsIncreaseRate: 0.32,
      otherLevelsDailyFixedIncreaseRial: 310_535,
      insuranceEmployeeRate: 0.07,
      insuranceEmployerBaseRate: 0.20,
      unemploymentInsuranceRate: 0.03,
      insuranceCeilingMultiplier: 7,
      taxMonthlyExemptionRial: 240_000_000,
      taxAnnualExemptionRial: 2_880_000_000,
      eidTaxExemptionCapRial: 240_000_000,
      taxBrackets: [
        { id: 'b0', label: 'پله معافیت پایه', minMonthlyRial: 0, maxMonthlyRial: 240_000_000, rate: 0 },
        { id: 'b1', label: 'پله اول (۱۰٪)', minMonthlyRial: 240_000_000, maxMonthlyRial: 300_000_000, rate: 0.10 },
        { id: 'b2', label: 'پله دوم (۱۵٪)', minMonthlyRial: 300_000_000, maxMonthlyRial: 380_000_000, rate: 0.15 },
        { id: 'b3', label: 'پله سوم (۲۰٪)', minMonthlyRial: 380_000_000, maxMonthlyRial: 500_000_000, rate: 0.20 },
        { id: 'b4', label: 'پله چهارم (۲۵٪)', minMonthlyRial: 500_000_000, maxMonthlyRial: 666_666_667, rate: 0.25 },
        { id: 'b5', label: 'پله پنجم (۳۰٪)', minMonthlyRial: 666_666_667, maxMonthlyRial: null, rate: 0.30 },
      ],
    },
  },
};

export function getPayrollRuleSet(year: FiscalYear): PayrollRuleSet {
  const ruleSet = RULE_SETS[year];
  if (!ruleSet) {
    throw new Error(`No payroll RuleSet is registered for fiscal year: ${year}`);
  }

  const issues = validatePayrollRuleSet(ruleSet);
  if (issues.length > 0) {
    const summary = issues.map((issue) => `${issue.code}: ${issue.message}`).join('; ');
    throw new Error(`Payroll RuleSet ${ruleSet.id} is invalid: ${summary}`);
  }

  return ruleSet;
}

export function listPayrollRuleSets(): PayrollRuleSet[] {
  return Object.values(RULE_SETS);
}

export interface RuleSetValidationIssue {
  code: string;
  message: string;
}

export function validatePayrollRuleSet(
  ruleSet: PayrollRuleSet
): RuleSetValidationIssue[] {
  const issues: RuleSetValidationIssue[] = [];
  const reg = ruleSet.regulations;

  const numericValues: Array<[string, number]> = [
    ['minDailyWageRial', reg.minDailyWageRial],
    ['minMonthlyWage30Rial', reg.minMonthlyWage30Rial],
    ['housingAllowanceRial', reg.housingAllowanceRial],
    ['workerCouponRial', reg.workerCouponRial],
    ['marriageAllowanceRial', reg.marriageAllowanceRial],
    ['childAllowancePerChildRial', reg.childAllowancePerChildRial],
    ['baseSeniorityDaily1YrRial', reg.baseSeniorityDaily1YrRial],
    ['otherLevelsIncreaseRate', reg.otherLevelsIncreaseRate],
    ['otherLevelsDailyFixedIncreaseRial', reg.otherLevelsDailyFixedIncreaseRial],
    ['insuranceEmployeeRate', reg.insuranceEmployeeRate],
    ['insuranceEmployerBaseRate', reg.insuranceEmployerBaseRate],
    ['unemploymentInsuranceRate', reg.unemploymentInsuranceRate],
    ['insuranceCeilingMultiplier', reg.insuranceCeilingMultiplier],
    ['taxMonthlyExemptionRial', reg.taxMonthlyExemptionRial],
    ['taxAnnualExemptionRial', reg.taxAnnualExemptionRial],
    ['eidTaxExemptionCapRial', reg.eidTaxExemptionCapRial],
  ];

  for (const [name, value] of numericValues) {
    if (!Number.isFinite(value) || value < 0) {
      issues.push({
        code: 'INVALID_NUMERIC_PARAMETER',
        message: `${name} must be a finite non-negative number.`,
      });
    }
  }

  for (const [name, rate] of [
    ['insuranceEmployeeRate', reg.insuranceEmployeeRate],
    ['insuranceEmployerBaseRate', reg.insuranceEmployerBaseRate],
    ['unemploymentInsuranceRate', reg.unemploymentInsuranceRate],
    ['otherLevelsIncreaseRate', reg.otherLevelsIncreaseRate],
  ] as Array<[string, number]>) {
    if (rate < 0 || rate > 1) {
      issues.push({
        code: 'INVALID_RATE',
        message: `${name} must be between 0 and 1.`,
      });
    }
  }

  if (reg.minMonthlyWage30Rial !== reg.minDailyWageRial * 30) {
    issues.push({
      code: 'MINIMUM_MONTHLY_WAGE_MISMATCH',
      message: 'The 30-day minimum monthly wage must equal 30 times the daily minimum wage.',
    });
  }

  if (reg.taxAnnualExemptionRial !== reg.taxMonthlyExemptionRial * 12) {
    issues.push({
      code: 'ANNUAL_MONTHLY_TAX_EXEMPTION_MISMATCH',
      message: 'Annual tax exemption must equal twelve times the monthly exemption.',
    });
  }

  if (reg.childAllowancePerChildRial !== reg.minDailyWageRial * 3) {
    issues.push({
      code: 'CHILD_ALLOWANCE_MISMATCH',
      message: 'The configured per-child allowance must equal three times the daily minimum wage.',
    });
  }

  if (!reg.taxBrackets.length || reg.taxBrackets[0].minMonthlyRial !== 0) {
    issues.push({
      code: 'INVALID_TAX_BRACKET_START',
      message: 'Tax brackets must start at zero.',
    });
  }

  for (let index = 0; index < reg.taxBrackets.length; index += 1) {
    const bracket = reg.taxBrackets[index];
    const upper = bracket.maxMonthlyRial;

    if (!Number.isFinite(bracket.minMonthlyRial) || bracket.minMonthlyRial < 0) {
      issues.push({
        code: 'INVALID_TAX_BRACKET_MIN',
        message: `Tax bracket ${bracket.id} has an invalid lower bound.`,
      });
    }

    if (upper !== null && (!Number.isFinite(upper) || upper <= bracket.minMonthlyRial)) {
      issues.push({
        code: 'INVALID_TAX_BRACKET_MAX',
        message: `Tax bracket ${bracket.id} must have an upper bound greater than its lower bound.`,
      });
    }

    if (bracket.rate < 0 || bracket.rate > 1) {
      issues.push({
        code: 'INVALID_TAX_BRACKET_RATE',
        message: `Tax bracket ${bracket.id} rate must be between 0 and 1.`,
      });
    }

    const next = reg.taxBrackets[index + 1];
    if (next && upper !== null && next.minMonthlyRial !== upper) {
      issues.push({
        code: 'NON_CONTIGUOUS_TAX_BRACKETS',
        message: `Tax bracket ${bracket.id} must end where bracket ${next.id} begins.`,
      });
    }

    if (next && next.rate < bracket.rate) {
      issues.push({
        code: 'NON_PROGRESSIVE_TAX_RATES',
        message: 'Tax bracket rates must not decrease as taxable income increases.',
      });
    }

    if (index === reg.taxBrackets.length - 1 && upper !== null) {
      issues.push({
        code: 'TAX_BRACKETS_MISSING_OPEN_ENDED_TOP',
        message: 'The final tax bracket must have a null upper bound.',
      });
    }
  }

  if (!ruleSet.sourceRefs.length) {
    issues.push({
      code: 'MISSING_LEGAL_SOURCES',
      message: 'A RuleSet must reference at least one legal source record.',
    });
  }

  return issues;
}
