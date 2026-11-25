import type { PayrollRunEmployee, PayrollRunResult } from '../utils/payrollRunEngine';
import type { EmployeeMasterRecord } from '../types/employee';
import type { MonthlyAttendanceRecord, MonthlyAttendanceDraft } from '../types/attendance';
import type { MonthlyLeaveRecord, MonthlyLeaveDraft } from '../types/leave';
import type { PayrollSettlementCase, PayrollSettlementAuditEventType } from '../types/payrollSettlement';
import { validatePayrollSettlementTransition } from '../utils/payrollSettlement';
import type {
  EmployeeDebtAccount,
  EmployeeDebtAccountDraft,
  EmployeeDebtRepayment,
  EmployeeDebtRepaymentDraft,
  EmployeeOtherDeduction,
  EmployeeOtherDeductionDraft,
  OtherDeductionReviewStatus,
} from '../types/employeeDebt';
import {
  createDebtRepaymentId,
  createEmployeeDebtId,
  createOtherDeductionId,
  validateDebtRepayment,
  validateEmployeeDebtAccount,
  validateOtherDeduction,
} from '../utils/employeeDebtLedger';
import { createAttendanceId, validateMonthlyAttendance } from '../utils/attendanceLedger';
import { calculateLeaveClosingBalance, createLeaveId, validateMonthlyLeave } from '../utils/leaveLedger';
import { PAYROLL_BACKUP_FORMAT, PAYROLL_BACKUP_FORMAT_VERSION, PAYROLL_BACKUP_STORE_NAMES, validatePayrollDatabaseBackup } from '../utils/payrollDatabaseBackup';
import type { PayrollDatabaseBackup } from '../utils/payrollDatabaseBackup';
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
export const PAYROLL_DATABASE_SCHEMA_VERSION = 7;
const DATABASE_VERSION = PAYROLL_DATABASE_SCHEMA_VERSION;
const EMPLOYEE_STORE = 'employees';
const PAYROLL_RUN_STORE = 'payrollRuns';
const EMPLOYEE_MASTER_STORE = 'employeeMasters';
const ATTENDANCE_STORE = 'attendanceRecords';
const LEAVE_STORE = 'leaveRecords';
const DEBT_ACCOUNT_STORE = 'employeeDebtAccounts';
const DEBT_REPAYMENT_STORE = 'employeeDebtRepayments';
const OTHER_DEDUCTION_STORE = 'employeeOtherDeductions';
const SETTLEMENT_STORE = 'payrollSettlementCases';
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
  kind: 'employee' | 'employeeMaster' | 'payrollRun' | 'attendance' | 'leave' | 'employeeDebt' | 'debtRepayment' | 'otherDeduction' | 'settlement';
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

      if (!database.objectStoreNames.contains(EMPLOYEE_MASTER_STORE)) {
        const masterStore = database.createObjectStore(EMPLOYEE_MASTER_STORE, {
          keyPath: 'employeeId',
        });
        masterStore.createIndex('personnelCode', 'personnelCode', { unique: true });
        masterStore.createIndex('fullName', ['firstName', 'lastName'], { unique: false });
      }

      if (!database.objectStoreNames.contains(ATTENDANCE_STORE)) {
        const attendanceStore = database.createObjectStore(ATTENDANCE_STORE, { keyPath: 'attendanceId' });
        attendanceStore.createIndex('employeePeriod', ['employeeId', 'fiscalYear', 'month'], { unique: true });
        attendanceStore.createIndex('period', ['fiscalYear', 'month'], { unique: false });
      }

      if (!database.objectStoreNames.contains(LEAVE_STORE)) {
        const leaveStore = database.createObjectStore(LEAVE_STORE, { keyPath: 'leaveId' });
        leaveStore.createIndex('employeeYear', ['employeeId', 'fiscalYear'], { unique: false });
        leaveStore.createIndex('period', ['fiscalYear', 'month'], { unique: false });
      }

      if (!database.objectStoreNames.contains(DEBT_ACCOUNT_STORE)) {
        const debtStore = database.createObjectStore(DEBT_ACCOUNT_STORE, { keyPath: 'debtId' });
        debtStore.createIndex('employee', 'employeeId', { unique: false });
        debtStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!database.objectStoreNames.contains(DEBT_REPAYMENT_STORE)) {
        const repaymentStore = database.createObjectStore(DEBT_REPAYMENT_STORE, { keyPath: 'repaymentId' });
        repaymentStore.createIndex('debt', 'debtId', { unique: false });
        repaymentStore.createIndex('employee', 'employeeId', { unique: false });
        repaymentStore.createIndex('period', ['fiscalYear', 'month'], { unique: false });
      }

      if (!database.objectStoreNames.contains(OTHER_DEDUCTION_STORE)) {
        const deductionStore = database.createObjectStore(OTHER_DEDUCTION_STORE, { keyPath: 'deductionId' });
        deductionStore.createIndex('employee', 'employeeId', { unique: false });
        deductionStore.createIndex('period', ['fiscalYear', 'month'], { unique: false });
        deductionStore.createIndex('employeePeriod', ['employeeId', 'fiscalYear', 'month'], { unique: false });
      }

      if (!database.objectStoreNames.contains(SETTLEMENT_STORE)) {
        const settlementStore = database.createObjectStore(SETTLEMENT_STORE, { keyPath: 'settlementId' });
        settlementStore.createIndex('employee', 'employeeId', { unique: false });
        settlementStore.createIndex('status', 'status', { unique: false });
        settlementStore.createIndex('updatedAt', 'updatedAt', { unique: false });
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

async function createEncryptedEmployeeMaster(
  keys: PayrollVaultKeys,
  employee: EmployeeMasterRecord
): Promise<EncryptedRecord> {
  const id = await createOpaqueRecordId(keys, 'employeeMaster', employee.employeeId);
  const personnelCodeToken = await createPersonnelCodeToken(keys, `master:${employee.personnelCode}`);
  return {
    id,
    kind: 'employeeMaster',
    personnelCodeToken,
    ...(await encryptVaultPayload(keys, id, employee)),
    updatedAt: employee.updatedAt,
  };
}

async function createEncryptedAttendance(
  keys: PayrollVaultKeys,
  attendance: MonthlyAttendanceRecord
): Promise<EncryptedRecord> {
  const id = await createOpaqueRecordId(keys, 'attendance', attendance.attendanceId);
  return {
    id,
    kind: 'attendance',
    ...(await encryptVaultPayload(keys, id, attendance)),
    updatedAt: attendance.updatedAt,
  };
}

async function createEncryptedLeave(
  keys: PayrollVaultKeys,
  leave: MonthlyLeaveRecord
): Promise<EncryptedRecord> {
  const id = await createOpaqueRecordId(keys, 'leave', leave.leaveId);
  return {
    id,
    kind: 'leave',
    ...(await encryptVaultPayload(keys, id, leave)),
    updatedAt: leave.updatedAt,
  };
}

async function createEncryptedDebtAccount(
  keys: PayrollVaultKeys,
  account: EmployeeDebtAccount
): Promise<EncryptedRecord> {
  const id = await createOpaqueRecordId(keys, 'employeeDebt', account.debtId);
  return {
    id,
    kind: 'employeeDebt',
    ...(await encryptVaultPayload(keys, id, account)),
    updatedAt: account.updatedAt,
  };
}

async function createEncryptedDebtRepayment(
  keys: PayrollVaultKeys,
  repayment: EmployeeDebtRepayment
): Promise<EncryptedRecord> {
  const id = await createOpaqueRecordId(keys, 'debtRepayment', repayment.repaymentId);
  return {
    id,
    kind: 'debtRepayment',
    ...(await encryptVaultPayload(keys, id, repayment)),
    updatedAt: repayment.createdAt,
  };
}

async function createEncryptedOtherDeduction(
  keys: PayrollVaultKeys,
  deduction: EmployeeOtherDeduction
): Promise<EncryptedRecord> {
  const id = await createOpaqueRecordId(keys, 'otherDeduction', deduction.deductionId);
  return {
    id,
    kind: 'otherDeduction',
    ...(await encryptVaultPayload(keys, id, deduction)),
    updatedAt: deduction.updatedAt,
  };
}

async function createEncryptedPayrollSettlement(
  keys: PayrollVaultKeys,
  settlement: PayrollSettlementCase
): Promise<EncryptedRecord> {
  const id = await createOpaqueRecordId(keys, 'settlement', settlement.settlementId);
  return {
    id,
    kind: 'settlement',
    ...(await encryptVaultPayload(keys, id, settlement)),
    updatedAt: settlement.updatedAt,
  };
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

export async function listEmployeeMasterRecords(): Promise<EmployeeMasterRecord[]> {
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);
  if (!metadata) {
    const transaction = database.transaction(EMPLOYEE_MASTER_STORE, 'readonly');
    const completed = transactionComplete(transaction);
    const records = await requestResult(
      transaction.objectStore(EMPLOYEE_MASTER_STORE).getAll() as IDBRequest<EmployeeMasterRecord[]>
    );
    await completed;
    return records.sort((a, b) => a.personnelCode.localeCompare(b.personnelCode));
  }

  const keys = requireUnlockedKeys();
  const records = await getEncryptedRecords('employeeMaster');
  const employees = await Promise.all(records.map((record) =>
    decryptVaultPayload<EmployeeMasterRecord>(keys, record.id, record)
  ));
  return employees.sort((a, b) => a.personnelCode.localeCompare(b.personnelCode));
}

export async function saveEmployeeMasterRecord(employee: EmployeeMasterRecord): Promise<void> {
  const normalized: EmployeeMasterRecord = {
    ...employee,
    personnelCode: employee.personnelCode.trim(),
    firstName: employee.firstName.trim(),
    lastName: employee.lastName.trim(),
    updatedAt: new Date().toISOString(),
  };
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);
  try {
    if (metadata) {
      const keys = requireUnlockedKeys();
      const record = await createEncryptedEmployeeMaster(keys, normalized);
      const transaction = database.transaction(ENCRYPTED_RECORD_STORE, 'readwrite');
      const completed = transactionComplete(transaction);
      transaction.objectStore(ENCRYPTED_RECORD_STORE).put(record);
      await completed;
      return;
    }
    const transaction = database.transaction(EMPLOYEE_MASTER_STORE, 'readwrite');
    const completed = transactionComplete(transaction);
    transaction.objectStore(EMPLOYEE_MASTER_STORE).put(normalized);
    await completed;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'ConstraintError') {
      throw new Error('این کد پرسنلی قبلاً در پرونده کارکنان ثبت شده است.');
    }
    throw error;
  }
}

