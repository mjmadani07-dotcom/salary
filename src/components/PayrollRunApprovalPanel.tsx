import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, LockKeyhole, ReceiptText } from 'lucide-react';
import type { CurrencyUnit } from '../data/payrollRegulations';
import type { StoredPayrollRun } from '../data/payrollLocalDatabase';
import { savePayrollRunWorkflow } from '../data/payrollLocalDatabase';
import {
  createInitialPayrollRunWorkflow,
  validatePayrollRunWorkflowUpdate,
} from '../utils/payrollRunWorkflow';
import type { PayrollRunWorkflow } from '../types/payrollRunWorkflow';
import { formatMoney, toPersianDigits } from '../utils/payrollEngine';

interface PayrollRunApprovalPanelProps {
  run: StoredPayrollRun;
  unit: CurrencyUnit;
  onUpdated: (run: StoredPayrollRun) => void;
}

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40';

function statusLabel(status: PayrollRunWorkflow['status']): string {
  switch (status) {
    case 'validation-failed': return 'دارای خطای اعتبارسنجی';
    case 'ready-for-review': return 'آماده بررسی مالی';
    case 'approved': return 'تأییدشده';
    case 'paid': return 'پرداخت‌شده';
    case 'closed': return 'بسته‌شده';
  }
}

export function PayrollRunApprovalPanel({ run, unit, onUpdated }: PayrollRunApprovalPanelProps) {
  const multiplier = unit === 'toman' ? 10 : 1;
  const workflow = useMemo(
    () => run.workflow ?? createInitialPayrollRunWorkflow(run, run.savedAt),
    [run.workflow, run.runId, run.savedAt, run.status],
  );
  const [approverName, setApproverName] = useState(workflow.approverName ?? '');
  const [approvalReference, setApprovalReference] = useState(workflow.approvalReference ?? '');
  const [paymentDate, setPaymentDate] = useState(workflow.paymentDate ?? '');
  const [paymentReference, setPaymentReference] = useState(workflow.paymentReference ?? '');
  const [paidAmount, setPaidAmount] = useState(
    workflow.paidAmountRial === undefined
      ? String(Math.round(run.totals.netPayRial / multiplier))
      : String(Math.round(workflow.paidAmountRial / multiplier))
  );
  const [paymentDifferenceReason, setPaymentDifferenceReason] = useState(workflow.paymentDifferenceReason ?? '');
  const [closeReference, setCloseReference] = useState(workflow.closeReference ?? '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setApproverName(workflow.approverName ?? '');
    setApprovalReference(workflow.approvalReference ?? '');
    setPaymentDate(workflow.paymentDate ?? '');
    setPaymentReference(workflow.paymentReference ?? '');
    setPaidAmount(workflow.paidAmountRial === undefined
      ? String(Math.round(run.totals.netPayRial / multiplier))
      : String(Math.round(workflow.paidAmountRial / multiplier)));
    setPaymentDifferenceReason(workflow.paymentDifferenceReason ?? '');
    setCloseReference(workflow.closeReference ?? '');
    setFeedback(null);
  }, [run.runId, workflow, multiplier, run.totals.netPayRial]);

  const persist = async (next: PayrollRunWorkflow, successMessage: string) => {
    const issues = validatePayrollRunWorkflowUpdate(run, workflow, next);
    if (issues.length > 0) {
      setFeedback(issues.map((issue) => issue.message).join(' '));
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const updated = await savePayrollRunWorkflow(run.runId, next);
      onUpdated(updated);
      setFeedback(successMessage);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'ثبت وضعیت دوره ناموفق بود.');
    } finally {
      setSaving(false);
    }
  };

  const approve = () => {
    void persist({
      ...workflow,
      status: 'approved',
      approverName: approverName.trim(),
      approvalReference: approvalReference.trim(),
      approvedAt: new Date().toISOString(),
    }, 'تأیید مالی دوره ثبت شد؛ Snapshot محاسبات قفل است.');
  };

  const markPaid = () => {
    const numericAmount = paidAmount.trim() === '' ? NaN : Number(paidAmount);
    if (!Number.isSafeInteger(numericAmount) || numericAmount < 0) {
      setFeedback('مبلغ پرداخت واقعی باید عدد صحیح و غیرمنفی باشد.');
      return;
    }
    void persist({
      ...workflow,
      status: 'paid',
      paymentDate: paymentDate.trim(),
      paymentReference: paymentReference.trim(),
      paidAmountRial: Math.round(numericAmount * multiplier),
      paymentDifferenceReason: paymentDifferenceReason.trim(),
      paidAt: new Date().toISOString(),
    }, 'پرداخت دوره ثبت شد؛ برای بستن دوره مرجع بایگانی را وارد کنید.');
  };

  const closeRun = () => {
    void persist({
      ...workflow,
      status: 'closed',
      closeReference: closeReference.trim(),
      closedAt: new Date().toISOString(),
    }, 'دوره حقوق بسته شد و دیگر قابل تغییر نیست.');
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs text-slate-500">Payroll Approval & Payment</div>
          <h3 className="mt-1 text-base font-bold text-slate-900">گردش تأیید و پرداخت دوره حقوق</h3>
          <p className="mt-1 text-xs text-slate-500">
            شناسه Snapshot: {run.runId} · مبلغ مورد انتظار: {formatMoney(run.totals.netPayRial, unit)}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
          {workflow.status === 'closed' ? <LockKeyhole className="h-4 w-4" /> : <ReceiptText className="h-4 w-4" />}
          {statusLabel(workflow.status)}
        </div>
      </div>

      {workflow.status === 'validation-failed' && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-6 text-rose-800">
          این دوره به علت خطاهای اعتبارسنجی قابل تأیید نیست. ابتدا داده‌های مسدودشده را اصلاح و یک Snapshot جدید محاسبه کنید.
        </div>
      )}

      {workflow.status === 'ready-for-review' && (
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1 text-xs text-slate-700">
            <span className="font-semibold">نام تأییدکننده مالی</span>
            <input className={inputClass} value={approverName} onChange={(event) => setApproverName(event.target.value)} disabled={saving} />
          </label>
          <label className="space-y-1 text-xs text-slate-700">
            <span className="font-semibold">شماره صورتجلسه / مجوز تأیید</span>
            <input className={inputClass} value={approvalReference} onChange={(event) => setApprovalReference(event.target.value)} disabled={saving} />
          </label>
          <div className="md:col-span-2">
            <button type="button" className={`${buttonClass} bg-slate-900 text-white hover:bg-slate-800`} onClick={approve} disabled={saving}>
              <CheckCircle2 className="h-4 w-4" /> ثبت تأیید مالی
            </button>
          </div>
        </div>
      )}

      {workflow.status === 'approved' && (
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1 text-xs text-slate-700">
            <span className="font-semibold">تاریخ پرداخت شمسی</span>
            <input className={inputClass} placeholder="1405-01-31" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} disabled={saving} />
          </label>
          <label className="space-y-1 text-xs text-slate-700">
            <span className="font-semibold">شماره سند / مرجع پرداخت</span>
            <input className={inputClass} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} disabled={saving} />
          </label>
          <label className="space-y-1 text-xs text-slate-700">
            <span className="font-semibold">مبلغ پرداخت واقعی ({unit})</span>
            <input className={inputClass} type="number" min={0} step={1} value={paidAmount} onChange={(event) => setPaidAmount(event.target.value)} disabled={saving} />
          </label>
          <label className="space-y-1 text-xs text-slate-700">
            <span className="font-semibold">علت اختلاف مبلغ (در صورت مغایرت)</span>
            <input className={inputClass} value={paymentDifferenceReason} onChange={(event) => setPaymentDifferenceReason(event.target.value)} disabled={saving} />
          </label>
          <div className="md:col-span-2">
            <button type="button" className={`${buttonClass} bg-teal-700 text-white hover:bg-teal-800`} onClick={markPaid} disabled={saving}>
              <CheckCircle2 className="h-4 w-4" /> ثبت پرداخت واقعی
            </button>
          </div>
        </div>
      )}

      {workflow.status === 'paid' && (
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-700">
            تأییدکننده: {workflow.approverName} · مرجع تأیید: {workflow.approvalReference}<br />
            مرجع پرداخت: {workflow.paymentReference} · تاریخ پرداخت: {workflow.paymentDate}<br />
            مبلغ ثبت‌شده: {formatMoney(workflow.paidAmountRial ?? 0, unit)}
          </div>
          <label className="space-y-1 text-xs text-slate-700">
            <span className="font-semibold">شماره سند بستن دوره / مرجع بایگانی</span>
            <input className={inputClass} value={closeReference} onChange={(event) => setCloseReference(event.target.value)} disabled={saving} />
          </label>
          <div className="md:col-span-2">
            <button type="button" className={`${buttonClass} bg-slate-900 text-white hover:bg-slate-800`} onClick={closeRun} disabled={saving}>
              <LockKeyhole className="h-4 w-4" /> بستن و قفل دوره
            </button>
          </div>
        </div>
      )}

      {workflow.status === 'closed' && (
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-700">
          دوره در تاریخ {workflow.closedAt ? new Date(workflow.closedAt).toLocaleString('fa-IR') : 'ثبت‌شده'} بسته شده است. مرجع بایگانی: {workflow.closeReference}
        </p>
      )}

      {workflow.auditTrail.length > 0 && (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <h4 className="text-xs font-bold text-slate-700">تاریخچه گردش دوره</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {workflow.auditTrail.map((event) => (
              <span key={event.eventId} className="rounded-md bg-slate-50 px-2.5 py-1.5 text-[10px] text-slate-600">
                {event.eventType === 'calculated' ? 'محاسبه'
                  : event.eventType === 'approved' ? 'تأیید'
                  : event.eventType === 'paid' ? 'پرداخت'
                  : 'بستن دوره'}
                {' · '}{toPersianDigits(new Date(event.occurredAt).toLocaleDateString('fa-IR'))}
                {event.reference ? ` · ${event.reference}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {feedback && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-700">
          {feedback}
        </div>
      )}
    </section>
  );
}
