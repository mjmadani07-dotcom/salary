import assert from 'node:assert/strict';
import test from 'node:test';
import type { EmployeeMasterRecord } from '../types/employee';
import type { PayrollRunEmployee, PayrollRunResult } from './payrollRunEngine';
import {
  clearPayrollConfirmationIssue,
  createPayrollWorkspaceEmployees,
} from './payrollRunWorkspace';

function makeMaster(overrides: Partial<EmployeeMasterRecord> = {}): EmployeeMasterRecord {
  return {
    employeeId: 'emp-001',
    personnelCode: 'P-001',
    firstName: 'علی',
    lastName: 'رضایی',
    nationalId: '',
    hireDateJalali: '1404-01-01',
    terminationDateJalali: null,
    status: 'active',
    insuranceNumber: '',
    contracts: [{
      contractId: 'contract-1',
      contractNumber: 'C-001',
      contractType: 'fixed-term',
      jobTitle: 'کارشناس',
      department: 'مالی',
      effectiveFromJalali: '1404-01-01',
      effectiveToJalali: null,
      weeklyHours: 44,
      notes: '',
    }],
    wageHistory: [{
      wageEntryId: 'wage-1',
      effectiveFromJalali: '1404-01-01',
      dailyBaseWageRial: 8_000_000,
      dailySeniorityRial: 100_000,
      notes: '',
    }],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeSavedEmployee(overrides: Partial<PayrollRunEmployee> = {}): PayrollRunEmployee {
  return {
    employeeId: 'emp-001',
    personnelCode: 'P-001',
    fullName: 'علی رضایی',
    isActive: true,
    payrollInput: {
      year: '1405',
      monthDays: 31,
      workDays: 21,
      dailyBaseWageRial: 7_000_000,
      dailySeniorityRial: 50_000,
      housingAllowanceRial: 30_000_000,
      workerCouponRial: 22_000_000,
      isMarried: true,
      childrenCount: 2,
      has720DaysInsurance: true,
      overtimeHours: 12,
      nightShiftHours: 4,
      holidayHours: 2,
      variableBonusRial: 5_000_000,
      annualWorkedDays: 180,
      serviceYearsForSeverance: 1,
      serviceExtraDaysForSeverance: 20,
    },
    ...overrides,
  };
}

function makeSnapshot(lines: PayrollRunResult['lines']): PayrollRunResult {
  return {
    runId: 'PAY-1405-02-test',
    fiscalYear: '1405',
    month: 2,
    monthDays: 30,
    status: 'ready-for-review',
    periodIssues: [],
    lines,
    totals: {
      employeeCount: lines.length,
      calculatedCount: lines.length,
      blockedCount: 0,
      excludedCount: 0,
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
    },
  };
}

const standardSeed = {
  year: '1405' as const,
  month: 1,
  monthDays: 31 as const,
  housingAllowanceRial: 30_000_000,
  workerCouponRial: 22_000_000,
  minDailyWageRial: 5_541_850,
};

test('loads all employee records, including inactive rows, and marks unconfirmed monthly/statutory facts', () => {
  const active = makeMaster({
    costCenter: 'فروش',
    bankAccountNumber: '0012345678',
    bankIban: 'IR000000000000000000000000',
  });
  const inactive = makeMaster({
    employeeId: 'emp-002',
    personnelCode: 'P-002',
    status: 'inactive',
  });

  const rows = createPayrollWorkspaceEmployees({
    ...standardSeed,
    employeeMasters: [active, inactive],
    savedEmployees: [],
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].employeeId, 'emp-001');
  assert.equal(rows[0].payrollInput.dailyBaseWageRial, 8_000_000);
  assert.equal(rows[0].payrollInput.workDays, 31);
  assert.equal(rows[0].payrollInput.annualWorkedDays, 0);
  assert.equal(rows[0].jobTitle, 'کارشناس');
  assert.equal(rows[0].costCenter, 'فروش');
  assert.equal(rows[0].bankAccountNumber, '0012345678');
  assert.equal(rows[0].bankIban, 'IR000000000000000000000000');
  assert.equal(rows[1].employeeId, 'emp-002');
  assert.equal(rows[1].isActive, false);

  const issueCodes = rows[0].masterDataIssues?.map((issue) => issue.code) ?? [];
  assert.ok(issueCodes.includes('MONTHLY_WORK_DAYS_UNCONFIRMED'));
  assert.ok(issueCodes.includes('MONTHLY_ANNUAL_WORKED_DAYS_UNCONFIRMED'));
  assert.ok(issueCodes.includes('MONTHLY_MARITAL_STATUS_UNCONFIRMED'));
  assert.ok(issueCodes.includes('MONTHLY_CHILDREN_COUNT_UNCONFIRMED'));
  assert.ok(issueCodes.includes('MONTHLY_720_DAY_INSURANCE_UNCONFIRMED'));
});

test('seeds stable marital and eligible-child facts from the employee master', () => {
  const rows = createPayrollWorkspaceEmployees({
    ...standardSeed,
    employeeMasters: [makeMaster({ isMarried: true, eligibleChildrenCount: 3 })],
    savedEmployees: [],
  });
  assert.equal(rows[0].payrollInput.isMarried, true);
  assert.equal(rows[0].payrollInput.childrenCount, 3);
  const issueCodes = rows[0].masterDataIssues?.map((issue) => issue.code) ?? [];
  assert.ok(!issueCodes.includes('MONTHLY_MARITAL_STATUS_UNCONFIRMED'));
  assert.ok(!issueCodes.includes('MONTHLY_CHILDREN_COUNT_UNCONFIRMED'));
});

test('uses the minimum or custom wage type and applies the statutory wage floor', () => {
  const minimum = createPayrollWorkspaceEmployees({
    ...standardSeed,
    employeeMasters: [makeMaster({
      wageHistory: [{
        ...makeMaster().wageHistory[0],
        dailyBaseWageRial: 8_000_000,
        wageType: 'minimum',
        seniorityEligible: false,
      }],
    })],
    savedEmployees: [],
  });
  assert.equal(minimum[0].payrollInput.dailyBaseWageRial, standardSeed.minDailyWageRial);
  assert.equal(minimum[0].payrollInput.dailySeniorityRial, 0);

  const custom = createPayrollWorkspaceEmployees({
    ...standardSeed,
    employeeMasters: [makeMaster({
      wageHistory: [{
        ...makeMaster().wageHistory[0],
        dailyBaseWageRial: 4_000_000,
        wageType: 'custom',
        seniorityEligible: true,
      }],
    })],
    savedEmployees: [],
  });
  assert.equal(custom[0].payrollInput.dailyBaseWageRial, standardSeed.minDailyWageRial);
  assert.equal(custom[0].payrollInput.dailySeniorityRial, 100_000);
  assert.ok(custom[0].masterDataIssues?.some((issue) => issue.code === 'CUSTOM_WAGE_BELOW_STATUTORY_MINIMUM'));
});

test('reuses stable employee facts but resets period-specific inputs for a new month', () => {
  const saved = makeSavedEmployee();
  const rows = createPayrollWorkspaceEmployees({
    ...standardSeed,
    month: 3,
    employeeMasters: [makeMaster()],
    savedEmployees: [saved],
  });

  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.payrollInput.isMarried, true);
  assert.equal(row.payrollInput.childrenCount, 2);
  assert.equal(row.payrollInput.has720DaysInsurance, true);
  assert.equal(row.payrollInput.workDays, 31);
  assert.equal(row.payrollInput.overtimeHours, 0);
  assert.equal(row.payrollInput.nightShiftHours, 0);
  assert.equal(row.payrollInput.holidayHours, 0);
  assert.equal(row.payrollInput.variableBonusRial, 0);
  assert.equal(row.payrollInput.annualWorkedDays, 0);

  const issueCodes = row.masterDataIssues?.map((issue) => issue.code) ?? [];
  assert.ok(issueCodes.includes('MONTHLY_WORK_DAYS_UNCONFIRMED'));
  assert.ok(issueCodes.includes('MONTHLY_ANNUAL_WORKED_DAYS_UNCONFIRMED'));
  assert.ok(!issueCodes.includes('MONTHLY_MARITAL_STATUS_UNCONFIRMED'));
  assert.ok(!issueCodes.includes('MONTHLY_CHILDREN_COUNT_UNCONFIRMED'));
  assert.ok(!issueCodes.includes('MONTHLY_720_DAY_INSURANCE_UNCONFIRMED'));
});

test('restores period-specific inputs from the matching saved snapshot and includes newly hired employees', () => {
  const savedInput = makeSavedEmployee().payrollInput;
  const snapshot = makeSnapshot([{
    employeeId: 'emp-001',
    personnelCode: 'P-001',
    fullName: 'علی رضایی',
    status: 'calculated',
    issues: [],
    payrollInput: { ...savedInput, monthDays: 30, workDays: 27, overtimeHours: 9, annualWorkedDays: 220 },
  }]);

  const rows = createPayrollWorkspaceEmployees({
    ...standardSeed,
    month: 2,
    monthDays: 30,
    employeeMasters: [
      makeMaster(),
      makeMaster({
        employeeId: 'emp-002',
        personnelCode: 'P-002',
        firstName: 'مریم',
        lastName: 'احمدی',
      }),
    ],
    savedEmployees: [],
    savedRun: snapshot,
  });

  assert.equal(rows.length, 2);
  const restored = rows.find((row) => row.employeeId === 'emp-001');
  const newlyAdded = rows.find((row) => row.employeeId === 'emp-002');
  assert.ok(restored);
  assert.ok(newlyAdded);
  assert.equal(restored.payrollInput.workDays, 27);
  assert.equal(restored.payrollInput.overtimeHours, 9);
  assert.equal(restored.payrollInput.annualWorkedDays, 220);
  assert.equal(restored.masterDataIssues?.some((issue) => issue.code === 'MONTHLY_WORK_DAYS_UNCONFIRMED'), false);
  assert.ok(newlyAdded.masterDataIssues?.some((issue) => issue.code === 'MONTHLY_WORK_DAYS_UNCONFIRMED'));
});

test('requires an explicit shift-work pattern for a new payroll period', () => {
  const rows = createPayrollWorkspaceEmployees({
    ...standardSeed,
    savedEmployees: [makeSavedEmployee()],
  });
  const employee = rows.find((row) => row.employeeId === 'emp-001');
  assert.ok(employee);
  assert.equal(employee.payrollInput.shiftWorkPattern, undefined);
  assert.ok(employee.masterDataIssues?.some((issue) =>
    issue.code === 'MONTHLY_SHIFT_PATTERN_UNCONFIRMED'
  ));
});

test('keeps a historically calculated employee active when the current master record is now inactive', () => {
  const snapshot = makeSnapshot([{
    employeeId: 'emp-001',
    personnelCode: 'P-001',
    fullName: 'علی رضایی',
    status: 'calculated',
    issues: [],
    payrollInput: { ...makeSavedEmployee().payrollInput, monthDays: 30 },
  }]);

  const rows = createPayrollWorkspaceEmployees({
    ...standardSeed,
    month: 2,
    monthDays: 30,
    employeeMasters: [makeMaster({
      status: 'inactive',
      terminationDateJalali: '1405-05-01',
    })],
    savedEmployees: [],
    savedRun: snapshot,
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].isActive, true);
  assert.equal(rows[0].masterDataIssues?.some((issue) => issue.code === 'EMPLOYEE_INACTIVE'), false);
});

test('preserves legacy employee rows that do not yet have an employee master record', () => {
  const legacy = makeSavedEmployee({
    employeeId: 'legacy-1',
    personnelCode: 'OLD-001',
    fullName: 'کارمند قدیمی',
  });

  const rows = createPayrollWorkspaceEmployees({
    ...standardSeed,
    employeeMasters: [],
    savedEmployees: [legacy],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].employeeId, 'legacy-1');
  assert.equal(rows[0].payrollInput.dailyBaseWageRial, legacy.payrollInput.dailyBaseWageRial);
});

test('clears only the selected confirmation blocker when the user enters a value', () => {
  const row = makeSavedEmployee({
    masterDataIssues: [
      { code: 'MONTHLY_WORK_DAYS_UNCONFIRMED', message: 'تأیید روزها', field: 'workDays' },
      { code: 'MONTHLY_ANNUAL_WORKED_DAYS_UNCONFIRMED', message: 'تأیید سال', field: 'annualWorkedDays' },
    ],
  });

  const updated = clearPayrollConfirmationIssue(row, 'MONTHLY_WORK_DAYS_UNCONFIRMED');
  assert.deepEqual(updated.masterDataIssues?.map((issue) => issue.code), [
    'MONTHLY_ANNUAL_WORKED_DAYS_UNCONFIRMED',
  ]);
});