export async function deleteEmployeeMasterRecord(employeeId: string): Promise<void> {
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);
  if (metadata) {
    const keys = requireUnlockedKeys();
    const id = await createOpaqueRecordId(keys, 'employeeMaster', employeeId);
    const transaction = database.transaction(ENCRYPTED_RECORD_STORE, 'readwrite');
    const completed = transactionComplete(transaction);
    transaction.objectStore(ENCRYPTED_RECORD_STORE).delete(id);
    await completed;
    return;
  }
  const transaction = database.transaction(EMPLOYEE_MASTER_STORE, 'readwrite');
  const completed = transactionComplete(transaction);
  transaction.objectStore(EMPLOYEE_MASTER_STORE).delete(employeeId);
  await completed;
}



function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return '[' + value.map((item) => stableStringify(item)).join(',') + ']';
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record).sort().map((key) =>
      JSON.stringify(key) + ':' + stableStringify(record[key])
    ).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'undefined';
}

function assertApprovedSettlementImmutable(
  current: PayrollSettlementCase,
  next: PayrollSettlementCase
): void {
  const allowedPaymentFields = new Set([
    'status',
    'updatedAt',
    'paymentDate',
    'paymentReference',
    'paidAmountRial',
    'paymentDifferenceReason',
    'auditTrail',
  ]);
  const snapshot = (value: PayrollSettlementCase) =>
    Object.fromEntries(Object.entries(value).filter(([key]) => !allowedPaymentFields.has(key)));
  if (stableStringify(snapshot(current)) !== stableStringify(snapshot(next))) {
    throw new Error('پس از تأیید، مبانی و ارقام پرونده قابل تغییر نیستند؛ در صورت نیاز باید پرونده اصلاحی مستقل ایجاد شود.');
  }
}

