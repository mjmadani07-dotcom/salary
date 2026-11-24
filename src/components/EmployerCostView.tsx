import { useState } from 'react';
import { Check, Copy, FileSpreadsheet } from 'lucide-react';
import { YEAR_REGULATIONS } from '../data/payrollRegulations';
import {
  formatMoney,
  formatPercentFa,
  toPersianDigits,
} from '../utils/payrollEngine';
import { downloadPayrollExcelWorkbook } from '../utils/excelWorkbookBuilder';
import { useUnifiedPayroll } from '../state/UnifiedPayrollContext';

export function EmployerCostView() {
  const { state, computed, updateState, setTargetNetPayRial } =
    useUnifiedPayroll();
  const year = state.year;
  const unit = state.unit;
  const reg = YEAR_REGULATIONS[year];
  const multiplierToRial = unit === 'toman' ? 10 : 1;
  const unitLabel = unit === 'toman' ? 'تومان' : 'ریال';

  const [inputMode, setInputMode] = useState<'base' | 'target-net'>('base');
  const [targetNetDraft, setTargetNetDraft] = useState<number>(
    Math.round(computed.payrollResult.netPayRial / multiplierToRial)
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const result = computed.payrollResult;
  const input = computed.payrollInput;
  const totalReservesAndEos =
    computed.totalStatutoryReservesRial + computed.totalEosReservesRial;
  const effectiveCtcMonthly = computed.totalCtcMonthlyRial;
  const effectiveCtcAnnual = computed.totalCtcAnnualRial;
  const effectiveOverheadAboveNet = effectiveCtcMonthly - result.netPayRial;

  const pctNet =
    effectiveCtcMonthly > 0
      ? (result.netPayRial / effectiveCtcMonthly) * 100
      : 0;
  const pctDeductions =
    effectiveCtcMonthly > 0
      ? (result.totalDeductionsRial / effectiveCtcMonthly) * 100
      : 0;
  const pctEmployerIns =
    effectiveCtcMonthly > 0
      ? (result.totalEmployerInsuranceRial / effectiveCtcMonthly) * 100
      : 0;
  const pctReserves =
    effectiveCtcMonthly > 0
      ? (totalReservesAndEos / effectiveCtcMonthly) * 100
      : 0;

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
    } catch {
      // Ignore
    }
  };

  const ctcExcelFormula =
    '=Gross_Salary + (0.23 * MIN(Insurable_Gross, 7*Min_Daily*30)) + (MIN(2*Base_30, 3*Min_Monthly_30)/12) + ((Base_30+Seniority_30)/12) + ((Base_30/30)*2.1667) + EOS_Monthly_Reserves';

  const presetsToman = [
    { label: 'حداقل قانون کار', mode: 'min' as const, rial: reg.minMonthlyWage30Rial },
    { label: '۳۰ میلیون تومان پایه', mode: 'custom' as const, rial: 300_000_000 },
    { label: '۵۰ میلیون تومان پایه', mode: 'custom' as const, rial: 500_000_000 },
    { label: '۸۰ میلیون تومان پایه', mode: 'custom' as const, rial: 800_000_000 },
    { label: '۱۲۰ میلیون تومان پایه', mode: 'custom' as const, rial: 1_200_000_000 },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="border border-slate-200 bg-white rounded-xl p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
              <span>تحلیل هزینه تمام‌شده نیروی انسانی (Cost to Company / CTC)</span>
              <span aria-hidden="true">·</span>
              <span>متصل به فیش حقوقی و بسته EOS ({state.employeeName})</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">
              یک کارمند چقدر به صورت واقعی برای کارفرما هزینه دارد؟
            </h1>
            <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
              تمامی تغییرات حقوق پایه، مزایا، اضافه‌کاری، ذخیره مرخصی و پاداش‌های EOS به‌صورت لحظه‌ای بین این صفحه، فیش حقوقی و خروجی اکسل همگام هستند.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              void downloadPayrollExcelWorkbook(year, input, {
                seatName: state.employeeName || 'پرسنل تنظیم‌شده شما',
                isGwcQualified: computed.isGwcQualified,
                seatMonthlyBaseRial: input.dailyBaseWageRial * 30,
                scorecardBudgetRial: state.scorecardBudgetRial,
                scorecardAchievementPct: state.scorecardAchievementPct,
                quarterlyRockBudgetRial: state.quarterlyRockBudgetRial,
                companyRocksPct: state.companyRocksPct,
                individualRocksPct: state.individualRocksPct,
                annualProfitShareRial: state.annualProfitShareRial,
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>خروجی اکسل CTC (.xlsx)</span>
          </button>
        </div>

        {/* 4-column CTC KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5 border-t border-slate-200">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">خالص دریافتی کارمند (ماهانه)</div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">
              {formatMoney(result.netPayRial, unit)}
            </div>
            <div className="text-xs text-slate-500 tabular-nums">
              پایه ۳۰ روزه: {formatMoney(input.dailyBaseWageRial * 30, unit)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500">بیمه کارفرما (۲۳٪) + کل ذخایر</div>
            <div className="text-xl font-bold text-amber-700 tabular-nums">
              {formatMoney(
                result.totalEmployerInsuranceRial + totalReservesAndEos,
                unit
              )}
            </div>
            <div className="text-xs text-slate-500 tabular-nums">
              بیمه ۲۳٪: {formatMoney(result.totalEmployerInsuranceRial, unit)} · ذخایر:{' '}
              {formatMoney(totalReservesAndEos, unit)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500">هزینه واقعی ماهانه کارفرما (CTC)</div>
            <div className="text-xl font-bold text-teal-700 tabular-nums">
              {formatMoney(effectiveCtcMonthly, unit)}
            </div>
            <div className="text-xs text-slate-500 tabular-nums">
              سالانه: {formatMoney(effectiveCtcAnnual, unit)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500">ضریب واقعی هزینه به خالص دریافتی</div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">
              {toPersianDigits(computed.ctcMultiplierToNet.toFixed(2))} برابر
            </div>
            <div className="text-xs text-slate-500 tabular-nums">
              سربار کل مازاد بر خالص: {formatMoney(effectiveOverheadAboveNet, unit)}
            </div>
          </div>
        </div>
      </section>

      {/* Main Split: Controls + Cost Breakdown Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls Panel */}
        <section className="lg:col-span-5 border border-slate-200 bg-white rounded-xl p-6 space-y-5">
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700">
              روش تنظیم حقوق پایه
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setInputMode('base')}
                className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  inputMode === 'base'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                بر اساس حقوق پایه ماهانه
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetNetDraft(
                    Math.round(result.netPayRial / multiplierToRial)
                  );
                  setInputMode('target-net');
                }}
                className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  inputMode === 'target-net'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                بر اساس خالص دریافتی توافقی
              </button>
            </div>
          </div>

          {inputMode === 'base' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">
                  حقوق پایه ماهانه ۳۰ روزه ({unitLabel})
                </span>
                <span className="tabular-nums text-teal-700 font-semibold">
                  {formatMoney(input.dailyBaseWageRial * 30, unit)}
                </span>
              </div>
              <input
                type="number"
                min={0}
                step={unit === 'toman' ? 1_000_000 : 10_000_000}
                value={Math.round((input.dailyBaseWageRial * 30) / multiplierToRial)}
                onChange={(e) =>
                  updateState({
                    wageMode: 'custom',
                    customMonthlyBase30Rial:
                      Number(e.target.value) * multiplierToRial,
                  })
                }
                className="w-full px-3 py-2 text-sm tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {presetsToman.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() =>
                      updateState({
                        wageMode: p.mode,
                        customMonthlyBase30Rial: p.rial,
                      })
                    }
                    className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">
                  خالص دریافتی هدف کارمند ({unitLabel})
                </span>
                <span className="tabular-nums text-teal-700 font-semibold">
                  پایه معادل: {formatMoney(input.dailyBaseWageRial * 30, unit)}
                </span>
              </div>
              <input
                type="number"
                min={0}
                step={unit === 'toman' ? 1_000_000 : 10_000_000}
                value={targetNetDraft}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setTargetNetDraft(val);
                  setTargetNetPayRial(val * multiplierToRial);
                }}
                className="w-full px-3 py-2 text-sm tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              />
              <p className="text-xs text-slate-500">
                تغییر خالص هدف، حقوق پایه پرسنل را در تمام تب‌ها به‌صورت خودکار به‌روزرسانی می‌کند تا به خالص مورد نظر برسید.
              </p>
            </div>
          )}

          {/* Shared Situational toggles */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">
                دارای سابقه یک سال به بالا (پایه سنوات)
              </span>
              <button
                type="button"
                onClick={() => updateState({ hasSeniority: !state.hasSeniority })}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                  state.hasSeniority
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {state.hasSeniority ? 'بله' : 'خیر'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">وضعیت تأهل</span>
              <button
                type="button"
                onClick={() => updateState({ isMarried: !state.isMarried })}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                  state.isMarried
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {state.isMarried ? 'متأهل' : 'مجرد'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">
                تعداد فرزندان مشمول
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateState({
                      childrenCount: Math.max(0, state.childrenCount - 1),
                    })
                  }
                  className="w-7 h-7 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm font-bold cursor-pointer"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-bold tabular-nums">
                  {toPersianDigits(state.childrenCount)}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateState({ childrenCount: state.childrenCount + 1 })
                  }
                  className="w-7 h-7 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm font-bold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">
                ساعات اضافه‌کاری ماه
              </span>
              <input
                type="number"
                min={0}
                value={state.overtimeHours}
                onChange={(e) =>
                  updateState({ overtimeHours: Number(e.target.value) })
                }
                className="w-20 px-2.5 py-1 text-sm text-center tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <div>
                <div className="text-xs font-medium text-slate-700">
                  ذخیره بازخرید مرخصی استحقاقی
                </div>
                <div className="text-xs text-slate-500">
                  ۲۶ روز در سال (۲.۱۶۶۷ روز در ماه · ماده ۶۴ قانون کار)
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateState({ includeLeaveReserve: !state.includeLeaveReserve })
                }
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                  state.includeLeaveReserve
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {state.includeLeaveReserve ? 'لحاظ شود' : 'حذف'}
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <div>
                <div className="text-xs font-medium text-slate-700">
                  لحاظ پاداش‌ها و ذخایر EOS در هزینه کل
                </div>
                <div className="text-xs text-slate-500 tabular-nums">
                  اسکورکارد + ذخیره راک (۱/۳) + ذخیره سود V/TO (۱/۱۲)
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateState({ includeEosInPayroll: !state.includeEosInPayroll })
                }
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                  state.includeEosInPayroll
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {state.includeEosInPayroll ? 'متصل' : 'فقط قانونی'}
              </button>
            </div>
          </div>
        </section>

        {/* Visual Distribution + Complete Ledger Table */}
        <div className="lg:col-span-7 space-y-6">
          {/* Distribution Bar */}
          <section className="border border-slate-200 bg-white rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                ساختار سهم‌بری هر ریال هزینه کارفرما (CTC)
              </h2>
              <span className="text-xs text-slate-500 tabular-nums">
                مجموع ۱۰۰٪ = {formatMoney(effectiveCtcMonthly, unit)}
              </span>
            </div>

            <div className="h-5 w-full rounded-lg overflow-hidden flex bg-slate-100 border border-slate-200">
              <div
                style={{ width: `${pctNet}%` }}
                className="bg-teal-700 h-full transition-all duration-200"
                title="خالص دریافتی کارمند"
              />
              <div
                style={{ width: `${pctDeductions}%` }}
                className="bg-slate-700 h-full transition-all duration-200"
                title="کسورات بیمه ۷٪ و مالیات کارمند"
              />
              <div
                style={{ width: `${pctEmployerIns}%` }}
                className="bg-amber-600 h-full transition-all duration-200"
                title="بیمه ۲۳٪ سهم کارفرما"
              />
              <div
                style={{ width: `${pctReserves}%` }}
                className="bg-rose-600 h-full transition-all duration-200"
                title="ذخایر قانونی و EOS"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
              <div className="space-y-0.5">
                <div className="font-semibold text-teal-700 tabular-nums">
                  خالص کارمند ({toPersianDigits(pctNet.toFixed(1))}٪)
                </div>
                <div className="text-slate-600 tabular-nums">
                  {formatMoney(result.netPayRial, unit)}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="font-semibold text-slate-700 tabular-nums">
                  بیمه ۷٪ + مالیات ({toPersianDigits(pctDeductions.toFixed(1))}٪)
                </div>
                <div className="text-slate-600 tabular-nums">
                  {formatMoney(result.totalDeductionsRial, unit)}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="font-semibold text-amber-700 tabular-nums">
                  بیمه ۲۳٪ کارفرما ({toPersianDigits(pctEmployerIns.toFixed(1))}٪)
                </div>
                <div className="text-slate-600 tabular-nums">
                  {formatMoney(result.totalEmployerInsuranceRial, unit)}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="font-semibold text-rose-700 tabular-nums">
                  کل ذخایر آتی ({toPersianDigits(pctReserves.toFixed(1))}٪)
                </div>
                <div className="text-slate-600 tabular-nums">
                  {formatMoney(totalReservesAndEos, unit)}
                </div>
              </div>
            </div>
          </section>

          {/* Detailed Monthly & Annual CTC Table */}
          <section className="border border-slate-200 bg-white rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              جدول تفکیکی بار مالی کارفرما (ماهانه و سالانه)
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs md:text-sm text-right">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 font-semibold">ردیف هزینه</th>
                    <th className="py-3 px-4 font-semibold">مبلغ ماهانه</th>
                    <th className="py-3 px-4 font-semibold">مبلغ سالانه (۱۲ ماه)</th>
                    <th className="py-3 px-4 font-semibold">سهم از CTC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      ۱. خالص پرداختی به کارمند
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {formatMoney(result.netPayRial, unit)}
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {formatMoney(result.netPayRial * 12, unit)}
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {formatPercentFa(pctNet / 100)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      ۲. بیمه ۷٪ سهم کارگر + مالیات حقوق
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {formatMoney(result.totalDeductionsRial, unit)}
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {formatMoney(result.totalDeductionsRial * 12, unit)}
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {formatPercentFa(pctDeductions / 100)}
                    </td>
                  </tr>
                  <tr className="bg-slate-50 font-semibold">
                    <td className="py-2.5 px-4 text-slate-800">
                      جمع حقوق ناخالص فیش (شامل اسکورکارد EOS در صورت اتصال)
                    </td>
                    <td className="py-2.5 px-4 tabular-nums">
                      {formatMoney(result.grossEarningsRial, unit)}
                    </td>
                    <td className="py-2.5 px-4 tabular-nums">
                      {formatMoney(result.grossEarningsRial * 12, unit)}
                    </td>
                    <td className="py-2.5 px-4 tabular-nums">
                      {formatPercentFa(
                        effectiveCtcMonthly > 0
                          ? result.grossEarningsRial / effectiveCtcMonthly
                          : 0
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      ۳. بیمه تأمین اجتماعی سهم کارفرما (۲۰٪) + بیکاری (۳٪)
                    </td>
                    <td className="py-3 px-4 tabular-nums text-amber-700 font-semibold">
                      {formatMoney(result.totalEmployerInsuranceRial, unit)}
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {formatMoney(result.totalEmployerInsuranceRial * 12, unit)}
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {formatPercentFa(pctEmployerIns / 100)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      ۴. ذخیره ماهانه عیدی (۱/۱۲) + سنوات (۱/۱۲)
                      {state.includeLeaveReserve ? ' + مرخصی (۲.۱۷ روز)' : ''}
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {formatMoney(computed.totalStatutoryReservesRial, unit)}
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {formatMoney(computed.totalStatutoryReservesRial * 12, unit)}
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {formatPercentFa(
                        effectiveCtcMonthly > 0
                          ? computed.totalStatutoryReservesRial /
                              effectiveCtcMonthly
                          : 0
                      )}
                    </td>
                  </tr>
                  {computed.totalEosReservesRial > 0 && (
                    <tr>
                      <td className="py-3 px-4 font-medium text-teal-800">
                        ۵. ذخایر متغیر EOS (راک فصلی ۱/۳ + مشارکت در سود V/TO ۱/۱۲)
                      </td>
                      <td className="py-3 px-4 tabular-nums text-teal-800 font-semibold">
                        {formatMoney(computed.totalEosReservesRial, unit)}
                      </td>
                      <td className="py-3 px-4 tabular-nums text-teal-800">
                        {formatMoney(computed.totalEosReservesRial * 12, unit)}
                      </td>
                      <td className="py-3 px-4 tabular-nums">
                        {formatPercentFa(
                          effectiveCtcMonthly > 0
                            ? computed.totalEosReservesRial / effectiveCtcMonthly
                            : 0
                        )}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-900 text-white font-bold">
                    <td className="py-3.5 px-4">جمع کل هزینه واقعی کارفرما (CTC)</td>
                    <td className="py-3.5 px-4 tabular-nums">
                      {formatMoney(effectiveCtcMonthly, unit)}
                    </td>
                    <td className="py-3.5 px-4 tabular-nums">
                      {formatMoney(effectiveCtcAnnual, unit)}
                    </td>
                    <td className="py-3.5 px-4 tabular-nums">۱۰۰٪</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  فرمول جامع اکسل هزینه کل کارفرما (CTC):
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('ctc-excel', ctcExcelFormula)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-900 px-2 py-1 rounded hover:bg-teal-50 transition-colors cursor-pointer"
                >
                  {copiedId === 'ctc-excel' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>کپی شد</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>کپی فرمول اکسل</span>
                    </>
                  )}
                </button>
              </div>
              <div className="font-mono-code text-xs bg-slate-100 text-slate-900 border border-slate-200 px-3 py-2.5 rounded-lg overflow-x-auto">
                {ctcExcelFormula}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
