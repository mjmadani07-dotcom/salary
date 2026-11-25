import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Pencil, Trash2, UserRound, FileText, Wallet } from 'lucide-react';
import type {
  EmployeeMasterDraft,
  EmployeeMasterRecord,
  EmploymentContract,
  EmploymentContractType,
  WageHistoryEntry,
} from '../types/employee';
import {
  deleteEmployeeMasterRecord,
  listEmployeeMasterRecords,
  saveEmployeeMasterRecord,
} from '../data/payrollLocalDatabase';
import { validateEmployeeMaster } from '../utils/employeeMaster';
import { formatMoney, toPersianDigits } from '../utils/payrollEngine';
import { useUnifiedPayroll } from '../state/UnifiedPayrollContext';

const EMPTY_DRAFT: EmployeeMasterDraft = {
  personnelCode: '',
  firstName: '',
  lastName: '',
  nationalId: '',
  hireDateJalali: '',
  terminationDateJalali: '',
  status: 'active',
  insuranceNumber: '',
  contractNumber: '',
  contractType: 'fixed-term',
  jobTitle: '',
  department: '',
  contractFromJalali: '',
  contractToJalali: '',
  weeklyHours: '44',
  dailyBaseWageRial: '',
  dailySeniorityRial: '0',
  wageFromJalali: '',
};

