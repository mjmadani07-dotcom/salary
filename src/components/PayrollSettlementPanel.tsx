import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, FilePlus2, Save } from 'lucide-react';
import type { PayrollRunResult } from '../utils/payrollRunEngine';
import type { StoredPayrollRun } from '../data/payrollLocalDatabase';
import {
  listPayrollSettlementCases,
  savePayrollSettlementCase,
} from '../data/payrollLocalDatabase';
import type {
  PayrollSettlementCase,
  PayrollSettlementReason,
} from '../types/payrollSettlement';
import {
  calculatePayrollSettlement,
  validatePayrollSettlementWorkflow,
} from '../utils/payrollSettlement';
import { formatMoney } from '../utils/payrollEngine';
import type { CurrencyUnit } from '../data/payrollRegulations';

interface PayrollSettlementPanelProps {
  run: StoredPayrollRun;
  unit: CurrencyUnit;
}

const reasons: Array<{ value: PayrollSettlementReason; label: string }> = [
  { value: 'contract-end', label: 'پایان قرارداد / خاتمه همکاری' },
  { value: 'resignation', label: 'استعفا' },
  { value: 'dismissal', label: 'فسخ / اخراج' },
  { value: 'retirement', label: 'بازنشستگی' },
  { value: 'total-disability', label: 'ازکارافتادگی کلی' },
  { value: 'death', label: 'فوت' },
  { value: 'workshop-closure', label: 'تعطیلی کارگاه' },
  { value: 'work-related-incapacity', label: 'کاهش توانایی ناشی از کار (ماده ۳۲)' },
  { value: 'other', label: 'سایر موارد (با ثبت مبنای حقوقی)' },
];

function createDraft(line: PayrollRunResult['lines'][number], run: StoredPayrollRun): PayrollSettlementCase {
  const suggestedDailyWage = line.payrollInput.dailyBaseWageRial + line.payrollInput.dailySeniorityRial;
  return {
    settlementId: crypto.randomUUID(),
    employeeId: line.employeeId,
    personnelCode: line.personnelCode,
    employeeName: line.fullName,
    fiscalYear: run.fiscalYear,
    hireDateJalali: line.hireDateJalali ?? '',
    terminationDateJalali: line.terminationDateJalali ?? '',
    reason: 'contract-end',
    monthsWorkedInYear: 0,
    annualWorkedDays: line.payrollInput.annualWorkedDays,
    annualCalendarDays: 365,
    eidDailyWageBasisRial: suggestedDailyWage,
    eidWageBasisReference: `پیشنهاد از Snapshot حقوق ${run.runId}؛ نیازمند بازبینی حکم و اجزای مزد`,
    eidWageBasisConfirmed: false,
    severanceMonthlyWageBasisRial: suggestedDailyWage * 30,
    severanceWageBasisReference: `پیشنهاد از Snapshot حقوق ${run.runId}؛ نیازمند بازبینی آخرین حقوق`,
    severanceWageBasisConfirmed: false,
    leaveBalanceDays: line.leaveBalanceDays ?? 0,
    leaveBalanceConfirmed: line.leaveBalanceDays !== undefined,
    leaveDailyBasisRial: 0,
    leaveBasisReference: '',
    leaveBasisConfirmed: false,
    eidAdvancePaidRial: 0,
    eidAdvanceReference: '',
    priorSeverancePaidRial: 0,
    priorSeveranceReference: '',
    otherClaimsRial: 0,
    otherClaimsDescription: '',
    approvedDeductionsRial: 0,
    deductionAuthorizationReference: '',
    medicalCommissionReference: '',
    legalBasisReference: '',
    notes: '',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5 text-xs text-slate-700">
      <span className="font-semibold">{label}</span>
      {children}
      {hint && <span className="block text-[10px] leading-4 text-slate-500">{hint}</span>}
    </label>
  );
}

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40';

