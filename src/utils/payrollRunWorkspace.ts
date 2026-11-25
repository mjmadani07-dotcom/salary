import type { EmployeeMasterRecord } from '../types/employee';
import type { PayrollInput } from './payrollEngine';
import {
  calculateServiceDurationJalali,
  resolveEmployeeTerms,
} from './employeeMaster';
import type {
  PayrollRunEmployee,
  PayrollRunLine,
  PayrollRunLineIssue,
  PayrollRunResult,
} from './payrollRunEngine';

export interface PayrollWorkspaceSeed {
  year: PayrollInput['year'];
  month: number;
  monthDays: PayrollInput['monthDays'];
  housingAllowanceRial: number;
  workerCouponRial: number;
  minDailyWageRial: number;
  employeeMasters: EmployeeMasterRecord[];
  savedEmployees: PayrollRunEmployee[];
  savedRun?: PayrollRunResult | null;
}

const STABLE_CONFIRMATION_CODES = new Set([
  'MONTHLY_MARITAL_STATUS_UNCONFIRMED',
  'MONTHLY_CHILDREN_COUNT_UNCONFIRMED',
  'MONTHLY_720_DAY_INSURANCE_UNCONFIRMED',
]);

function monthlyIssue(
  code: string,
  field: string,
  message: string
): PayrollRunLineIssue {
  return { code, field, message };
}

