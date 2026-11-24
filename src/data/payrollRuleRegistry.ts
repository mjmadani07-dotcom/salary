import { FiscalYear, YEAR_REGULATIONS, YearRegulation } from './payrollRegulations';

export type RuleApprovalStatus = 'pending-legal-review' | 'approved' | 'superseded';

export interface PayrollRuleSet {
  id: string;
  version: number;
  year: FiscalYear;
  calendar: 'jalali';
  approvalStatus: RuleApprovalStatus;
  regulations: YearRegulation;
  sourceRefs: string[];
  reviewNotes: string[];
}

const RULE_SET_METADATA: Record<
  FiscalYear,
  Omit<PayrollRuleSet, 'regulations'>
> = {
  '1405': {
    id: 'IR-LABOR-PAYROLL-1405',
    version: 1,
    year: '1405',
    calendar: 'jalali',
    approvalStatus: 'pending-legal-review',
    sourceRefs: ['SRC-001', 'SRC-003', 'SRC-004', 'SRC-005', 'SRC-008', 'SRC-009', 'SRC-010', 'SRC-011'],
    reviewNotes: [
      'Amounts and brackets are the current application baseline and must be reconciled against the final official circulars before operational approval.',
      'Tax treatment of welfare benefits must follow the applicable 1405 tax circular and its limits; see SRC-008.',
      'Eid tax treatment, non-cash benefits, special insurance groups and employer exemptions require separate legal review.',
      'The 1405 RuleSet is not legally approved by this application release.',
    ],
  },
  '1404': {
    id: 'IR-LABOR-PAYROLL-1404',
    version: 1,
    year: '1404',
    calendar: 'jalali',
    approvalStatus: 'pending-legal-review',
    sourceRefs: ['SRC-007', 'SRC-009', 'SRC-010', 'SRC-011'],
    reviewNotes: [
      'Retained for historical calculations. The complete official source pack for 1404 has not yet been attached to this RuleSet.',
      'The 1404 RuleSet is not legally approved by this application release.',
    ],
  },
};

export function getPayrollRuleSet(year: FiscalYear): PayrollRuleSet {
  const metadata = RULE_SET_METADATA[year];
  const regulations = YEAR_REGULATIONS[year];

  if (!metadata || !regulations) {
    throw new Error(`No payroll RuleSet is registered for fiscal year: ${year}`);
  }

  return {
    ...metadata,
    regulations,
  };
}

export function listPayrollRuleSets(): PayrollRuleSet[] {
  return (Object.keys(RULE_SET_METADATA) as FiscalYear[]).map(getPayrollRuleSet);
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
