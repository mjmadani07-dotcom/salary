import type { PayrollRunEmployee, PayrollRunResult } from '../utils/payrollRunEngine';
import {
  createOpaqueRecordId,
  createPersonnelCodeToken,
  createVaultSalt,
  decryptVaultPayload,
  derivePayrollVaultKeys,
  encryptVaultPayload,
  getVaultFormatVersion,
  getVaultKdfIterations,
} from '../utils/payrollVaultCrypto';
import type {
  PayrollVaultKeys,
  VaultCiphertext,
} from '../utils/payrollVaultCrypto';

const DATABASE_NAME = 'iran-payroll-local';
const DATABASE_VERSION = 2;
const EMPLOYEE_STORE = 'employees';
const PAYROLL_RUN_STORE = 'payrollRuns';
const ENCRYPTED_RECORD_STORE = 'encryptedRecords';
const VAULT_METADATA_STORE = 'vaultMetadata';
const VAULT_METADATA_ID = 'vault';
const VAULT_VERIFIER_ID = 'iran-payroll-local-vault-verifier-v1';
const VAULT_VERIFIER_VALUE = 'iran-payroll-local-vault-ready';

interface StoredEmployee extends PayrollRunEmployee {
  updatedAt: string;
}

export interface StoredPayrollRun extends PayrollRunResult {
  savedAt: string;
}

interface VaultMetadata {
  id: typeof VAULT_METADATA_ID;
  formatVersion: number;
  kdf: 'PBKDF2-HMAC-SHA-256';
  kdfIterations: number;
  salt: string;
  verifier: VaultCiphertext;
  createdAt: string;
}

interface EncryptedRecord extends VaultCiphertext {
  id: string;
  kind: 'employee' | 'payrollRun';
  personnelCodeToken?: string;
  updatedAt: string;
}

interface LegacyRecords {
  employees: StoredEmployee[];
  payrollRuns: StoredPayrollRun[];
}

export interface PayrollVaultStatus {
  configured: boolean;
  unlocked: boolean;
  legacyRecordsCount: number;
}

let databasePromise: Promise<IDBDatabase> | null = null;
let unlockedVaultKeys: PayrollVaultKeys | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(
      new Error('مرورگر یا محیط اجرا از IndexedDB پشتیبانی نمی‌کند.')
    );
  }

  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(EMPLOYEE_STORE)) {
        const employeeStore = database.createObjectStore(EMPLOYEE_STORE, {
          keyPath: 'employeeId',
        });
        employeeStore.createIndex('personnelCode', 'personnelCode', { unique: true });
        employeeStore.createIndex('fullName', 'fullName', { unique: false });
      }

      if (!database.objectStoreNames.contains(PAYROLL_RUN_STORE)) {
        const runStore = database.createObjectStore(PAYROLL_RUN_STORE, {
          keyPath: 'runId',
        });
        runStore.createIndex('savedAt', 'savedAt', { unique: false });
      }

      if (!database.objectStoreNames.contains(ENCRYPTED_RECORD_STORE)) {
        const encryptedStore = database.createObjectStore(ENCRYPTED_RECORD_STORE, {
          keyPath: 'id',
        });
        encryptedStore.createIndex('kind', 'kind', { unique: false });
        encryptedStore.createIndex('personnelCodeToken', 'personnelCodeToken', {
          unique: true,
        });
      }

      if (!database.objectStoreNames.contains(VAULT_METADATA_STORE)) {
        database.createObjectStore(VAULT_METADATA_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
        unlockedVaultKeys = null;
      };
      resolve(database);
    };

    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error('باز کردن پایگاه داده محلی ناموفق بود.'));
    };

    request.onblocked = () => {
      databasePromise = null;
      reject(new Error('پایگاه داده توسط یک پنجره دیگر قفل شده است؛ پنجره‌های دیگر نرم‌افزار را ببندید.'));
    };
  });

  return databasePromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('عملیات پایگاه داده ناموفق بود.'));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('تراکنش پایگاه داده لغو شد.'));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('خطا در تراکنش پایگاه داده.'));
  });
}

function requireUnlockedKeys(): PayrollVaultKeys {
  if (!unlockedVaultKeys) {
    throw new Error('خزانه اطلاعات قفل است؛ ابتدا با عبارت عبور آن را باز کنید.');
  }
  return unlockedVaultKeys;
}

async function readLegacyRecords(database: IDBDatabase): Promise<LegacyRecords> {
  const transaction = database.transaction(
    [EMPLOYEE_STORE, PAYROLL_RUN_STORE],
    'readonly'
  );
  const completed = transactionComplete(transaction);
  const [employees, payrollRuns] = await Promise.all([
    requestResult(
      transaction.objectStore(EMPLOYEE_STORE).getAll() as IDBRequest<StoredEmployee[]>
    ),
    requestResult(
      transaction.objectStore(PAYROLL_RUN_STORE).getAll() as IDBRequest<StoredPayrollRun[]>
    ),
  ]);
  await completed;
  return { employees, payrollRuns };
}