function createSettlementAuditEvent(
  eventType: PayrollSettlementAuditEventType,
  status: PayrollSettlementCase['status'],
  occurredAt: string,
  input: PayrollSettlementCase
) {
  return {
    eventId: crypto.randomUUID(),
    eventType,
    status,
    occurredAt,
    ...(eventType === 'approved' && input.approverName
      ? { actorName: input.approverName.trim() }
      : {}),
    ...(eventType === 'approved' && input.approvalReference
      ? { reference: input.approvalReference.trim() }
      : {}),
    ...(eventType === 'paid' && input.paymentReference
      ? { reference: input.paymentReference.trim() }
      : {}),
    ...(eventType === 'paid'
      ? { note: 'پرداخت با تاریخ و مبلغ ثبت‌شده در پرونده تسویه' }
      : {}),
  };
}


export async function exportPayrollDatabaseBackup(): Promise<PayrollDatabaseBackup> {
  const database = await openDatabase();
  const transaction = database.transaction([...PAYROLL_BACKUP_STORE_NAMES], 'readonly');
  const completed = transactionComplete(transaction);
  const storeEntries = await Promise.all(
    PAYROLL_BACKUP_STORE_NAMES.map(async (name) => [
      name,
      await requestResult(
        transaction.objectStore(name).getAll() as IDBRequest<unknown[]>
      ),
    ] as const)
  );
  await completed;

  const stores = Object.fromEntries(storeEntries) as PayrollDatabaseBackup['stores'];
  const backup = {
    format: PAYROLL_BACKUP_FORMAT,
    formatVersion: PAYROLL_BACKUP_FORMAT_VERSION,
    sourceDatabaseVersion: database.version,
    createdAt: new Date().toISOString(),
    vaultConfigured: stores.vaultMetadata.length > 0,
    stores,
  };

  return validatePayrollDatabaseBackup(backup, DATABASE_VERSION);
}

