import assert from 'node:assert/strict';
import test from 'node:test';

import { getPayrollRuleSet, listPayrollRuleSets, validatePayrollRuleSet } from '../data/payrollRuleRegistry';
import { calculatePayroll, calculateProgressiveTax, validatePayrollInput } from './payrollEngine';
import { calculateOtherLevelsDailyWage } from './wageRules';
import type { PayrollInput } from './payrollEngine';

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
  assert.equal(ruleSet.regulations.fridayWorkPremiumRate, 0.4);
  assert.equal(ruleSet.regulations.hourlyDivisorDefault, 220);
  assert.equal(ruleSet.regulations.overtimeMultiplier, 1.4);
  assert.equal(ruleSet.regulations.nonShiftNightPremiumRate, 0.35);
  assert.equal(ruleSet.regulations.annualLeaveCarryoverCapDays, 9);
  assert.equal(ruleSet.regulations.monthsPerYear, 12);
  assert.equal(ruleSet.regulations.shiftWorkMorningEveningRate, 0.10);
  assert.equal(ruleSet.regulations.shiftWorkMorningEveningNightRate, 0.15);
  assert.equal(ruleSet.regulations.shiftWorkMorningNightRate, 0.225);
  assert.equal(ruleSet.regulations.shiftWorkEveningNightRate, 0.225);
  assert.equal(ruleSet.effectiveFromJalali, '1405-01-01');
  assert.equal(ruleSet.effectiveToJalali, null);
  assert.ok(ruleSet.sourceRefs.includes('SRC-003'));
  assert.ok(ruleSet.sourceRefs.includes('SRC-014'));
});

test('progressive tax calculates only the slice within each bracket', () => {
  const ruleSet = getPayrollRuleSet('1405');
  const result = calculateProgressiveTax(900_000_000, ruleSet.regulations.taxBrackets);

  assert.equal(result.totalTax, 55_000_000);
  assert.equal(result.steps.reduce((sum, step) => sum + step.taxAmountRial, 0), 55_000_000);
});

