import {
  calculatePayroll,
  PayrollInput,
  PayrollInputIssue,
  PayrollInputValidationError,
  PayrollResult,
  validatePayrollInput,
} from './payrollEngine';

export interface PayrollRunPeriod {
  runId: string;
  fiscalYear: PayrollInput['year'];
  month: number;
  monthDays: PayrollInput['monthDays'];
}

export interface PayrollRunEmployee {
  employeeId: string;
  personnelCode: string;
  fullName: string;
  isActive: boolean;
  payrollInput: PayrollInput;
  masterDataIssues?: PayrollRunLineIssue[];
}

export type PayrollRunLineStatus = 'calculated' | 'blocked' | 'excluded';
export type PayrollRunStatus = 'ready-for-review' | 'validation-failed';

export interface PayrollRunLineIssue {
  code: string;
  message: string;
  field?: string;
}

export interface PayrollRunLine {
  employeeId: string;
  personnelCode: string;
  fullName: string;
  status: PayrollRunLineStatus;
  issues: PayrollRunLineIssue[];
  payrollInput: PayrollInput;
  result?: PayrollResult;
}

export interface PayrollRunTotals {
  employeeCount: number;
  calculatedCount: number;
  blockedCount: number;
  excludedCount: number;
  grossEarningsRial: number;
  employeeInsuranceRial: number;
  payrollTaxRial: number;
  totalDeductionsRial: number;
  netPayRial: number;
  employerInsuranceRial: number;
  directEmployerCostRial: number;
  monthlyReservesRial: number;
  ctcMonthlyRial: number;
  ctcAnnualRial: number;
}

export interface PayrollRunResult {
  runId: string;
  fiscalYear: PayrollInput['year'];
  month: number;
  monthDays: PayrollInput['monthDays'];
  status: PayrollRunStatus;
  periodIssues: PayrollRunLineIssue[];
  lines: PayrollRunLine[];
  totals: PayrollRunTotals;
}

/**
 * Calculates a multi-employee payroll run by delegating every employee
 * calculation to the single central calculatePayroll engine.
 *
 * This is a pure in-memory domain service. Persistence, attendance ingestion,
 * approvals and payment execution are separate application layers.
 */
