import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { formatMoney, toPersianDigits } from '../utils/payrollEngine';
import {
  listSavedPayrollRuns,
  loadSavedPayrollRun,
} from '../data/payrollLocalDatabase';
import type { StoredPayrollRun } from '../data/payrollLocalDatabase';
import { downloadPayrollRunExcelWorkbook } from '../utils/excelWorkbookBuilder';
import { useUnifiedPayroll } from '../state/UnifiedPayrollContext';
import { PayrollSettlementPanel } from './PayrollSettlementPanel';
import { PayrollRunApprovalPanel } from './PayrollRunApprovalPanel';

interface PayrollReportsViewProps {
  onNavigateToPayroll: () => void;
}

export function PayrollReportsView({ onNavigateToPayroll }: PayrollReportsViewProps) {
  const { state } = useUnifiedPayroll();
  const [runs, setRuns] = useState<StoredPayrollRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<StoredPayrollRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openingRunId, setOpeningRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const format = (value: number) => formatMoney(value, state.unit);

  const refresh = async (selectLatest = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const savedRuns = await listSavedPayrollRuns(100);
      setRuns(savedRuns);

      const runIdToOpen = selectLatest
        ? savedRuns[0]?.runId
        : selectedRun?.runId ?? savedRuns[0]?.runId;

      if (!runIdToOpen) {
        setSelectedRun(null);
        return;
      }

      setOpeningRunId(runIdToOpen);
      const snapshot = await loadSavedPayrollRun(runIdToOpen);
      setSelectedRun(snapshot ?? null);
      if (!snapshot) {
        setError('Snapshot انتخاب‌شده در پایگاه داده محلی پیدا نشد.');
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'بازیابی گزارش‌های ذخیره‌شده ناموفق بود.');
    } finally {
      setOpeningRunId(null);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadInitial = async () => {
      setIsLoading(true);
      try {
        const savedRuns = await listSavedPayrollRuns(100);
        if (!active) return;
        setRuns(savedRuns);
        if (savedRuns[0]) {
          setOpeningRunId(savedRuns[0].runId);
          const snapshot = await loadSavedPayrollRun(savedRuns[0].runId);
          if (active) setSelectedRun(snapshot ?? null);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'بازیابی گزارش‌های ذخیره‌شده ناموفق بود.');
        }
      } finally {
        if (active) {
          setOpeningRunId(null);
          setIsLoading(false);
        }
      }
    };
    void loadInitial();
    return () => { active = false; };
  }, []);

  const openRun = async (runId: string) => {
    setOpeningRunId(runId);
    setError(null);
    try {
      const snapshot = await loadSavedPayrollRun(runId);
      if (!snapshot) {
        setError('Snapshot این دوره پیدا نشد.');
        return;
      }
      setSelectedRun(snapshot);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'بازکردن گزارش دوره ناموفق بود.');
    } finally {
      setOpeningRunId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs text-slate-500">Reports & Exports</div>
            <h1 className="mt-1 text-xl font-bold text-slate-900">گزارش حقوق و هزینه کارفرما</h1>
            <p className="mt-1 text-sm text-slate-600">
              گزارش‌ها از Snapshot دوره‌های ذخیره‌شده خوانده می‌شوند؛ تغییرات بعدی اطلاعات کارکنان، نتیجه دوره‌های قبلی را عوض نمی‌کند.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh(true)}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            بروزرسانی گزارش‌ها
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          در حال بازیابی گزارش‌های ذخیره‌شده…
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <FileSpreadsheet className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-3 font-bold text-slate-800">هنوز گزارشی ذخیره نشده است</h2>
          <p className="mt-2 text-sm text-slate-600">
            ابتدا محاسبه یک دوره حقوق را در بخش حقوق ماهانه انجام بده و ذخیره کن.
          </p>
          <button
            type="button"
            onClick={onNavigateToPayroll}
            className="mt-5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            رفتن به حقوق ماهانه
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-bold text-slate-900">دوره‌های ذخیره‌شده</h2>
            <p className="mt-1 text-xs text-slate-500">{toPersianDigits(runs.length)} دوره اخیر</p>
            <div className="mt-3 divide-y divide-slate-200">
              {runs.map((run) => (
                <button
                  key={run.runId}
                  type="button"
                  onClick={() => void openRun(run.runId)}
                  disabled={openingRunId !== null}
                  className={`w-full rounded-lg px-3 py-3 text-right transition-colors hover:bg-slate-50 disabled:opacity-60 ${selectedRun?.runId === run.runId ? 'bg-slate-100' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {toPersianDigits(run.fiscalYear)} · ماه {toPersianDigits(run.month)}
                    </span>
                    {openingRunId === run.runId && (
                      <span className="text-xs text-slate-500">در حال بارگذاری…</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {toPersianDigits(run.totals.calculatedCount)} نفر · خالص {format(run.totals.netPayRial)}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {new Date(run.savedAt).toLocaleString('fa-IR')}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            {!selectedRun ? (
              <div className="py-10 text-center text-sm text-slate-500">یک دوره را برای مشاهده گزارش انتخاب کن.</div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      گزارش حقوق {toPersianDigits(selectedRun.fiscalYear)} · ماه {toPersianDigits(selectedRun.month)}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedRun.runId} · ذخیره‌شده در {new Date(selectedRun.savedAt).toLocaleString('fa-IR')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void downloadPayrollRunExcelWorkbook(selectedRun)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
                  >
                    <Download className="h-4 w-4" />
                    خروجی Excel
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                  {[
                    ['جمع ناخالص', selectedRun.totals.grossEarningsRial],
                    ['جمع کسورات', selectedRun.totals.totalDeductionsRial],
                    ['خالص پرداختی', selectedRun.totals.netPayRial],
                    ['بیمه سهم کارفرما', selectedRun.totals.employerInsuranceRial],
                    ['هزینه مستقیم کارفرما', selectedRun.totals.directEmployerCostRial],
                    ['ذخایر ماهانه', selectedRun.totals.monthlyReservesRial],
                    ['CTC ماهانه', selectedRun.totals.ctcMonthlyRial],
                    ['CTC سالانه‌شده', selectedRun.totals.ctcAnnualRial],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">{label}</div>
                      <div className="mt-1 text-base font-bold tabular-nums text-slate-900">{format(Number(value))}</div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
                  <span>کل کارکنان: {toPersianDigits(selectedRun.totals.employeeCount)}</span>
                  <span>محاسبه‌شده: {toPersianDigits(selectedRun.totals.calculatedCount)}</span>
                  <span>نیازمند اصلاح: {toPersianDigits(selectedRun.totals.blockedCount)}</span>
                  <span>خارج از دوره: {toPersianDigits(selectedRun.totals.excludedCount)}</span>
                  <span className={selectedRun.status === 'ready-for-review' ? 'font-semibold text-teal-700' : 'font-semibold text-rose-700'}>
                    {selectedRun.status === 'ready-for-review' ? 'آماده بررسی' : 'دارای خطای اعتبارسنجی'}
                  </span>
                </div>

                {selectedRun.lines.some((line) => line.issues.length > 0) && (
                  <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <h3 className="text-sm font-semibold text-amber-900">موارد نیازمند اصلاح ورودی</h3>
                    {selectedRun.lines.filter((line) => line.issues.length > 0).map((line) => (
                      <p key={line.employeeId} className="text-xs leading-6 text-amber-900">
                        <strong>{line.personnelCode} · {line.fullName}:</strong>{' '}
                        {line.issues.map((issue) => issue.message).join('؛ ')}
                      </p>
                    ))}
                  </div>
                )}

                {selectedRun.lines.some((line) => (line.result?.legalReviewRequiredItems.length ?? 0) > 0) && (
                  <div className="space-y-2 rounded-lg border border-orange-200 bg-orange-50 p-4">
                    <h3 className="text-sm font-semibold text-orange-900">هشدارهای قواعد نیازمند بررسی حقوقی</h3>
                    {selectedRun.lines.filter((line) => (line.result?.legalReviewRequiredItems.length ?? 0) > 0).map((line) => (
                      <p key={line.employeeId} className="text-xs leading-6 text-orange-900">
                        <strong>{line.personnelCode} · {line.fullName}:</strong>{' '}
                        {line.result?.legalReviewRequiredItems.join('؛ ')}
                      </p>
                    ))}
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-right text-sm">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="p-3">کد پرسنلی</th>
                        <th className="p-3">نام کارمند</th>
                        <th className="p-3">ناخالص</th>
                        <th className="p-3">بیمه کارگر</th>
                        <th className="p-3">مالیات</th>
                        <th className="p-3">خالص دریافتی</th>
                        <th className="p-3">بیمه کارفرما</th>
                        <th className="p-3">CTC ماهانه</th>
                        <th className="p-3">وضعیت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedRun.lines.map((line) => (
                        <tr key={line.employeeId}>
                          <td className="p-3 tabular-nums">{line.personnelCode}</td>
                          <td className="p-3">{line.fullName}</td>
                          <td className="p-3 tabular-nums">{line.result ? format(line.result.grossEarningsRial) : '—'}</td>
                          <td className="p-3 tabular-nums">{line.result ? format(line.result.employeeInsuranceRial) : '—'}</td>
                          <td className="p-3 tabular-nums">{line.result ? format(line.result.totalPayrollTaxRial) : '—'}</td>
                          <td className="p-3 tabular-nums font-semibold">{line.result ? format(line.result.netPayRial) : '—'}</td>
                          <td className="p-3 tabular-nums">{line.result ? format(line.result.totalEmployerInsuranceRial) : '—'}</td>
                          <td className="p-3 tabular-nums">{line.result ? format(line.result.ctcMonthlyRial) : '—'}</td>
                          <td className="p-3">
                            {line.status === 'calculated' ? 'محاسبه‌شده' : line.status === 'blocked' ? 'نیازمند اصلاح' : 'خارج از دوره'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
      {selectedRun && !isLoading && (
        <>
          <PayrollRunApprovalPanel
            run={selectedRun}
            unit={state.unit}
            onUpdated={(updated) => {
              setSelectedRun(updated);
              setRuns((current) => current.map((item) =>
                item.runId === updated.runId ? updated : item
              ));
            }}
          />
          <PayrollSettlementPanel run={selectedRun} unit={state.unit} />
        </>
      )}
    </div>
  );
}