/**
 * Full restore replaces every local object store atomically. On success the
 * in-memory Vault key is discarded; encrypted backups must be unlocked again.
 */
export async function restorePayrollDatabaseBackup(
  input: unknown
): Promise<PayrollDatabaseBackup> {
  const backup = validatePayrollDatabaseBackup(input, DATABASE_VERSION);
  const database = await openDatabase();
  const transaction = database.transaction([...PAYROLL_BACKUP_STORE_NAMES], 'readwrite');
  const completed = transactionComplete(transaction);

  try {
    for (const name of PAYROLL_BACKUP_STORE_NAMES) {
      const store = transaction.objectStore(name);
      store.clear();
      for (const record of backup.stores[name]) {
        store.put(record);
      }
    }
    await completed;
  } catch (error) {
    try { transaction.abort(); } catch { /* The transaction may already be complete. */ }
    throw new Error(
      error instanceof Error
        ? `بازیابی انجام نشد و تغییری ذخیره نشد: ${error.message}`
        : 'بازیابی فایل پشتیبان ناموفق بود؛ تراکنش پایگاه داده لغو شد.'
    );
  }

  unlockedVaultKeys = null;
  return backup;
}

export async function savePayrollSettlementCase(
  input: PayrollSettlementCase
): Promise<PayrollSettlementCase> {
  const now = new Date().toISOString();
  const normalized: PayrollSettlementCase = {
    ...input,
    settlementId: input.settlementId.trim(),
    personnelCode: input.personnelCode.trim(),
    employeeName: input.employeeName.trim(),
    createdAt: input.createdAt || now,
    updatedAt: now,
  };
  if (!normalized.settlementId || !normalized.employeeId || !normalized.personnelCode) {
    throw new Error('شناسه پرونده، شناسه کارمند و کد پرسنلی برای ذخیره تسویه الزامی است.');
  }

  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);
  let current: PayrollSettlementCase | undefined;
  let keys: PayrollVaultKeys | undefined;

  if (metadata) {
    keys = requireUnlockedKeys();
    const id = await createOpaqueRecordId(keys, 'settlement', normalized.settlementId);
    const encrypted = await getEncryptedRecord(id);
    if (encrypted) {
      current = await decryptVaultPayload<PayrollSettlementCase>(keys, encrypted.id, encrypted);
    }
  } else {
    const readTransaction = database.transaction(SETTLEMENT_STORE, 'readonly');
    const readCompleted = transactionComplete(readTransaction);
    current = await requestResult(
      readTransaction.objectStore(SETTLEMENT_STORE).get(normalized.settlementId) as IDBRequest<PayrollSettlementCase | undefined>
    );
    await readCompleted;
  }

  const transitionIssues = validatePayrollSettlementTransition(current?.status ?? null, normalized.status);
  if (transitionIssues.length > 0) throw new Error(transitionIssues.join(' '));
  if (current?.status === 'approved') {
    if (normalized.status !== 'paid') {
      throw new Error('پرونده تأییدشده فقط با ثبت پرداخت قابل تغییر است.');
    }
    assertApprovedSettlementImmutable(current, normalized);
  }
  if (current?.status === 'paid') {
    throw new Error('پرونده پرداخت‌شده غیرقابل‌ویرایش است.');
  }

  const eventType: PayrollSettlementAuditEventType | null = !current
    ? 'created'
    : current.status !== normalized.status
      ? normalized.status === 'ready-for-review'
        ? 'submitted-for-review'
        : normalized.status === 'draft'
          ? 'returned-to-draft'
          : normalized.status === 'approved'
            ? 'approved'
            : normalized.status === 'paid'
              ? 'paid'
              : normalized.status === 'cancelled'
                ? 'cancelled'
                : null
      : normalized.status === 'draft'
        ? 'draft-updated'
        : null;
  const previousAudit = current?.auditTrail ?? [];
  const normalizedWithAudit: PayrollSettlementCase = {
    ...normalized,
    auditTrail: eventType
      ? [...previousAudit, createSettlementAuditEvent(eventType, normalized.status, now, normalized)]
      : previousAudit,
  };

  if (metadata && keys) {
    const record = await createEncryptedPayrollSettlement(keys, normalizedWithAudit);
    const transaction = database.transaction(ENCRYPTED_RECORD_STORE, 'readwrite');
    const completed = transactionComplete(transaction);
    transaction.objectStore(ENCRYPTED_RECORD_STORE).put(record);
    await completed;
    return normalizedWithAudit;
  }

  const transaction = database.transaction(SETTLEMENT_STORE, 'readwrite');
  const completed = transactionComplete(transaction);
  transaction.objectStore(SETTLEMENT_STORE).put(normalizedWithAudit);
  await completed;
  return normalizedWithAudit;
}

