import type {
  EmployeeMasterRecord,
  EmploymentContract,
  WageHistoryEntry,
} from '../types/employee';

export interface EmployeeMasterIssue {
  code: string;
  field: string;
  message: string;
}

function isJalaliDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= (month <= 6 ? 31 : month <= 11 ? 30 : 30);
}

export function validateEmployeeMaster(
  employee: EmployeeMasterRecord
): EmployeeMasterIssue[] {
  const issues: EmployeeMasterIssue[] = [];
  const add = (code: string, field: string, message: string) =>
    issues.push({ code, field, message });

  if (!employee.personnelCode.trim()) add('PERSONNEL_CODE_REQUIRED', 'personnelCode', 'کد پرسنلی الزامی است.');
  if (!employee.firstName.trim()) add('FIRST_NAME_REQUIRED', 'firstName', 'نام الزامی است.');
  if (!employee.lastName.trim()) add('LAST_NAME_REQUIRED', 'lastName', 'نام خانوادگی الزامی است.');
  if (!isJalaliDate(employee.hireDateJalali)) add('INVALID_HIRE_DATE', 'hireDateJalali', 'تاریخ شروع همکاری باید به شکل 1405-01-01 باشد.');
  if (employee.terminationDateJalali && !isJalaliDate(employee.terminationDateJalali)) {
    add('INVALID_TERMINATION_DATE', 'terminationDateJalali', 'تاریخ پایان همکاری معتبر نیست.');
  }
  if (
    employee.terminationDateJalali &&
    employee.hireDateJalali &&
    employee.terminationDateJalali < employee.hireDateJalali
  ) add('TERMINATION_BEFORE_HIRE', 'terminationDateJalali', 'تاریخ پایان همکاری نمی‌تواند قبل از شروع همکاری باشد.');

  const contractIds = new Set<string>();
  const contracts = [...employee.contracts].sort((a, b) => a.effectiveFromJalali.localeCompare(b.effectiveFromJalali));
  for (const contract of contracts) {
    if (!contract.contractId || contractIds.has(contract.contractId)) {
      add('DUPLICATE_CONTRACT_ID', 'contracts', 'شناسه قرارداد تکراری یا خالی است.');
    }
    contractIds.add(contract.contractId);
    if (!contract.jobTitle.trim()) add('CONTRACT_JOB_TITLE_REQUIRED', 'contracts.jobTitle', 'عنوان شغلی قرارداد الزامی است.');
    if (!isJalaliDate(contract.effectiveFromJalali)) add('INVALID_CONTRACT_START', 'contracts.effectiveFromJalali', 'تاریخ شروع قرارداد معتبر نیست.');
    if (contract.effectiveToJalali && !isJalaliDate(contract.effectiveToJalali)) {
      add('INVALID_CONTRACT_END', 'contracts.effectiveToJalali', 'تاریخ پایان قرارداد معتبر نیست.');
    }
    if (contract.effectiveToJalali && contract.effectiveToJalali < contract.effectiveFromJalali) {
      add('CONTRACT_END_BEFORE_START', 'contracts.effectiveToJalali', 'پایان قرارداد نمی‌تواند قبل از شروع آن باشد.');
    }
    if (!Number.isFinite(contract.weeklyHours) || contract.weeklyHours <= 0 || contract.weeklyHours > 168) {
      add('INVALID_WEEKLY_HOURS', 'contracts.weeklyHours', 'ساعات هفتگی باید بیشتر از صفر و حداکثر ۱۶۸ باشد.');
    }
  }
  for (let index = 1; index < contracts.length; index += 1) {
    const previous = contracts[index - 1];
    const current = contracts[index];
    if (!previous.effectiveToJalali || current.effectiveFromJalali <= previous.effectiveToJalali) {
      add('OVERLAPPING_CONTRACTS', 'contracts', 'بازه قراردادها هم‌پوشانی دارد؛ تاریخ‌های مؤثر را اصلاح کنید.');
      break;
    }
  }

  const wageIds = new Set<string>();
  const wages = [...employee.wageHistory].sort((a, b) => a.effectiveFromJalali.localeCompare(b.effectiveFromJalali));
  for (const wage of wages) {
    if (!wage.wageEntryId || wageIds.has(wage.wageEntryId)) {
      add('DUPLICATE_WAGE_ENTRY_ID', 'wageHistory', 'شناسه سابقه مزد تکراری یا خالی است.');
    }
    wageIds.add(wage.wageEntryId);
    if (!isJalaliDate(wage.effectiveFromJalali)) {
      add('INVALID_WAGE_EFFECTIVE_DATE', 'wageHistory.effectiveFromJalali', 'تاریخ اثر مزد معتبر نیست.');
    }
    if (!Number.isFinite(wage.dailyBaseWageRial) || wage.dailyBaseWageRial <= 0) {
      add('INVALID_DAILY_BASE_WAGE', 'wageHistory.dailyBaseWageRial', 'مزد روزانه پایه باید عددی بزرگ‌تر از صفر باشد.');
    }
    if (!Number.isFinite(wage.dailySeniorityRial) || wage.dailySeniorityRial < 0) {
      add('INVALID_DAILY_SENIORITY', 'wageHistory.dailySeniorityRial', 'پایه سنوات روزانه نمی‌تواند منفی باشد.');
    }
  }
  if (wages.length > 1) {
    for (let index = 1; index < wages.length; index += 1) {
      if (wages[index].effectiveFromJalali === wages[index - 1].effectiveFromJalali) {
        add('DUPLICATE_WAGE_EFFECTIVE_DATE', 'wageHistory', 'برای یک تاریخ اثر، بیش از یک سابقه مزد ثبت شده است.');
        break;
      }
    }
  }
  if (employee.contracts.length === 0) {
    add('CONTRACT_REQUIRED', 'contracts', 'حداقل یک قرارداد استخدامی ثبت کنید.');
  }
  if (employee.wageHistory.length === 0) {
    add('WAGE_HISTORY_REQUIRED', 'wageHistory', 'حداقل یک سابقه مزد ثبت کنید.');
  }
  if (employee.status === 'inactive' && !employee.terminationDateJalali) {
    add('INACTIVE_WITHOUT_TERMINATION_DATE', 'terminationDateJalali', 'برای کارمند غیرفعال، تاریخ پایان همکاری ثبت کنید.');
  }
  for (const contract of employee.contracts) {
    if (isJalaliDate(employee.hireDateJalali) && isJalaliDate(contract.effectiveFromJalali) && contract.effectiveFromJalali < employee.hireDateJalali) {
      add('CONTRACT_BEFORE_HIRE', 'contracts.effectiveFromJalali', 'شروع قرارداد نمی‌تواند قبل از تاریخ شروع همکاری باشد.');
    }
  }
  for (const wage of employee.wageHistory) {
    if (isJalaliDate(employee.hireDateJalali) && isJalaliDate(wage.effectiveFromJalali) && wage.effectiveFromJalali < employee.hireDateJalali) {
      add('WAGE_BEFORE_HIRE', 'wageHistory.effectiveFromJalali', 'تاریخ اثر مزد نمی‌تواند قبل از شروع همکاری باشد.');
    }
  }
  return issues;
}

