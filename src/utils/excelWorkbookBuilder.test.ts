import assert from 'node:assert/strict';
import test from 'node:test';

import { calculatePayroll } from './payrollEngine';
import {
  buildPayrollExcelWorkbook,
  buildPayrollRunExcelWorkbook,
  buildPayrollSettlementExcelWorkbook,
} from './excelWorkbookBuilder';
import type { PayrollSettlementCase } from '../types/payrollSettlement';
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

test('multi-employee export contains calculation, payslip, monthly summary, bank and settlement outputs', async () => {
  const firstInput = makeInput({
    paidLeaveDays: 2,
    sickLeaveDays: 1,
    unpaidAbsenceDays: 1,
    fridayHours: 3,
    missionDays: 1,
    insuredBenefitsRial: 1_200_000,
    nonInsuredBenefitsRial: 800_000,
    loanDeductionRial: 300_000,
    advanceDeductionRial: 150_000,
    otherDeductionsRial: 50_000,
    signedCorrectionRial: -25_000,
    payslipId: 'PAY-1405-01-P001',
    paymentDate: '1405-02-01',
    monthlyNotes: 'یادداشت خروجی',
  });
  const run = calculatePayrollRun(
    { runId: 'PAY-1405-01-OUTPUT', fiscalYear: '1405', month: 1, monthDays: 30 },
    [{
      employeeId: 'emp-001',
      personnelCode: 'P-001',
      fullName: 'کارمند اول',
      isActive: true,
      payrollInput: firstInput,
      jobTitle: 'کارشناس مالی',
      costCenter: 'اداری',
      bankAccountNumber: '0012345678',
      bankIban: 'IR000000000000000000000000',
      insuranceNumber: 'INS-001',
      hireDateJalali: '1400-01-01',
      leaveBalanceDays: 7.5,
    }],
  );
  const result = run.lines[0].result;
  assert.ok(result);

  const workbook = await buildPayrollRunExcelWorkbook(run);
  const calculations = workbook.getWorksheet('محاسبات حقوق');
  const summary = workbook.getWorksheet('خلاصه ماهانه');
  const bank = workbook.getWorksheet('لیست پرداخت بانکی');
  const settlement = workbook.getWorksheet('عیدی و تسویه');
  const payslip = workbook.getWorksheet('فیش P-001');

  assert.ok(calculations);
  assert.ok(summary);
  assert.ok(bank);
  assert.ok(settlement);
  assert.ok(payslip);

  assert.equal(calculations.getCell('A2').value, 'PAY-1405-01-P001');
  assert.equal(calculations.getCell('F2').value, 'کارشناس مالی');
  assert.equal(calculations.getCell('G2').value, 'اداری');
  assert.equal(calculations.getCell('S2').value, result.fridayWorkPayRial);
  assert.equal(calculations.getCell('T2').value, result.missionPayRial);
  assert.equal(calculations.getCell('U2').value, result.insuredBenefitsRial);
  assert.equal(calculations.getCell('X2').value, result.signedCorrectionRial);
  assert.equal(calculations.getCell('Y2').value, result.grossEarningsRial);
  assert.equal(calculations.getCell('AN2').value, 'محاسبه شد - نیازمند بررسی و تأیید');
  assert.equal(calculations.getCell('BA2').value, 'یادداشت خروجی');

  assert.equal(bank.getCell('C2').value, '0012345678');
  assert.equal(bank.getCell('E2').value, result.netPayRial);
  assert.equal(bank.getCell('F2').value, 'PAY-1405-01-P001');

  let costCenterRow: number | undefined;
  summary.eachRow((row, rowNumber) => {
    if (row.getCell(3).value === 'اداری') costCenterRow = rowNumber;
  });
  assert.ok(costCenterRow);
  assert.equal(summary.getCell(costCenterRow, 5).value, result.grossEarningsRial);

  assert.equal(payslip.getCell('A1').value, 'فیش حقوق و دستمزد');
  assert.ok(payslip.rowCount > 20);
  assert.equal(settlement.getCell('A1').value?.toString().startsWith('توجه:'), true);
  assert.equal(settlement.getCell('D3').value, firstInput.annualWorkedDays);
  assert.equal(settlement.getCell('K3').value, 7.5);
  assert.equal(settlement.getCell('N3').value, result.eidPayableRial + result.severancePayableRial);

  let formulaCount = 0;
  workbook.worksheets.forEach((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        const value = cell.value;
        if (value && typeof value === 'object' && 'formula' in value) formulaCount += 1;
      });
    });
  });
  assert.equal(formulaCount, 0);
});