async function readVaultMetadata(
  database: IDBDatabase
): Promise<VaultMetadata | undefined> {
  const transaction = database.transaction(VAULT_METADATA_STORE, 'readonly');
  const completed = transactionComplete(transaction);
  const metadata = await requestResult(
    transaction.objectStore(VAULT_METADATA_STORE).get(VAULT_METADATA_ID) as IDBRequest<
      VaultMetadata | undefined
    >
  );
  await completed;
  return metadata;
}

function createEncryptedEmployee(
  keys: PayrollVaultKeys,
  employee: StoredEmployee
): Promise<EncryptedRecord> {
  return Promise.all([
    createOpaqueRecordId(keys, 'employee', employee.employeeId),
    createPersonnelCodeToken(keys, employee.personnelCode),
  ]).then(async ([id, personnelCodeToken]) => ({
    id,
    kind: 'employee',
    personnelCodeToken,
    ...(await encryptVaultPayload(keys, id, employee)),
    updatedAt: employee.updatedAt,
  }));
}

async function createEncryptedPayrollRun(
  keys: PayrollVaultKeys,
  run: StoredPayrollRun
): Promise<EncryptedRecord> {
  const id = await createOpaqueRecordId(keys, 'payrollRun', run.runId);
  return {
    id,
    kind: 'payrollRun',
    ...(await encryptVaultPayload(keys, id, run)),
    updatedAt: run.savedAt,
  };
}

async function migrateLegacyRecords(
  database: IDBDatabase,
  keys: PayrollVaultKeys
): Promise<number> {
  const legacy = await readLegacyRecords(database);
  if (legacy.employees.length === 0 && legacy.payrollRuns.length === 0) return 0;

  const encryptedRecords = await Promise.all([
    ...legacy.employees.map((employee) =>
      createEncryptedEmployee(keys, employee)
    ),
    ...legacy.payrollRuns.map((run) =>
      createEncryptedPayrollRun(keys, run)
    ),
  ]);

  const transaction = database.transaction(
    [
      ENCRYPTED_RECORD_STORE,
      EMPLOYEE_STORE,
      PAYROLL_RUN_STORE,
    ],
    'readwrite'
  );
  const completed = transactionComplete(transaction);
  const encryptedStore = transaction.objectStore(ENCRYPTED_RECORD_STORE);

  for (const record of encryptedRecords) encryptedStore.put(record);
  transaction.objectStore(EMPLOYEE_STORE).clear();
  transaction.objectStore(PAYROLL_RUN_STORE).clear();

  await completed;
  return encryptedRecords.length;
}

export async function getPayrollVaultStatus(): Promise<PayrollVaultStatus> {
  const database = await openDatabase();
  const [metadata, legacy] = await Promise.all([
    readVaultMetadata(database),
    readLegacyRecords(database),
  ]);

  return {
    configured: Boolean(metadata),
    unlocked: Boolean(unlockedVaultKeys),
    legacyRecordsCount: legacy.employees.length + legacy.payrollRuns.length,
  };
}

