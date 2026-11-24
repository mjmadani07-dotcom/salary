import assert from 'node:assert/strict';
import test from 'node:test';
import type { EmployeeMasterRecord } from '../types/employee';
import { resolveEmployeeTerms, validateEmployeeMaster } from './employeeMaster';

function makeEmployee(overrides: Partial<EmployeeMasterRecord> = {}): EmployeeMasterRecord {
  return {
    employeeId: 'emp-1',
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
      effectiveToJalali: '1404-12-29',
      weeklyHours: 44,
      notes: '',
    }],
    wageHistory: [{
      wageEntryId: 'wage-1',
      effectiveFromJalali: '1404-01-01',
      dailyBaseWageRial: 5_000_000,
      dailySeniorityRial: 0,
      notes: '',
    }],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('valid employee master record passes validation', () => {
  assert.deepEqual(validateEmployeeMaster(makeEmployee()), []);
});

test('rejects overlapping contract periods', () => {
  const employee = makeEmployee({
    contracts: [
      ...makeEmployee().contracts,
      { ...makeEmployee().contracts[0], contractId: 'contract-2', effectiveFromJalali: '1404-06-01', effectiveToJalali: '1405-01-01' },
    ],
  });
  assert.ok(validateEmployeeMaster(employee).some((issue) => issue.code === 'OVERLAPPING_CONTRACTS'));
});

test('resolves contract and latest effective wage at payroll period start', () => {
  const employee = makeEmployee({
    contracts: [{ ...makeEmployee().contracts[0], effectiveToJalali: null }],
    wageHistory: [
      makeEmployee().wageHistory[0],
      { ...makeEmployee().wageHistory[0], wageEntryId: 'wage-2', effectiveFromJalali: '1405-01-01', dailyBaseWageRial: 8_000_000 },
    ],
  });
  const terms = resolveEmployeeTerms(employee, '1405-02-01');
  assert.equal(terms.contract?.contractId, 'contract-1');
  assert.equal(terms.wage?.dailyBaseWageRial, 8_000_000);
  assert.deepEqual(terms.issues, []);
});

test('flags an employee whose contract has expired before the payroll period', () => {
  const terms = resolveEmployeeTerms(makeEmployee(), '1405-01-01');
  assert.ok(terms.issues.some((issue) => issue.code === 'NO_ACTIVE_CONTRACT'));
});

test('flags employment that has not started by the payroll period', () => {
  const employee = makeEmployee({ hireDateJalali: '1405-02-01' });
  const terms = resolveEmployeeTerms(employee, '1405-01-01');
  assert.ok(terms.issues.some((issue) => issue.code === 'NOT_YET_HIRED'));
});