function periodDate(year: string, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function makeEmployeeFromMaster(
  master: EmployeeMasterRecord,
  seed: PayrollWorkspaceSeed,
  saved: PayrollRunEmployee | undefined,
  snapshotLine: PayrollRunLine | undefined
): PayrollRunEmployee {
  const periodStart = periodDate(seed.year, seed.month, 1);
  const periodEnd = periodDate(seed.year, seed.month, seed.monthDays);
  const terms = resolveEmployeeTerms(master, periodStart, periodEnd);
  const isActiveForPeriod = snapshotLine ? snapshotLine.status !== 'excluded' : master.status === 'active';
  const masterDataIssues: PayrollRunLineIssue[] = [];

  if (snapshotLine) {
    masterDataIssues.push(
      ...snapshotLine.issues.filter((issue) => issue.code.startsWith('MONTHLY_'))
    );
  } else {
    masterDataIssues.push(
      monthlyIssue(
        'MONTHLY_WORK_DAYS_UNCONFIRMED',
        'workDays',
        'روزهای کارکرد این دوره را تأیید یا اصلاح کنید.'
      ),
      monthlyIssue(
        'MONTHLY_ANNUAL_WORKED_DAYS_UNCONFIRMED',
        'annualWorkedDays',
        'تعداد روزهای کارکرد سال برای محاسبه عیدی را وارد یا تأیید کنید.'
      )
    );

    for (const issue of saved?.masterDataIssues ?? []) {
      if (STABLE_CONFIRMATION_CODES.has(issue.code)) masterDataIssues.push(issue);
    }

    if (!saved) {
      if (master.isMarried === undefined) {
        masterDataIssues.push(
          monthlyIssue(
            'MONTHLY_MARITAL_STATUS_UNCONFIRMED',
            'isMarried',
            'وضعیت تأهل این کارمند را مشخص کنید.'
          )
        );
      }
      if (master.eligibleChildrenCount === undefined) {
        masterDataIssues.push(
          monthlyIssue(
            'MONTHLY_CHILDREN_COUNT_UNCONFIRMED',
            'childrenCount',
            'تعداد فرزندان واجد شرایط را مشخص کنید؛ در صورت نداشتن فرزند، عدد صفر را وارد کنید.'
          )
        );
      }
      masterDataIssues.push(
        monthlyIssue(
          'MONTHLY_720_DAY_INSURANCE_UNCONFIRMED',
          'has720DaysInsurance',
          'وضعیت احراز حداقل ۷۲۰ روز سابقه بیمه را مشخص کنید.'
        )
      );
    }
  }

  if (isActiveForPeriod) {
    masterDataIssues.push(
      ...terms.issues.filter((issue) => issue.code !== 'EMPLOYEE_INACTIVE').map((issue) => ({
        code: issue.code,
        message: issue.message,
        field: issue.field,
      }))
    );
  }

  let serviceYears = saved?.payrollInput.serviceYearsForSeverance ?? 0;
  let serviceExtraDays = saved?.payrollInput.serviceExtraDaysForSeverance ?? 0;
  if (isActiveForPeriod) {
    try {
      const duration = calculateServiceDurationJalali(master.hireDateJalali, periodEnd);
      serviceYears = duration.completedYears;
      serviceExtraDays = duration.additionalDays;
    } catch (error) {
      masterDataIssues.push({
        code: 'INVALID_SERVICE_DURATION',
        message: error instanceof Error ? error.message : 'محاسبه سابقه خدمت ناموفق بود.',
        field: 'hireDateJalali',
      });
    }
  }

  const sourceInput = snapshotLine?.payrollInput;
  const baseInput = sourceInput ?? saved?.payrollInput;
  const effectiveWage = terms.wage;
  const resolvedDailyBaseWage = effectiveWage
    ? effectiveWage.wageType === 'minimum'
      ? seed.minDailyWageRial
      : effectiveWage.wageType === 'custom'
        ? Math.max(effectiveWage.dailyBaseWageRial, seed.minDailyWageRial)
        : effectiveWage.dailyBaseWageRial
    : saved?.payrollInput.dailyBaseWageRial ?? seed.minDailyWageRial;

  if (
    effectiveWage?.wageType === 'custom' &&
    effectiveWage.dailyBaseWageRial < seed.minDailyWageRial
  ) {
    masterDataIssues.push({
      code: 'CUSTOM_WAGE_BELOW_STATUTORY_MINIMUM',
      field: 'wageHistory',
      message: 'مزد سفارشی کمتر از حداقل مزد مصوب است؛ حداقل مصوب برای محاسبه اعمال می‌شود.',
    });
  }

  const payrollInput: PayrollInput = {
    year: seed.year,
    monthDays: seed.monthDays,
    workDays: sourceInput?.workDays ?? seed.monthDays,
    dailyBaseWageRial: sourceInput?.dailyBaseWageRial ?? resolvedDailyBaseWage,
    dailySeniorityRial: sourceInput?.dailySeniorityRial ??
      (effectiveWage?.seniorityEligible === false
        ? 0
        : effectiveWage?.dailySeniorityRial ?? saved?.payrollInput.dailySeniorityRial ?? 0),
    housingAllowanceRial: seed.housingAllowanceRial,
    workerCouponRial: seed.workerCouponRial,
    isMarried: sourceInput?.isMarried ?? baseInput?.isMarried ?? master.isMarried ?? false,
    childrenCount: sourceInput?.childrenCount ?? baseInput?.childrenCount ?? master.eligibleChildrenCount ?? 0,
    has720DaysInsurance:
      sourceInput?.has720DaysInsurance ?? baseInput?.has720DaysInsurance ?? false,
    overtimeHours: sourceInput?.overtimeHours ?? 0,
    nightShiftHours: sourceInput?.nightShiftHours ?? 0,
    holidayHours: sourceInput?.holidayHours ?? 0,
    variableBonusRial: sourceInput?.variableBonusRial ?? 0,
    annualWorkedDays: sourceInput?.annualWorkedDays ?? 0,
    serviceYearsForSeverance: sourceInput
      ? sourceInput.serviceYearsForSeverance
      : serviceYears,
    serviceExtraDaysForSeverance: sourceInput
      ? sourceInput.serviceExtraDaysForSeverance
      : serviceExtraDays,
    hourlyDivisor: sourceInput?.hourlyDivisor ?? saved?.payrollInput.hourlyDivisor,
  };

  return {
    employeeId: master.employeeId,
    personnelCode: master.personnelCode,
    fullName: `${master.firstName} ${master.lastName}`.trim(),
    isActive: isActiveForPeriod,
    payrollInput,
    masterDataIssues,
  };
}

/**
 * Creates the monthly editable workspace from employee master data.
 *
 * A saved snapshot for the selected period takes precedence for that period.
 * Otherwise, stable employee facts may be reused from the previous employee
 * record, while period-specific work values are reset and explicitly marked
 * for confirmation. The central payroll engine remains the sole calculator.
 */
export function createPayrollWorkspaceEmployees(
  seed: PayrollWorkspaceSeed
): PayrollRunEmployee[] {
  const savedById = new Map(
    seed.savedEmployees.map((employee) => [employee.employeeId, employee])
  );
  const snapshotById = new Map(
    (seed.savedRun?.lines ?? []).map((line) => [line.employeeId, line])
  );
  const seen = new Set<string>();

  const masterRows = seed.employeeMasters
    .map((master) => {
      seen.add(master.employeeId);
      return makeEmployeeFromMaster(
        master,
        seed,
        savedById.get(master.employeeId),
        snapshotById.get(master.employeeId)
      );
    });

  const legacyRows = seed.savedEmployees
    .filter((employee) => !seen.has(employee.employeeId))
    .map((employee) => {
      seen.add(employee.employeeId);
      return { ...employee };
    });

  const snapshotOnlyRows = (seed.savedRun?.lines ?? [])
    .filter((line) => !seen.has(line.employeeId))
    .map((line) => ({
      employeeId: line.employeeId,
      personnelCode: line.personnelCode,
      fullName: line.fullName,
      isActive: line.status !== 'excluded',
      payrollInput: line.payrollInput,
      masterDataIssues: line.issues.filter((issue) => issue.code.startsWith('MONTHLY_')),
    }));

  return [...masterRows, ...legacyRows, ...snapshotOnlyRows].sort((left, right) =>
    left.personnelCode.localeCompare(right.personnelCode, 'en')
  );
}

/** Remove the confirmation blocker once the operator has explicitly entered a value. */
export function clearPayrollConfirmationIssue(
  employee: PayrollRunEmployee,
  issueCode: string
): PayrollRunEmployee {
  return {
    ...employee,
    masterDataIssues: (employee.masterDataIssues ?? []).filter(
      (issue) => issue.code !== issueCode
    ),
  };
}
