import { useEffect, useState } from 'react';
import { Check, CheckSquare, FileSpreadsheet, RotateCcw, Square } from 'lucide-react';
import {
  EOS_BONUS_LAYERS,
  EOS_FIVE_PRINCIPLES,
  EOS_IMPLEMENTATION_CHECKLIST,
  EOS_OWNERS_BOX_RULES,
} from '../data/eosCompensation';
import {
  formatMoney,
  formatPercentFa,
  toPersianDigits,
} from '../utils/payrollEngine';
import { downloadPayrollExcelWorkbook } from '../utils/excelWorkbookBuilder';
import { useUnifiedPayroll } from '../state/UnifiedPayrollContext';

const CHECKLIST_STORAGE_KEY = 'iran-payroll-eos-checklist-v1';

export function EosCompensationView() {
  const { state, computed, updateState } = useUnifiedPayroll();
  const year = state.year;
  const unit = state.unit;
  const multiplierToRial = unit === 'toman' ? 10 : 1;
  const unitLabel = unit === 'toman' ? 'تومان' : 'ریال';

  const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(completedSteps));
    } catch {
      // Ignore storage errors
    }
  }, [completedSteps]);

  const toggleStep = (id: string) => {
    setCompletedSteps((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const input = computed.payrollInput;
  const baseline = computed.baselineResult;
  const full = computed.payrollResult;

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <section className="border border-slate-200 bg-white rounded-xl p-6 md:p-8 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
              <span>نظام جبران خدمات و پاداش EOS</span>
              <span aria-hidden="true">·</span>
              <span>متصل به فیش حقوقی و CTC ({state.employeeName})</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">
              پیاده‌سازی سیستم حقوق و پاداش ارزش‌محور EOS در چارچوب قانون کار ایران
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              تغییر نرخ بازار صندلی، وضعیت GWC، پاداش اسکورکارد، راک‌های فصلی یا مشارکت در سود مستقیماً در فیش حقوقی و هزینه واقعی کارفرما (CTC) اعمال می‌شود.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              void downloadPayrollExcelWorkbook({
                employeeName: state.employeeName || 'پرسنل تنظیم‌شده شما',
                periodLabel: `سال ${year} · ماه ${input.monthDays} روزه`,
                input,
                result: full,
                eos: {
                  seatName: state.employeeName || 'پرسنل تنظیم‌شده شما',
                  isGwcQualified: computed.isGwcQualified,
                  seatMonthlyBaseRial: input.dailyBaseWageRial * 30,
                  scorecardBudgetRial: state.scorecardBudgetRial,
                  scorecardAchievementPct: state.scorecardAchievementPct,
                  scorecardBonusRial: computed.scorecardBonusRial,
                  quarterlyRockBudgetRial: state.quarterlyRockBudgetRial,
                  companyRocksPct: state.companyRocksPct,
                  individualRocksPct: state.individualRocksPct,
                  quarterlyRockEarnedRial: computed.quarterlyRockEarnedRial,
                  monthlyRockReserveRial: computed.monthlyRockReserveRial,
                  annualProfitShareRial: computed.annualProfitShareRial,
                  monthlyProfitReserveRial: computed.monthlyProfitReserveRial,
                  totalEosReservesRial: computed.totalEosReservesRial,
                  totalCtcMonthlyRial: computed.totalCtcMonthlyRial,
                  totalCtcAnnualRial: computed.totalCtcAnnualRial,
                },
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>خروجی اکسل کامل با شیت EOS</span>
          </button>
        </div>

        {/* 4-Column Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5 border-t border-slate-200">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">حقوق پایه صندلی + مزایای قانونی</div>
            <div className="text-lg font-bold text-slate-900 tabular-nums">
              {formatMoney(baseline.grossEarningsRial, unit)}
            </div>
            <div className="text-xs text-slate-500">
              وضعیت احراز GWC:{' '}
              {computed.isGwcQualified ? 'کامل (۳ از ۳)' : 'ناقص (پاداش معلق)'}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500">پاداش ماهانه اسکورکارد</div>
            <div className="text-lg font-bold text-teal-700 tabular-nums">
              {formatMoney(computed.scorecardBonusRial, unit)}
            </div>
            <div className="text-xs text-slate-500">{computed.scorecardTierLabel}</div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500">
              ذخیره ماهانه راک فصلی + سهم سود
            </div>
            <div className="text-lg font-bold text-slate-900 tabular-nums">
              {formatMoney(computed.totalEosReservesRial, unit)}
            </div>
            <div className="text-xs text-slate-500 tabular-nums">
              راک فصل: {formatMoney(computed.quarterlyRockEarnedRial, unit)} · سال سود:{' '}
              {formatMoney(computed.annualProfitShareRial, unit)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500">
              هزینه کل واقعی کارفرما با بسته EOS
            </div>
            <div className="text-lg font-bold text-slate-900 tabular-nums">
              {formatMoney(computed.totalCtcMonthlyRial, unit)}
            </div>
            <div className="text-xs text-slate-500 tabular-nums">
              سالانه: {formatMoney(computed.totalCtcAnnualRial, unit)}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Simulator */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls */}
        <div className="lg:col-span-5 border border-slate-200 bg-white rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-lg font-bold text-slate-900">
              شبیه‌ساز بسته جبران خدمات صندلی (EOS)
            </h2>
            <button
              type="button"
              onClick={() =>
                updateState({ includeEosInPayroll: !state.includeEosInPayroll })
              }
              className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                state.includeEosInPayroll
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {state.includeEosInPayroll ? 'متصل به فیش' : 'معلق'}
            </button>
          </div>

          {/* Seat Base + GWC */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">
                نرخ بازار صندلی (Seat Market Rate - {unitLabel})
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

            <div className="space-y-1.5 pt-1">
              <div className="text-xs font-medium text-slate-600">
                شرط احراز صندلی (GWC):
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => updateState({ gwcGet: !state.gwcGet })}
                  className={`py-1.5 px-2 text-xs font-medium rounded-lg border cursor-pointer ${
                    state.gwcGet
                      ? 'bg-teal-700 text-white border-teal-700'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  درک نقش (G)
                </button>
                <button
                  type="button"
                  onClick={() => updateState({ gwcWant: !state.gwcWant })}
                  className={`py-1.5 px-2 text-xs font-medium rounded-lg border cursor-pointer ${
                    state.gwcWant
                      ? 'bg-teal-700 text-white border-teal-700'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  اشتیاق (W)
                </button>
                <button
                  type="button"
                  onClick={() => updateState({ gwcCapacity: !state.gwcCapacity })}
                  className={`py-1.5 px-2 text-xs font-medium rounded-lg border cursor-pointer ${
                    state.gwcCapacity
                      ? 'bg-teal-700 text-white border-teal-700'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  ظرفیت (C)
                </button>
              </div>
            </div>
          </div>

          {/* Scorecard Simulator */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">
                بودجه پایه پاداش ماهانه اسکورکارد ({unitLabel})
              </span>
              <span className="tabular-nums text-slate-600">
                ضریب فعلی: {formatPercentFa(computed.scorecardMultiplier)}
              </span>
            </div>
            <input
              type="number"
              min={0}
              step={unit === 'toman' ? 500_000 : 5_000_000}
              value={Math.round(state.scorecardBudgetRial / multiplierToRial)}
              onChange={(e) =>
                updateState({
                  scorecardBudgetRial: Number(e.target.value) * multiplierToRial,
                })
              }
              className="w-full px-3 py-2 text-sm tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
            />
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-600">
                <span>درصد تحقق شاخص عددی اسکورکارد:</span>
                <span className="font-bold tabular-nums text-slate-900">
                  {toPersianDigits(state.scorecardAchievementPct)}٪
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={125}
                value={state.scorecardAchievementPct}
                onChange={(e) =>
                  updateState({
                    scorecardAchievementPct: Number(e.target.value),
                  })
                }
                className="w-full accent-teal-700 cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-600">ضریب پاداش فوق‌العاده (≥۱۰۵٪):</span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                {([1.2, 1.35, 1.5] as const).map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() =>
                      updateState({ overAchievementMultiplier: rate })
                    }
                    className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                      state.overAchievementMultiplier === rate
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    {toPersianDigits(Math.round(rate * 100))}٪
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quarterly Rocks Simulator */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <label className="block text-xs font-semibold text-slate-700">
              پاداش فصلی راک‌ها (۹۰ روزه · شرط ≥۸۰٪ سازمان)
            </label>
            <input
              type="number"
              min={0}
              step={unit === 'toman' ? 1_000_000 : 10_000_000}
              value={Math.round(state.quarterlyRockBudgetRial / multiplierToRial)}
              onChange={(e) =>
                updateState({
                  quarterlyRockBudgetRial:
                    Number(e.target.value) * multiplierToRial,
                })
              }
              className="w-full px-3 py-2 text-sm tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-xs text-slate-500 block">
                  تحقق راک کل سازمان (٪)
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={state.companyRocksPct}
                  onChange={(e) =>
                    updateState({ companyRocksPct: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-1.5 text-sm tabular-nums bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-500 block">
                  تحقق راک فردی (٪)
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={state.individualRocksPct}
                  onChange={(e) =>
                    updateState({ individualRocksPct: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-1.5 text-sm tabular-nums bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div
              className={`text-xs font-medium ${
                computed.isCompanyRockThresholdMet
                  ? 'text-emerald-700'
                  : 'text-rose-700'
              }`}
            >
              {computed.isCompanyRockThresholdMet
                ? 'حد نصاب ۸۰٪ راک‌های سازمان احراز شده و بودجه فصلی آزاد است.'
                : 'نرخ راک سازمان زیر ۸۰٪ است؛ مطابق اصل چهارم EOS پاداش فصلی آزاد نمی‌شود.'}
            </div>
          </div>

          {/* Profit Sharing */}
          <div className="space-y-2 pt-4 border-t border-slate-200">
            <label className="block text-xs font-semibold text-slate-700">
              سهم پیش‌بینی‌شده از صندوق سود مازاد V/TO در سال ({unitLabel})
            </label>
            <input
              type="number"
              min={0}
              step={unit === 'toman' ? 5_000_000 : 50_000_000}
              value={Math.round(state.annualProfitShareRial / multiplierToRial)}
              onChange={(e) =>
                updateState({
                  annualProfitShareRial: Number(e.target.value) * multiplierToRial,
                })
              }
              className="w-full px-3 py-2 text-sm tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
            />
          </div>
        </div>

        {/* Legal & Financial Impact Output */}
        <div className="lg:col-span-7 space-y-6">
          <section className="border border-slate-200 bg-white rounded-xl p-6 space-y-5">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3">
              خروجی مالی و تطبیق قانونی با فیش حقوقی ایران ({toPersianDigits(year)})
            </h2>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs md:text-sm text-right">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 font-semibold">جزء بسته جبران خدمات</th>
                    <th className="py-3 px-4 font-semibold">مبلغ ناخالص ماهانه</th>
                    <th className="py-3 px-4 font-semibold">اثر بیمه و مالیات قانونی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      حقوق پایه صندلی + مزایای حکم و اضافه‌کاری فعلی
                    </td>
                    <td className="py-3 px-4 tabular-nums font-semibold">
                      {formatMoney(baseline.grossEarningsRial, unit)}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 tabular-nums">
                      بیمه ۷٪: {formatMoney(baseline.employeeInsuranceRial, unit)} ·
                      مالیات: {formatMoney(baseline.totalPayrollTaxRial, unit)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      پاداش عملکردی اسکورکارد ({toPersianDigits(state.scorecardAchievementPct)}٪
                      تحقق)
                    </td>
                    <td className="py-3 px-4 tabular-nums font-semibold text-teal-700">
                      {formatMoney(computed.scorecardBonusRial, unit)}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 tabular-nums">
                      افزایش بیمه:{' '}
                      {formatMoney(computed.marginalInsuranceOnScorecardRial, unit)} ·
                      افزایش مالیات:{' '}
                      {formatMoney(computed.marginalTaxOnScorecardRial, unit)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      ذخیره ماهانه پاداش فصلی راک‌ها (۱/۳ پاداش فصل)
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {formatMoney(computed.monthlyRockReserveRial, unit)}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      در ماه تسویه فصل مشمول بیمه (تا سقف ۷ برابر) و مالیات پلکانی می‌شود.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      ذخیره ماهانه مشارکت در سود V/TO (۱/۱۲ سهم سالانه)
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {formatMoney(computed.monthlyProfitReserveRial, unit)}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      در ماه پرداخت سالانه مشمول مالیات حقوق و بیمه تا سقف ماه است.
                    </td>
                  </tr>
                  <tr className="bg-slate-50 font-bold">
                    <td className="py-3 px-4 text-slate-900">
                      خالص دریافتی ماهانه کارمند (دقیقاً برابر با تب فیش حقوقی)
                    </td>
                    <td className="py-3 px-4 tabular-nums text-teal-700">
                      {formatMoney(full.netPayRial, unit)}
                    </td>
                    <td className="py-3 px-4 text-xs font-normal text-slate-600 tabular-nums">
                      پس از کسر کل بیمه ۷٪ و مالیات پلکانی ماهانه
                    </td>
                  </tr>
                  <tr className="bg-slate-900 text-white font-bold">
                    <td className="py-3.5 px-4">
                      هزینه واقعی کل کارفرما (دقیقاً برابر با تب CTC)
                    </td>
                    <td className="py-3.5 px-4 tabular-nums">
                      {formatMoney(computed.totalCtcMonthlyRial, unit)}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-normal text-slate-300 tabular-nums">
                      شامل ۲۳٪ بیمه + ذخایر عیدی، سنوات، مرخصی، راک و سود
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 3 Bonus Layers Reference */}
          <section className="border border-slate-200 bg-white rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              سه لایه پاداش انگیزشی در مدل EOS و تکلیف قانونی آن‌ها در ایران
            </h3>
            <div className="space-y-3">
              {EOS_BONUS_LAYERS.map((layer) => (
                <div
                  key={layer.id}
                  className="border border-slate-200 bg-slate-50 rounded-lg p-4 space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      {layer.title}
                    </span>
                    <span className="text-xs text-slate-500">
                      {layer.cadence} · {layer.eosSource}
                    </span>
                  </div>
                  <div className="text-xs text-slate-700">
                    <span className="font-semibold">معیار آزادسازی: </span>
                    {layer.triggerRule}
                  </div>
                  <div className="text-xs text-teal-800">
                    <span className="font-semibold">حکم بیمه و مالیات ایران: </span>
                    {layer.iranianLawTreatment}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      {/* 5 Core Principles */}
      <section className="border border-slate-200 bg-white rounded-xl p-6 md:p-8 space-y-5">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900">
            اصول ۵‌گانه بنیادین EOS در مدیریت حقوق و پاداش
          </h2>
          <p className="text-sm text-slate-600">
            قواعد غیرقابل‌مذاکره استخراج‌شده از کتاب‌های مرجع Traction، How to Be a Great Boss، The EOS Life، Data و People
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {EOS_FIVE_PRINCIPLES.map((p) => (
            <article
              key={p.number}
              className="border border-slate-200 rounded-xl p-5 bg-slate-50 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="text-xs text-slate-500">{p.sourceBook}</div>
                <h3 className="text-base font-bold text-slate-900">
                  {p.number}. {p.title}
                </h3>
                <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                  {p.summary}
                </p>
              </div>
              <div className="pt-3 border-t border-slate-200 text-xs text-slate-800 leading-relaxed">
                <span className="font-semibold text-teal-800">قاعده اجرایی: </span>
                {p.operationalRule}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Owner's Box vs Accountability Chart + Interactive 7-Step Checklist */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 border border-slate-200 bg-white rounded-xl p-6 space-y-5">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">کتاب Rocket Fuel · قانون شماره ۴</div>
            <h2 className="text-lg font-bold text-slate-900">
              تفکیک صندوق مالکان (Owner’s Box) از صندلی شغلی
            </h2>
          </div>

          <div className="space-y-3">
            <div className="border border-slate-900 bg-slate-900 text-white rounded-lg p-4 text-center space-y-1">
              <div className="text-xs text-slate-300">لایه مالکیت</div>
              <div className="text-sm font-bold">OWNER’S BOX</div>
              <div className="text-xs text-slate-300">
                توزیع سود سالانه سهام‌داری (Profit Distributions)
              </div>
            </div>
            <div className="text-center text-xs text-slate-400 select-none">
              ↓ تفکیک کامل حسابداری و حقوقی ↓
            </div>
            <div className="border border-teal-700 bg-teal-50 rounded-lg p-4 text-center space-y-1">
              <div className="text-xs text-teal-800">لایه عملیاتی</div>
              <div className="text-sm font-bold text-slate-900">
                ACCOUNTABILITY CHART SEAT
              </div>
              <div className="text-xs text-slate-700">
                حقوق شغلی بر اساس نرخ بازار صندلی (Seat Market Rate)
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {EOS_OWNERS_BOX_RULES.map((rule, idx) => (
              <div key={idx} className="space-y-1">
                <div className="text-xs font-bold text-slate-900">{rule.title}</div>
                <p className="text-xs text-slate-600 leading-relaxed">{rule.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 border border-slate-200 bg-white rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                چک‌لیست عملیاتی استقرار نظام جبران خدمات EOS
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                پیشرفت فعلی: {toPersianDigits(completedSteps.length)} از{' '}
                {toPersianDigits(EOS_IMPLEMENTATION_CHECKLIST.length)} گام
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCompletedSteps([])}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>بازنشانی</span>
            </button>
          </div>

          <div className="divide-y divide-slate-200">
            {EOS_IMPLEMENTATION_CHECKLIST.map((step) => {
              const isDone = completedSteps.includes(step.id);
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => toggleStep(step.id)}
                  className="w-full py-3.5 px-2 text-right flex items-start gap-3 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span className="mt-0.5 shrink-0 text-teal-700">
                    {isDone ? (
                      <CheckSquare className="w-5 h-5" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400" />
                    )}
                  </span>
                  <span className="space-y-0.5 flex-1">
                    <span
                      className={`block text-sm font-bold ${
                        isDone ? 'line-through text-slate-400' : 'text-slate-900'
                      }`}
                    >
                      {step.stepNumber}: {step.title}
                    </span>
                    <span className="block text-xs text-slate-600 leading-relaxed">
                      {step.description}
                    </span>
                  </span>
                  {isDone && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                      <span>انجام شد</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