export interface ServiceDuration {
  completedYears: number;
  additionalDays: number;
}

function jalaliDayNumber(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  const elapsedYears = year - 979;
  const elapsedDays =
    365 * elapsedYears +
    Math.floor(elapsedYears / 33) * 8 +
    Math.floor(((elapsedYears % 33) + 3) / 4);
  const elapsedMonths = month <= 6
    ? (month - 1) * 31
    : 186 + (month - 7) * 30;
  return elapsedDays + elapsedMonths + day - 1;
}

export function calculateServiceDurationJalali(
  hireDateJalali: string,
  asOfDateJalali: string
): ServiceDuration {
  if (!isJalaliDate(hireDateJalali) || !isJalaliDate(asOfDateJalali) || asOfDateJalali < hireDateJalali) {
    throw new Error('تاریخ شروع همکاری یا تاریخ محاسبه سابقه معتبر نیست.');
  }
  const [hireYear, hireMonth, hireDay] = hireDateJalali.split('-').map(Number);
  const [endYear, endMonth, endDay] = asOfDateJalali.split('-').map(Number);
  let completedYears = endYear - hireYear;
  if (endMonth < hireMonth || (endMonth === hireMonth && endDay < hireDay)) {
    completedYears -= 1;
  }
  const anniversary = `${String(hireYear + completedYears).padStart(4, '0')}-${String(hireMonth).padStart(2, '0')}-${String(hireDay).padStart(2, '0')}`;
  return {
    completedYears,
    additionalDays: jalaliDayNumber(asOfDateJalali) - jalaliDayNumber(anniversary),
  };
}