export async function listPayrollSettlementCases(
  limit = 200
): Promise<PayrollSettlementCase[]> {
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);
  let cases: PayrollSettlementCase[];

  if (!metadata) {
    const transaction = database.transaction(SETTLEMENT_STORE, 'readonly');
    const completed = transactionComplete(transaction);
    cases = await requestResult(
      transaction.objectStore(SETTLEMENT_STORE).getAll() as IDBRequest<PayrollSettlementCase[]>
    );
    await completed;
  } else {
    const keys = requireUnlockedKeys();
    const records = await getEncryptedRecords('settlement');
    cases = await Promise.all(records.map((record) =>
      decryptVaultPayload<PayrollSettlementCase>(keys, record.id, record)
    ));
  }

  return cases
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, Math.max(0, limit));
}

export async function loadPayrollSettlementCase(
  settlementId: string
): Promise<PayrollSettlementCase | undefined> {
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);
  if (!metadata) {
    const transaction = database.transaction(SETTLEMENT_STORE, 'readonly');
    const completed = transactionComplete(transaction);
    const record = await requestResult(
      transaction.objectStore(SETTLEMENT_STORE).get(settlementId) as IDBRequest<PayrollSettlementCase | undefined>
    );
    await completed;
    return record;
  }

  const keys = requireUnlockedKeys();
  const id = await createOpaqueRecordId(keys, 'settlement', settlementId);
  const record = await getEncryptedRecord(id);
  if (!record) return undefined;
  return decryptVaultPayload<PayrollSettlementCase>(keys, record.id, record);
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


export async function listMonthlyAttendance(
  fiscalYear: MonthlyAttendanceRecord['fiscalYear'],
  month: number
): Promise<MonthlyAttendanceRecord[]> {
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);
  if (!metadata) {
    const transaction = database.transaction(ATTENDANCE_STORE, 'readonly');
    const completed = transactionComplete(transaction);
    const records = await requestResult(
      transaction.objectStore(ATTENDANCE_STORE).index('period')
        .getAll([fiscalYear, month]) as IDBRequest<MonthlyAttendanceRecord[]>
    );
    await completed;
    return records.sort((a, b) => a.personnelCode.localeCompare(b.personnelCode));
  }
  const keys = requireUnlockedKeys();
  const records = await getEncryptedRecords('attendance');
  const decoded = await Promise.all(records.map(record =>
    decryptVaultPayload<MonthlyAttendanceRecord>(keys, record.id, record)
  ));
  return decoded.filter(record => record.fiscalYear === fiscalYear && record.month === month)
    .sort((a, b) => a.personnelCode.localeCompare(b.personnelCode));
}

export async function saveMonthlyAttendance(input: MonthlyAttendanceDraft): Promise<MonthlyAttendanceRecord> {
  const issues = validateMonthlyAttendance(input);
  if (issues.length) throw new Error(issues.map(issue => issue.message).join(' '));
  const normalized: MonthlyAttendanceRecord = {
    ...input,
    attendanceId: createAttendanceId(input.employeeId, input.fiscalYear, input.month),
    personnelCode: input.personnelCode.trim(),
    updatedAt: new Date().toISOString(),
  };
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);
  if (metadata) {
    const keys = requireUnlockedKeys();
    const record = await createEncryptedAttendance(keys, normalized);
    const transaction = database.transaction(ENCRYPTED_RECORD_STORE, 'readwrite');
    const completed = transactionComplete(transaction);
    transaction.objectStore(ENCRYPTED_RECORD_STORE).put(record);
    await completed;
    return normalized;
  }
  const transaction = database.transaction(ATTENDANCE_STORE, 'readwrite');
  const completed = transactionComplete(transaction);
  transaction.objectStore(ATTENDANCE_STORE).put(normalized);
  await completed;
  return normalized;
}