export async function initializePayrollVault(passphrase: string): Promise<void> {
  if (passphrase.length < 12) {
    throw new Error('عبارت عبور باید حداقل ۱۲ نویسه داشته باشد.');
  }

  const database = await openDatabase();
  const existingMetadata = await readVaultMetadata(database);
  if (existingMetadata) {
    throw new Error('خزانه قبلاً راه‌اندازی شده است؛ از گزینه بازکردن خزانه استفاده کنید.');
  }

  const legacy = await readLegacyRecords(database);
  const salt = createVaultSalt();
  const keys = await derivePayrollVaultKeys(passphrase, salt);
  const verifier = await encryptVaultPayload(keys, VAULT_VERIFIER_ID, {
    value: VAULT_VERIFIER_VALUE,
  });

  const [encryptedEmployees, encryptedRuns] = await Promise.all([
    Promise.all(
      legacy.employees.map((employee) => createEncryptedEmployee(keys, employee))
    ),
    Promise.all(
      legacy.payrollRuns.map((run) => createEncryptedPayrollRun(keys, run))
    ),
  ]);

  const metadata: VaultMetadata = {
    id: VAULT_METADATA_ID,
    formatVersion: getVaultFormatVersion(),
    kdf: 'PBKDF2-HMAC-SHA-256',
    kdfIterations: getVaultKdfIterations(),
    salt: toBase64(salt),
    verifier,
    createdAt: new Date().toISOString(),
  };

  const transaction = database.transaction(
    [
      VAULT_METADATA_STORE,
      ENCRYPTED_RECORD_STORE,
      EMPLOYEE_STORE,
      PAYROLL_RUN_STORE,
    ],
    'readwrite'
  );
  const completed = transactionComplete(transaction);

  // add() makes concurrent first-time setup attempts mutually exclusive.
  transaction.objectStore(VAULT_METADATA_STORE).add(metadata);
  const encryptedStore = transaction.objectStore(ENCRYPTED_RECORD_STORE);
  for (const record of [...encryptedEmployees, ...encryptedRuns]) {
    encryptedStore.put(record);
  }
  transaction.objectStore(EMPLOYEE_STORE).clear();
  transaction.objectStore(PAYROLL_RUN_STORE).clear();

  await completed;
  unlockedVaultKeys = keys;
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function unlockPayrollVault(passphrase: string): Promise<void> {
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);
  if (!metadata) {
    throw new Error('خزانه هنوز راه‌اندازی نشده است.');
  }
  if (
    metadata.formatVersion !== getVaultFormatVersion() ||
    metadata.kdf !== 'PBKDF2-HMAC-SHA-256' ||
    !Number.isInteger(metadata.kdfIterations) ||
    metadata.kdfIterations < 600_000 ||
    metadata.kdfIterations > 2_000_000
  ) {
    throw new Error('نسخه یا پارامترهای رمزنگاری خزانه پشتیبانی نمی‌شود.');
  }

  const keys = await derivePayrollVaultKeys(
    passphrase,
    fromBase64(metadata.salt),
    metadata.kdfIterations
  );

  try {
    const verifier = await decryptVaultPayload<{ value: string }>(
      keys,
      VAULT_VERIFIER_ID,
      metadata.verifier
    );
    if (verifier.value !== VAULT_VERIFIER_VALUE) throw new Error('Invalid verifier');
  } catch {
    throw new Error('عبارت عبور نادرست است یا اطلاعات اعتبارسنجی خزانه آسیب دیده است.');
  }

  await migrateLegacyRecords(database, keys);
  unlockedVaultKeys = keys;
}

export function lockPayrollVault(): void {
  unlockedVaultKeys = null;
}

export function isPayrollVaultUnlocked(): boolean {
  return Boolean(unlockedVaultKeys);
}

async function getEncryptedRecords(
  kind: EncryptedRecord['kind']
): Promise<EncryptedRecord[]> {
  const database = await openDatabase();
  const transaction = database.transaction(ENCRYPTED_RECORD_STORE, 'readonly');
  const completed = transactionComplete(transaction);
  const records = await requestResult(
    transaction
      .objectStore(ENCRYPTED_RECORD_STORE)
      .index('kind')
      .getAll(kind) as IDBRequest<EncryptedRecord[]>
  );
  await completed;
  return records;
}

async function getEncryptedRecord(
  id: string
): Promise<EncryptedRecord | undefined> {
  const database = await openDatabase();
  const transaction = database.transaction(ENCRYPTED_RECORD_STORE, 'readonly');
  const completed = transactionComplete(transaction);
  const record = await requestResult(
    transaction.objectStore(ENCRYPTED_RECORD_STORE).get(id) as IDBRequest<
      EncryptedRecord | undefined
    >
  );
  await completed;
  return record;
}

export async function listSavedEmployees(): Promise<PayrollRunEmployee[]> {
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);

  if (!metadata) {
    const transaction = database.transaction(EMPLOYEE_STORE, 'readonly');
    const completed = transactionComplete(transaction);
    const employees = await requestResult(
      transaction.objectStore(EMPLOYEE_STORE).getAll() as IDBRequest<StoredEmployee[]>
    );
    await completed;
    return employees
      .sort((left, right) => left.personnelCode.localeCompare(right.personnelCode))
      .map(({ updatedAt: _updatedAt, ...employee }) => employee);
  }

  const keys = requireUnlockedKeys();
  const records = await getEncryptedRecords('employee');
  const employees = await Promise.all(
    records.map((record) =>
      decryptVaultPayload<StoredEmployee>(keys, record.id, record)
    )
  );

  return employees
    .sort((left, right) => left.personnelCode.localeCompare(right.personnelCode))
    .map(({ updatedAt: _updatedAt, ...employee }) => employee);
}