export interface ResolvedEmployeeTerms {
  contract?: EmploymentContract;
  wage?: WageHistoryEntry;
  issues: EmployeeMasterIssue[];
}

export function resolveEmployeeTerms(
  employee: EmployeeMasterRecord,
  periodStartJalali: string
): ResolvedEmployeeTerms {
  const issues: EmployeeMasterIssue[] = [];
  const contractMatches = employee.contracts.filter((contract) =>
    contract.effectiveFromJalali <= periodStartJalali &&
    (!contract.effectiveToJalali || contract.effectiveToJalali >= periodStartJalali)
  );
  const wageMatches = employee.wageHistory.filter((wage) =>
    wage.effectiveFromJalali <= periodStartJalali
  );
  if (employee.hireDateJalali > periodStartJalali) {
    issues.push({ code: 'NOT_YET_HIRED', field: 'hireDateJalali', message: 'تاریخ شروع همکاری پس از ابتدای دوره حقوق است.' });
  }
  if (employee.terminationDateJalali && employee.terminationDateJalali < periodStartJalali) {
    issues.push({ code: 'EMPLOYMENT_ENDED', field: 'terminationDateJalali', message: 'همکاری کارمند پیش از دوره حقوق پایان یافته است.' });
  }
  if (employee.status !== 'active') {
    issues.push({ code: 'EMPLOYEE_INACTIVE', field: 'status', message: 'وضعیت پرونده کارمند غیرفعال است.' });
  }
  if (contractMatches.length !== 1) {
    issues.push({ code: contractMatches.length === 0 ? 'NO_ACTIVE_CONTRACT' : 'AMBIGUOUS_ACTIVE_CONTRACT', field: 'contracts', message: contractMatches.length === 0 ? 'در ابتدای دوره، قرارداد معتبر ثبت نشده است.' : 'در ابتدای دوره بیش از یک قرارداد معتبر وجود دارد.' });
  }
  if (wageMatches.length === 0) {
    issues.push({ code: 'NO_EFFECTIVE_WAGE', field: 'wageHistory', message: 'برای ابتدای دوره، سابقه مزد مؤثر ثبت نشده است.' });
  }
  return {
    contract: contractMatches.length === 1 ? contractMatches[0] : undefined,
    wage: wageMatches.sort((a, b) => b.effectiveFromJalali.localeCompare(a.effectiveFromJalali))[0],
    issues,
  };
}

export function createEmployeeMasterRecord(input: {
  employeeId: string;
  personnelCode: string;
  firstName: string;
  lastName: string;
  hireDateJalali: string;
  nationalId?: string;
  insuranceNumber?: string;
  contract: Omit<EmploymentContract, 'contractId'>;
  wage: Omit<WageHistoryEntry, 'wageEntryId'>;
}): EmployeeMasterRecord {
  const now = new Date().toISOString();
  return {
    employeeId: input.employeeId,
    personnelCode: input.personnelCode.trim(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    nationalId: input.nationalId?.trim() ?? '',
    hireDateJalali: input.hireDateJalali,
    terminationDateJalali: null,
    status: 'active',
    insuranceNumber: input.insuranceNumber?.trim() ?? '',
    contracts: [{ ...input.contract, contractId: crypto.randomUUID() }],
    wageHistory: [{ ...input.wage, wageEntryId: crypto.randomUUID() }],
    createdAt: now,
    updatedAt: now,
  };
}