export async function deleteMonthlyAttendance(attendanceId: string): Promise<void> {
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);
  if (metadata) {
    const keys = requireUnlockedKeys();
    const id = await createOpaqueRecordId(keys, 'attendance', attendanceId);
    const transaction = database.transaction(ENCRYPTED_RECORD_STORE, 'readwrite');
    const completed = transactionComplete(transaction);
    transaction.objectStore(ENCRYPTED_RECORD_STORE).delete(id);
    await completed;
    return;
  }
  const transaction = database.transaction(ATTENDANCE_STORE, 'readwrite');
  const completed = transactionComplete(transaction);
  transaction.objectStore(ATTENDANCE_STORE).delete(attendanceId);
  await completed;
}


export async function listAnnualLeaveRecords(
  fiscalYear: MonthlyLeaveRecord['fiscalYear'],
  employeeId?: string
): Promise<MonthlyLeaveRecord[]> {
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);
  let records: MonthlyLeaveRecord[];
  if (!metadata) {
    const transaction = database.transaction(LEAVE_STORE, 'readonly');
    const completed = transactionComplete(transaction);
    const store = transaction.objectStore(LEAVE_STORE);
    records = await requestResult(
      (employeeId
        ? store.index('employeeYear').getAll([employeeId, fiscalYear])
        : store.index('period').getAll(IDBKeyRange.bound([fiscalYear, 1], [fiscalYear, 12]))
      ) as IDBRequest<MonthlyLeaveRecord[]>
    );
    await completed;
  } else {
    const keys = requireUnlockedKeys();
    const encrypted = await getEncryptedRecords('leave');
    const decoded = await Promise.all(encrypted.map(record =>
      decryptVaultPayload<MonthlyLeaveRecord>(keys, record.id, record)
    ));
    records = decoded.filter(record =>
      record.fiscalYear === fiscalYear && (!employeeId || record.employeeId === employeeId)
    );
  }
  return records.sort((a, b) =>
    a.employeeId.localeCompare(b.employeeId) || a.month - b.month
  );
}

export async function saveMonthlyLeave(input: MonthlyLeaveDraft): Promise<MonthlyLeaveRecord> {
  const issues = validateMonthlyLeave(input);
  if (issues.length) throw new Error(issues.map(issue => issue.message).join(' '));
  const normalized: MonthlyLeaveRecord = {
    ...input,
    leaveId: createLeaveId(input.employeeId, input.fiscalYear, input.month),
    personnelCode: input.personnelCode.trim(),
    closingBalanceDays: calculateLeaveClosingBalance(input),
    updatedAt: new Date().toISOString(),
  };
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);
  if (metadata) {
    const keys = requireUnlockedKeys();
    const record = await createEncryptedLeave(keys, normalized);
    const transaction = database.transaction(ENCRYPTED_RECORD_STORE, 'readwrite');
    const completed = transactionComplete(transaction);
    transaction.objectStore(ENCRYPTED_RECORD_STORE).put(record);
    await completed;
    return normalized;
  }
  const transaction = database.transaction(LEAVE_STORE, 'readwrite');
  const completed = transactionComplete(transaction);
  transaction.objectStore(LEAVE_STORE).put(normalized);
  await completed;
  return normalized;
}

export async function deleteMonthlyLeave(leaveId: string): Promise<void> {
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);
  if (metadata) {
    const keys = requireUnlockedKeys();
    const id = await createOpaqueRecordId(keys, 'leave', leaveId);
    const transaction = database.transaction(ENCRYPTED_RECORD_STORE, 'readwrite');
    const completed = transactionComplete(transaction);
    transaction.objectStore(ENCRYPTED_RECORD_STORE).delete(id);
    await completed;
    return;
  }
  const transaction = database.transaction(LEAVE_STORE, 'readwrite');
  const completed = transactionComplete(transaction);
  transaction.objectStore(LEAVE_STORE).delete(leaveId);
  await completed;
}



// Employee advances, loans and repayments are stored as an auditable local ledger.
// Installments are suggestions only; this layer never posts a payroll deduction.
export async function listEmployeeDebtAccounts(employeeId?: string): Promise<EmployeeDebtAccount[]> {
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);
  let records: EmployeeDebtAccount[];
  if (!metadata) {
    const transaction = database.transaction(DEBT_ACCOUNT_STORE, 'readonly');
    const completed = transactionComplete(transaction);
    const store = transaction.objectStore(DEBT_ACCOUNT_STORE);
    const request = employeeId
      ? store.index('employee').getAll(employeeId)
      : store.getAll();
    records = await requestResult(request as IDBRequest<EmployeeDebtAccount[]>);
    await completed;
  } else {
    const keys = requireUnlockedKeys();
    const encrypted = await getEncryptedRecords('employeeDebt');
    const decoded = await Promise.all(encrypted.map(record =>
      decryptVaultPayload<EmployeeDebtAccount>(keys, record.id, record)
    ));
    records = decoded.filter(record => !employeeId || record.employeeId === employeeId);
  }
  return records.sort((a, b) =>
    b.issueDateJalali.localeCompare(a.issueDateJalali) ||
    a.employeeName.localeCompare(b.employeeName)
  );
}

