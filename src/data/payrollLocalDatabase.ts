import type { PayrollRunEmployee, PayrollRunResult } from './payrollRunEngine';

const DATABASE_NAME = 'iran-payroll-local';
const DATABASE_VERSION = 1;
const EMPLOYEE_STORE = 'employees';
const PAYROLL_RUN_STORE = 'payrollRuns';

interface StoredEmployee extends PayrollRunEmployee {
  updatedAt: string;
}

export interface StoredPayrollRun extends PayrollRunResult {
  savedAt: string;
}

let databasePromise: Promise<IDBDatabase> | null = null;

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
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
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

export async function listSavedEmployees(): Promise<PayrollRunEmployee[]> {
  const database = await openDatabase();
  const transaction = database.transaction(EMPLOYEE_STORE, 'readonly');
  const completed = transactionComplete(transaction);
  const records = await requestResult(
    transaction.objectStore(EMPLOYEE_STORE).getAll() as IDBRequest<StoredEmployee[]>
  );
  await completed;

  return records
    .sort((left, right) => left.personnelCode.localeCompare(right.personnelCode))
    .map(({ updatedAt: _updatedAt, ...employee }) => employee);
}

export async function saveEmployee(
  employee: PayrollRunEmployee
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(EMPLOYEE_STORE, 'readwrite');
  const completed = transactionComplete(transaction);
  transaction.objectStore(EMPLOYEE_STORE).put({
    ...employee,
    employeeId: employee.employeeId.trim(),
    personnelCode: employee.personnelCode.trim(),
    fullName: employee.fullName.trim(),
    updatedAt: new Date().toISOString(),
  } satisfies StoredEmployee);
  await completed;
}

export async function deleteSavedEmployee(employeeId: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(EMPLOYEE_STORE, 'readwrite');
  const completed = transactionComplete(transaction);
  transaction.objectStore(EMPLOYEE_STORE).delete(employeeId);
  await completed;
}

export async function savePayrollRunSnapshot(
  run: PayrollRunResult
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(PAYROLL_RUN_STORE, 'readwrite');
  const completed = transactionComplete(transaction);
  transaction.objectStore(PAYROLL_RUN_STORE).put({
    ...run,
    savedAt: new Date().toISOString(),
  } satisfies StoredPayrollRun);
  await completed;
}

export async function listSavedPayrollRuns(
  limit = 10
): Promise<StoredPayrollRun[]> {
  const database = await openDatabase();
  const transaction = database.transaction(PAYROLL_RUN_STORE, 'readonly');
  const completed = transactionComplete(transaction);
  const records = await requestResult(
    transaction.objectStore(PAYROLL_RUN_STORE).getAll() as IDBRequest<StoredPayrollRun[]>
  );
  await completed;

  return records
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
    .slice(0, Math.max(0, limit));
}

export async function loadSavedPayrollRun(
  runId: string
): Promise<StoredPayrollRun | undefined> {
  const database = await openDatabase();
  const transaction = database.transaction(PAYROLL_RUN_STORE, 'readonly');
  const completed = transactionComplete(transaction);
  const record = await requestResult(
    transaction.objectStore(PAYROLL_RUN_STORE).get(runId) as IDBRequest<StoredPayrollRun | undefined>
  );
  await completed;
  return record;
}

export async function deleteSavedPayrollRun(runId: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(PAYROLL_RUN_STORE, 'readwrite');
  const completed = transactionComplete(transaction);
  transaction.objectStore(PAYROLL_RUN_STORE).delete(runId);
  await completed;
}
