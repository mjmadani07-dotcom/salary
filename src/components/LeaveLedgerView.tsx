import { useEffect, useMemo, useState } from 'react';
import { listAnnualLeaveRecords, listEmployeeMasterRecords, saveMonthlyLeave } from '../data/payrollLocalDatabase';
import type { EmployeeMasterRecord } from '../types/employee';
import type { MonthlyLeaveDraft, MonthlyLeaveRecord } from '../types/leave';
import { useUnifiedPayroll } from '../state/UnifiedPayrollContext';
import { calculateLeaveClosingBalance, getSuggestedLeaveOpeningBalance } from '../utils/leaveLedger';
import { toPersianDigits } from '../utils/payrollEngine';

type Row = Omit<MonthlyLeaveDraft, 'employeeId' | 'personnelCode' | 'fiscalYear' | 'month'>;

const emptyRow = (openingBalanceDays: number): Row => ({
  openingBalanceDays, accruedDays: 0, paidLeaveUsedDays: 0,
  unpaidLeaveUsedDays: 0, adjustmentDays: 0, notes: '',
});

export function LeaveLedgerView() {
  const { state } = useUnifiedPayroll();
  const { year } = state;
  const [month, setMonth] = useState(1);
  const [employees, setEmployees] = useState<EmployeeMasterRecord[]>([]);
  const [records, setRecords] = useState<MonthlyLeaveRecord[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([listEmployeeMasterRecords(), listAnnualLeaveRecords(year)])
      .then(([masters, ledger]) => {
        if (!active) return;
        const activeEmployees = masters.filter(item => item.status === 'active');
        setEmployees(activeEmployees);
        setRecords(ledger);
        const nextRows: Record<string, Row> = {};
        const nextSaved: Record<string, boolean> = {};
        activeEmployees.forEach(employee => {
          const item = ledger.find(record => record.employeeId === employee.employeeId && record.month === month);
          const previous = ledger.filter(record => record.employeeId === employee.employeeId && record.month < month);
          const opening = item?.openingBalanceDays ?? getSuggestedLeaveOpeningBalance(previous, month, 0);
          nextRows[employee.employeeId] = item ? {
            openingBalanceDays: item.openingBalanceDays, accruedDays: item.accruedDays,
            paidLeaveUsedDays: item.paidLeaveUsedDays, unpaidLeaveUsedDays: item.unpaidLeaveUsedDays,
            adjustmentDays: item.adjustmentDays, notes: item.notes,
          } : emptyRow(opening);
          nextSaved[employee.employeeId] = Boolean(item);
        });
        setRows(nextRows);
        setSaved(nextSaved);
        setError('');
      })
      .catch(e => active && setError(e instanceof Error ? e.message : 'بارگذاری دفتر مرخصی ناموفق بود.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [year, month]);

  const update = (id: string, patch: Partial<Row>) => {
    setRows(current => ({ ...current, [id]: { ...current[id], ...patch } }));
    setSaved(current => ({ ...current, [id]: false }));
  };

  const save = async (employee: EmployeeMasterRecord) => {
    const row = rows[employee.employeeId];
    if (!row) return;
    setBusyId(employee.employeeId);
    setError('');
    try {
      const draft: MonthlyLeaveDraft = {
        employeeId: employee.employeeId, personnelCode: employee.personnelCode,
        fiscalYear: year, month, ...row,
      };
      await saveMonthlyLeave(draft);

      // Recalculate later months so a correction to an earlier month cannot leave stale carry-forward balances.
      const annual = await listAnnualLeaveRecords(year, employee.employeeId);
      const later = annual.filter(item => item.month > month).sort((a, b) => a.month - b.month);
      let balance = calculateLeaveClosingBalance(draft);
      for (const item of later) {
        const updated: MonthlyLeaveDraft = {
          employeeId: item.employeeId, personnelCode: item.personnelCode,
          fiscalYear: item.fiscalYear, month: item.month,
          openingBalanceDays: balance, accruedDays: item.accruedDays,
          paidLeaveUsedDays: item.paidLeaveUsedDays, unpaidLeaveUsedDays: item.unpaidLeaveUsedDays,
          adjustmentDays: item.adjustmentDays, notes: item.notes,
        };
        const savedLater = await saveMonthlyLeave(updated);
        balance = savedLater.closingBalanceDays;
      }
      const refreshed = await listAnnualLeaveRecords(year);
      setRecords(current => [
        ...current.filter(item => item.employeeId !== employee.employeeId),
        ...refreshed.filter(item => item.employeeId === employee.employeeId),
      ]);
      setSaved(current => ({ ...current, [employee.employeeId]: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره دفتر مرخصی ناموفق بود.');
    } finally {
      setBusyId('');
    }
  };

  const periodLabel = useMemo(() => `سال ${toPersianDigits(year)} · ماه ${toPersianDigits(month)}`, [year, month]);

  return <div className="space-y-5">
    <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
      <div>
        <div className="text-xs text-slate-500">Leave Ledger · گردش مرخصی</div>
        <h1 className="mt-1 text-xl font-bold text-slate-900">دفتر مرخصی کارکنان</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">استحقاق ماهانه را مطابق مبنای تأییدشده شرکت وارد کنید. مانده پایان ماه به‌صورت خودکار محاسبه و به ماه‌های بعد منتقل می‌شود.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold">{periodLabel}</div>
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>ماه {toPersianDigits(m)}</option>)}
        </select>
        <span className="text-xs text-slate-500">مقادیر برحسب روز؛ امکان ثبت اعشار تا دو رقم</span>
      </div>
    </section>
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
      برای اولین ماه ثبت‌شده هر کارمند، مانده ابتدای دوره را از سوابق تأییدشده وارد کنید. استحقاق ماهانه فعلاً دستی ثبت می‌شود و نرم‌افزار نرخ قانونی یا قراردادی را بدون تأیید شما اعمال نمی‌کند.
    </div>
    {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
    {loading ? <div className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">در حال بارگذاری اطلاعات…</div> :
      employees.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">ابتدا در بخش «پرونده کارکنان» کارمند فعال ثبت کنید.</div> :
      <section className="space-y-3">
        {employees.map(employee => {
          const row = rows[employee.employeeId] ?? emptyRow(0);
          const prior = records.some(item => item.employeeId === employee.employeeId && item.month < month);
          const closing = calculateLeaveClosingBalance(row);
          const fields: Array<[keyof Row,string,number,number,number]> = [
            ['openingBalanceDays','مانده ابتدای ماه',0,9999,0.01],
            ['accruedDays','استحقاق این ماه',0,31,0.01],
            ['paidLeaveUsedDays','مرخصی باحقوق استفاده‌شده',0,31,0.01],
            ['unpaidLeaveUsedDays','مرخصی بدون حقوق',0,31,0.01],
            ['adjustmentDays','تعدیلات (+ / −)',-9999,9999,0.01],
          ];
          return <article key={employee.employeeId} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><div className="font-semibold text-slate-900">{employee.firstName} {employee.lastName}</div><div className="text-xs text-slate-500">کد پرسنلی: {toPersianDigits(employee.personnelCode)}</div></div>
              <span className={saved[employee.employeeId] ? 'text-xs font-semibold text-teal-700' : 'text-xs text-amber-700'}>{saved[employee.employeeId] ? 'ذخیره شده' : 'تغییرات ذخیره نشده'}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {fields.map(([key,label,min,max,step]) => <label key={key} className="space-y-1 text-xs text-slate-600">
                <span>{label}{key === 'openingBalanceDays' && prior ? ' · انتقال خودکار' : ''}</span>
                <input type="number" min={min} max={max} step={step} value={row[key] as number}
                  readOnly={key === 'openingBalanceDays' && prior}
                  onChange={e=>update(employee.employeeId,{[key]:Number(e.target.value)} as Partial<Row>)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums read-only:bg-slate-50"/>
              </label>)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">مانده پایان ماه</div><div className={closing < 0 ? 'mt-1 text-lg font-bold text-rose-700' : 'mt-1 text-lg font-bold text-slate-900'}>{toPersianDigits(closing.toFixed(2))} روز</div></div>
              <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">تعداد ماه‌های ثبت‌شده</div><div className="mt-1 text-lg font-bold text-slate-900">{toPersianDigits(records.filter(item=>item.employeeId===employee.employeeId).length)}</div></div>
            </div>
            <label className="block space-y-1 text-xs text-slate-600"><span>توضیحات</span><input value={row.notes} onChange={e=>update(employee.employeeId,{notes:e.target.value})} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="توضیحات یا مرجع تعدیل اختیاری"/></label>
            <div className="flex justify-end"><button type="button" disabled={busyId===employee.employeeId} onClick={()=>void save(employee)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyId===employee.employeeId?'در حال ذخیره…':'ذخیره گردش مرخصی'}</button></div>
          </article>;
        })}
      </section>}
  </div>;
}