export async function saveEmployeeDebtAccount(
  input: EmployeeDebtAccountDraft
): Promise<EmployeeDebtAccount> {
  const issues = validateEmployeeDebtAccount(input);
  if (issues.length) throw new Error(issues.map(issue => issue.message).join(' '));
  const now = new Date().toISOString();
  const normalized: EmployeeDebtAccount = {
    ...input,
    debtId: createEmployeeDebtId(),
    personnelCode: input.personnelCode.trim(),
    employeeName: input.employeeName.trim(),
    purpose: input.purpose.trim(),
    notes: input.notes.trim(),
    createdAt: now,
    updatedAt: now,
  };
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);
  if (metadata) {
    const keys = requireUnlockedKeys();
    const record = await createEncryptedDebtAccount(keys, normalized);
    const transaction = database.transaction(ENCRYPTED_RECORD_STORE, 'readwrite');
    const completed = transactionComplete(transaction);
    transaction.objectStore(ENCRYPTED_RECORD_STORE).put(record);
    await completed;
    return normalized;
  }
  const transaction = database.transaction(DEBT_ACCOUNT_STORE, 'readwrite');
  const completed = transactionComplete(transaction);
  transaction.objectStore(DEBT_ACCOUNT_STORE).put(normalized);
  await completed;
  return normalized;
}

export async function listDebtRepayments(
  employeeId?: string,
  debtId?: string
): Promise<EmployeeDebtRepayment[]> {
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);
  let records: EmployeeDebtRepayment[];
  if (!metadata) {
    const transaction = database.transaction(DEBT_REPAYMENT_STORE, 'readonly');
    const completed = transactionComplete(transaction);
    const store = transaction.objectStore(DEBT_REPAYMENT_STORE);
    records = await requestResult(
      (debtId
        ? store.index('debt').getAll(debtId)
        : employeeId
          ? store.index('employee').getAll(employeeId)
          : store.getAll()) as IDBRequest<EmployeeDebtRepayment[]>
    );
    await completed;
    if (employeeId && debtId) records = records.filter(item => item.employeeId === employeeId);
  } else {
    const keys = requireUnlockedKeys();
    const encrypted = await getEncryptedRecords('debtRepayment');
    const decoded = await Promise.all(encrypted.map(record =>
      decryptVaultPayload<EmployeeDebtRepayment>(keys, record.id, record)
    ));
    records = decoded.filter(record =>
      (!employeeId || record.employeeId === employeeId) &&
      (!debtId || record.debtId === debtId)
    );
  }
  return records.sort((a, b) =>
    a.repaymentDateJalali.localeCompare(b.repaymentDateJalali) ||
    a.createdAt.localeCompare(b.createdAt)
  );
}

export async function recordDebtRepayment(
  input: EmployeeDebtRepaymentDraft
): Promise<EmployeeDebtRepayment> {
  const accounts = await listEmployeeDebtAccounts(input.employeeId);
  const account = accounts.find(item => item.debtId === input.debtId);
  if (!account) throw new Error('حساب مساعده/وام انتخاب‌شده پیدا نشد.');
  const previous = await listDebtRepayments(input.employeeId, input.debtId);
  const issues = validateDebtRepayment(input, account, previous);
  if (issues.length) throw new Error(issues.map(issue => issue.message).join(' '));
  const normalized: EmployeeDebtRepayment = {
    ...input,
    repaymentId: createDebtRepaymentId(),
    personnelCode: input.personnelCode.trim(),
    reference: input.reference.trim(),
    notes: input.notes.trim(),
    createdAt: new Date().toISOString(),
  };
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);
  if (metadata) {
    const keys = requireUnlockedKeys();
    const record = await createEncryptedDebtRepayment(keys, normalized);
    const transaction = database.transaction(ENCRYPTED_RECORD_STORE, 'readwrite');
    const completed = transactionComplete(transaction);
    transaction.objectStore(ENCRYPTED_RECORD_STORE).put(record);
    await completed;
    return normalized;
  }
  const transaction = database.transaction(DEBT_REPAYMENT_STORE, 'readwrite');
  const completed = transactionComplete(transaction);
  transaction.objectStore(DEBT_REPAYMENT_STORE).put(normalized);
  await completed;
  return normalized;
}