const CONTRACT_TYPES: Array<[EmploymentContractType, string]> = [
  ['permanent', 'دائم'],
  ['fixed-term', 'مدت‌موقت'],
  ['temporary', 'موقت'],
  ['project', 'پروژه‌ای'],
  ['other', 'سایر'],
];

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function numberValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function EmployeeDirectoryView() {
  const { state } = useUnifiedPayroll();
  const { unit } = state;
  const multiplier = unit === 'toman' ? 10 : 1;
  const [employees, setEmployees] = useState<EmployeeMasterRecord[]>([]);
  const [draft, setDraft] = useState<EmployeeMasterDraft>(EMPTY_DRAFT);
  const [contracts, setContracts] = useState<EmploymentContract[]>([]);
  const [wageHistory, setWageHistory] = useState<WageHistoryEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    try {
      setEmployees(await listEmployeeMasterRecords());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'خواندن پرونده کارکنان ناموفق بود.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const updateDraft = (patch: Partial<EmployeeMasterDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
    setSuccess(null);
  };

  const addContract = () => {
    const contract: EmploymentContract = {
      contractId: makeId('contract'),
      contractNumber: draft.contractNumber.trim(),
      contractType: draft.contractType,
      jobTitle: draft.jobTitle.trim(),
      department: draft.department.trim(),
      effectiveFromJalali: draft.contractFromJalali.trim(),
      effectiveToJalali: draft.contractToJalali.trim() || null,
      weeklyHours: numberValue(draft.weeklyHours),
      notes: '',
    };
    if (!contract.jobTitle || !contract.effectiveFromJalali) {
      setError('برای ثبت قرارداد، عنوان شغلی و تاریخ شروع قرارداد را وارد کنید.');
      return;
    }
    setContracts((current) => [...current, contract].sort((a, b) => a.effectiveFromJalali.localeCompare(b.effectiveFromJalali)));
    updateDraft({ contractNumber: '', jobTitle: '', contractFromJalali: '', contractToJalali: '' });
  };

  const addWage = () => {
    const wage: WageHistoryEntry = {
      wageEntryId: makeId('wage'),
      effectiveFromJalali: draft.wageFromJalali.trim(),
      dailyBaseWageRial: numberValue(draft.dailyBaseWageRial) * multiplier,
      dailySeniorityRial: numberValue(draft.dailySeniorityRial) * multiplier,
      notes: '',
    };
    if (!wage.effectiveFromJalali || wage.dailyBaseWageRial <= 0) {
      setError('تاریخ اثر و مزد روزانه پایه معتبر را وارد کنید.');
      return;
    }
    setWageHistory((current) => [...current, wage].sort((a, b) => a.effectiveFromJalali.localeCompare(b.effectiveFromJalali)));
    updateDraft({ wageFromJalali: '', dailyBaseWageRial: '', dailySeniorityRial: '0' });
  };

  const resetForm = () => {
    setDraft(EMPTY_DRAFT);
    setContracts([]);
    setWageHistory([]);
    setEditingId(null);
    setError(null);
    setSuccess(null);
  };

  const startEdit = (employee: EmployeeMasterRecord) => {
    setEditingId(employee.employeeId);
    setDraft({
      ...EMPTY_DRAFT,
      personnelCode: employee.personnelCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      nationalId: employee.nationalId,
      hireDateJalali: employee.hireDateJalali,
      terminationDateJalali: employee.terminationDateJalali ?? '',
      status: employee.status,
      insuranceNumber: employee.insuranceNumber,
    });
    setContracts(employee.contracts);
    setWageHistory(employee.wageHistory);
    setError(null);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    const now = new Date().toISOString();
    const existing = employees.find((employee) => employee.employeeId === editingId);
    const record: EmployeeMasterRecord = {
      employeeId: editingId ?? crypto.randomUUID(),
      personnelCode: draft.personnelCode.trim(),
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      nationalId: draft.nationalId.trim(),
      hireDateJalali: draft.hireDateJalali.trim(),
      terminationDateJalali: draft.terminationDateJalali.trim() || null,
      status: draft.status,
      insuranceNumber: draft.insuranceNumber.trim(),
      contracts,
      wageHistory,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const issues = validateEmployeeMaster(record);
    if (issues.length) {
      setError(issues.map((issue) => issue.message).join(' '));
      return;
    }
    if (employees.some((employee) => employee.personnelCode === record.personnelCode && employee.employeeId !== record.employeeId)) {
      setError('این کد پرسنلی قبلاً در پرونده کارکنان ثبت شده است.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await saveEmployeeMasterRecord(record);
      await refresh();
      resetForm();
      setSuccess(editingId ? 'پرونده کارمند به‌روزرسانی شد.' : 'پرونده کارمند ثبت شد.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'ذخیره پرونده ناموفق بود.');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (employee: EmployeeMasterRecord) => {
    if (!window.confirm(`پرونده ${employee.firstName} ${employee.lastName} حذف شود؟ این عملیات سوابق قرارداد و مزد این پرونده را نیز حذف می‌کند.`)) return;
    try {
      await deleteEmployeeMasterRecord(employee.employeeId);
      if (editingId === employee.employeeId) resetForm();
      await refresh();
      setSuccess('پرونده حذف شد.');
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'حذف پرونده ناموفق بود.');
    }
  };

  const activeCount = useMemo(() => employees.filter((employee) => employee.status === 'active').length, [employees]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-100 p-3 text-slate-700"><UserRound className="h-6 w-6" /></div>
          <div>
            <div className="text-xs text-slate-500">Employee Master Data</div>
            <h1 className="mt-1 text-xl font-bold text-slate-900">پرونده کارکنان</h1>
            <p className="mt-1 text-sm text-slate-600">اطلاعات پایه، قراردادهای استخدامی و تاریخچه تغییرات مزد را در یک پرونده دائمی نگهداری کنید.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
          <span>کل پرونده‌ها: <strong className="text-slate-900">{toPersianDigits(employees.length)}</strong></span>
          <span>فعال: <strong className="text-teal-700">{toPersianDigits(activeCount)}</strong></span>
        </div>
      </section>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      {success && <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">{success}</div>}

      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-slate-900">{editingId ? 'ویرایش پرونده کارمند' : 'ثبت کارمند جدید'}</h2>
          {editingId && <button type="button" onClick={resetForm} className="text-xs font-semibold text-slate-600 hover:text-slate-900">لغو ویرایش</button>}
        </div>
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700"><UserRound className="h-4 w-4" /> اطلاعات پایه</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="کد پرسنلی *" value={draft.personnelCode} onChange={(value) => updateDraft({ personnelCode: value })} placeholder="P-1001" />
            <Field label="نام *" value={draft.firstName} onChange={(value) => updateDraft({ firstName: value })} />
            <Field label="نام خانوادگی *" value={draft.lastName} onChange={(value) => updateDraft({ lastName: value })} />
            <Field label="کد ملی" value={draft.nationalId} onChange={(value) => updateDraft({ nationalId: value })} />
            <Field label="شماره بیمه" value={draft.insuranceNumber} onChange={(value) => updateDraft({ insuranceNumber: value })} />
            <Field label="تاریخ شروع همکاری (شمسی) *" value={draft.hireDateJalali} onChange={(value) => updateDraft({ hireDateJalali: value })} placeholder="1404-01-01" />
            <Field label="تاریخ پایان همکاری (شمسی)" value={draft.terminationDateJalali} onChange={(value) => updateDraft({ terminationDateJalali: value })} placeholder="1405-12-29" />
            <label className="space-y-1 text-xs text-slate-600">
              وضعیت پرونده
              <select value={draft.status} onChange={(event) => updateDraft({ status: event.target.value as EmployeeMasterDraft['status'] })} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
                <option value="active">فعال</option><option value="inactive">غیرفعال</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-slate-500">تاریخ‌ها با قالب سال-ماه-روز شمسی وارد می‌شوند؛ مانند 1405-01-01.</p>
        </div>

        <div className="border-t border-slate-100 pt-4 space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700"><FileText className="h-4 w-4" /> قراردادهای استخدامی</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="شماره قرارداد" value={draft.contractNumber} onChange={(value) => updateDraft({ contractNumber: value })} />
            <label className="space-y-1 text-xs text-slate-600">نوع قرارداد
              <select value={draft.contractType} onChange={(event) => updateDraft({ contractType: event.target.value as EmploymentContractType })} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
                {CONTRACT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <Field label="عنوان شغلی *" value={draft.jobTitle} onChange={(value) => updateDraft({ jobTitle: value })} />
            <Field label="واحد سازمانی" value={draft.department} onChange={(value) => updateDraft({ department: value })} />
            <Field label="شروع قرارداد (شمسی) *" value={draft.contractFromJalali} onChange={(value) => updateDraft({ contractFromJalali: value })} placeholder="1405-01-01" />
            <Field label="پایان قرارداد (شمسی)" value={draft.contractToJalali} onChange={(value) => updateDraft({ contractToJalali: value })} placeholder="1405-12-29" />
            <Field label="ساعات هفتگی" value={draft.weeklyHours} onChange={(value) => updateDraft({ weeklyHours: value })} type="number" />
          </div>
          <div className="flex justify-end"><button type="button" onClick={addContract} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"><Plus className="h-4 w-4" /> افزودن قرارداد به سوابق</button></div>
          <div className="space-y-2">
            {contracts.map((contract) => <div key={contract.contractId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-xs">
              <span className="font-semibold text-slate-800">{contract.jobTitle} · {CONTRACT_TYPES.find(([value]) => value === contract.contractType)?.[1]}</span>
              <span className="text-slate-600">{contract.effectiveFromJalali} تا {contract.effectiveToJalali ?? 'بدون تاریخ پایان'}</span>
              <button type="button" onClick={() => setContracts((current) => current.filter((item) => item.contractId !== contract.contractId))} className="text-rose-700">حذف</button>
            </div>)}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Wallet className="h-4 w-4" /> تاریخچه مزد</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={`مزد روزانه پایه (${unit}) *`} value={draft.dailyBaseWageRial} onChange={(value) => updateDraft({ dailyBaseWageRial: value })} type="number" />
            <Field label={`پایه سنوات روزانه (${unit})`} value={draft.dailySeniorityRial} onChange={(value) => updateDraft({ dailySeniorityRial: value })} type="number" />
            <Field label="تاریخ اثر مزد (شمسی) *" value={draft.wageFromJalali} onChange={(value) => updateDraft({ wageFromJalali: value })} placeholder="1405-01-01" />
          </div>
          <div className="flex justify-end"><button type="button" onClick={addWage} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"><Plus className="h-4 w-4" /> افزودن تغییر مزد به سوابق</button></div>
          <div className="space-y-2">
            {wageHistory.map((wage) => <div key={wage.wageEntryId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-xs">
              <span className="font-semibold text-slate-800">{wage.effectiveFromJalali}</span>
              <span className="text-slate-600">مزد روزانه: {formatMoney(wage.dailyBaseWageRial, unit)} · پایه سنوات: {formatMoney(wage.dailySeniorityRial, unit)}</span>
              <button type="button" onClick={() => setWageHistory((current) => current.filter((item) => item.wageEntryId !== wage.wageEntryId))} className="text-rose-700">حذف</button>
            </div>)}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={resetForm} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">پاک‌کردن فرم</button>
          <button type="button" disabled={isSaving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"><Save className="h-4 w-4" />{isSaving ? 'در حال ذخیره…' : 'ذخیره پرونده'}</button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
        <div className="flex items-center justify-between gap-3"><h2 className="font-bold text-slate-900">فهرست کارکنان ثبت‌شده</h2><span className="text-xs text-slate-500">{toPersianDigits(employees.length)} پرونده</span></div>
        {isLoading ? <p className="py-6 text-center text-sm text-slate-500">در حال بارگذاری…</p> : employees.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">هنوز پرونده‌ای ثبت نشده است.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm">
            <thead className="bg-slate-100 text-slate-700"><tr><th className="p-3">کد پرسنلی</th><th className="p-3">نام و نام خانوادگی</th><th className="p-3">شروع همکاری</th><th className="p-3">قرارداد</th><th className="p-3">سوابق مزد</th><th className="p-3">وضعیت</th><th className="p-3">عملیات</th></tr></thead>
            <tbody className="divide-y divide-slate-200">{employees.map((employee) => <tr key={employee.employeeId}>
              <td className="p-3 tabular-nums">{employee.personnelCode}</td><td className="p-3">{employee.firstName} {employee.lastName}</td><td className="p-3 tabular-nums">{employee.hireDateJalali}</td><td className="p-3">{toPersianDigits(employee.contracts.length)}</td><td className="p-3">{toPersianDigits(employee.wageHistory.length)}</td><td className="p-3"><span className={employee.status === 'active' ? 'text-teal-700' : 'text-slate-500'}>{employee.status === 'active' ? 'فعال' : 'غیرفعال'}</span></td>
              <td className="p-3"><div className="flex items-center gap-3"><button type="button" onClick={() => startEdit(employee)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700"><Pencil className="h-3.5 w-3.5" />ویرایش</button><button type="button" onClick={() => void remove(employee)} className="inline-flex items-center gap-1 text-xs text-rose-700"><Trash2 className="h-3.5 w-3.5" />حذف</button></div></td>
            </tr>)}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return <label className="space-y-1 text-xs text-slate-600">{label}<input type={type} min={type === 'number' ? 0 : undefined} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>;
}