export function calculatePayrollRun(
  period: PayrollRunPeriod,
  employees: PayrollRunEmployee[]
): PayrollRunResult {
  const periodIssues: PayrollRunLineIssue[] = [];

  if (!period.runId.trim()) {
    periodIssues.push({
      code: 'MISSING_RUN_ID',
      message: 'Payroll run ID is required.',
      field: 'runId',
    });
  }
  if (!Number.isInteger(period.month) || period.month < 1 || period.month > 12) {
    periodIssues.push({
      code: 'INVALID_PAYROLL_MONTH',
      message: 'Payroll month must be an integer between 1 and 12.',
      field: 'month',
    });
  }
  if (!['1404', '1405'].includes(period.fiscalYear)) {
    periodIssues.push({
      code: 'UNSUPPORTED_FISCAL_YEAR',
      message: 'Payroll run fiscal year is not registered.',
      field: 'fiscalYear',
    });
  }
  if (![29, 30, 31].includes(period.monthDays)) {
    periodIssues.push({
      code: 'INVALID_MONTH_LENGTH',
      message: 'Payroll month length must be 29, 30 or 31 days.',
      field: 'monthDays',
    });
  }
  if (employees.length === 0) {
    periodIssues.push({
      code: 'EMPTY_PAYROLL_RUN',
      message: 'At least one employee must be supplied to calculate a payroll run.',
      field: 'employees',
    });
  }

  const employeeIdCounts = new Map<string, number>();
  const personnelCodeCounts = new Map<string, number>();
  for (const employee of employees) {
    const employeeId = employee.employeeId.trim();
    const personnelCode = employee.personnelCode.trim();
    employeeIdCounts.set(employeeId, (employeeIdCounts.get(employeeId) ?? 0) + 1);
    personnelCodeCounts.set(personnelCode, (personnelCodeCounts.get(personnelCode) ?? 0) + 1);
  }

  const lines: PayrollRunLine[] = employees.map((employee) => {
    const issues: PayrollRunLineIssue[] = [];
    const employeeId = employee.employeeId.trim();
    const personnelCode = employee.personnelCode.trim();

    if (!employeeId) {
      issues.push({
        code: 'MISSING_EMPLOYEE_ID',
        message: 'Employee ID is required.',
        field: 'employeeId',
      });
    } else if ((employeeIdCounts.get(employeeId) ?? 0) > 1) {
      issues.push({
        code: 'DUPLICATE_EMPLOYEE_ID',
        message: `Employee ID "${employeeId}" appears more than once in this payroll run.`,
        field: 'employeeId',
      });
    }

    if (!personnelCode) {
      issues.push({
        code: 'MISSING_PERSONNEL_CODE',
        message: 'Personnel code is required.',
        field: 'personnelCode',
      });
    } else if ((personnelCodeCounts.get(personnelCode) ?? 0) > 1) {
      issues.push({
        code: 'DUPLICATE_PERSONNEL_CODE',
        message: `Personnel code "${personnelCode}" appears more than once in this payroll run.`,
        field: 'personnelCode',
      });
    }

    if (!employee.fullName.trim()) {
      issues.push({
        code: 'MISSING_EMPLOYEE_NAME',
        message: 'Employee full name is required.',
        field: 'fullName',
      });
    }

    for (const issue of employee.masterDataIssues ?? []) {
      issues.push(issue);
    }

    if (!employee.isActive) {
      return {
        employeeId,
        personnelCode,
        fullName: employee.fullName,
        status: 'excluded',
        payrollInput: employee.payrollInput,
        issues: [
          ...issues,
          {
            code: 'EMPLOYEE_INACTIVE',
            message: 'Inactive employees are excluded from payroll calculation.',
            field: 'isActive',
          },
        ],
      };
    }

    if (employee.payrollInput.year !== period.fiscalYear) {
      issues.push({
        code: 'EMPLOYEE_YEAR_MISMATCH',
        message: 'Employee payroll input fiscal year does not match the payroll run.',
        field: 'payrollInput.year',
      });
    }
    if (employee.payrollInput.monthDays !== period.monthDays) {
      issues.push({
        code: 'EMPLOYEE_MONTH_LENGTH_MISMATCH',
        message: 'Employee payroll input month length does not match the payroll run.',
        field: 'payrollInput.monthDays',
      });
    }

    const inputIssues: PayrollInputIssue[] = validatePayrollInput(employee.payrollInput);
    inputIssues.forEach((issue) => {
      issues.push({
        code: issue.code,
        message: issue.message,
        field: String(issue.field),
      });
    });

    if (issues.length > 0 || periodIssues.length > 0) {
      return {
        employeeId,
        personnelCode,
        fullName: employee.fullName,
        status: 'blocked',
        payrollInput: employee.payrollInput,
        issues,
      };
    }

    try {
      const result = calculatePayroll(employee.payrollInput);
      return {
        employeeId,
        personnelCode,
        fullName: employee.fullName,
        status: 'calculated',
        issues: [],
        payrollInput: employee.payrollInput,
        result,
      };
    } catch (error) {
      const engineIssues =
        error instanceof PayrollInputValidationError
          ? error.issues.map((issue) => ({
              code: issue.code,
              message: issue.message,
              field: String(issue.field),
            }))
          : [{
              code: 'PAYROLL_CALCULATION_ERROR',
              message: error instanceof Error ? error.message : 'Unknown payroll calculation error.',
            }];

      return {
        employeeId,
        personnelCode,
        fullName: employee.fullName,
        status: 'blocked',
        payrollInput: employee.payrollInput,
        issues: engineIssues,
      };
    }
  });

  const calculated = lines
    .filter((line): line is PayrollRunLine & { result: PayrollResult } =>
      line.status === 'calculated' && Boolean(line.result)
    )
    .map((line) => line.result);

  const totals: PayrollRunTotals = calculated.reduce(
    (sum, result) => ({
      employeeCount: sum.employeeCount,
      calculatedCount: sum.calculatedCount,
      blockedCount: sum.blockedCount,
      excludedCount: sum.excludedCount,
      grossEarningsRial: sum.grossEarningsRial + result.grossEarningsRial,
      employeeInsuranceRial: sum.employeeInsuranceRial + result.employeeInsuranceRial,
      payrollTaxRial: sum.payrollTaxRial + result.totalPayrollTaxRial,
      totalDeductionsRial: sum.totalDeductionsRial + result.totalDeductionsRial,
      netPayRial: sum.netPayRial + result.netPayRial,
      employerInsuranceRial: sum.employerInsuranceRial + result.totalEmployerInsuranceRial,
      directEmployerCostRial: sum.directEmployerCostRial + result.totalEmployerCostRial,
      monthlyReservesRial: sum.monthlyReservesRial + result.totalMonthlyReservesRial,
      ctcMonthlyRial: sum.ctcMonthlyRial + result.ctcMonthlyRial,
      ctcAnnualRial: sum.ctcAnnualRial + result.ctcAnnualRial,
    }),
    {
      employeeCount: employees.length,
      calculatedCount: calculated.length,
      blockedCount: lines.filter((line) => line.status === 'blocked').length,
      excludedCount: lines.filter((line) => line.status === 'excluded').length,
      grossEarningsRial: 0,
      employeeInsuranceRial: 0,
      payrollTaxRial: 0,
      totalDeductionsRial: 0,
      netPayRial: 0,
      employerInsuranceRial: 0,
      directEmployerCostRial: 0,
      monthlyReservesRial: 0,
      ctcMonthlyRial: 0,
      ctcAnnualRial: 0,
    }
  );

  const hasLineErrors = lines.some((line) => line.status === 'blocked');
  const status: PayrollRunStatus =
    periodIssues.length === 0 && !hasLineErrors && calculated.length > 0
      ? 'ready-for-review'
      : 'validation-failed';

  return {
    runId: period.runId,
    fiscalYear: period.fiscalYear,
    month: period.month,
    monthDays: period.monthDays,
    status,
    periodIssues,
    lines,
    totals,
  };
}
