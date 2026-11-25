import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock3,
  FileText,
  Plus,
  Wallet,
} from 'lucide-react';
import {
  listEmployeeDebtAccounts,
  listDebtRepayments,
  listEmployeeOtherDeductions,
  listEmployeeMasterRecords,
  saveEmployeeDebtAccount,
  recordDebtRepayment,
  saveEmployeeOtherDeduction,
  updateEmployeeOtherDeductionReview,
} from '../data/payrollLocalDatabase';
import type {
  DebtPaymentMethod,
  DebtRepaymentPlan,
  EmployeeDebtAccount,
  EmployeeDebtRepayment,
  EmployeeOtherDeduction,
} from '../types/employeeDebt';
import { useUnifiedPayroll } from '../state/UnifiedPayrollContext';
import { formatMoney, toPersianDigits } from '../utils/payrollEngine';
import { calculateDebtScheduleSummary } from '../utils/employeeDebtLedger';
import type { EmployeeMasterRecord } from '../types/employee';

const emptyAccount = {
  employeeId: '',
  debtType: 'advance' as const,
  principal: '',
  issueDateJalali: '',
  purpose: '',
  repaymentPlan: 'fixed-installment' as DebtRepaymentPlan,
  monthlyInstallment: '',
  firstDueMonth: '1',
  installmentLimit: '',
  notes: '',
};

const emptyRepayment = {
  debtId: '',
  amount: '',
  repaymentDateJalali: '',
  paymentMethod: 'bank' as DebtPaymentMethod,
  reference: '',
  notes: '',
};

const emptyDeduction = {
  employeeId: '',
  title: '',
  amount: '',
  authorizationReference: '',
  notes: '',
};