test('1405 monthly salary tax brackets match the published 40-million-toman exemption and progressive rates', () => {
  const ruleSet = getPayrollRuleSet('1405');
  const regulations = ruleSet.regulations;

  assert.equal(regulations.taxMonthlyExemptionRial, 400_000_000);
  assert.deepEqual(
    regulations.taxBrackets.map(({ minMonthlyRial, maxMonthlyRial, rate }) => ({
      minMonthlyRial, maxMonthlyRial, rate,
    })),
    [
      { minMonthlyRial: 0, maxMonthlyRial: 400_000_000, rate: 0 },
      { minMonthlyRial: 400_000_000, maxMonthlyRial: 800_000_000, rate: 0.10 },
      { minMonthlyRial: 800_000_000, maxMonthlyRial: 1_000_000_000, rate: 0.15 },
      { minMonthlyRial: 1_000_000_000, maxMonthlyRial: 1_200_000_000, rate: 0.20 },
      { minMonthlyRial: 1_200_000_000, maxMonthlyRial: 1_400_000_000, rate: 0.25 },
      { minMonthlyRial: 1_400_000_000, maxMonthlyRial: null, rate: 0.30 },
    ],
  );

  const result = calculateProgressiveTax(1_500_000_000, regulations.taxBrackets);
  assert.equal(result.totalTax, 190_000_000);
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

test('Friday premium uses the same base wage plus seniority hourly basis as overtime', () => {
  const result = calculatePayroll(makeInput({
    dailyBaseWageRial: 10_000_000,
    dailySeniorityRial: 200_000,
    housingAllowanceRial: 0,
    workerCouponRial: 0,
    fridayHours: 2,
  }));

  const expectedHourlyBasis = Math.round(((10_000_000 + 200_000) * 30) / 220);
  assert.equal(result.hourlyNormalRateRial, expectedHourlyBasis);
  assert.equal(result.fridayWorkPayRial, Math.round(2 * expectedHourlyBasis * 0.4));
});

test('rotating shift premiums use Article 56 rates and suppress the non-shift 35% night premium', () => {
  const base = {
    dailyBaseWageRial: 10_000_000,
    dailySeniorityRial: 1_000_000,
    housingAllowanceRial: 0,
    workerCouponRial: 0,
    nightShiftHours: 12,
  };
  const morningEvening = calculatePayroll(makeInput({ ...base, shiftWorkPattern: 'morning-evening' }));
  const morningEveningNight = calculatePayroll(makeInput({ ...base, shiftWorkPattern: 'morning-evening-night' }));
  const morningNight = calculatePayroll(makeInput({ ...base, shiftWorkPattern: 'morning-night' }));
  const eveningNight = calculatePayroll(makeInput({ ...base, shiftWorkPattern: 'evening-night' }));

  assert.equal(morningEvening.shiftWorkPremiumRial, 33_000_000);
  assert.equal(morningEveningNight.shiftWorkPremiumRial, 49_500_000);
  assert.equal(morningNight.shiftWorkPremiumRial, 74_250_000);
  assert.equal(eveningNight.shiftWorkPremiumRial, 74_250_000);
  assert.equal(morningEvening.nightShiftPayRial, 0);
  assert.equal(morningEveningNight.nightShiftPayRial, 0);
  assert.equal(morningNight.nightShiftPayRial, 0);
  assert.equal(eveningNight.nightShiftPayRial, 0);
});

test('non-shift and legacy rows retain the 35% hourly night premium without a shift allowance', () => {
  const input = makeInput({
    dailyBaseWageRial: 10_000_000,
    dailySeniorityRial: 200_000,
    nightShiftHours: 8,
    shiftWorkPattern: 'non-shift',
  });
  const nonShift = calculatePayroll(input);
  const legacy = calculatePayroll(makeInput({ ...input, shiftWorkPattern: undefined }));

  const expected = Math.round(nonShift.hourlyNormalRateRial * 8 * 0.35);
  assert.equal(nonShift.nightShiftPayRial, expected);
  assert.equal(legacy.nightShiftPayRial, expected);
  assert.equal(nonShift.shiftWorkPremiumRial, 0);
  assert.equal(legacy.shiftWorkPremiumRial, 0);
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

test('flags possible double counting when premium hour categories overlap', () => {
  const result = calculatePayroll(makeInput({
    overtimeHours: 4,
    holidayHours: 2,
    fridayHours: 3,
  }));

  assert.ok(result.legalReviewRequiredItems.some((item) =>
    item.includes('هم‌پوشانی زمانی')
  ));
  assert.ok(result.legalReviewRequiredItems.some((item) =>
    item.includes('تعطیل‌کاری عمومی همراه')
  ));
  assert.ok(result.legalReviewRequiredItems.some((item) =>
    item.includes('رضایت کارگر') && item.includes('مستند روزانه')
  ));
});

test('calculates separate Friday work, mission, benefit and signed correction inputs', () => {
  const result = calculatePayroll(makeInput({
    dailyBaseWageRial: 10_000_000,
    dailySeniorityRial: 0,
    housingAllowanceRial: 0,
    workerCouponRial: 0,
    fridayHours: 2,
    missionDays: 1,
    insuredBenefitsRial: 1_000_000,
    nonInsuredBenefitsRial: 2_000_000,
    signedCorrectionRial: -300_000,
    insuranceSubject: true,
    taxSubject: true,
  }));

  assert.equal(result.fridayWorkPayRial, 1_090_909);
  assert.equal(result.missionPayRial, 10_000_000);
  assert.equal(result.insuredBenefitsRial, 1_000_000);
  assert.equal(result.nonInsuredBenefitsRial, 2_000_000);
  assert.equal(result.signedCorrectionRial, -300_000);
  assert.equal(result.grossEarningsRial, 313_790_909);
  assert.equal(result.insuranceSubjectEarningsRial, 311_790_909);
  assert.equal(result.employeeInsuranceRial, 21_825_364);
  assert.equal(result.loanDeductionRial, 0);
  assert.equal(result.netPayRial, 291_965_545);
  assert.equal(
    result.payItemBreakdown.find((line) => line.itemId === 'signed-correction')?.amountRial,
    -300_000,
  );
});

test('applies employee-level insurance and tax exclusions without removing gross earnings', () => {
  const result = calculatePayroll(makeInput({
    dailyBaseWageRial: 10_000_000,
    dailySeniorityRial: 0,
    housingAllowanceRial: 0,
    workerCouponRial: 0,
    insuredBenefitsRial: 1_000_000,
    nonInsuredBenefitsRial: 2_000_000,
    loanDeductionRial: 100_000,
    advanceDeductionRial: 50_000,
    otherDeductionsRial: 25_000,
    insuranceSubject: false,
    taxSubject: false,
  }));

  assert.equal(result.grossEarningsRial, 303_000_000);
  assert.equal(result.insuranceSubjectEarningsRial, 0);
  assert.equal(result.employeeInsuranceRial, 0);
  assert.equal(result.totalEmployerInsuranceRial, 0);
  assert.equal(result.taxableIncomeRial, 0);
  assert.equal(result.totalPayrollTaxRial, 0);
  assert.equal(result.manualDeductionsRial, 175_000);
  assert.equal(result.totalDeductionsRial, 175_000);
  assert.equal(result.netPayRial, 302_825_000);
});

test('validates monthly day and deduction inputs while allowing a signed correction', () => {
  assert.equal(validatePayrollInput(makeInput({
    sickLeaveDays: 4,
    unpaidAbsenceDays: 2,
    paidLeaveDays: 3,
    missionDays: 1,
    signedCorrectionRial: -500_000,
    loanDeductionRial: 100_000,
  })).length, 0);

  assert.ok(validatePayrollInput(makeInput({ sickLeaveDays: 31 }))
    .some((issue) => issue.code === 'INVALID_MONTHLY_DAY_COUNT'));
  assert.ok(validatePayrollInput(makeInput({ loanDeductionRial: -1 }))
    .some((issue) => issue.code === 'INVALID_NON_NEGATIVE_NUMBER'));
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

test('other-level daily wage adjustment follows 1405 percentage plus fixed amount', () => {
  const result = calculateOtherLevelsDailyWage('1405', 8_000_000);

  assert.equal(result.increaseRate, 0.45);
  assert.equal(result.fixedDailyIncreaseRial, 519_549);
  assert.equal(result.calculatedDailyWageBeforeFloorRial, 12_119_549);
  assert.equal(result.adjustedDailyWageRial, 12_119_549);
  assert.equal(result.minimumWageFloorApplied, false);
});

test('other-level daily wage adjustment follows 1404 percentage plus fixed amount', () => {
  const result = calculateOtherLevelsDailyWage('1404', 5_000_000);

  assert.equal(result.increaseRate, 0.32);
  assert.equal(result.fixedDailyIncreaseRial, 310_535);
  assert.equal(result.calculatedDailyWageBeforeFloorRial, 6_910_535);
});

test('other-level adjustment never falls below the annual minimum wage', () => {
  const result = calculateOtherLevelsDailyWage('1405', 1_000);

  assert.equal(result.adjustedDailyWageRial, result.minimumDailyWageRial);
  assert.equal(result.minimumWageFloorApplied, true);
});

test('other-level adjustment rejects negative prior wages', () => {
  assert.throws(
    () => calculateOtherLevelsDailyWage('1405', -1),
    /finite non-negative/
  );
});
