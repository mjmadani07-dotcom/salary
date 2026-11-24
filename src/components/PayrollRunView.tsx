import { useMemo, useState } from 'react';
import { Plus, Trash2, Calculator, FileSpreadsheet } from 'lucide-react';
import { getPayrollRuleSet } from '../data/payrollRuleRegistry';
import {
  formatMoney,
  toPersianDigits,
} from '../utils/payrollEngine';
import type { PayrollInput } from '../utils/payrollEngine';
import {
  calculatePayrollRun,
  PayrollRunEmployee,
  PayrollRunResult,
} from '../utils/payrollRunEngine';
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
  const [runResult, setRunResult] = useState<PayrollRunResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

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

  const addEmployee = () => {
    const personnelCode = draft.personnelCode.trim();
    const fullName = draft.fullName.trim();

    if (!personnelCode || !fullName) {
      setFormError('کد پرسنلی و نام کامل کارمند باید وارد شوند.');
      return;
    }

    if (employees.some((employee) => employee.personnelCode === personnelCode)) {
      setFormError('این کد پرسنلی قبلاً به فهرست دوره اضافه شده است.');
      return;
    }

    const payrollInput: PayrollInput = {
      year,
      monthDays,
      workDays: draft.workDays,
      dailyBaseWageRial: draft.dailyBaseWageRial,
      dailySeniorityRial: draft.dailySeniorityRial,
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
      serviceYearsForSeverance: draft.serviceYearsForSeverance,
      serviceExtraDaysForSeverance: draft.serviceExtraDaysForSeverance,
    };

    setEmployees((current) => [
      ...current,
      {
        employeeId: personnelCode,
        personnelCode,
        fullName,
        isActive: true,
        payrollInput,
      },
    ]);
    setDraft(createEmptyDraft(year, monthDays));
    setRunResult(null);
    setFormError(null);
  };

  const removeEmployee = (personnelCode: string) => {
    setEmployees((current) =>
      current.filter((employee) => employee.personnelCode !== personnelCode)
    );
    setRunResult(null);
  };

  const calculateRun = () => {
    const result = calculatePayrollRun(
      {
        runId: `PAY-${year}-${String(month).padStart(2, '0')}`,
        fiscalYear: year,
        month,
        monthDays,
      },
      employees
    );
    setRunResult(result);
  };

  return (
    <div className="space-y-6">
      <section className="border border-slate-200 bg-white rounded-xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500">Payroll Run · پردازش گروهی</div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">پردازش دوره حقوق و دستمزد</h1>
            <p className="text-sm text-slate-600 mt-1">
              فهرست چندپرسنلی را تشکیل بده و محاسبات تمام افراد را از موتور مرکزی اجرا کن.
            </p>
          </div>
          <div className="text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg px-3 py-2">
            {periodLabel}
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

      <section className="border border-slate-200 bg-white rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">افزودن کارمند به دوره</h2>
          <p className="text-xs text-slate-500 mt-1">
            همه مبالغ در موتور به ریال ذخیره می‌شوند؛ ورودی مزد و مزایا بر اساس واحد نمایشی بالا تفسیر می‌شود.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">کد پرسنلی</label>
            <input
              value={draft.personnelCode}
              onChange={(event) => updateDraft({ personnelCode: event.target.value })}
              placeholder="مثلاً P-1001"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-slate-600">نام و نام خانوادگی</label>
            <input
              value={draft.fullName}
              onChange={(event) => updateDraft({ fullName: event.target.value })}
              placeholder="نام کارمند"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">مزد روزانه پایه ({unit})</label>
            <input
              type="number"
              min={0}
              value={Math.round(draft.dailyBaseWageRial / unitMultiplier)}
              onChange={(event) => updateDraft({ dailyBaseWageRial: numberValue(event.target.value) * unitMultiplier })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">پایه سنوات روزانه ({unit})</label>
            <input
              type="number"
              min={0}
              value={Math.round(draft.dailySeniorityRial / unitMultiplier)}
              onChange={(event) => updateDraft({ dailySeniorityRial: numberValue(event.target.value) * unitMultiplier })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">روزهای پرداخت/کارکرد</label>
            <input
              type="number"
              min={0}
              max={monthDays}
              value={draft.workDays}
              onChange={(event) => updateDraft({ workDays: numberValue(event.target.value) })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">اضافه‌کاری (ساعت)</label>
            <input
              type="number"
              min={0}
              value={draft.overtimeHours}
              onChange={(event) => updateDraft({ overtimeHours: numberValue(event.target.value) })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">شب‌کاری (ساعت)</label>
            <input
              type="number"
              min={0}
              value={draft.nightShiftHours}
              onChange={(event) => updateDraft({ nightShiftHours: numberValue(event.target.value) })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">کار در تعطیل (ساعت)</label>
            <input
              type="number"
              min={0}
              value={draft.holidayHours}
              onChange={(event) => updateDraft({ holidayHours: numberValue(event.target.value) })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">پاداش متغیر ({unit})</label>
            <input
              type="number"
              min={0}
              value={Math.round(draft.variableBonusRial / unitMultiplier)}
              onChange={(event) => updateDraft({ variableBonusRial: numberValue(event.target.value) * unitMultiplier })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">کارکرد سال برای عیدی (روز)</label>
            <input
              type="number"
              min={0}
              max={366}
              value={draft.annualWorkedDays}
              onChange={(event) => updateDraft({ annualWorkedDays: numberValue(event.target.value) })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">سابقه سنوات (سال کامل)</label>
            <input
              type="number"
              min={0}
              value={draft.serviceYearsForSeverance}
              onChange={(event) => updateDraft({ serviceYearsForSeverance: numberValue(event.target.value) })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">روز اضافه سابقه</label>
            <input
              type="number"
              min={0}
              max={364}
              value={draft.serviceExtraDaysForSeverance}
              onChange={(event) => updateDraft({ serviceExtraDaysForSeverance: numberValue(event.target.value) })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
            />
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
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="w-4 h-4"/>
            افزودن به فهرست دوره
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
            disabled={employees.length === 0}
            onClick={calculateRun}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
          >
            <Calculator className="w-4 h-4"/>
            محاسبه دوره حقوق
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
              <div className="text-sm font-semibold text-amber-900">موارد نیازمند بررسی</div>
              {runResult.lines.filter((line) => line.issues.length > 0).map((line) => (
                <div key={line.employeeId} className="text-xs text-amber-900">
                  <strong>{line.personnelCode} · {line.fullName}:</strong>{' '}
                  {line.issues.map((issue) => issue.message).join('؛ ')}
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
        این صفحه در نسخه فعلی، پردازش چندپرسنلی را در حافظه همین نشست انجام می‌دهد. اطلاعات پس از بارگذاری مجدد صفحه باقی نمی‌مانند. بانک دائمی پرسنل، قراردادها، حضور و غیاب، گردش مرخصی، گردش تأیید و پرداخت، و حفاظت دسترسی هنوز پیاده‌سازی نشده‌اند. تا زمان تکمیل این اجزا و تأیید حقوقی قواعد، نتیجه صرفاً «آماده بررسی» است و مجوز پرداخت محسوب نمی‌شود.
      </section>
    </div>
  );
}
