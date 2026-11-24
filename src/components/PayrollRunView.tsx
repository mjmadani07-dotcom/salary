import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Trash2, Calculator, FileSpreadsheet, Lock } from 'lucide-react';
import { getPayrollRuleSet } from '../data/payrollRuleRegistry';
import {
  formatMoney,
  toPersianDigits,
} from '../utils/payrollEngine';
import type { PayrollInput } from '../utils/payrollEngine';
import { calculatePayrollRun } from '../utils/payrollRunEngine';
import type { PayrollRunEmployee, PayrollRunResult } from '../utils/payrollRunEngine';
import {
  deleteSavedEmployee,
  getPayrollVaultStatus,
  isPayrollVaultUnlocked,
  lockPayrollVault,
  unlockPayrollVault,
  listSavedEmployees,
  listSavedPayrollRuns,
  loadSavedPayrollRun,
  saveEmployee,
  savePayrollRunSnapshot,
} from '../data/payrollLocalDatabase';
import type { StoredPayrollRun } from '../data/payrollLocalDatabase';
import { listEmployeeMasterRecords } from '../data/payrollLocalDatabase';
import type { EmployeeMasterRecord } from '../types/employee';
import { calculateServiceDurationJalali, resolveEmployeeTerms } from '../utils/employeeMaster';
import { downloadPayrollRunExcelWorkbook } from '../utils/excelWorkbookBuilder';
import { useUnifiedPayroll } from '../state/UnifiedPayrollContext';

interface EmployeeDraft {
  personnelCode: string;
  fullName: string;
  dailyBaseWageRial: number;
  dailySeniorityRial: number;
  workDays: number;
  isMarried: boolean;
  childrenCount: number;
  has720DaysInsurance: boolean;
  overtimeHours: number;
  nightShiftHours: number;
  holidayHours: number;
  variableBonusRial: number;
  annualWorkedDays: number;
  serviceYearsForSeverance: number;
  serviceExtraDaysForSeverance: number;
}

function createEmptyDraft(
  year: PayrollInput['year'],
  monthDays: PayrollInput['monthDays']
): EmployeeDraft {
  const rules = getPayrollRuleSet(year).regulations;
  return {
    personnelCode: '',
    fullName: '',
    dailyBaseWageRial: rules.minDailyWageRial,
    dailySeniorityRial: 0,
    workDays: monthDays,
    isMarried: false,
    childrenCount: 0,
    has720DaysInsurance: false,
    overtimeHours: 0,
    nightShiftHours: 0,
    holidayHours: 0,
    variableBonusRial: 0,
    annualWorkedDays: 365,
    serviceYearsForSeverance: 0,
    serviceExtraDaysForSeverance: 0,
  };
}

function numberValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function PayrollRunView() {
  const { state } = useUnifiedPayroll();
  const { year, monthDays, unit } = state;
  const rules = getPayrollRuleSet(year).regulations;
  const [month, setMonth] = useState(1);
  const [draft, setDraft] = useState<EmployeeDraft>(() => createEmptyDraft(year, monthDays));
  const [employees, setEmployees] = useState<PayrollRunEmployee[]>([]);
  const [employeeMasters, setEmployeeMasters] = useState<EmployeeMasterRecord[]>([]);
  const [selectedMasterId, setSelectedMasterId] = useState('');
  const [runResult, setRunResult] = useState<PayrollRunResult | null>(null);
  const [runHistory, setRunHistory] = useState<StoredPayrollRun[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [isLoadingLocalData, setIsLoadingLocalData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedRunId, setLastSavedRunId] = useState<string | null>(null);
  const [vaultPhase, setVaultPhase] = useState<'checking' | 'locked' | 'unlocked' | 'error'>('checking');
  const [vaultPassword, setVaultPassword] = useState('');
  const [vaultBusy, setVaultBusy] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getPayrollVaultStatus()
      .then((status) => {
        if (!active) return;
        // New installations use the local database directly. Only databases
        // protected by an older vault require the legacy passphrase screen.
        setVaultPhase(
          status.configured && !isPayrollVaultUnlocked() ? 'locked' : 'unlocked'
        );
      })
      .catch((error) => {
        if (!active) return;
        setVaultError(error instanceof Error ? error.message : 'بررسی خزانه اطلاعات ناموفق بود.');
        setVaultPhase('error');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (vaultPhase !== 'unlocked') {
      setEmployees([]);
      setRunHistory([]);
      setRunResult(null);
      setLastSavedRunId(null);
      setIsLoadingLocalData(false);
      return;
    }
    let active = true;
    setIsLoadingLocalData(true);
    setRunResult(null);
    setLastSavedRunId(null);
    Promise.all([listSavedEmployees(), listSavedPayrollRuns(8), listEmployeeMasterRecords()])
      .then(([savedEmployees, savedRuns, savedMasters]) => {
        if (!active) return;
        setEmployees(
          savedEmployees.map((employee) => ({
            ...employee,
            payrollInput: {
              ...employee.payrollInput,
              year,
              monthDays,
              workDays: Math.min(employee.payrollInput.workDays, monthDays),
              housingAllowanceRial: rules.housingAllowanceRial,
              workerCouponRial: rules.workerCouponRial,
            },
          }))
        );
        setRunHistory(savedRuns);
        setEmployeeMasters(savedMasters);
        setStorageError(null);
      })
      .catch((error) => {
        if (active) {
          setStorageError(
            error instanceof Error
              ? error.message
              : 'خواندن پایگاه داده محلی ناموفق بود.'
          );
        }
      })
      .finally(() => {
        if (active) setIsLoadingLocalData(false);
      });

    return () => {
      active = false;
    };
  }, [year, monthDays, rules.housingAllowanceRial, rules.workerCouponRial, vaultPhase]);

  const handleUnlockVault = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setVaultError(null);
    setVaultBusy(true);
    try {
      await unlockPayrollVault(vaultPassword);
      setVaultPassword('');
      setVaultPhase('unlocked');
    } catch (error) {
      setVaultError(error instanceof Error ? error.message : 'بازکردن خزانه ناموفق بود.');
    } finally {
      setVaultBusy(false);
    }
  };

  const handleLockVault = () => {
    lockPayrollVault();
    setVaultPassword('');
    setEmployees([]);
    setRunHistory([]);
    setRunResult(null);
    setDraft(createEmptyDraft(year, monthDays));
    setFormError(null);
    setStorageError(null);
    setLastSavedRunId(null);
    setVaultPhase('locked');
  };

  const unitMultiplier = unit === 'toman' ? 10 : 1;
  const format = (value: number) => formatMoney(value, unit);
  const periodLabel = useMemo(
    () => `سال ${toPersianDigits(year)} · ماه ${toPersianDigits(month)} · ${toPersianDigits(monthDays)} روزه`,
    [year, month, monthDays]
  );

  const updateDraft = (patch: Partial<EmployeeDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setRunResult(null);
    setFormError(null);
  };

  const addEmployee = async () => {
    const master = employeeMasters.find((item) => item.employeeId === selectedMasterId);
    if (!master) {
      setFormError('ابتدا کارمند را در بخش «پرونده کارکنان» ثبت کنید و سپس از این فهرست انتخاب کنید.');
      return;
    }

    const periodStartJalali = `${year}-${String(month).padStart(2, '0')}-01`;
    const periodEndJalali = `${year}-${String(month).padStart(2, '0')}-${String(monthDays).padStart(2, '0')}`;
    const terms = resolveEmployeeTerms(master, periodStartJalali);
    if (terms.issues.length > 0 || !terms.wage || !terms.contract) {
      setFormError(terms.issues.map((issue) => issue.message).join(' '));
      return;
    }

    if (employees.some((employee) =>
      employee.employeeId === master.employeeId ||
      employee.personnelCode === master.personnelCode
    )) {
      setFormError('این کارمند قبلاً به فهرست دوره اضافه شده است.');
      return;
    }

    let serviceDuration;
    try {
      serviceDuration = calculateServiceDurationJalali(master.hireDateJalali, periodEndJalali);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'محاسبه سابقه خدمت ناموفق بود.');
      return;
    }

    const payrollInput: PayrollInput = {
      year,
      monthDays,
      workDays: draft.workDays,
      dailyBaseWageRial: terms.wage.dailyBaseWageRial,
      dailySeniorityRial: terms.wage.dailySeniorityRial,
      housingAllowanceRial: rules.housingAllowanceRial,
      workerCouponRial: rules.workerCouponRial,
      isMarried: draft.isMarried,
      childrenCount: draft.childrenCount,
      has720DaysInsurance: draft.has720DaysInsurance,
      overtimeHours: draft.overtimeHours,
      nightShiftHours: draft.nightShiftHours,
      holidayHours: draft.holidayHours,
      variableBonusRial: draft.variableBonusRial,
      annualWorkedDays: draft.annualWorkedDays,
      serviceYearsForSeverance: serviceDuration.completedYears,
      serviceExtraDaysForSeverance: serviceDuration.additionalDays,
    };

    const employee: PayrollRunEmployee = {
      employeeId: master.employeeId,
      personnelCode: master.personnelCode,
      fullName: `${master.firstName} ${master.lastName}`,
      isActive: master.status === 'active',
      payrollInput,
    };

    try {
      await saveEmployee(employee);
      setEmployees((current) => [
        ...current.filter((item) => item.employeeId !== employee.employeeId),
        employee,
      ]);
      setSelectedMasterId('');
      setDraft(createEmptyDraft(year, monthDays));
      setRunResult(null);
      setFormError(null);
      setStorageError(null);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'ذخیره کارمند در پایگاه داده محلی انجام نشد.'
      );
    }
  };

  const removeEmployee = async (personnelCode: string) => {
    const employee = employees.find((item) => item.personnelCode === personnelCode);
    if (!employee) return;

    try {
      await deleteSavedEmployee(employee.employeeId);
      setEmployees((current) =>
        current.filter((item) => item.employeeId !== employee.employeeId)
      );
      setRunResult(null);
      setStorageError(null);
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : 'حذف کارمند از پایگاه داده محلی ناموفق بود.'
      );
    }
  };

  const calculateRun = async () => {
    if (employees.length === 0 || isSaving) return;
    setIsSaving(true);
    setStorageError(null);

    const periodStartJalali = `${year}-${String(month).padStart(2, '0')}-01`;
    const periodEndJalali = `${year}-${String(month).padStart(2, '0')}-${String(monthDays).padStart(2, '0')}`;
    const periodEmployees = employees.map((employee) => {
      const master = employeeMasters.find((item) => item.employeeId === employee.employeeId);
      if (!master) {
        return {
          ...employee,
          payrollInput: {
            ...employee.payrollInput,
            year,
            monthDays,
            workDays: Math.min(employee.payrollInput.workDays, monthDays),
            housingAllowanceRial: rules.housingAllowanceRial,
            workerCouponRial: rules.workerCouponRial,
          },
        };
      }

      const terms = resolveEmployeeTerms(master, periodStartJalali);
      const masterDataIssues = terms.issues.map((issue) => ({
        code: issue.code,
        message: issue.message,
        field: issue.field,
      }));
      let serviceDuration = {
        completedYears: employee.payrollInput.serviceYearsForSeverance,
        additionalDays: employee.payrollInput.serviceExtraDaysForSeverance,
      };
      try {
        serviceDuration = calculateServiceDurationJalali(master.hireDateJalali, periodEndJalali);
      } catch (error) {
        masterDataIssues.push({
          code: 'INVALID_SERVICE_DURATION',
          message: error instanceof Error ? error.message : 'محاسبه سابقه خدمت ناموفق بود.',
          field: 'hireDateJalali',
        });
      }

      return {
        ...employee,
        personnelCode: master.personnelCode,
        fullName: `${master.firstName} ${master.lastName}`,
        isActive: master.status === 'active',
        masterDataIssues,
        payrollInput: {
          ...employee.payrollInput,
          year,
          monthDays,
          workDays: Math.min(employee.payrollInput.workDays, monthDays),
          dailyBaseWageRial: terms.wage?.dailyBaseWageRial ?? employee.payrollInput.dailyBaseWageRial,
          dailySeniorityRial: terms.wage?.dailySeniorityRial ?? employee.payrollInput.dailySeniorityRial,
          housingAllowanceRial: rules.housingAllowanceRial,
          workerCouponRial: rules.workerCouponRial,
          serviceYearsForSeverance: serviceDuration.completedYears,
          serviceExtraDaysForSeverance: serviceDuration.additionalDays,
        },
      };
    });

    const result = calculatePayrollRun(
      {
        runId: `PAY-${year}-${String(month).padStart(2, '0')}-${Date.now()}`,
        fiscalYear: year,
        month,
        monthDays,
      },
      periodEmployees
    );
    setRunResult(result);

    try {
      await savePayrollRunSnapshot(result);
      const history = await listSavedPayrollRuns(8);
      setRunHistory(history);
      setLastSavedRunId(result.runId);
    } catch (error) {
      setLastSavedRunId(null);
      setStorageError(
        error instanceof Error
          ? `محاسبه انجام شد، اما ذخیره سابقه دوره ناموفق بود: ${error.message}`
          : 'محاسبه انجام شد، اما ذخیره سابقه دوره ناموفق بود.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (vaultPhase === 'checking') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        در حال بررسی وضعیت خزانه اطلاعات…
      </div>
    );
  }

  if (vaultPhase !== 'unlocked') {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">LOCAL DATA</div>
            <h1 className="mt-1 text-xl font-bold text-slate-900">
              {vaultPhase === 'error' ? 'دسترسی به اطلاعات ممکن نیست' : 'بازکردن اطلاعات ذخیره‌شده'}
            </h1>
          </div>
        </div>

        {vaultPhase === 'error' ? (
          <div className="space-y-3">
            <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {vaultError ?? 'خواندن پایگاه داده محلی ناموفق بود.'}
            </p>
            <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              بارگذاری مجدد نرم‌افزار
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm leading-7 text-slate-600">
              این داده‌ها در نسخه قبلی نرم‌افزار با عبارت عبور محافظت شده‌اند. برای حفظ و بازیابی همان اطلاعات، عبارت عبور قبلی را وارد کن. نصب‌های جدید به ساخت خزانه یا تعریف گذرواژه جداگانه نیاز ندارند.
            </p>
            <form onSubmit={handleUnlockVault} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">عبارت عبور قبلی</label>
                <input type="password" value={vaultPassword} onChange={(event) => setVaultPassword(event.target.value)} autoComplete="current-password" required className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" placeholder="عبارت عبور قبلی" />
              </div>
              {vaultError && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{vaultError}</div>}
              <button type="submit" disabled={vaultBusy || !vaultPassword} className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40">
                {vaultBusy ? 'در حال بازکردن اطلاعات…' : 'بازکردن اطلاعات'}
              </button>
            </form>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="border border-slate-200 bg-white rounded-xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500">Payroll Run · پردازش گروهی</div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">پردازش دوره حقوق و دستمزد</h1>
            <p className="text-sm text-slate-600 mt-1">
              پرونده کارکنان و سوابق محاسبات در پایگاه داده محلی همین دستگاه نگهداری می‌شوند؛ محاسبات همه کارکنان از موتور مرکزی نرم‌افزار انجام می‌شود.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {isLoadingLocalData
                ? 'در حال بازیابی اطلاعات ذخیره‌شده…'
                : `${toPersianDigits(employees.length)} پرونده پرسنلی ذخیره‌شده در این دستگاه`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg px-3 py-2">
              {periodLabel}
            </div>
            {isPayrollVaultUnlocked() && (
              <button
                type="button"
                onClick={handleLockVault}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Lock className="h-3.5 w-3.5" />
                قفل اطلاعات
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">ماه دوره</label>
            <select
              value={month}
              onChange={(event) => {
                setMonth(numberValue(event.target.value));
                setRunResult(null);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>{toPersianDigits(value)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">طول ماه</label>
            <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              {toPersianDigits(monthDays)} روز · از تنظیمات اصلی
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">تعداد پرسنل فهرست</label>
            <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm tabular-nums">
              {toPersianDigits(employees.length)} نفر
            </div>
          </div>
        </div>
      </section>

      {storageError && (
        <div className="border border-rose-200 bg-rose-50 rounded-lg p-3 text-sm text-rose-800">
          {storageError}
        </div>
      )}

      {runHistory.length > 0 && (
        <section className="border border-slate-200 bg-white rounded-xl p-6 space-y-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">تاریخچه محاسبات ذخیره‌شده</h2>
            <p className="text-xs text-slate-500 mt-1">این موارد Snapshot محاسبات قبلی هستند و با تغییر نرخ‌های فعلی بازمحاسبه نمی‌شوند.</p>
          </div>
          <div className="divide-y divide-slate-200">
            {runHistory.map((savedRun) => (
              <div key={savedRun.runId} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-slate-800">{savedRun.runId}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(savedRun.savedAt).toLocaleString('fa-IR')} ·
                    {toPersianDigits(savedRun.totals.calculatedCount)} نفر محاسبه‌شده ·
                    {toPersianDigits(savedRun.totals.netPayRial.toLocaleString('fa-IR'))} ریال خالص
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const snapshot = await loadSavedPayrollRun(savedRun.runId);
                      if (snapshot) {
                        setRunResult(snapshot);
                        setLastSavedRunId(snapshot.runId);
                        setStorageError(null);
                      }
                    } catch (error) {
                      setStorageError(error instanceof Error ? error.message : 'بازیابی دوره ناموفق بود.');
                    }
                  }}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-900"
                >
                  نمایش Snapshot
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="border border-slate-200 bg-white rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">افزودن کارمند به دوره</h2>
          <p className="text-xs text-slate-500 mt-1">
            همه مبالغ در موتور به ریال ذخیره می‌شوند؛ ورودی مزد و مزایا بر اساس واحد نمایشی بالا تفسیر می‌شود.
          </p>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">انتخاب از پرونده کارکنان *</label>
              <select
                value={selectedMasterId}
                onChange={(event) => { setSelectedMasterId(event.target.value); setFormError(null); }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">انتخاب کارمند ثبت‌شده</option>
                {employeeMasters.map((master) => (
                  <option key={master.employeeId} value={master.employeeId}>
                    {master.personnelCode} — {master.firstName} {master.lastName}
                  </option>
                ))}
              </select>
              {employeeMasters.length === 0 && (
                <p className="text-xs text-amber-700">هنوز پرونده‌ای ثبت نشده است. ابتدا از تب «پرونده کارکنان» اطلاعات پایه، قرارداد و مزد را ثبت کنید.</p>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600">
              {selectedMasterId ? (() => {
                const master = employeeMasters.find((item) => item.employeeId === selectedMasterId);
                if (!master) return 'کارمند انتخاب نشده است.';
                const terms = resolveEmployeeTerms(master, `${year}-${String(month).padStart(2, '0')}-01`);
                return terms.issues.length
                  ? terms.issues.map((issue) => issue.message).join(' ')
                  : `قرارداد: ${terms.contract?.jobTitle} · مزد روزانه مؤثر: ${format(terms.wage?.dailyBaseWageRial ?? 0)} · پایه سنوات: ${format(terms.wage?.dailySeniorityRial ?? 0)}`;
              })() : 'با انتخاب کارمند، قرارداد و آخرین سابقه مزد معتبر در ابتدای دوره به‌صورت خودکار انتخاب می‌شوند.'}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">روزهای پرداخت/کارکرد</label>
              <input type="number" min={0} max={monthDays} value={draft.workDays} onChange={(event) => updateDraft({ workDays: numberValue(event.target.value) })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">اضافه‌کاری (ساعت)</label>
              <input type="number" min={0} value={draft.overtimeHours} onChange={(event) => updateDraft({ overtimeHours: numberValue(event.target.value) })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">شب‌کاری (ساعت)</label>
              <input type="number" min={0} value={draft.nightShiftHours} onChange={(event) => updateDraft({ nightShiftHours: numberValue(event.target.value) })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">کار در تعطیل (ساعت)</label>
              <input type="number" min={0} value={draft.holidayHours} onChange={(event) => updateDraft({ holidayHours: numberValue(event.target.value) })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">پاداش متغیر ({unit})</label>
              <input type="number" min={0} value={Math.round(draft.variableBonusRial / unitMultiplier)} onChange={(event) => updateDraft({ variableBonusRial: numberValue(event.target.value) * unitMultiplier })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">کارکرد سال برای عیدی (روز)</label>
              <input type="number" min={0} max={366} value={draft.annualWorkedDays} onChange={(event) => updateDraft({ annualWorkedDays: numberValue(event.target.value) })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.isMarried}
              onChange={(event) => updateDraft({ isMarried: event.target.checked })}
            />
            متأهل
          </label>
          <label className="inline-flex items-center gap-2">
            <span>تعداد فرزند واجد شرایط</span>
            <input
              type="number"
              min={0}
              value={draft.childrenCount}
              onChange={(event) => updateDraft({ childrenCount: numberValue(event.target.value) })}
              className="w-20 rounded-lg border border-slate-200 px-2 py-1 tabular-nums"
            />
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.has720DaysInsurance}
              onChange={(event) => updateDraft({ has720DaysInsurance: event.target.checked })}
            />
            سابقه بیمه ۷۲۰ روز یا بیشتر
          </label>
        </div>

        {formError && (
          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
            {formError}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={addEmployee}
            disabled={isLoadingLocalData}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            <Plus className="w-4 h-4"/>
            ذخیره کارمند و افزودن به دوره
          </button>
        </div>
      </section>

      <section className="border border-slate-200 bg-white rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">فهرست پرسنل دوره</h2>
            <p className="text-xs text-slate-500 mt-1">حذف هر ردیف، نتیجه محاسبه قبلی را باطل می‌کند.</p>
          </div>
          <button
            type="button"
            disabled={employees.length === 0 || isSaving || isLoadingLocalData}
            onClick={() => void calculateRun()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
          >
            <Calculator className="w-4 h-4"/>
            {isSaving ? 'در حال محاسبه و ذخیره…' : 'محاسبه و ذخیره دوره حقوق'}
          </button>
        </div>

        {employees.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            هنوز کارمندی به این دوره اضافه نشده است.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm text-right">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="p-3">کد پرسنلی</th>
                  <th className="p-3">نام</th>
                  <th className="p-3">مزد روزانه</th>
                  <th className="p-3">روز کارکرد</th>
                  <th className="p-3">اضافه‌کاری</th>
                  <th className="p-3">وضعیت</th>
                  <th className="p-3">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {employees.map((employee) => {
                  const line = runResult?.lines.find((item) => item.personnelCode === employee.personnelCode);
                  return (
                    <tr key={employee.employeeId}>
                      <td className="p-3 tabular-nums">{employee.personnelCode}</td>
                      <td className="p-3">{employee.fullName}</td>
                      <td className="p-3 tabular-nums">{format(employee.payrollInput.dailyBaseWageRial)}</td>
                      <td className="p-3 tabular-nums">{toPersianDigits(employee.payrollInput.workDays)}</td>
                      <td className="p-3 tabular-nums">{toPersianDigits(employee.payrollInput.overtimeHours)}</td>
                      <td className="p-3">
                        {line?.status === 'calculated' ? (
                          <span className="text-teal-700">محاسبه شد</span>
                        ) : line?.status === 'blocked' ? (
                          <span className="text-rose-700">نیازمند اصلاح</span>
                        ) : (
                          <span className="text-slate-500">در انتظار محاسبه</span>
                        )}
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => removeEmployee(employee.personnelCode)}
                          className="inline-flex items-center gap-1 text-xs text-rose-700 hover:text-rose-900"
                        >
                          <Trash2 className="w-3.5 h-3.5"/>
                          حذف
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {runResult && (
        <section className="border border-slate-200 bg-white rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">نتیجه تجمیعی دوره</h2>
              <p className="text-xs text-slate-500 mt-1">{runResult.runId}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className={runResult.status === 'ready-for-review' ? 'text-teal-700 text-sm font-semibold' : 'text-rose-700 text-sm font-semibold'}>
                {runResult.status === 'ready-for-review' ? 'آماده بررسی' : 'دارای خطای اعتبارسنجی'}
              </span>
              {lastSavedRunId === runResult.runId && (
                <span className="text-xs text-teal-700">Snapshot این دوره ذخیره شده است</span>
              )}
              <button
                type="button"
                onClick={() => void downloadPayrollRunExcelWorkbook(runResult)}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800"
              >
                <FileSpreadsheet className="w-4 h-4"/>
                خروجی Excel کل دوره
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ['جمع ناخالص', runResult.totals.grossEarningsRial],
              ['بیمه سهم کارگر', runResult.totals.employeeInsuranceRial],
              ['مالیات حقوق', runResult.totals.payrollTaxRial],
              ['خالص پرداختی', runResult.totals.netPayRial],
              ['بیمه کارفرما', runResult.totals.employerInsuranceRial],
              ['هزینه مستقیم کارفرما', runResult.totals.directEmployerCostRial],
              ['ذخایر ماهانه', runResult.totals.monthlyReservesRial],
              ['CTC ماهانه', runResult.totals.ctcMonthlyRial],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="text-base font-bold text-slate-900 tabular-nums mt-1">
                  {format(Number(value))}
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-slate-600">
            محاسبه‌شده: {toPersianDigits(runResult.totals.calculatedCount)} ·
            مسدودشده: {toPersianDigits(runResult.totals.blockedCount)} ·
            خارج از دوره: {toPersianDigits(runResult.totals.excludedCount)}
          </div>

          {runResult.lines.some((line) => line.issues.length > 0) && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-2">
              <div className="text-sm font-semibold text-amber-900">موارد نیازمند اصلاح ورودی</div>
              {runResult.lines.filter((line) => line.issues.length > 0).map((line) => (
                <div key={line.employeeId} className="text-xs text-amber-900">
                  <strong>{line.personnelCode} · {line.fullName}:</strong>{' '}
                  {line.issues.map((issue) => issue.message).join('؛ ')}
                </div>
              ))}
            </div>
          )}
          {runResult.lines.some((line) => (line.result?.legalReviewRequiredItems.length ?? 0) > 0) && (
            <div className="border border-orange-200 bg-orange-50 rounded-lg p-4 space-y-2">
              <div className="text-sm font-semibold text-orange-900">
                هشدارهای حقوقی؛ محاسبه انجام شده اما قواعد تأیید نهایی ندارند
              </div>
              {runResult.lines.filter((line) => (line.result?.legalReviewRequiredItems.length ?? 0) > 0).map((line) => (
                <div key={line.employeeId} className="text-xs text-orange-900 leading-6">
                  <strong>{line.personnelCode} · {line.fullName}:</strong>{' '}
                  {line.result?.legalReviewRequiredItems.join('؛ ')}
                </div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm text-right">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="p-3">کارمند</th>
                  <th className="p-3">ناخالص</th>
                  <th className="p-3">بیمه کارگر</th>
                  <th className="p-3">مالیات</th>
                  <th className="p-3">خالص</th>
                  <th className="p-3">CTC</th>
                  <th className="p-3">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {runResult.lines.map((line) => (
                  <tr key={line.employeeId}>
                    <td className="p-3">{line.personnelCode} · {line.fullName}</td>
                    <td className="p-3 tabular-nums">{line.result ? format(line.result.grossEarningsRial) : '—'}</td>
                    <td className="p-3 tabular-nums">{line.result ? format(line.result.employeeInsuranceRial) : '—'}</td>
                    <td className="p-3 tabular-nums">{line.result ? format(line.result.totalPayrollTaxRial) : '—'}</td>
                    <td className="p-3 tabular-nums">{line.result ? format(line.result.netPayRial) : '—'}</td>
                    <td className="p-3 tabular-nums">{line.result ? format(line.result.ctcMonthlyRial) : '—'}</td>
                    <td className="p-3">
                      {line.status === 'calculated' ? 'محاسبه شد' : line.status === 'blocked' ? 'مسدود' : 'حذف از دوره'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="border border-amber-200 bg-amber-50 rounded-xl p-4 text-xs text-amber-900 leading-6">
        اطلاعات این نسخه به‌صورت محلی در پروفایل مرورگر همین دستگاه ذخیره می‌شوند و در نصب جدید رمزنگاری جداگانه یا حساب کاربری مستقل لازم نیست. پاک‌شدن داده‌های مرورگر یا خرابی دستگاه می‌تواند باعث از دست‌رفتن اطلاعات شود؛ تا زمان آماده‌شدن پشتیبان‌گیری داخلی، نسخه پشتیبان مستقل نگهداری شود. این نسخه هنوز بسته مستقل Windows نیست. قراردادها، تاریخچه مزد، حضور و غیاب، دفتر مرخصی و گردش تأیید/پرداخت نیز کامل نشده‌اند؛ نتیجه «آماده بررسی» مجوز پرداخت نیست.
      </section>
    </div>
  );
}
