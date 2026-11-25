import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePayrollGridPasteCell } from './payrollGridClipboard';

test('parses Persian digits and grouping separators from Excel cells', () => {
  assert.deepEqual(parsePayrollGridPasteCell('workDays', '۲۱'), {
    valid: true,
    empty: false,
    value: 21,
  });
  assert.deepEqual(parsePayrollGridPasteCell('overtimeHours', '1,250'), {
    valid: true,
    empty: false,
    value: 1250,
  });
});

test('converts pasted bonus amounts from the visible currency unit to Rial', () => {
  assert.deepEqual(parsePayrollGridPasteCell('variableBonusRial', '۱۲,۵۰۰', 10), {
    valid: true,
    empty: false,
    value: 125_000,
  });
});

test('parses Persian yes/no values for statutory and family facts', () => {
  assert.deepEqual(parsePayrollGridPasteCell('isMarried', 'متأهل'), {
    valid: true,
    empty: false,
    value: true,
  });
  assert.deepEqual(parsePayrollGridPasteCell('has720DaysInsurance', 'ندارد'), {
    valid: true,
    empty: false,
    value: false,
  });
});

test('recognizes Persian and Arabic digits in boolean cells', () => {
  assert.deepEqual(parsePayrollGridPasteCell('isMarried', '۱'), {
    valid: true,
    empty: false,
    value: true,
  });
  assert.deepEqual(parsePayrollGridPasteCell('has720DaysInsurance', '٠'), {
    valid: true,
    empty: false,
    value: false,
  });
});

test('handles empty and invalid clipboard cells explicitly', () => {
  assert.deepEqual(parsePayrollGridPasteCell('workDays', ''), {
    valid: true,
    empty: true,
    value: 0,
  });
  assert.deepEqual(parsePayrollGridPasteCell('isMarried', ''), {
    valid: true,
    empty: true,
  });
  assert.deepEqual(parsePayrollGridPasteCell('childrenCount', 'نامشخص'), {
    valid: false,
    empty: false,
  });
});
