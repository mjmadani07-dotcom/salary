import assert from 'node:assert/strict';
import test from 'node:test';
import { webcrypto } from 'node:crypto';
import {
  createOpaqueRecordId,
  createPersonnelCodeToken,
  createVaultSalt,
  decryptVaultPayload,
  derivePayrollVaultKeys,
  encryptVaultPayload,
} from './payrollVaultCrypto';

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

test('payroll vault encrypts and decrypts payloads with authenticated record identity', async () => {
  const salt = createVaultSalt();
  const keys = await derivePayrollVaultKeys('a-long-test-passphrase-2026', salt);
  const recordId = await createOpaqueRecordId(keys, 'employee', 'P-1001');
  const payload = {
    employeeId: 'P-1001',
    fullName: 'کارمند آزمایشی',
    payrollInput: { dailyBaseWageRial: 5_000_000 },
  };

  const encrypted = await encryptVaultPayload(keys, recordId, payload);
  assert.notEqual(encrypted.ciphertext, JSON.stringify(payload));
  assert.deepEqual(
    await decryptVaultPayload<typeof payload>(keys, recordId, encrypted),
    payload
  );

  await assert.rejects(
    decryptVaultPayload(keys, recordId + '-tampered', encrypted)
  );
});

test('payroll vault uses opaque deterministic IDs and personnel-code tokens', async () => {
  const keys = await derivePayrollVaultKeys(
    'another-long-test-passphrase',
    createVaultSalt()
  );

  const firstId = await createOpaqueRecordId(keys, 'employee', 'P-2001');
  const repeatedId = await createOpaqueRecordId(keys, 'employee', 'P-2001');
  const firstCodeToken = await createPersonnelCodeToken(keys, 'P-2001');
  const repeatedCodeToken = await createPersonnelCodeToken(keys, 'P-2001');
  const otherCodeToken = await createPersonnelCodeToken(keys, 'P-2002');

  assert.equal(firstId, repeatedId);
  assert.equal(firstCodeToken, repeatedCodeToken);
  assert.notEqual(firstCodeToken, otherCodeToken);
  assert.equal(firstId.includes('P-2001'), false);
  assert.equal(firstCodeToken.includes('P-2001'), false);
});