export function EmployeeDebtLedgerView() {
  const { state } = useUnifiedPayroll();
  const { year, unit } = state;
  const multiplier = unit === 'toman' ? 10 : 1;

  const [month, setMonth] = useState(1);
  const [employees, setEmployees] = useState<EmployeeMasterRecord[]>([]);
  const [accounts, setAccounts] = useState<EmployeeDebtAccount[]>([]);
  const [repayments, setRepayments] = useState<EmployeeDebtRepayment[]>([]);
  const [deductions, setDeductions] = useState<EmployeeOtherDeduction[]>([]);
  const [accountDraft, setAccountDraft] = useState(emptyAccount);
  const [repaymentDraft, setRepaymentDraft] = useState(emptyRepayment);
  const [deductionDraft, setDeductionDraft] = useState(emptyDeduction);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [masters, debtAccounts, debtRepayments, otherDeductions] = await Promise.all([
        listEmployeeMasterRecords(),
        listEmployeeDebtAccounts(),
        listDebtRepayments(),
        listEmployeeOtherDeductions(year, month),
      ]);
      setEmployees(masters.filter(item => item.status === 'active'));
      setAccounts(debtAccounts);
      setRepayments(debtRepayments);
      setDeductions(otherDeductions);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'بارگذاری دفتر بدهی کارکنان ناموفق بود.');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const rial = (value: string) => Math.round(Number(value) * multiplier);
  const money = (value: number) => formatMoney(value, unit);
  const selectedEmployee = (employeeId: string) =>
    employees.find(item => item.employeeId === employeeId);

  const submitAccount = async () => {
    const employee = selectedEmployee(accountDraft.employeeId);
    if (!employee) {
      setError('ابتدا کارمند را انتخاب کنید.');
      return;
    }
    setBusy('account');
    setError('');
    setNotice('');
    try {
      await saveEmployeeDebtAccount({
        employeeId: employee.employeeId,
        personnelCode: employee.personnelCode,
        employeeName: employee.firstName + ' ' + employee.lastName,
        debtType: accountDraft.debtType,
        principalRial: rial(accountDraft.principal),
        issueDateJalali: accountDraft.issueDateJalali.trim(),
        purpose: accountDraft.purpose,
        repaymentPlan: accountDraft.repaymentPlan,
        monthlyInstallmentRial: accountDraft.repaymentPlan === 'fixed-installment'
          ? rial(accountDraft.monthlyInstallment)
          : null,
        firstDueFiscalYear: accountDraft.repaymentPlan === 'fixed-installment' ? year : null,
        firstDueMonth: accountDraft.repaymentPlan === 'fixed-installment'
          ? Number(accountDraft.firstDueMonth)
          : null,
        installmentLimit: accountDraft.repaymentPlan === 'fixed-installment' && accountDraft.installmentLimit.trim()
          ? Number(accountDraft.installmentLimit)
          : null,
        notes: accountDraft.notes,
      });
      setAccountDraft({ ...emptyAccount, employeeId: employee.employeeId });
      setNotice('حساب مساعده/وام ثبت شد. اقساط فقط برای پیگیری نمایش داده می‌شوند و هنوز به حقوق متصل نیستند.');
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت حساب بدهی ناموفق بود.');
    } finally {
      setBusy('');
    }
  };

  const submitRepayment = async () => {
    const account = accounts.find(item => item.debtId === repaymentDraft.debtId);
    if (!account) {
      setError('حساب بدهی را برای ثبت وصول انتخاب کنید.');
      return;
    }
    const date = repaymentDraft.repaymentDateJalali.trim();
    setBusy('repayment');
    setError('');
    setNotice('');
    try {
      await recordDebtRepayment({
        debtId: account.debtId,
        employeeId: account.employeeId,
        personnelCode: account.personnelCode,
        amountRial: rial(repaymentDraft.amount),
        fiscalYear: date.slice(0, 4),
        month: Number(date.slice(5, 7)),
        repaymentDateJalali: date,
        paymentMethod: repaymentDraft.paymentMethod,
        reference: repaymentDraft.reference,
        notes: repaymentDraft.notes,
      });
      setRepaymentDraft({ ...emptyRepayment, debtId: account.debtId });
      setNotice('وصول در گردش بدهی ثبت شد و از مانده حساب کسر شد.');
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت وصول ناموفق بود.');
    } finally {
      setBusy('');
    }
  };

  const submitOtherDeduction = async () => {
    const employee = selectedEmployee(deductionDraft.employeeId);
    if (!employee) {
      setError('برای ثبت کسور، کارمند را انتخاب کنید.');
      return;
    }
    setBusy('deduction');
    setError('');
    setNotice('');
    try {
      await saveEmployeeOtherDeduction({
        employeeId: employee.employeeId,
        personnelCode: employee.personnelCode,
        employeeName: employee.firstName + ' ' + employee.lastName,
        fiscalYear: year,
        month,
        title: deductionDraft.title,
        amountRial: rial(deductionDraft.amount),
        authorizationReference: deductionDraft.authorizationReference,
        reviewStatus: 'proposed',
        notes: deductionDraft.notes,
      });
      setDeductionDraft({ ...emptyDeduction, employeeId: employee.employeeId });
      setNotice('کسور توافقی به‌صورت پیشنهادی ثبت شد؛ هنوز در محاسبه یا فیش حقوق اعمال نمی‌شود.');
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت کسور پیشنهادی ناموفق بود.');
    } finally {
      setBusy('');
    }
  };

  const changeDeductionStatus = async (item: EmployeeOtherDeduction, status: 'reviewed' | 'cancelled') => {
    setBusy(item.deductionId);
    setError('');
    setNotice('');
    try {
      await updateEmployeeOtherDeductionReview(
        item.deductionId,
        status,
        item.authorizationReference
      );
      setNotice(status === 'reviewed'
        ? 'مستند کسور بررسی و وضعیت آن ثبت شد؛ این کار به معنی کسر از حقوق نیست.'
        : 'رکورد کسور لغو شد و از فهرست پیشنهادهای فعال خارج شد.');
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تغییر وضعیت کسور ناموفق بود.');
    } finally {
      setBusy('');
    }
  };

  const accountSummaries = useMemo(() => accounts.map(account => ({
    account,
    summary: calculateDebtScheduleSummary(
      account,
      repayments.filter(item => item.debtId === account.debtId),
      { fiscalYear: year, month }
    ),
  })), [accounts, repayments, year, month]);

  const activeDebtBalance = accountSummaries.reduce((sum, item) => sum + item.summary.outstandingRial, 0);
  const selectedDebt = accounts.find(item => item.debtId === repaymentDraft.debtId);
  const currentEmployeeOptions = employees.map(employee => (
    <option key={employee.employeeId} value={employee.employeeId}>
      {employee.personnelCode} — {employee.firstName} {employee.lastName}
    </option>
  ));

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500">Employee Debt Ledger · دفتر مساعده، وام و کسور</div>
            <h1 className="mt-1 text-xl font-bold text-slate-900">دفتر بدهی و مطالبات کارکنان</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              ثبت اصل بدهی، برنامه بازپرداخت، وصول اقساط و کسور توافقی با تاریخچه مستقل برای هر کارمند.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm">
            <span className="text-slate-500">دوره نمایش</span>
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="rounded-md border border-slate-200 bg-white px-2 py-1">
              {Array.from({ length: 12 }, (_, index) => index + 1).map(value =>
                <option key={value} value={value}>ماه {toPersianDigits(value)}</option>
              )}
            </select>
            <strong>سال {toPersianDigits(year)}</strong>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">تعداد حساب‌های بدهی</div>
            <div className="mt-1 text-xl font-bold tabular-nums">{toPersianDigits(accounts.length)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">مانده کل بدهی</div>
            <div className="mt-1 text-xl font-bold tabular-nums">{money(activeDebtBalance)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">وصول ثبت‌شده</div>
            <div className="mt-1 text-xl font-bold tabular-nums">
              {money(repayments.reduce((sum, item) => sum + item.amountRial, 0))}
            </div>
          </div>
        </div>
      </section>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-7 text-amber-950">
        <strong>مرز این دفتر:</strong> سررسیدها و مبالغ قابل بازپرداخت فقط برای پیگیری مالی نمایش داده می‌شوند. هیچ قسط یا کسور توافقی به‌صورت خودکار از خالص حقوق کم نمی‌شود و این دفتر به موتور محاسبه حقوق متصل نیست. هرگونه اتصال بعدی باید از مسیر مستند، بررسی و تأیید دوره حقوق انجام شود.
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      {notice && <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">{notice}</div>}
      {loading ? (
        <div className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">در حال بارگذاری دفتر بدهی…</div>
      ) : employees.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          ابتدا در بخش «پرونده کارکنان» کارمند فعال ثبت کنید.
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <Wallet className="h-5 w-5 text-slate-700" />
              <h2 className="text-lg font-bold">ثبت مساعده یا وام جدید</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="space-y-1 text-xs text-slate-600">
                <span>کارمند</span>
                <select value={accountDraft.employeeId} onChange={e => setAccountDraft(v => ({ ...v, employeeId: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option value="">انتخاب کارمند</option>{currentEmployeeOptions}
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>نوع پرداخت</span>
                <select value={accountDraft.debtType} onChange={e => setAccountDraft(v => ({ ...v, debtType: e.target.value as 'advance' | 'loan' }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option value="advance">مساعده</option><option value="loan">وام</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>مبلغ اصل بدهی ({unit})</span>
                <input type="number" min="1" step="1" value={accountDraft.principal} onChange={e => setAccountDraft(v => ({ ...v, principal: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>تاریخ پرداخت (شمسی)</span>
                <input placeholder="1405-09-01" value={accountDraft.issueDateJalali} onChange={e => setAccountDraft(v => ({ ...v, issueDateJalali: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1 text-xs text-slate-600 md:col-span-2">
                <span>موضوع یا علت پرداخت</span>
                <input value={accountDraft.purpose} onChange={e => setAccountDraft(v => ({ ...v, purpose: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>روش بازپرداخت</span>
                <select value={accountDraft.repaymentPlan} onChange={e => setAccountDraft(v => ({ ...v, repaymentPlan: e.target.value as DebtRepaymentPlan }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option value="fixed-installment">اقساط ثابت ماهانه</option><option value="manual">بازپرداخت دستی</option>
                </select>
              </label>
              {accountDraft.repaymentPlan === 'fixed-installment' && (
                <>
                  <label className="space-y-1 text-xs text-slate-600">
                    <span>مبلغ هر قسط ({unit})</span>
                    <input type="number" min="1" step="1" value={accountDraft.monthlyInstallment} onChange={e => setAccountDraft(v => ({ ...v, monthlyInstallment: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums" />
                  </label>
                  <label className="space-y-1 text-xs text-slate-600">
                    <span>ماه اولین سررسید</span>
                    <select value={accountDraft.firstDueMonth} onChange={e => setAccountDraft(v => ({ ...v, firstDueMonth: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                      {Array.from({ length: 12 }, (_, index) => index + 1).map(value => <option key={value} value={value}>{toPersianDigits(value)}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs text-slate-600">
                    <span>تعداد اقساط (اختیاری)</span>
                    <input type="number" min="1" step="1" value={accountDraft.installmentLimit} onChange={e => setAccountDraft(v => ({ ...v, installmentLimit: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums" placeholder="بدون محدودیت" />
                  </label>
                </>
              )}
              <label className="space-y-1 text-xs text-slate-600 md:col-span-3">
                <span>یادداشت / شماره سند پرداخت</span>
                <input value={accountDraft.notes} onChange={e => setAccountDraft(v => ({ ...v, notes: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">در این مرحله نرخ سود یا بهره تعریف نشده است؛ مبلغ بدهی همان اصل پرداخت‌شده است.</p>
              <button type="button" disabled={busy !== ''} onClick={() => void submitAccount()} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                <Plus className="h-4 w-4" />ثبت حساب بدهی
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <Banknote className="h-5 w-5 text-slate-700" />
              <h2 className="text-lg font-bold">حساب‌های بدهی و وضعیت اقساط</h2>
            </div>
            {accountSummaries.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">هنوز حساب مساعده یا وامی ثبت نشده است.</div>
            ) : accountSummaries.map(({ account, summary }) => (
              <article key={account.debtId} className="space-y-3 rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-900">{account.employeeName} · {account.debtType === 'advance' ? 'مساعده' : 'وام'}</div>
                    <div className="mt-1 text-xs text-slate-500">{account.purpose} · تاریخ پرداخت {account.issueDateJalali}</div>
                  </div>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs">{account.repaymentPlan === 'fixed-installment' ? 'اقساط ثابت' : 'بازپرداخت دستی'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-md bg-slate-50 p-2"><div className="text-xs text-slate-500">اصل بدهی</div><div className="mt-1 text-sm font-semibold">{money(account.principalRial)}</div></div>
                  <div className="rounded-md bg-slate-50 p-2"><div className="text-xs text-slate-500">وصول‌شده</div><div className="mt-1 text-sm font-semibold">{money(summary.paidToDateRial)}</div></div>
                  <div className="rounded-md bg-slate-50 p-2"><div className="text-xs text-slate-500">مانده</div><div className="mt-1 text-sm font-semibold">{money(summary.outstandingRial)}</div></div>
                  <div className="rounded-md bg-amber-50 p-2"><div className="text-xs text-amber-800">سررسید این دوره و معوق</div><div className="mt-1 text-sm font-semibold text-amber-950">{money(summary.totalDueRial)}</div></div>
                </div>
                {account.repaymentPlan === 'fixed-installment' && (
                  <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                    <span>قسط جاری: {money(summary.currentInstallmentRial)}</span>
                    <span>معوق: {money(summary.overdueRial)}</span>
                    {summary.installmentNumber !== null && <span>شماره قسط: {toPersianDigits(summary.installmentNumber)}</span>}
                    {summary.installmentsRemaining !== null && <span>باقی‌مانده اقساط طبق برنامه: {toPersianDigits(summary.installmentsRemaining)}</span>}
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <span className="text-xs text-slate-500">سررسید فقط بر اساس برنامه ثبت‌شده محاسبه می‌شود.</span>
                  <button type="button" onClick={() => setRepaymentDraft(v => ({ ...v, debtId: account.debtId }))} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">
                    <ArrowDownLeft className="h-3.5 w-3.5" />ثبت وصول
                  </button>
                </div>
              </article>
            ))}
          </section>

          {repaymentDraft.debtId && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <h2 className="text-lg font-bold">ثبت وصول / بازپرداخت</h2>
                <button type="button" onClick={() => setRepaymentDraft(emptyRepayment)} className="text-xs text-slate-500 hover:text-slate-900">بستن</button>
              </div>
              {selectedDebt && <div className="text-sm text-slate-600">{selectedDebt.employeeName} · {selectedDebt.purpose}</div>}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="space-y-1 text-xs text-slate-600"><span>مبلغ وصول ({unit})</span><input type="number" min="1" step="1" value={repaymentDraft.amount} onChange={e => setRepaymentDraft(v => ({ ...v, amount: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums" /></label>
                <label className="space-y-1 text-xs text-slate-600"><span>تاریخ وصول (شمسی)</span><input placeholder="1405-09-05" value={repaymentDraft.repaymentDateJalali} onChange={e => setRepaymentDraft(v => ({ ...v, repaymentDateJalali: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
                <label className="space-y-1 text-xs text-slate-600"><span>روش وصول</span><select value={repaymentDraft.paymentMethod} onChange={e => setRepaymentDraft(v => ({ ...v, paymentMethod: e.target.value as DebtPaymentMethod }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="bank">بانکی</option><option value="cash">نقدی</option><option value="other">سایر</option></select></label>
                <label className="space-y-1 text-xs text-slate-600 md:col-span-3"><span>شماره پیگیری / مرجع</span><input value={repaymentDraft.reference} onChange={e => setRepaymentDraft(v => ({ ...v, reference: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
                <label className="space-y-1 text-xs text-slate-600 md:col-span-3"><span>توضیحات</span><input value={repaymentDraft.notes} onChange={e => setRepaymentDraft(v => ({ ...v, notes: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
              </div>
              <button type="button" disabled={busy !== ''} onClick={() => void submitRepayment()} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                <ArrowDownLeft className="h-4 w-4" />ثبت وصول
              </button>
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <FileText className="h-5 w-5 text-slate-700" />
              <h2 className="text-lg font-bold">ثبت کسور توافقی / سایر مطالبات</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="space-y-1 text-xs text-slate-600"><span>کارمند</span><select value={deductionDraft.employeeId} onChange={e => setDeductionDraft(v => ({ ...v, employeeId: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">انتخاب کارمند</option>{currentEmployeeOptions}</select></label>
              <label className="space-y-1 text-xs text-slate-600"><span>عنوان کسور</span><input value={deductionDraft.title} onChange={e => setDeductionDraft(v => ({ ...v, title: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
              <label className="space-y-1 text-xs text-slate-600"><span>مبلغ ({unit})</span><input type="number" min="1" step="1" value={deductionDraft.amount} onChange={e => setDeductionDraft(v => ({ ...v, amount: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums" /></label>
              <label className="space-y-1 text-xs text-slate-600 md:col-span-3"><span>مرجع توافق / مجوز / مستند</span><input value={deductionDraft.authorizationReference} onChange={e => setDeductionDraft(v => ({ ...v, authorizationReference: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
              <label className="space-y-1 text-xs text-slate-600 md:col-span-3"><span>توضیحات</span><input value={deductionDraft.notes} onChange={e => setDeductionDraft(v => ({ ...v, notes: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">هر مورد ابتدا پیشنهادی است؛ بررسی مستند به معنی اجازه کسر خودکار از مزد نیست.</p>
              <button type="button" disabled={busy !== ''} onClick={() => void submitOtherDeduction()} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                <Plus className="h-4 w-4" />ثبت کسور پیشنهادی
              </button>
            </div>
            <div className="divide-y divide-slate-200">
              {deductions.length === 0 ? <p className="py-4 text-sm text-slate-500">برای این دوره کسور دیگری ثبت نشده است.</p> : deductions.map(item => (
                <div key={item.deductionId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold">{item.employeeName} · {item.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{money(item.amountRial)} · مرجع: {item.authorizationReference || 'ثبت نشده'}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={'rounded-md px-2 py-1 text-xs ' + (item.reviewStatus === 'reviewed' ? 'bg-teal-50 text-teal-800' : item.reviewStatus === 'cancelled' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-800')}>
                      {item.reviewStatus === 'reviewed' ? 'بررسی‌شده' : item.reviewStatus === 'cancelled' ? 'لغوشده' : 'پیشنهادی'}
                    </span>
                    {item.reviewStatus === 'proposed' && (
                      <>
                        <button type="button" disabled={busy !== ''} onClick={() => void changeDeductionStatus(item, 'reviewed')} className="inline-flex items-center gap-1 rounded-md border border-teal-300 px-2.5 py-1.5 text-xs text-teal-800 disabled:opacity-40"><CheckCircle2 className="h-3.5 w-3.5" />تأیید مستند</button>
                        <button type="button" disabled={busy !== ''} onClick={() => void changeDeductionStatus(item, 'cancelled')} className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-600 disabled:opacity-40">لغو</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
            <div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-slate-700" /><h2 className="text-lg font-bold">تاریخچه وصول‌ها</h2></div>
            {repayments.length === 0 ? <p className="text-sm text-slate-500">هنوز وصولی ثبت نشده است.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-sm text-right">
                  <thead className="bg-slate-100 text-slate-600"><tr><th className="p-3">تاریخ</th><th className="p-3">کارمند</th><th className="p-3">مبلغ</th><th className="p-3">روش</th><th className="p-3">مرجع</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{repayments.map(item => (
                    <tr key={item.repaymentId}><td className="p-3 tabular-nums">{item.repaymentDateJalali}</td><td className="p-3">{item.personnelCode}</td><td className="p-3 tabular-nums">{money(item.amountRial)}</td><td className="p-3">{item.paymentMethod === 'bank' ? 'بانکی' : item.paymentMethod === 'cash' ? 'نقدی' : 'سایر'}</td><td className="p-3">{item.reference || '—'}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
