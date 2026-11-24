import assert from 'node:assert/strict';
import test from 'node:test';

import { calculatePayroll } from './payrollEngine';
import {
  buildPayrollExcelWorkbook,
  buildPayrollRunExcelWorkbook,
} from './excelWorkbookBuilder';
import { calculatePayrollRun } from './payrollRunEngine';
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

function readSummaryValue(
  workbook: Awaited<ReturnType<typeof buildPayrollExcelWorkbook>>,
  label: string
): unknown {
  const sheet = workbook.getWorksheet('خلاصه حقوق');
  assert.ok(sheet, 'summary worksheet must exist');

  let value: unknown;
  sheet.eachRow((row) => {
    if (row.getCell(1).value === label) value = row.getCell(2).value;
  });
  return value;
}

test('Excel workbook exports exact amounts from the central calculation result', async () => {
  const input = makeInput({
    isMarried: true,
    childrenCount: 2,
    has720DaysInsurance: true,
    overtimeHours: 3,
    nightShiftHours: 2,
    holidayHours: 1,
    variableBonusRial: 25_000_000,
  });
  const result = calculatePayroll(input);
  const workbook = await buildPayrollExcelWorkbook({
    employeeCode: 'T-001',
    employeeName: 'کارمند آزمون',
    input,
    result,
  });

  assert.equal(readSummaryValue(workbook, 'جمع ناخالص'), result.grossEarningsRial);
  assert.equal(readSummaryValue(workbook, 'بیمه سهم کارگر'), result.employeeInsuranceRial);
  assert.equal(readSummaryValue(workbook, 'مالیات حقوق'), result.totalPayrollTaxRial);
  assert.equal(readSummaryValue(workbook, 'خالص پرداختی'), result.netPayRial);
  assert.equal(readSummaryValue(workbook, 'هزینه مستقیم کارفرما'), result.totalEmployerCostRial);
  assert.equal(readSummaryValue(workbook, 'شناسه مجموعه قواعد'), result.ruleSetId);
});

test('Excel workbook contains no independent formula cells', async () => {
  const input = makeInput({ overtimeHours: 2, variableBonusRial: 10_000_000 });
  const result = calculatePayroll(input);
  const workbook = await buildPayrollExcelWorkbook({
    employeeName: 'کارمند بدون فرمول',
    input,
    result,
  });

  let formulaCount = 0;
  workbook.worksheets.forEach((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        const value = cell.value;
        if (value && typeof value === 'object' && 'formula' in value) {
          formulaCount += 1;
        }
      });
    });
  });

  assert.equal(formulaCount, 0);
});

test('Excel export rejects a calculation produced by a different RuleSet version', async () => {
  const input = makeInput();
  const result = calculatePayroll(input);

  await assert.rejects(
    () =>
      buildPayrollExcelWorkbook({
        employeeName: 'نسخه ناسازگار',
        input,
        result: { ...result, ruleSetVersion: result.ruleSetVersion + 1 },
      }),
    /RuleSet does not match/
  );
});

test('Excel detail sheet includes central pay-item classifications', async () => {
  const input = makeInput({ isMarried: true, childrenCount: 1, has720DaysInsurance: true });
  const result = calculatePayroll(input);
  const workbook = await buildPayrollExcelWorkbook({
    employeeName: 'جزئیات آزمون',
    input,
    result,
  });
  const detail = workbook.getWorksheet('جزئیات اقلام');

  assert.ok(detail);
  assert.equal(detail.getCell('A1').value, 'شناسه قلم');
  assert.ok(
    detail.getColumn(1).values.includes('child-allowance'),
    'detail export must include the child allowance pay item'
  );
});

test('multi-employee Excel register exports every PayrollRunResult without formulas', async () => {
  const firstInput = makeInput();
  const secondInput = makeInput({ dailyBaseWageRial: 10_000_000 });
  const run = calculatePayrollRun(
    { runId: 'PAY-1405-01', fiscalYear: '1405', month: 1, monthDays: 30 },
    [
      {
        employeeId: 'emp-001',
        personnelCode: 'P-001',
        fullName: 'کارمند اول',
        isActive: true,
        payrollInput: firstInput,
      },
      {
        employeeId: 'emp-002',
        personnelCode: 'P-002',
        fullName: 'کارمند دوم',
        isActive: true,
        payrollInput: secondInput,
      },
    ]
  );
  const workbook = await buildPayrollRunExcelWorkbook(run);
  const register = workbook.getWorksheet('لیست حقوق');

  assert.ok(register);
  assert.equal(register.rowCount, 3);
  assert.equal(register.getCell('A2').value, 'P-001');
  assert.equal(register.getCell('A3').value, 'P-002');
  assert.equal(
    register.getCell('O2').value,
    run.lines[0].result?.grossEarningsRial
  );

  let formulaCount = 0;
  workbook.worksheets.forEach((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        const value = cell.value;
        if (value && typeof value === 'object' && 'formula' in value) {
          formulaCount += 1;
        }
      });
    });
  });
  assert.equal(formulaCount, 0);
});