export async function listEmployeeOtherDeductions(
  fiscalYear: string,
  month: number,
  employeeId?: string
): Promise<EmployeeOtherDeduction[]> {
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);
  let records: EmployeeOtherDeduction[];
  if (!metadata) {
    const transaction = database.transaction(OTHER_DEDUCTION_STORE, 'readonly');
    const completed = transactionComplete(transaction);
    const store = transaction.objectStore(OTHER_DEDUCTION_STORE);
    records = await requestResult(
      (employeeId
        ? store.index('employeePeriod').getAll([employeeId, fiscalYear, month])
        : store.index('period').getAll([fiscalYear, month])
      ) as IDBRequest<EmployeeOtherDeduction[]>
    );
    await completed;
  } else {
    const keys = requireUnlockedKeys();
    const encrypted = await getEncryptedRecords('otherDeduction');
    const decoded = await Promise.all(encrypted.map(record =>
      decryptVaultPayload<EmployeeOtherDeduction>(keys, record.id, record)
    ));
    records = decoded.filter(record =>
      record.fiscalYear === fiscalYear && record.month === month &&
      (!employeeId || record.employeeId === employeeId)
    );
  }
  return records.sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName) || a.createdAt.localeCompare(b.createdAt)
  );
}

export async function saveEmployeeOtherDeduction(
  input: EmployeeOtherDeductionDraft
): Promise<EmployeeOtherDeduction> {
  const issues = validateOtherDeduction(input);
  if (issues.length) throw new Error(issues.map(issue => issue.message).join(' '));
  const now = new Date().toISOString();
  const normalized: EmployeeOtherDeduction = {
    ...input,
    deductionId: createOtherDeductionId(),
    personnelCode: input.personnelCode.trim(),
    employeeName: input.employeeName.trim(),
    title: input.title.trim(),
    authorizationReference: input.authorizationReference.trim(),
    notes: input.notes.trim(),
    createdAt: now,
    updatedAt: now,
  };
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);
  if (metadata) {
    const keys = requireUnlockedKeys();
    const record = await createEncryptedOtherDeduction(keys, normalized);
    const transaction = database.transaction(ENCRYPTED_RECORD_STORE, 'readwrite');
    const completed = transactionComplete(transaction);
    transaction.objectStore(ENCRYPTED_RECORD_STORE).put(record);
    await completed;
    return normalized;
  }
  const transaction = database.transaction(OTHER_DEDUCTION_STORE, 'readwrite');
  const completed = transactionComplete(transaction);
  transaction.objectStore(OTHER_DEDUCTION_STORE).put(normalized);
  await completed;
  return normalized;
}

export async function updateEmployeeOtherDeductionReview(
  deductionId: string,
  reviewStatus: OtherDeductionReviewStatus,
  authorizationReference: string
): Promise<EmployeeOtherDeduction> {
  const database = await openDatabase();
  const metadata = await readVaultMetadata(database);
  let current: EmployeeOtherDeduction | undefined;
  let keys: PayrollVaultKeys | undefined;
  if (metadata) {
    keys = requireUnlockedKeys();
    const id = await createOpaqueRecordId(keys, 'otherDeduction', deductionId);
    const encrypted = await getEncryptedRecord(id);
    if (encrypted) current = await decryptVaultPayload<EmployeeOtherDeduction>(keys, encrypted.id, encrypted);
  } else {
    const transaction = database.transaction(OTHER_DEDUCTION_STORE, 'readonly');
    const completed = transactionComplete(transaction);
    current = await requestResult(
      transaction.objectStore(OTHER_DEDUCTION_STORE).get(deductionId) as IDBRequest<EmployeeOtherDeduction | undefined>
    );
    await completed;
  }
  if (!current) throw new Error('رکورد کسور موردنظر پیدا نشد.');
  const normalized: EmployeeOtherDeduction = {
    ...current,
    reviewStatus,
    authorizationReference: authorizationReference.trim(),
    updatedAt: new Date().toISOString(),
  };
  const issues = validateOtherDeduction(normalized);
  if (issues.length) throw new Error(issues.map(issue => issue.message).join(' '));
  if (metadata && keys) {
    const record = await createEncryptedOtherDeduction(keys, normalized);
    const transaction = database.transaction(ENCRYPTED_RECORD_STORE, 'readwrite');
    const completed = transactionComplete(transaction);
    transaction.objectStore(ENCRYPTED_RECORD_STORE).put(record);
    await completed;
    return normalized;
  }
  const transaction = database.transaction(OTHER_DEDUCTION_STORE, 'readwrite');
  const completed = transactionComplete(transaction);
  transaction.objectStore(OTHER_DEDUCTION_STORE).put(normalized);
  await completed;
  return normalized;
}
