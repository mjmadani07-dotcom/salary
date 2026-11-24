import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateLeaveClosingBalance,
  createLeaveId,
  getSuggestedLeaveOpeningBalance,
  validateMonthlyLeave,
} from './leaveLedger';

const valid = {
  employeeId: 'emp-1', personnelCode: '1001', fiscalYear: '1405' as const, month: 2,
  openingBalanceDays: 5, accruedDays: 2.17, paidLeaveUsedDays: 1,
  unpaidLeaveUsedDays: 2, adjustmentDays: 0, notes: '',
};

test('calculates closing balance without deducting unpaid leave', () => {
  assert.equal(calculateLeaveClosingBalance(valid), 6.17);
  assert.deepEqual(validateMonthlyLeave(valid), []);
});

test('rejects paid leave usage beyond available balance', () => {
  assert.ok(validateMonthlyLeave({ ...valid, paidLeaveUsedDays: 8 })
    .some(issue => issue.code === 'NEGATIVE_LEAVE_BALANCE'));
});

test('supports negative adjustments and stable employee-period IDs', () => {
  assert.equal(calculateLeaveClosingBalance({ ...valid, adjustmentDays: -1 }), 5.17);
  assert.equal(createLeaveId('emp-1', '1405', 2), 'emp-1:1405:02');
});

test('carries forward the most recent earlier closing balance', () => {
  assert.equal(getSuggestedLeaveOpeningBalance([
    { month: 1, closingBalanceDays: 4.5 },
    { month: 3, closingBalanceDays: 7 },
  ], 4, 2), 7);
  assert.equal(getSuggestedLeaveOpeningBalance([], 1, 2), 2);
});
