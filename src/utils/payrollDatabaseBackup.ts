export const PAYROLL_BACKUP_FORMAT = 'iran-payroll-local-backup' as const;
export const PAYROLL_BACKUP_FORMAT_VERSION = 1 as const;

export const PAYROLL_BACKUP_STORE_NAMES = [
  'employees',
  'payrollRuns',
  'employeeMasters',
  'attendanceRecords',
  'leaveRecords',
  'employeeDebtAccounts',
  'employeeDebtRepayments',
  'employeeOtherDeductions',
  'payrollSettlementCases',
  'encryptedRecords',
  'vaultMetadata',
] as const;

export type PayrollBackupStoreName = typeof PAYROLL_BACKUP_STORE_NAMES[number];

export const PAYROLL_BACKUP_PLAINTEXT_STORE_NAMES = [
  'employees',
  'payrollRuns',
  'employeeMasters',
  'attendanceRecords',
  'leaveRecords',
  'employeeDebtAccounts',
  'employeeDebtRepayments',
  'employeeOtherDeductions',
  'payrollSettlementCases',
] as const;



export interface PayrollDatabaseBackup {
  format: typeof PAYROLL_BACKUP_FORMAT;
  formatVersion: typeof PAYROLL_BACKUP_FORMAT_VERSION;
  sourceDatabaseVersion: number;
  createdAt: string;
  vaultConfigured: boolean;
  stores: Record<PayrollBackupStoreName, unknown[]>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validatePayrollDatabaseBackup(
  value: unknown,
  supportedDatabaseVersion: number
): PayrollDatabaseBackup {
  if (!isRecord(value)) throw new Error('ساختار فایل پشتیبان معتبر نیست.');
  if (value.format !== PAYROLL_BACKUP_FORMAT) throw new Error('نوع فایل، پشتیبان سامانه حقوق و دستمزد نیست.');
  if (value.formatVersion !== PAYROLL_BACKUP_FORMAT_VERSION) {
    throw new Error('نسخه قالب پشتیبان با این نسخه نرم‌افزار سازگار نیست.');
  }
  if (
    typeof value.sourceDatabaseVersion !== 'number' ||
    !Number.isInteger(value.sourceDatabaseVersion) ||
    value.sourceDatabaseVersion < 1 ||
    value.sourceDatabaseVersion > supportedDatabaseVersion
  ) {
    throw new Error('نسخه پایگاه داده پشتیبان پشتیبانی نمی‌شود یا از نسخه نرم‌افزار جدیدتر است.');
  }
  if (typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) {
    throw new Error('زمان ایجاد فایل پشتیبان معتبر نیست.');
  }
  if (typeof value.vaultConfigured !== 'boolean') {
    throw new Error('وضعیت رمزگذاری فایل پشتیبان مشخص نیست.');
  }
  if (!isRecord(value.stores)) throw new Error('بخش داده‌های پایگاه داده در فایل پشتیبان وجود ندارد.');

  const storeNames = Object.keys(value.stores);
  const unknownStores = storeNames.filter((name) =>
    !PAYROLL_BACKUP_STORE_NAMES.includes(name as PayrollBackupStoreName)
  );
  if (unknownStores.length > 0) {
    throw new Error(`فایل پشتیبان شامل مخزن ناشناخته است: ${unknownStores.join('، ')}`);
  }

  const stores = {} as Record<PayrollBackupStoreName, unknown[]>;
  for (const name of PAYROLL_BACKUP_STORE_NAMES) {
    const records = value.stores[name];
    if (!Array.isArray(records)) {
      throw new Error(`مخزن «${name}» در فایل پشتیبان وجود ندارد یا ساختار آن خراب است.`);
    }
    if (!records.every(isRecord)) {
      throw new Error(`یکی از رکوردهای مخزن «${name}» ساختار معتبری ندارد.`);
    }
    stores[name] = records;
  }

  if (value.vaultConfigured) {
    if (stores.vaultMetadata.length !== 1) {
      throw new Error('پشتیبان رمزگذاری‌شده فاقد مشخصات کامل Vault است.');
    }
    const plaintextStores = PAYROLL_BACKUP_PLAINTEXT_STORE_NAMES
      .filter((name) => stores[name].length > 0);
    if (plaintextStores.length > 0) {
      throw new Error(
        `پشتیبان با وضعیت Vault دارای اطلاعات خوانا در مخازن ${plaintextStores.join('، ')} است؛ ابتدا Vault را باز و مهاجرت رمزگذاری را کامل کنید.`
      );
    }
  } else if (stores.vaultMetadata.length !== 0 || stores.encryptedRecords.length !== 0) {
    throw new Error('وضعیت رمزگذاری با محتوای مخازن پشتیبان سازگار نیست.');
  }

  return {
    format: PAYROLL_BACKUP_FORMAT,
    formatVersion: PAYROLL_BACKUP_FORMAT_VERSION,
    sourceDatabaseVersion: value.sourceDatabaseVersion,
    createdAt: value.createdAt,
    vaultConfigured: value.vaultConfigured,
    stores,
  };
}