export async function saveEmployee(
  employee: PayrollRunEmployee
): Promise<void> {
  const normalized: StoredEmployee = {
    ...employee,
    employeeId: employee.employeeId.trim(),
    personnelCode: employee.personnelCode.trim(),
    fullName: employee.fullName.trim(),
    updatedAt: new Date().toISOString(),
  };
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);

  try {
    if (metadata) {
      const keys = requireUnlockedKeys();
      const record = await createEncryptedEmployee(keys, normalized);
      const transaction = database.transaction(ENCRYPTED_RECORD_STORE, 'readwrite');
      const completed = transactionComplete(transaction);
      transaction.objectStore(ENCRYPTED_RECORD_STORE).put(record);
      await completed;
      return;
    }

    const transaction = database.transaction(EMPLOYEE_STORE, 'readwrite');
    const completed = transactionComplete(transaction);
    transaction.objectStore(EMPLOYEE_STORE).put(normalized);
    await completed;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'ConstraintError') {
      throw new Error('این کد پرسنلی قبلاً برای پرونده دیگری ثبت شده است.');
    }
    throw error;
  }
}

export async function deleteSavedEmployee(employeeId: string): Promise<void> {
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);
  if (metadata) {
    const keys = requireUnlockedKeys();
    const id = await createOpaqueRecordId(keys, 'employee', employeeId);
    const transaction = database.transaction(ENCRYPTED_RECORD_STORE, 'readwrite');
    const completed = transactionComplete(transaction);
    transaction.objectStore(ENCRYPTED_RECORD_STORE).delete(id);
    await completed;
    return;
  }

  const transaction = database.transaction(EMPLOYEE_STORE, 'readwrite');
  const completed = transactionComplete(transaction);
  transaction.objectStore(EMPLOYEE_STORE).delete(employeeId);
  await completed;
}

export async function savePayrollRunSnapshot(
  run: PayrollRunResult
): Promise<void> {
  const snapshot: StoredPayrollRun = {
    ...run,
    savedAt: new Date().toISOString(),
  };
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);

  if (metadata) {
    const keys = requireUnlockedKeys();
    const id = await createOpaqueRecordId(keys, 'payrollRun', run.runId);
    const record: EncryptedRecord = {
      id,
      kind: 'payrollRun',
      ...(await encryptVaultPayload(keys, id, snapshot)),
      updatedAt: snapshot.savedAt,
    };
    const transaction = database.transaction(ENCRYPTED_RECORD_STORE, 'readwrite');
    const completed = transactionComplete(transaction);
    transaction.objectStore(ENCRYPTED_RECORD_STORE).put(record);
    await completed;
    return;
  }

  const transaction = database.transaction(PAYROLL_RUN_STORE, 'readwrite');
  const completed = transactionComplete(transaction);
  transaction.objectStore(PAYROLL_RUN_STORE).put(snapshot);
  await completed;
}

export async function listSavedPayrollRuns(
  limit = 10
): Promise<StoredPayrollRun[]> {
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);

  if (!metadata) {
    const transaction = database.transaction(PAYROLL_RUN_STORE, 'readonly');
    const completed = transactionComplete(transaction);
    const runs = await requestResult(
      transaction.objectStore(PAYROLL_RUN_STORE).getAll() as IDBRequest<StoredPayrollRun[]>
    );
    await completed;
    return runs
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
      .slice(0, Math.max(0, limit));
  }

  const keys = requireUnlockedKeys();
  const records = await getEncryptedRecords('payrollRun');
  const runs = await Promise.all(
    records.map((record) =>
      decryptVaultPayload<StoredPayrollRun>(keys, record.id, record)
    )
  );

  return runs
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
    .slice(0, Math.max(0, limit));
}

export async function loadSavedPayrollRun(
  runId: string
): Promise<StoredPayrollRun | undefined> {
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);

  if (!metadata) {
    const transaction = database.transaction(PAYROLL_RUN_STORE, 'readonly');
    const completed = transactionComplete(transaction);
    const run = await requestResult(
      transaction.objectStore(PAYROLL_RUN_STORE).get(runId) as IDBRequest<StoredPayrollRun | undefined>
    );
    await completed;
    return run;
  }

  const keys = requireUnlockedKeys();
  const id = await createOpaqueRecordId(keys, 'payrollRun', runId);
  const record = await getEncryptedRecord(id);
  if (!record) return undefined;
  return decryptVaultPayload<StoredPayrollRun>(keys, record.id, record);
}

export async function deleteSavedPayrollRun(runId: string): Promise<void> {
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);
  if (metadata) {
    const keys = requireUnlockedKeys();
    const id = await createOpaqueRecordId(keys, 'payrollRun', runId);
    const transaction = database.transaction(ENCRYPTED_RECORD_STORE, 'readwrite');
    const completed = transactionComplete(transaction);
    transaction.objectStore(ENCRYPTED_RECORD_STORE).delete(id);
    await completed;
    return;
  }

  const transaction = database.transaction(PAYROLL_RUN_STORE, 'readwrite');
  const completed = transactionComplete(transaction);
  transaction.objectStore(PAYROLL_RUN_STORE).delete(runId);
  await completed;
}
