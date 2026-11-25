import { useEffect, useMemo, useState } from 'react';
import { listAnnualLeaveRecords, listEmployeeMasterRecords } from '../data/payrollLocalDatabase';
import { listMonthlyAttendance, saveMonthlyAttendance } from '../data/payrollLocalDatabase';
import type { EmployeeMasterRecord } from '../types/employee';
import type { MonthlyAttendanceRecord } from '../types/attendance';
import { useUnifiedPayroll } from '../state/UnifiedPayrollContext';
import { toPersianDigits } from '../utils/payrollEngine';

type Row = {
  workedDays: number; overtimeHours: number; nightShiftHours: number;
  holidayHours: number; variableBonusRial: number; annualWorkedDays: number;
  reviewedUnpaidLeaveDays: number | null; notes: string;
};

const emptyRow = (days: number): Row => ({
  workedDays: days, overtimeHours: 0, nightShiftHours: 0, holidayHours: 0,
  variableBonusRial: 0, annualWorkedDays: 365, reviewedUnpaidLeaveDays: null, notes: '',
});

export function AttendanceView() {
  const { state } = useUnifiedPayroll();
  const { year, monthDays, unit } = state;
  const [month, setMonth] = useState(1);
  const [employees, setEmployees] = useState<EmployeeMasterRecord[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [leaveUsage, setLeaveUsage] = useState<Record<string, { paid: number; unpaid: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([listEmployeeMasterRecords(), listMonthlyAttendance(year, month), listAnnualLeaveRecords(year)])
      .then(([masters, attendance, annualLeave]) => {
        if (!active) return;
        setEmployees(masters.filter(item => item.status === 'active'));
        const attendanceByEmployee = new Map(attendance.map(item => [item.employeeId, item]));
        const leaveByEmployee = new Map(annualLeave.filter(item => item.month === month).map(item => [item.employeeId, item]));
        const nextRows: Record<string, Row> = {};
        const nextSaved: Record<string, boolean> = {};
        masters.filter(item => item.status === 'active').forEach(employee => {
          const item = attendanceByEmployee.get(employee.employeeId);
          nextRows[employee.employeeId] = item ? {
            workedDays: item.workedDays, overtimeHours: item.overtimeHours,
            nightShiftHours: item.nightShiftHours, holidayHours: item.holidayHours,
            variableBonusRial: item.variableBonusRial, annualWorkedDays: item.annualWorkedDays,
            reviewedUnpaidLeaveDays: item.reviewedUnpaidLeaveDays ?? null,
            notes: item.notes,
          } : emptyRow(monthDays);
          nextSaved[employee.employeeId] = Boolean(item);
        });
        const nextLeaveUsage: Record<string, { paid: number; unpaid: number }> = {};
        masters.filter(item => item.status === 'active').forEach(employee => {
          const leave = leaveByEmployee.get(employee.employeeId);
          nextLeaveUsage[employee.employeeId] = {
            paid: leave?.paidLeaveUsedDays ?? 0,
            unpaid: leave?.unpaidLeaveUsedDays ?? 0,
          };
        });
        setRows(nextRows);
        setSaved(nextSaved);
        setLeaveUsage(nextLeaveUsage);
        setError('');
      })
      .catch(e => active && setError(e instanceof Error ? e.message : 'بارگذاری کارکرد ناموفق بود.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [year, month, monthDays]);

  const update = (id: string, patch: Partial<Row>) => {
    const safePatch = patch.workedDays !== undefined
      ? { ...patch, reviewedUnpaidLeaveDays: null }
      : patch;
    setRows(current => ({ ...current, [id]: { ...current[id], ...safePatch } }));
    setSaved(current => ({ ...current, [id]: false }));
  };
  const multiplier = unit === 'toman' ? 10 : 1;
  const formatMoneyInput = (value: number) => Math.round(value / multiplier);

  const save = async (employee: EmployeeMasterRecord) => {
    const row = rows[employee.employeeId];
    if (!row) return;
    setBusyId(employee.employeeId);
    setError('');
    try {
      await saveMonthlyAttendance({
        employeeId: employee.employeeId, personnelCode: employee.personnelCode,
        fiscalYear: year, month, monthDays, ...row,
        reviewedUnpaidLeaveDays: (leaveUsage[employee.employeeId]?.unpaid ?? 0) > 0 &&
          row.reviewedUnpaidLeaveDays === leaveUsage[employee.employeeId]?.unpaid
          ? row.reviewedUnpaidLeaveDays
          : undefined,
      });
      setSaved(current => ({ ...current, [employee.employeeId]: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره کارکرد ناموفق بود.');
    } finally {
      setBusyId('');
    }
  };

  const periodLabel = useMemo(() => `سال ${toPersianDigits(year)} · ماه ${toPersianDigits(month)}`, [year, month]);

  return <div className="space-y-5">
    <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
      <div>
        <div className="text-xs text-slate-500">Attendance Ledger · کارکرد ماهانه</div>
        <h1 className="mt-1 text-xl font-bold text-slate-900">ثبت کارکرد کارکنان</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">اطلاعات این صفحه برای هر کارمند و هر ماه ذخیره می‌شود و مقادیر آن هنگام محاسبه دوره حقوق خوانده می‌شوند. این دفتر جمع ماهانه است، نه ثبت تردد روزانه.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold">{periodLabel}</div>
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>ماه {toPersianDigits(m)}</option>)}
        </select>
        <span className="text-xs text-slate-500">{toPersianDigits(monthDays)} روز در ماه · مبالغ به {unit === 'toman' ? 'تومان' : 'ریال'}</span>
      </div>
    </section>
    {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
    {loading ? <div className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">در حال بارگذاری اطلاعات…</div> :
      employees.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">ابتدا در بخش «پرونده کارکنان» کارمند فعال ثبت کنید.</div> :
      <section className="space-y-3">
        {employees.map(employee => {
          const row = rows[employee.employeeId] ?? emptyRow(monthDays);
          return <article key={employee.employeeId} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><div className="font-semibold text-slate-900">{employee.firstName} {employee.lastName}</div><div className="text-xs text-slate-500">کد پرسنلی: {toPersianDigits(employee.personnelCode)}</div></div>
              <span className={saved[employee.employeeId] ? 'text-xs font-semibold text-teal-700' : 'text-xs text-amber-700'}>{saved[employee.employeeId] ? 'ذخیره شده' : 'تغییرات ذخیره نشده'}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {([
                ['workedDays','روزهای کارکرد',0,monthDays],
                ['overtimeHours','اضافه‌کاری (ساعت)',0,744],
                ['nightShiftHours','شب‌کاری (ساعت)',0,744],
                ['holidayHours','کار در تعطیل (ساعت)',0,744],
                ['variableBonusRial',`پاداش متغیر (${unit})`,0,100000000000],
                ['annualWorkedDays','کارکرد سالانه (روز)',0,366],
              ] as [keyof Row,string,number,number][]).map(([key,label,min,max]) => <label key={key} className="space-y-1 text-xs text-slate-600">
                <span>{label}</span>
                <input type="number" min={min} max={max} value={key === 'variableBonusRial' ? formatMoneyInput(row[key] as number) : row[key] as number}
                  onChange={e=>update(employee.employeeId,{[key]: key === 'variableBonusRial' ? Number(e.target.value)*multiplier : Number(e.target.value)} as Partial<Row>)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"/>
              </label>)}
            </div>
            {(leaveUsage[employee.employeeId]?.paid ?? 0) > 0 || (leaveUsage[employee.employeeId]?.unpaid ?? 0) > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2 text-xs leading-6 text-amber-900">
                <div>مرخصی ثبت‌شده این ماه: باحقوق {toPersianDigits(leaveUsage[employee.employeeId]?.paid ?? 0)} روز · بدون حقوق {toPersianDigits(leaveUsage[employee.employeeId]?.unpaid ?? 0)} روز</div>
                {(leaveUsage[employee.employeeId]?.unpaid ?? 0) > 0 && (
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" className="mt-1" checked={row.reviewedUnpaidLeaveDays === leaveUsage[employee.employeeId]?.unpaid}
                      onChange={e => update(employee.employeeId, { reviewedUnpaidLeaveDays: e.target.checked ? (leaveUsage[employee.employeeId]?.unpaid ?? 0) : null })} />
                    <span>تأیید می‌کنم روزهای کارکرد ثبت‌شده، اثر {toPersianDigits(leaveUsage[employee.employeeId]?.unpaid ?? 0)} روز مرخصی بدون حقوق را لحاظ کرده است. نرم‌افزار این مقدار را خودکار از حقوق کم نمی‌کند.</span>
                  </label>
                )}
              </div>
            ) : null}
            <label className="block space-y-1 text-xs text-slate-600"><span>توضیحات</span><input value={row.notes} onChange={e=>update(employee.employeeId,{notes:e.target.value})} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="توضیحات اختیاری"/></label>
            <div className="flex justify-end"><button type="button" disabled={busyId===employee.employeeId} onClick={()=>void save(employee)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyId===employee.employeeId?'در حال ذخیره…':'ذخیره کارکرد ماه'}</button></div>
          </article>;
        })}
      </section>}
  </div>;
}
