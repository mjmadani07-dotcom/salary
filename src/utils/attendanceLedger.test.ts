import assert from 'node:assert/strict';
import test from 'node:test';
import { createAttendanceId, validateMonthlyAttendance } from './attendanceLedger';

const valid = {
  employeeId: 'emp-1', personnelCode: '1001', fiscalYear: '1405' as const,
  month: 2, monthDays: 30 as const, workedDays: 26, overtimeHours: 12,
  nightShiftHours: 8, holidayHours: 0, variableBonusRial: 0,
  annualWorkedDays: 60, notes: '',
};

test('validates monthly attendance values and bounds', () => {
  assert.deepEqual(validateMonthlyAttendance(valid), []);
  assert.ok(validateMonthlyAttendance({ ...valid, workedDays: 31 }).some(x => x.code === 'INVALID_WORKED_DAYS'));
  assert.ok(validateMonthlyAttendance({ ...valid, overtimeHours: -1 }).some(x => x.code === 'INVALID_OVERTIMEHOURS'));
});

test('creates a stable employee-period attendance key', () => {
  assert.equal(createAttendanceId('emp-1', '1405', 2), 'emp-1:1405:02');
});