test('settlement export preserves inputs, calculation results, legal warnings and workflow audit without formulas', async () => {
  const settlementCase: PayrollSettlementCase = {
    settlementId: 'SET-001',
    employeeId: 'emp-001',
    personnelCode: 'P-001',
    employeeName: 'کارمند تسویه',
    fiscalYear: '1405',
    hireDateJalali: '1400-01-01',
    terminationDateJalali: '1405-06-31',
    reason: 'contract-end',
    monthsWorkedInYear: 6,
    annualWorkedDays: 184,
    annualCalendarDays: 365,
    eidDailyWageBasisRial: 8_000_000,
    eidWageBasisReference: 'حکم مزد',
    eidWageBasisConfirmed: true,
    severanceMonthlyWageBasisRial: 240_000_000,
    severanceWageBasisReference: 'آخرین فیش',
    severanceWageBasisConfirmed: true,
    leaveBalanceDays: 12,
    leaveBalanceConfirmed: true,
    leaveDailyBasisRial: 9_000_000,
    leaveBasisReference: 'گزارش حق‌السعی',
    leaveBasisConfirmed: true,
    eidAdvancePaidRial: 10_000_000,
    eidAdvanceReference: 'فیش خرداد',
    priorSeverancePaidRial: 0,
    priorSeveranceReference: '',
    otherClaimsRial: 15_000_000,
    otherClaimsDescription: 'مطالبات تأییدشده',
    approvedDeductionsRial: 0,
    deductionAuthorizationReference: '',
    medicalCommissionReference: '',
    legalBasisReference: '',
    notes: 'پرونده آزمون',
    status: 'approved',
    calculation: {
      ruleSetId: 'iran-1405',
      ruleSetVersion: 1,
      ruleSetApprovalStatus: 'pending',
      completedServiceYears: 5,
      additionalServiceDays: 185,
      recognizedServiceYears: 5 + 185 / 365,
      eidMaximumBeforeProrationRial: 480_000_000,
      eidEntitlementRial: Math.round(480_000_000 * 184 / 365),
      eidAdvancePaidRial: 10_000_000,
      eidBalanceRial: Math.round(480_000_000 * 184 / 365) - 10_000_000,
      severanceMultiplier: 1,
      severanceEntitlementRial: 1_000_000_000,
      priorSeverancePaidRial: 0,
      severanceBalanceRial: 1_000_000_000,
      leaveEncashmentRial: 108_000_000,
      otherClaimsRial: 15_000_000,
      totalGrossEntitlementRial: 1_000_000_000,
      approvedDeductionsRial: 0,
      payableBeforeTaxRial: 1_000_000_000,
      legalReviewRequiredItems: ['مبنای مزد نیازمند تأیید'],
    },
    createdAt: '2026-11-25T10:00:00.000Z',
    updatedAt: '2026-11-25T11:00:00.000Z',
    approverName: 'مدیر مالی',
    approvalReference: 'FIN-001',
    approvedAt: '2026-11-25T11:00:00.000Z',
    auditTrail: [{
      eventId: 'EV-001',
      eventType: 'approved',
      occurredAt: '2026-11-25T11:00:00.000Z',
      status: 'approved',
      actorName: 'مدیر مالی',
      reference: 'FIN-001',
    }],
  };

  const workbook = await buildPayrollSettlementExcelWorkbook([settlementCase]);
  const sheet = workbook.getWorksheet('پرونده‌های تسویه');
  const audit = workbook.getWorksheet('گردش پرونده‌ها');
  const guide = workbook.getWorksheet('راهنمای خروجی');

  assert.ok(sheet);
  assert.ok(audit);
  assert.ok(guide);
  assert.equal(sheet.getCell('A2').value, 'SET-001');
  assert.equal(sheet.getCell('H2').value, 6);
  assert.equal(sheet.getCell('I2').value, 184);
  assert.equal(sheet.getCell('R2').value, settlementCase.calculation.eidEntitlementRial);
  assert.equal(sheet.getCell('AF2').value, 108_000_000);
  assert.equal(sheet.getCell('AM2').value, 'approved');
  assert.equal(audit.getCell('A2').value, 'SET-001');
  assert.equal(audit.getCell('H2').value, 'مدیر مالی');
  assert.ok(String(guide.getCell('A1').value).includes('قبل از مالیات'));

  let formulaCount = 0;
  workbook.worksheets.forEach((worksheet) => worksheet.eachRow((row) => row.eachCell((cell) => {
    const value = cell.value;
    if (value && typeof value === 'object' && 'formula' in value) formulaCount += 1;
  })));
  assert.equal(formulaCount, 0);
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
        jobTitle: 'کارشناس مالی',
        costCenter: 'اداری',
        bankAccountNumber: '0012345678',
        bankIban: 'IR000000000000000000000000',
        insuranceNumber: 'INS-001',
        hireDateJalali: '1400-01-01',
        leaveBalanceDays: 7.5,
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
