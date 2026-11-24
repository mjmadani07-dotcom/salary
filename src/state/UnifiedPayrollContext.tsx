import { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import {
  CurrencyUnit,
  FiscalYear,
  YEAR_REGULATIONS,
} from '../data/payrollRegulations';
import { getScorecardMultiplier } from '../data/eosCompensation';
import {
  PayrollInput,
  PayrollResult,
  calculatePayroll,
} from '../utils/payrollEngine';

export interface UnifiedPayrollState {
  year: FiscalYear;
  unit: CurrencyUnit;
  employeeName: string;
  monthDays: 29 | 30 | 31;
  workDays: number;
  wageMode: 'min' | 'custom';
  customMonthlyBase30Rial: number;
  hasSeniority: boolean;
  isMarried: boolean;
  childrenCount: number;
  has720DaysInsurance: boolean;
  overtimeHours: number;
  nightShiftHours: number;
  holidayHours: number;
  otherVariableBonusRial: number;
  annualWorkedDays: number;
  serviceYearsForSeverance: number;
  serviceExtraDaysForSeverance: number;

  // CTC & EOS Unification
  includeLeaveReserve: boolean;
  includeEosInPayroll: boolean;
  gwcGet: boolean;
  gwcWant: boolean;
  gwcCapacity: boolean;
  scorecardBudgetRial: number;
  scorecardAchievementPct: number;
  overAchievementMultiplier: 1.2 | 1.35 | 1.5;
  quarterlyRockBudgetRial: number;
  companyRocksPct: number;
  individualRocksPct: number;
  annualProfitShareRial: number;
}

export interface UnifiedCalculatedOutput {
  payrollInput: PayrollInput;
  baselineResult: PayrollResult; // Without EOS bonuses (statutory + manual bonus)
  payrollResult: PayrollResult; // With EOS scorecard bonus if enabled
  isGwcQualified: boolean;
  scorecardMultiplier: number;
  scorecardTierLabel: string;
  scorecardBonusRial: number;
  isCompanyRockThresholdMet: boolean;
  quarterlyRockEarnedRial: number;
  monthlyRockReserveRial: number;
  annualProfitShareRial: number;
  monthlyProfitReserveRial: number;
  effectiveLeaveReserveRial: number;
  totalStatutoryReservesRial: number; // Eid + Severance + Leave (if enabled)
  totalEosReservesRial: number; // Monthly Rock reserve + Monthly Profit reserve
  totalCtcMonthlyRial: number;
  totalCtcAnnualRial: number;
  ctcMultiplierToNet: number;
  marginalTaxOnScorecardRial: number;
  marginalInsuranceOnScorecardRial: number;
}

interface UnifiedPayrollContextValue {
  state: UnifiedPayrollState;
  computed: UnifiedCalculatedOutput;
  updateState: (patch: Partial<UnifiedPayrollState>) => void;
  setTargetNetPayRial: (targetNetRial: number) => void;
  resetToDefaults: () => void;
}

const DEFAULT_STATE: UnifiedPayrollState = {
  year: '1405',
  unit: 'rial',
  employeeName: 'پرسنل نمونه',
  monthDays: 30,
  workDays: 30,
  wageMode: 'custom',
  customMonthlyBase30Rial: 450_000_000, // 45M Toman
  hasSeniority: true,
  isMarried: true,
  childrenCount: 1,
  has720DaysInsurance: true,
  overtimeHours: 10,
  nightShiftHours: 0,
  holidayHours: 0,
  otherVariableBonusRial: 0,
  annualWorkedDays: 365,
  serviceYearsForSeverance: 2,
  serviceExtraDaysForSeverance: 0,

  includeLeaveReserve: true,
  includeEosInPayroll: true,
  gwcGet: true,
  gwcWant: true,
  gwcCapacity: true,
  scorecardBudgetRial: 80_000_000,
  scorecardAchievementPct: 100,
  overAchievementMultiplier: 1.2,
  quarterlyRockBudgetRial: 150_000_000,
  companyRocksPct: 85,
  individualRocksPct: 100,
  annualProfitShareRial: 600_000_000,
};

const UnifiedPayrollContext = createContext<UnifiedPayrollContextValue | null>(
  null
);

export function UnifiedPayrollProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UnifiedPayrollState>(DEFAULT_STATE);

  const updateState = (patch: Partial<UnifiedPayrollState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      if (patch.monthDays !== undefined && patch.workDays === undefined) {
        next.workDays = Math.min(prev.workDays, patch.monthDays);
      }
      if (next.workDays > next.monthDays) {
        next.workDays = next.monthDays;
      }
      return next;
    });
  };

  const resetToDefaults = () => {
    setState((prev) => ({
      ...DEFAULT_STATE,
      year: prev.year,
      unit: prev.unit,
    }));
  };

  const computed = useMemo<UnifiedCalculatedOutput>(() => {
    const reg = YEAR_REGULATIONS[state.year];
    const dailyBaseWageRial =
      state.wageMode === 'min'
        ? reg.minDailyWageRial
        : Math.max(
            reg.minDailyWageRial,
            Math.round(state.customMonthlyBase30Rial / 30)
          );
    const dailySeniorityRial = state.hasSeniority
      ? reg.baseSeniorityDaily1YrRial
      : 0;

    // EOS Evaluation
    const isGwcQualified = state.gwcGet && state.gwcWant && state.gwcCapacity;
    const scorecardEval = getScorecardMultiplier(
      state.scorecardAchievementPct,
      state.overAchievementMultiplier
    );
    const scorecardBonusRial =
      state.includeEosInPayroll && isGwcQualified
        ? Math.round(
            Math.max(0, state.scorecardBudgetRial) * scorecardEval.multiplier
          )
        : 0;

    const isCompanyRockThresholdMet = state.companyRocksPct >= 80;
    const quarterlyRockEarnedRial =
      state.includeEosInPayroll && isGwcQualified && isCompanyRockThresholdMet
        ? Math.round(
            Math.max(0, state.quarterlyRockBudgetRial) *
              (Math.min(100, Math.max(0, state.individualRocksPct)) / 100)
          )
        : 0;
    const monthlyRockReserveRial = Math.round(quarterlyRockEarnedRial / 3);

    const annualProfitShareRial =
      state.includeEosInPayroll && isGwcQualified
        ? Math.max(0, Math.round(state.annualProfitShareRial))
        : 0;
    const monthlyProfitReserveRial = Math.round(annualProfitShareRial / 12);

    const baseInput: PayrollInput = {
      year: state.year,
      monthDays: state.monthDays,
      workDays: state.workDays,
      dailyBaseWageRial,
      dailySeniorityRial,
      housingAllowanceRial: reg.housingAllowanceRial,
      workerCouponRial: reg.workerCouponRial,
      isMarried: state.isMarried,
      childrenCount: state.childrenCount,
      has720DaysInsurance: state.has720DaysInsurance,
      overtimeHours: state.overtimeHours,
      nightShiftHours: state.nightShiftHours,
      holidayHours: state.holidayHours,
      variableBonusRial: Math.max(0, state.otherVariableBonusRial),
      annualWorkedDays: state.annualWorkedDays,
      serviceYearsForSeverance: state.serviceYearsForSeverance,
      serviceExtraDaysForSeverance: state.serviceExtraDaysForSeverance,
    };

    const fullInput: PayrollInput = {
      ...baseInput,
      variableBonusRial:
        Math.max(0, state.otherVariableBonusRial) + scorecardBonusRial,
    };

    const baselineResult = calculatePayroll(baseInput);
    const payrollResult = calculatePayroll(fullInput);

    const effectiveLeaveReserveRial = state.includeLeaveReserve
      ? payrollResult.monthlyLeaveReserveRial
      : 0;
    const totalStatutoryReservesRial =
      payrollResult.monthlyEidReserveRial +
      payrollResult.monthlySeveranceReserveRial +
      effectiveLeaveReserveRial;

    const totalEosReservesRial =
      monthlyRockReserveRial + monthlyProfitReserveRial;

    const totalCtcMonthlyRial =
      payrollResult.totalEmployerCostRial +
      totalStatutoryReservesRial +
      totalEosReservesRial;

    const totalCtcAnnualRial = totalCtcMonthlyRial * 12;
    const ctcMultiplierToNet =
      payrollResult.netPayRial > 0
        ? totalCtcMonthlyRial / payrollResult.netPayRial
        : 0;

    return {
      payrollInput: fullInput,
      baselineResult,
      payrollResult,
      isGwcQualified,
      scorecardMultiplier: scorecardEval.multiplier,
      scorecardTierLabel: scorecardEval.tierLabel,
      scorecardBonusRial,
      isCompanyRockThresholdMet,
      quarterlyRockEarnedRial,
      monthlyRockReserveRial,
      annualProfitShareRial,
      monthlyProfitReserveRial,
      effectiveLeaveReserveRial,
      totalStatutoryReservesRial,
      totalEosReservesRial,
      totalCtcMonthlyRial,
      totalCtcAnnualRial,
      ctcMultiplierToNet,
      marginalTaxOnScorecardRial:
        payrollResult.totalPayrollTaxRial - baselineResult.totalPayrollTaxRial,
      marginalInsuranceOnScorecardRial:
        payrollResult.employeeInsuranceRial -
        baselineResult.employeeInsuranceRial,
    };
  }, [state]);

  // Reverse solver: given desired Net Take-Home Pay, find required monthlyBase30Rial
  const setTargetNetPayRial = (targetNetRial: number) => {
    const reg = YEAR_REGULATIONS[state.year];
    const isGwcQualified = state.gwcGet && state.gwcWant && state.gwcCapacity;
    const scorecardEval = getScorecardMultiplier(
      state.scorecardAchievementPct,
      state.overAchievementMultiplier
    );
    const scorecardBonusRial =
      state.includeEosInPayroll && isGwcQualified
        ? Math.round(
            Math.max(0, state.scorecardBudgetRial) * scorecardEval.multiplier
          )
        : 0;

    const evalNet = (dailyWage: number) =>
      calculatePayroll({
        year: state.year,
        monthDays: state.monthDays,
        workDays: state.workDays,
        dailyBaseWageRial: dailyWage,
        dailySeniorityRial: state.hasSeniority
          ? reg.baseSeniorityDaily1YrRial
          : 0,
        housingAllowanceRial: reg.housingAllowanceRial,
        workerCouponRial: reg.workerCouponRial,
        isMarried: state.isMarried,
        childrenCount: state.childrenCount,
        has720DaysInsurance: state.has720DaysInsurance,
        overtimeHours: state.overtimeHours,
        nightShiftHours: state.nightShiftHours,
        holidayHours: state.holidayHours,
        variableBonusRial:
          Math.max(0, state.otherVariableBonusRial) + scorecardBonusRial,
        annualWorkedDays: state.annualWorkedDays,
        serviceYearsForSeverance: state.serviceYearsForSeverance,
        serviceExtraDaysForSeverance: state.serviceExtraDaysForSeverance,
      }).netPayRial;

    let low = reg.minDailyWageRial;
    let high = reg.minDailyWageRial * 30;
    if (evalNet(low) >= targetNetRial) {
      updateState({ wageMode: 'min', customMonthlyBase30Rial: reg.minMonthlyWage30Rial });
      return;
    }

    for (let i = 0; i < 32; i++) {
      const mid = Math.round((low + high) / 2);
      if (evalNet(mid) < targetNetRial) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    updateState({
      wageMode: 'custom',
      customMonthlyBase30Rial: high * 30,
    });
  };

  return (
    <UnifiedPayrollContext.Provider
      value={{
        state,
        computed,
        updateState,
        setTargetNetPayRial,
        resetToDefaults,
      }}
    >
      {children}
    </UnifiedPayrollContext.Provider>
  );
}

export function useUnifiedPayroll(): UnifiedPayrollContextValue {
  const ctx = useContext(UnifiedPayrollContext);
  if (!ctx) {
    throw new Error('useUnifiedPayroll must be used inside UnifiedPayrollProvider');
  }
  return ctx;
}
