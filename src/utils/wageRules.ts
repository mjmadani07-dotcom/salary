import { getPayrollRuleSet } from '../data/payrollRuleRegistry';
import type { FiscalYear } from '../data/payrollRuleRegistry';

export interface OtherLevelsWageAdjustment {
  fiscalYear: FiscalYear;
  previousDailyBaseWageRial: number;
  increaseRate: number;
  fixedDailyIncreaseRial: number;
  calculatedDailyWageBeforeFloorRial: number;
  minimumDailyWageRial: number;
  adjustedDailyWageRial: number;
  minimumWageFloorApplied: boolean;
}

/**
 * Applies the annual "other wage levels" increase to the previous year's
 * daily fixed/base wage. This does not replace job-classification tables,
 * piece-rate rules or individually approved collective wage arrangements.
 */
export function calculateOtherLevelsDailyWage(
  fiscalYear: FiscalYear,
  previousDailyBaseWageRial: number
): OtherLevelsWageAdjustment {
  if (
    !Number.isFinite(previousDailyBaseWageRial) ||
    previousDailyBaseWageRial < 0
  ) {
    throw new Error('Previous daily base wage must be a finite non-negative Rial amount.');
  }

  const rules = getPayrollRuleSet(fiscalYear).regulations;
  const calculatedDailyWageBeforeFloorRial = Math.round(
    previousDailyBaseWageRial * (1 + rules.otherLevelsIncreaseRate) +
      rules.otherLevelsDailyFixedIncreaseRial
  );
  const adjustedDailyWageRial = Math.max(
    rules.minDailyWageRial,
    calculatedDailyWageBeforeFloorRial
  );

  return {
    fiscalYear,
    previousDailyBaseWageRial,
    increaseRate: rules.otherLevelsIncreaseRate,
    fixedDailyIncreaseRial: rules.otherLevelsDailyFixedIncreaseRial,
    calculatedDailyWageBeforeFloorRial,
    minimumDailyWageRial: rules.minDailyWageRial,
    adjustedDailyWageRial,
    minimumWageFloorApplied:
      adjustedDailyWageRial !== calculatedDailyWageBeforeFloorRial,
  };
}
