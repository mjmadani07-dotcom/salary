import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PAYROLL_BACKUP_FORMAT,
  PAYROLL_BACKUP_STORE_NAMES,
  validatePayrollDatabaseBackup,
} from './payrollDatabaseBackup';

function makeBackup(overrides: Record<string, unknown> = {}) {
  const stores = Object.fromEntries(PAYROLL_BACKUP_STORE_NAMES.map((name) => [name, []]));
  return {
    format: PAYROLL_BACKUP_FORMAT,
    formatVersion: 1,
    sourceDatabaseVersion: 7,
    createdAt: '2026-11-25T12:00:00.000Z',
    vaultConfigured: false,
    stores,
    ...overrides,
  };
}

test('accepts a complete unencrypted database backup', () => {
  const backup = makeBackup();
  const validated = validatePayrollDatabaseBackup(backup, 7);
  assert.equal(validated.vaultConfigured, false);
  assert.deepEqual(Object.keys(validated.stores), [...PAYROLL_BACKUP_STORE_NAMES]);
});

test('accepts an encrypted backup only with Vault metadata', () => {
  const backup = makeBackup({
    vaultConfigured: true,
    stores: {
      ...makeBackup().stores as Record<string, unknown>,
      vaultMetadata: [{ id: 'vault', formatVersion: 1 }],
      encryptedRecords: [{ id: 'payrollRun:opaque', kind: 'payrollRun', iv: 'iv', ciphertext: 'data' }],
    },
  });
  assert.equal(validatePayrollDatabaseBackup(backup, 7).vaultConfigured, true);
});

test('rejects a newer database backup, unknown store and missing store data', () => {
  assert.throws(
    () => validatePayrollDatabaseBackup(makeBackup({ sourceDatabaseVersion: 8 }), 7),
    /نسخه پایگاه داده/
  );
  assert.throws(
    () => validatePayrollDatabaseBackup(makeBackup({
      stores: { ...makeBackup().stores as object, surprise: [] },
    }), 7),
    /مخزن ناشناخته/
  );
  const missing = { ...makeBackup(), stores: { ...makeBackup().stores as object } } as Record<string, unknown>;
  delete (missing.stores as Record<string, unknown>).payrollRuns;
  assert.throws(() => validatePayrollDatabaseBackup(missing, 7), /payrollRuns/);
});

test('rejects inconsistent encryption state and malformed record arrays', () => {
  const inconsistent = makeBackup({
    stores: { ...makeBackup().stores as object, encryptedRecords: [{ id: 'x' }] },
  });
  assert.throws(() => validatePayrollDatabaseBackup(inconsistent, 7), /با محتوای مخازن/);

  const malformed = makeBackup({
    stores: { ...makeBackup().stores as object, payrollRuns: ['not-a-record'] },
  });
  assert.throws(() => validatePayrollDatabaseBackup(malformed, 7), /ساختار معتبری/);
});
