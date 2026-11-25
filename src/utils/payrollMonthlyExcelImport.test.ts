import assert from 'node:assert/strict';
import test from 'node:test';
import { PAYROLL_MONTHLY_EXCEL_HEADERS, parsePayrollMonthlyExcelPaste } from './payrollMonthlyExcelImport';

function makeRow(overrides: Record<number, string> = {}): string {
  const cells = [
    'PAY-1405-01-P001', '1405', '1', 'P001', '31', '27', '2', '1', '1',
    '8', '4', '3', '1', '120000', '80000', '50000', '30000', '15000',
    '5000', '-2500', '1405/01/31', 'یادداشت ماهانه',
  ];
  for (const [index, value] of Object.entries(overrides)) cells[Number(index)] = value;
  return cells.join('\t');
}

test('parses the exact 22-column monthly workbook layout and converts toman to rial', () => {
  const result = parsePayrollMonthlyExcelPaste([
    PAYROLL_MONTHLY_EXCEL_HEADERS.join('\t'),
    makeRow(),
  ].join('\n'));

  assert.equal(result.headerDetected, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 1);
  const row = result.rows[0];
  assert.equal(row.personnelCode, 'P001');
  assert.equal(row.workDays, 27);
  assert.equal(row.paidLeaveDays, 2);
  assert.equal(row.fridayHours, 3);
  assert.equal(row.missionDays, 1);
  assert.equal(row.insuredBenefitsRial, 1_200_000);
  assert.equal(row.nonInsuredBenefitsRial, 800_000);
  assert.equal(row.variableBonusRial, 500_000);
  assert.equal(row.loanDeductionRial, 300_000);
  assert.equal(row.advanceDeductionRial, 150_000);
  assert.equal(row.otherDeductionsRial, 50_000);
  assert.equal(row.signedCorrectionRial, -25_000);
  assert.equal(row.paymentDate, '1405-01-31');
});

test('normalizes Persian digits, generates a missing payslip id and ignores blank template rows', () => {
  const blankTemplate = ['', '۱۴۰۵', '۱', '', '۳۱', '۰', '۰', '۰', '۰', '۰', '۰', '۰', '۰',
    '۰', '۰', '۰', '۰', '۰', '۰', '۰', '', ''].join('\t');
  const row = makeRow({
    0: '',
    1: '۱۴۰۵',
    2: '۱',
    3: 'P002',
    4: '۳۱',
    5: '۲۹',
    13: '۱٬۲۰۰',
  });
  const result = parsePayrollMonthlyExcelPaste([blankTemplate, row].join('\n'));

  assert.deepEqual(result.errors, []);
  assert.equal(result.ignoredBlankRows, 1);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].year, '1405');
  assert.equal(result.rows[0].month, 1);
  assert.equal(result.rows[0].workDays, 29);
  assert.equal(result.rows[0].payslipId, '1405-01-P002');
  assert.equal(result.rows[0].insuredBenefitsRial, 12_000);
});

test('rejects duplicate personnel, invalid days and wrong column counts', () => {
  const duplicate = makeRow();
  const invalid = makeRow({ 0: 'PAY-1405-01-P002', 3: 'P002', 5: '32' });
  const result = parsePayrollMonthlyExcelPaste([
    duplicate,
    duplicate,
    invalid,
    'only\ttwo',
  ].join('\n'));

  assert.ok(result.errors.some((message) => message.includes('تکراری')));
  assert.ok(result.errors.some((message) => message.includes('روز کارکرد')));
  assert.ok(result.errors.some((message) => message.includes('۲۲ ستون')));
});

test('rejects an unexpected header order rather than silently shifting source fields', () => {
  const headers = [...PAYROLL_MONTHLY_EXCEL_HEADERS];
  [headers[4], headers[5]] = [headers[5], headers[4]];
  const result = parsePayrollMonthlyExcelPaste([headers.join('\t'), makeRow()].join('\n'));

  assert.ok(result.errors.some((message) => message.includes('سرستون‌های فایل')));
});