export function PayrollSettlementPanel({ run, unit }: PayrollSettlementPanelProps) {
  const multiplier = unit === 'toman' ? 10 : 1;
  const employees = run.lines.filter((line) => line.status === 'calculated' && line.result);
  const [cases, setCases] = useState<PayrollSettlementCase[]>([]);
  const [form, setForm] = useState<PayrollSettlementCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employees[0]?.employeeId ?? '');

  const preview = useMemo(
    () => form ? calculatePayrollSettlement(form) : null,
    [form],
  );
  const locked = saving || form?.status === 'approved' || form?.status === 'paid';

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const saved = await listPayrollSettlementCases(300);
        if (active) setCases(saved);
      } catch (error) {
        if (active) setFeedback(error instanceof Error ? error.message : 'بازیابی پرونده‌های تسویه ناموفق بود.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [run.runId]);

  const updateField = <K extends keyof PayrollSettlementCase>(
    key: K,
    value: PayrollSettlementCase[K]
  ) => {
    setForm((current) => current ? {
      ...current,
      [key]: value,
      status: current.status === 'approved' || current.status === 'paid' ? current.status : 'draft',
      calculation: undefined,
    } : current);
    setFeedback(null);
  };

  const updateWorkflowField = <K extends keyof PayrollSettlementCase>(
    key: K,
    value: PayrollSettlementCase[K]
  ) => {
    setForm((current) => current ? { ...current, [key]: value } : current);
    setFeedback(null);
  };

  const startNewCase = () => {
    const line = employees.find((item) => item.employeeId === selectedEmployeeId);
    if (!line) {
      setFeedback('ابتدا یک کارمند دارای محاسبه معتبر از دوره انتخاب کن.');
      return;
    }
    setForm(createDraft(line, run));
    setFeedback('پرونده جدید ایجاد شد. مبانی مزد، سابقه، مانده مرخصی و روزهای کارکرد را بررسی و تکمیل کن.');
  };

  const openCase = (settlementId: string) => {
    const selected = cases.find((item) => item.settlementId === settlementId);
    if (!selected) return;
    setForm(selected);
    setSelectedEmployeeId(selected.employeeId);
    setFeedback('پرونده ذخیره‌شده بارگذاری شد.');
  };

  const persist = async (next: PayrollSettlementCase, message: string) => {
    setSaving(true);
    setFeedback(null);
    try {
      const saved = await savePayrollSettlementCase(next);
      setCases((current) => [
        saved,
        ...current.filter((item) => item.settlementId !== saved.settlementId),
      ]);
      setForm(saved);
      setFeedback(message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'ذخیره پرونده تسویه ناموفق بود.');
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = () => {
    if (!form) return;
    void persist({ ...form, status: 'draft', calculation: undefined }, 'پیش‌نویس تسویه ذخیره شد.');
  };

  const calculateAndReview = () => {
    if (!form) return;
    const result = calculatePayrollSettlement(form);
    if (result.issues.length > 0 || !result.result) {
      setFeedback(result.issues.map((issue) => issue.message).join(' '));
      return;
    }
    void persist({
      ...form,
      status: 'ready-for-review',
      calculation: result.result,
    }, 'محاسبه انجام شد و پرونده برای بازبینی آماده است.');
  };

  const approve = () => {
    if (!form) return;
    const next = { ...form, status: 'approved' as const };
    const issues = validatePayrollSettlementWorkflow(next);
    if (issues.length > 0) {
      setFeedback(issues.join(' '));
      return;
    }
    void persist(next, 'تأیید پرونده ثبت شد. نام تأییدکننده و مرجع تأیید در سابقه پرونده نگهداری می‌شود.');
  };

  const markPaid = () => {
    if (!form) return;
    const next = { ...form, status: 'paid' as const };
    const issues = validatePayrollSettlementWorkflow(next);
    if (issues.length > 0) {
      setFeedback(issues.join(' '));
      return;
    }
    void persist(next, 'سند پرداخت به پرونده تسویه اضافه شد.');
  };

  const setAmount = (
    key: 'eidDailyWageBasisRial' | 'severanceMonthlyWageBasisRial' |
      'leaveDailyBasisRial' | 'eidAdvancePaidRial' | 'priorSeverancePaidRial' |
      'otherClaimsRial' | 'approvedDeductionsRial' | 'paidAmountRial',
    raw: string
  ) => {
    const numeric = raw.trim() === '' ? 0 : Number(raw);
    if (!Number.isFinite(numeric)) return;
    updateField(key, Math.round(numeric * multiplier));
  };

  const moneyValue = (value: number | undefined) =>
    value === undefined ? '' : String(Math.round(value / multiplier));

  const amountField = (
    label: string,
    key: 'eidDailyWageBasisRial' | 'severanceMonthlyWageBasisRial' |
      'leaveDailyBasisRial' | 'eidAdvancePaidRial' | 'priorSeverancePaidRial' |
      'otherClaimsRial' | 'approvedDeductionsRial',
    hint?: string
  ) => (
    <Field label={`${label} (${unit})`} hint={hint}>
      <input
        className={inputClass}
        type="number"
        min={0}
        step={1}
        disabled={Boolean(locked)}
        value={form ? moneyValue(form[key]) : ''}
        onChange={(event) => setAmount(key, event.target.value)}
      />
    </Field>
  );

  const textField = (
    label: string,
    key: 'eidWageBasisReference' | 'severanceWageBasisReference' |
      'leaveBasisReference' | 'eidAdvanceReference' | 'priorSeveranceReference' |
      'otherClaimsDescription' | 'deductionAuthorizationReference' |
      'medicalCommissionReference' | 'legalBasisReference' | 'notes',
    placeholder = ''
  ) => (
    <Field label={label}>
      <input
        className={inputClass}
        type="text"
        disabled={Boolean(locked)}
        value={form?.[key] ?? ''}
        placeholder={placeholder}
        onChange={(event) => updateField(key, event.target.value)}
      />
    </Field>
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs text-slate-500">Termination & Final Settlement</div>
          <h2 className="mt-1 text-lg font-bold text-slate-900">پرونده عیدی، سنوات و تسویه پایان کار</h2>
          <p className="mt-1 max-w-3xl text-xs leading-6 text-slate-600">
            مبنای مزد عیدی، سنوات و بازخرید مرخصی جداست و باید با سند تأیید شود. مانده مرخصیِ پایان کار به‌صورت خودکار به سقف ۹ روز محدود نمی‌شود. مبلغ نهایی این صفحه قبل از مالیات و کسورات قانونی احتمالی است.
          </p>
        </div>
        <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
          دوره مبنا: {run.fiscalYear} · ماه {run.month}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="کارمند">
          <select
            className={inputClass}
            value={selectedEmployeeId}
            onChange={(event) => setSelectedEmployeeId(event.target.value)}
          >
            {employees.map((line) => (
              <option key={line.employeeId} value={line.employeeId}>
                {line.personnelCode} · {line.fullName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="پرونده‌های ذخیره‌شده">
          <select
            className={inputClass}
            value={form && cases.some((item) => item.settlementId === form.settlementId) ? form.settlementId : ''}
            onChange={(event) => event.target.value && openCase(event.target.value)}
            disabled={loading || cases.length === 0}
          >
            <option value="">انتخاب پرونده قبلی…</option>
            {cases.map((item) => (
              <option key={item.settlementId} value={item.settlementId}>
                {item.personnelCode} · {item.terminationDateJalali || 'بدون تاریخ'} · {item.status}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end">
          <button type="button" className={`${buttonClass} w-full bg-slate-900 text-white hover:bg-slate-800`}
            onClick={startNewCase} disabled={employees.length === 0 || saving}>
            <FilePlus2 className="h-4 w-4" /> پرونده جدید
          </button>
        </div>
      </div>

      {loading && <p className="mt-4 text-xs text-slate-500">در حال بارگذاری پرونده‌های ذخیره‌شده…</p>}
      {!form && !loading && (
        <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          برای شروع، کارمند را انتخاب و «پرونده جدید» را بزن.
        </p>
      )}

      {form && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-700">وضعیت پرونده:</span>
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">
              {form.status === 'draft' ? 'پیش‌نویس' : form.status === 'ready-for-review' ? 'آماده بازبینی' : form.status === 'approved' ? 'تأییدشده' : form.status === 'paid' ? 'پرداخت‌شده' : 'لغوشده'}
            </span>
            <span className="text-slate-500">{form.employeeName} · {form.personnelCode}</span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="تاریخ خاتمه همکاری (شمسی)">
              <input className={inputClass} disabled={Boolean(locked)} placeholder="1405-06-31" value={form.terminationDateJalali}
                onChange={(event) => updateField('terminationDateJalali', event.target.value)} />
            </Field>
            <Field label="علت خاتمه">
              <select className={inputClass} disabled={Boolean(locked)} value={form.reason}
                onChange={(event) => updateField('reason', event.target.value as PayrollSettlementReason)}>
                {reasons.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </Field>
            <Field label="تاریخ شروع همکاری (شمسی)">
              <input className={inputClass} disabled value={form.hireDateJalali} />
            </Field>
            <Field label="ماه کارکرد سال (ورودی مستقل اکسل)">
              <input className={inputClass} type="number" min={0} max={12} step={1} disabled={Boolean(locked)} value={form.monthsWorkedInYear}
                onChange={(event) => updateField('monthsWorkedInYear', Number(event.target.value))} />
            </Field>
            <Field label="روز کارکرد سال">
              <input className={inputClass} type="number" min={0} max={366} step={0.5} disabled={Boolean(locked)} value={form.annualWorkedDays}
                onChange={(event) => updateField('annualWorkedDays', Number(event.target.value))} />
            </Field>
            <Field label="روزهای تقویمی سال">
              <select className={inputClass} disabled={Boolean(locked)} value={form.annualCalendarDays}
                onChange={(event) => updateField('annualCalendarDays', Number(event.target.value) as 365 | 366)}>
                <option value={365}>۳۶۵</option><option value={366}>۳۶۶</option>
              </select>
            </Field>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <h3 className="text-sm font-bold text-slate-800">مبنای مستقل عیدی</h3>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">مبنای روزانه عیدی از مزد و مزایای مرتبط با شغل استخراج می‌شود؛ مقدار پیشنهادی از Snapshot فقط نقطه شروع است و تأیید سندی لازم دارد.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              {amountField('مزد روزانه مبنای عیدی', 'eidDailyWageBasisRial')}
              {textField('مرجع مزد عیدی', 'eidWageBasisReference')}
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-xs text-slate-700">
                <input type="checkbox" disabled={Boolean(locked)} checked={form.eidWageBasisConfirmed}
                  onChange={(event) => updateField('eidWageBasisConfirmed', event.target.checked)} />
                مبنای عیدی با سند بررسی شد
              </label>
              {amountField('عیدی علی‌الحساب پرداخت‌شده', 'eidAdvancePaidRial')}
              {textField('مرجع پرداخت علی‌الحساب عیدی', 'eidAdvanceReference')}
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <h3 className="text-sm font-bold text-slate-800">مبنای مستقل سنوات پایان کار</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              {amountField('حقوق ماهانه مبنای سنوات', 'severanceMonthlyWageBasisRial')}
              {textField('مرجع حقوق مبنای سنوات', 'severanceWageBasisReference')}
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-xs text-slate-700">
                <input type="checkbox" disabled={Boolean(locked)} checked={form.severanceWageBasisConfirmed}
                  onChange={(event) => updateField('severanceWageBasisConfirmed', event.target.checked)} />
                مبنای سنوات با سند بررسی شد
              </label>
              {amountField('سنوات پرداخت‌شده برای سابقه قبلی', 'priorSeverancePaidRial')}
              {textField('مرجع سنوات پرداخت‌شده قبلی', 'priorSeveranceReference')}
              {textField('شماره رأی کمیسیون پزشکی (ماده ۳۲)', 'medicalCommissionReference')}
              {textField('مبنای حقوقی علت خاتمه', 'legalBasisReference')}
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <h3 className="text-sm font-bold text-slate-800">مانده و بازخرید مرخصی</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="مانده مرخصی تأییدشده (روز)">
                <input className={inputClass} type="number" min={0} step={0.25} disabled={Boolean(locked)} value={form.leaveBalanceDays}
                  onChange={(event) => updateField('leaveBalanceDays', Number(event.target.value))} />
              </Field>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-xs text-slate-700">
                <input type="checkbox" disabled={Boolean(locked)} checked={form.leaveBalanceConfirmed}
                  onChange={(event) => updateField('leaveBalanceConfirmed', event.target.checked)} />
                مانده با دفتر مرخصی تطبیق شد
              </label>
              {amountField('مزد روزانه مبنای بازخرید', 'leaveDailyBasisRial', 'باید بر اساس حق‌السعی و رأی دیوان عدالت اداری تعیین شود؛ به مزد روزانه ساده محدود نشود.')}
              {textField('مرجع مبنای بازخرید مرخصی', 'leaveBasisReference')}
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-xs text-slate-700">
                <input type="checkbox" disabled={Boolean(locked)} checked={form.leaveBasisConfirmed}
                  onChange={(event) => updateField('leaveBasisConfirmed', event.target.checked)} />
                مبنای بازخرید با سند بررسی شد
              </label>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <h3 className="text-sm font-bold text-slate-800">سایر مطالبات و کسورات مجاز</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              {amountField('سایر مطالبات', 'otherClaimsRial')}
              {textField('شرح سایر مطالبات', 'otherClaimsDescription')}
              {amountField('کسورات دارای مجوز', 'approvedDeductionsRial')}
              {textField('مرجع مجوز قانونی/قراردادی کسر', 'deductionAuthorizationReference')}
              <Field label="یادداشت پرونده">
                <textarea className={inputClass} rows={2} disabled={Boolean(locked)} value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)} />
              </Field>
            </div>
          </div>

          {preview && (
            <div className="mt-6 rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-800">نتیجه محاسبه تسویه</h3>
              {preview.issues.length > 0 ? (
                <div className="mt-3 space-y-1 text-xs leading-5 text-rose-700">
                  {preview.issues.map((issue) => <p key={issue.code}>{issue.message}</p>)}
                </div>
              ) : preview.result ? (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
                    {[
                      ['عیدی استحقاقی', preview.result.eidEntitlementRial],
                      ['سنوات پایان کار', preview.result.severanceEntitlementRial],
                      ['بازخرید مرخصی', preview.result.leaveEncashmentRial],
                      ['سایر مطالبات', preview.result.otherClaimsRial],
                      ['قابل پرداخت قبل از مالیات', preview.result.payableBeforeTaxRial],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-lg bg-slate-50 p-3">
                        <div className="text-[11px] text-slate-500">{label}</div>
                        <div className="mt-1 text-sm font-bold tabular-nums text-slate-900">{formatMoney(Number(value), unit)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-[11px] leading-5 text-slate-500">
                    {preview.warnings.map((warning, index) => <p key={index}>• {warning}</p>)}
                  </div>
                </>
              ) : null}
            </div>
          )}

          {form.status === 'ready-for-review' && (
            <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-200 pt-5 md:grid-cols-2">
              <Field label="نام تأییدکننده">
                <input className={inputClass} disabled={saving} value={form.approverName ?? ''}
                  onChange={(event) => updateWorkflowField('approverName', event.target.value)} />
              </Field>
              <Field label="شماره صورتجلسه/مجوز تأیید">
                <input className={inputClass} disabled={saving} value={form.approvalReference ?? ''}
                  onChange={(event) => updateWorkflowField('approvalReference', event.target.value)} />
              </Field>
            </div>
          )}

          {form.status === 'approved' && (
            <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-200 pt-5 md:grid-cols-3">
              <Field label="تاریخ پرداخت (شمسی)">
                <input className={inputClass} placeholder="1405-06-31" value={form.paymentDate ?? ''} disabled={saving}
                  onChange={(event) => updateWorkflowField('paymentDate', event.target.value)} />
              </Field>
              <Field label="شماره سند/مرجع پرداخت">
                <input className={inputClass} value={form.paymentReference ?? ''} disabled={saving}
                  onChange={(event) => updateWorkflowField('paymentReference', event.target.value)} />
              </Field>
              <Field label={`مبلغ پرداخت واقعی (${unit})`}>
                <input className={inputClass} type="number" min={0} value={moneyValue(form.paidAmountRial)} disabled={saving}
                  onChange={(event) => {
                    const numeric = Number(event.target.value || 0);
                    if (Number.isFinite(numeric)) updateWorkflowField('paidAmountRial', Math.round(numeric * multiplier));
                  }} />
              </Field>
              <Field label="علت اختلاف مبلغ پرداخت با محاسبه">
                <input className={inputClass} value={form.paymentDifferenceReason ?? ''} disabled={saving}
                  onChange={(event) => updateWorkflowField('paymentDifferenceReason', event.target.value)} />
              </Field>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-200 pt-5">
            {form.status !== 'approved' && form.status !== 'paid' && (
              <>
                <button type="button" className={`${buttonClass} border border-slate-300 text-slate-700 hover:bg-slate-50`}
                  onClick={saveDraft} disabled={saving}>
                  <Save className="h-4 w-4" /> ذخیره پیش‌نویس
                </button>
                <button type="button" className={`${buttonClass} bg-teal-700 text-white hover:bg-teal-800`}
                  onClick={calculateAndReview} disabled={saving}>
                  <ClipboardCheck className="h-4 w-4" /> محاسبه و آماده بازبینی
                </button>
              </>
            )}
            {form.status === 'ready-for-review' && (
              <button type="button" className={`${buttonClass} bg-slate-900 text-white hover:bg-slate-800`}
                onClick={approve} disabled={saving}>
                <CheckCircle2 className="h-4 w-4" /> ثبت تأیید
              </button>
            )}
            {form.status === 'approved' && (
              <button type="button" className={`${buttonClass} bg-teal-700 text-white hover:bg-teal-800`}
                onClick={markPaid} disabled={saving}>
                <CheckCircle2 className="h-4 w-4" /> ثبت پرداخت
              </button>
            )}
          </div>
        </>
      )}

      {feedback && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-700">
          {feedback}
        </div>
      )}
    </section>
  );
}
