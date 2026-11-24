import assert from 'node:assert/strict';
import test from 'node:test';

import { getPayrollRuleSet, listPayrollRuleSets, validatePayrollRuleSet } from '../data/payrollRuleRegistry';
import { calculatePayroll, calculateProgressiveTax, PayrollInput } from './payrollEngine';

function makeInput(overrides: Partial<PayrollInput> = {}): PayrollInput {
  return {
    year: '1405',
    monthDays: 30,
    workDays: 30,
    dailyBaseWageRial: 5_541_850,
    dailySeniorityRial: 0,
    housingAllowanceRial: 30_000_000,
    workerCouponRial: 22_000_000,
    isMarried: false,
    childrenCount: 0,
    has720DaysInsurance: false,
    overtimeHours: 0,
    nightShiftHours: 0,
    holidayHours: 0,
    variableBonusRial: 0,
    annualWorkedDays: 365,
    serviceYearsForSeverance: 1,
    serviceExtraDaysForSeverance: 0,
    ...overrides,
  };
}

test('all registered RuleSets pass structural validation', () => {
  const ruleSets = listPayrollRuleSets();
  assert.deepEqual(ruleSets.map((ruleSet) => ruleSet.year).sort(), ['1404', '1405']);

  for (const ruleSet of ruleSets) {
    assert.deepEqual(validatePayrollRuleSet(ruleSet), []);
  }
});

test('1405 RuleSet is explicitly pending legal approval', () => {
  const ruleSet = getPayrollRuleSet('1405');
  assert.equal(ruleSet.id, 'IR-LABOR-PAYROLL-1405');
  assert.equal(ruleSet.version, 1);
  assert.equal(ruleSet.approvalStatus, 'pending-legal-review');
  assert.equal(ruleSet.effectiveFromJalali, '1405-01-01');
  assert.equal(ruleSet.effectiveToJalali, null);
  assert.ok(ruleSet.sourceRefs.includes('SRC-003'));
});

test('progressive tax calculates only the slice within each bracket', () => {
  const ruleSet = getPayrollRuleSet('1405');
  const result = calculateProgressiveTax(900_000_000, ruleSet.regulations.taxBrackets);

  assert.equal(result.totalTax, 55_000_000);
  assert.equal(result.steps.reduce((sum, step) => sum + step.taxAmountRial, 0), 55_000_000);
});

test('minimum wage, gross pay, insurance and tax use catalog classifications', () => {
  const result = calculatePayroll(makeInput());

  assert.equal(result.basePayRial, 166_255_500);
  assert.equal(result.grossEarningsRial, 218_255_500);
  assert.equal(result.insuranceSubjectEarningsRial, 218_255_500);
  assert.equal(result.cappedInsuranceBasisRial, 218_255_500);
  assert.equal(result.employeeInsuranceRial, 15_277_885);
  assert.equal(result.taxableIncomeRial, 166_255_500);
  assert.equal(result.totalPayrollTaxRial, 0);
  assert.equal(
    result.legalReviewRequiredItems.includes('حق اولاد / کمک عائله‌مندی'),
    false
  );

  const childItem = result.payItemBreakdown.find((line) => line.itemId === 'child-allowance');
  assert.ok(childItem);
  assert.equal(childItem.insuranceBasisRial, 0);
  assert.equal(childItem.taxableBasisRial, 0);
});

test('overtime base is derived from catalog items and retains aggregate rounding', () => {
  const result = calculatePayroll(
    makeInput({
      dailyBaseWageRial: 10_000_000,
      dailySeniorityRial: 200_000,
      overtimeHours: 1,
    })
  );

  assert.equal(
    result.hourlyNormalRateRial,
    Math.round(((10_000_000 + 200_000) * 30) / 220)
  );
  assert.equal(
    result.overtimePayRial,
    Math.round(result.hourlyNormalRateRial * 1.4)
  );
});

test('insurance ceiling is applied to the 30-day monthly base', () => {
  const result = calculatePayroll(
    makeInput({ dailyBaseWageRial: 60_000_000 })
  );

  assert.equal(result.insuranceMonthlyCeilingRial, 1_163_788_500);
  assert.equal(result.cappedInsuranceBasisRial, 1_163_788_500);
  assert.equal(result.employeeInsuranceRial, Math.round(1_163_788_500 * 0.07));
  assert.equal(result.totalEmployerInsuranceRial, Math.round(1_163_788_500 * 0.23));
});

test('employee social insurance is not automatically deducted from taxable income', () => {
  const result = calculatePayroll(
    makeInput({ dailyBaseWageRial: 500_000_000 / 30 })
  );

  assert.equal(result.taxableIncomeRial, 500_000_000);
  assert.equal(result.employeeInsuranceRial > 0, true);
});

test('housing and coupon are taxed only above their configured exemption caps', () => {
  const result = calculatePayroll(
    makeInput({
      dailyBaseWageRial: 15_000_000,
      housingAllowanceRial: 40_000_000,
      workerCouponRial: 30_000_000,
    })
  );

  const housingLine = result.payItemBreakdown.find((line) => line.itemId === 'housing-allowance');
  const couponLine = result.payItemBreakdown.find((line) => line.itemId === 'worker-coupon');

  assert.ok(housingLine);
  assert.ok(couponLine);
  assert.equal(housingLine.taxableBasisRial, 10_000_000);
  assert.equal(couponLine.taxableBasisRial, 8_000_000);
  assert.equal(result.taxableIncomeRial, 468_000_000);
});

test('calculation result carries RuleSet identity and legal-review warnings', () => {
  const result = calculatePayroll(
    makeInput({
      isMarried: true,
      childrenCount: 1,
      has720DaysInsurance: true,
      overtimeHours: 2,
    })
  );

  assert.equal(result.ruleSetId, 'IR-LABOR-PAYROLL-1405');
  assert.equal(result.ruleSetVersion, 1);
  assert.equal(result.ruleSetApprovalStatus, 'pending-legal-review');
  assert.ok(result.legalReviewRequiredItems.some((item) => item.includes('pending legal approval')));
  assert.ok(result.legalReviewRequiredItems.includes('حق تأهل'));
  assert.ok(result.legalReviewRequiredItems.includes('حق اولاد / کمک عائله‌مندی'));
  assert.ok(result.legalReviewRequiredItems.includes('فوق‌العاده اضافه‌کاری'));
});
