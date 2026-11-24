import { FileSpreadsheet, Printer, RotateCcw } from 'lucide-react';
import { YEAR_REGULATIONS } from '../data/payrollRegulations';
import {
  formatMoney,
  formatPercentFa,
  toPersianDigits,
} from '../utils/payrollEngine';
import { downloadPayrollExcelWorkbook } from '../utils/excelWorkbookBuilder';
import { useUnifiedPayroll } from '../state/UnifiedPayrollContext';

export function PayrollCalculatorView() {
  const { state, computed, updateState, resetToDefaults } = useUnifiedPayroll();
  const reg = YEAR_REGULATIONS[state.year];
  const unit = state.unit;
  const year = state.year;
  const result = computed.payrollResult;
  const input = computed.payrollInput;

  const multiplierToRial = unit === 'toman' ? 10 : 1;
  const unitLabel = unit === 'toman' ? 'تومان' : 'ریال';
  const isInsuranceCapped =
    result.insuranceSubjectEarningsRial > result.insuranceMonthlyCeilingRial;

  const handleMonthDaysChange = (days: 29 | 30 | 31) => {
    updateState({ monthDays: days, workDays: days });
  };

  return (
    <div className="space-y-6">
      {result.ruleSetApprovalStatus !== 'approved' && (
        <section className="border border-amber-300 bg-amber-50 rounded-xl p-4 space-y-2">
          <div className="text-sm font-bold text-amber-900">
            این محاسبه با نسخه قواعد تأییدنشده انجام شده است
          </div>
          <p className="text-xs leading-6 text-amber-900">
            نسخه قواعد {result.ruleSetId} (ویرایش {toPersianDigits(result.ruleSetVersion)}) هنوز تأیید حقوقی نهایی ندارد؛
            بنابراین ارقام فعلی برای توسعه و بررسی هستند و نباید به‌عنوان محاسبه نهایی تأییدشده حقوق و دستمزد تلقی شوند.
          </p>
          {result.legalReviewRequiredItems.filter((item) => !item.startsWith('RuleSet ')).length > 0 && (
            <div className="text-xs text-amber-900 leading-6">
              اقلام دارای بررسی حقوقی باز: {result.legalReviewRequiredItems
                .filter((item) => !item.startsWith('RuleSet '))
                .join('، ')}
            </div>
          )}
        </section>
      )}
      {/* Top 4 KPI Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <div className="border border-slate-200 bg-white rounded-xl p-5 space-y-1">
          <div className="text-xs text-slate-500">جمع حقوق و مزایای ناخالص</div>
          <div className="text-xl font-bold text-slate-900 tabular-nums">
            {formatMoney(result.grossEarningsRial, unit)}
          </div>
          <div className="text-xs text-slate-500 tabular-nums">
            نرخ هر ساعت اضافه‌کار:{' '}
            {formatMoney(Math.round(result.hourlyNormalRateRial * 1.4), unit)}
          </div>
        </div>
        <div className="border border-slate-200 bg-white rounded-xl p-5 space-y-1">
          <div className="text-xs text-slate-500">حق بیمه سهم کارگر (۷٪)</div>
          <div className="text-xl font-bold text-rose-700 tabular-nums">
            {formatMoney(result.employeeInsuranceRial, unit)}
          </div>
          <div className="text-xs text-slate-500">
            {isInsuranceCapped
              ? 'سقف ۷ برابری بیمه اعمال شده است'
              : 'مشمول کامل تا سقف قانونی'}
          </div>
        </div>
        <div className="border border-slate-200 bg-white rounded-xl p-5 space-y-1">
          <div className="text-xs text-slate-500">مالیات پلکانی حقوق</div>
          <div className="text-xl font-bold text-amber-700 tabular-nums">
            {formatMoney(result.totalPayrollTaxRial, unit)}
          </div>
          <div className="text-xs text-slate-500 tabular-nums">
            نرخ مؤثر مالیاتی: {formatPercentFa(result.effectiveTaxRate)}
          </div>
        </div>
        <div className="border border-slate-200 bg-white rounded-xl p-5 space-y-1">
          <div className="text-xs text-slate-500">خالص پرداختی به کارگر</div>
          <div className="text-xl font-bold text-teal-700 tabular-nums">
            {formatMoney(result.netPayRial, unit)}
          </div>
          <div className="text-xs text-slate-500 tabular-nums">
            هزینه واقعی کارفرما (CTC): {formatMoney(computed.totalCtcMonthlyRial, unit)}
          </div>
        </div>
      </section>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Input Form */}
        <section className="lg:col-span-5 border border-slate-200 bg-white rounded-xl p-6 space-y-6 no-print">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                پارامترهای حکم و کارکرد ماهانه
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                همگام با تب‌های هزینه کارفرما (CTC) و جبران خدمات EOS
              </p>
            </div>
            <button
              type="button"
              onClick={resetToDefaults}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>بازنشانی</span>
            </button>
          </div>

          {/* Employee Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              نام یا عنوان صندلی پرسنل
            </label>
            <input
              type="text"
              value={state.employeeName}
              onChange={(e) => updateState({ employeeName: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
            />
          </div>

          {/* Month Days & Worked Days */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <label className="block text-xs font-semibold text-slate-700">
              طول ماه تقویمی و روزهای کارکرد
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([31, 30, 29] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleMonthDaysChange(d)}
                  className={`py-2 px-3 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    state.monthDays === d
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {toPersianDigits(d)} روزه
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-4 pt-1">
              <span className="text-xs text-slate-600">روزهای کارکرد واقعی:</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={state.monthDays}
                  value={state.workDays}
                  onChange={(e) =>
                    updateState({ workDays: Number(e.target.value) })
                  }
                  className="w-24 px-3 py-1.5 text-sm text-center tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
                />
                <span className="text-xs text-slate-500">روز</span>
              </div>
            </div>
          </div>

          {/* Base Salary Selection */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <label className="block text-xs font-semibold text-slate-700">
              مبنای حقوق پایه ماهانه (۳۰ روزه)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateState({ wageMode: 'min' })}
                className={`py-2 px-3 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  state.wageMode === 'min'
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                حداقل دستمزد مصوب
              </button>
              <button
                type="button"
                onClick={() => updateState({ wageMode: 'custom' })}
                className={`py-2 px-3 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  state.wageMode === 'custom'
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                حقوق صندلی / توافقی
              </button>
            </div>
            {state.wageMode === 'custom' && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>مبلغ حقوق پایه ماهانه ۳۰ روزه ({unitLabel}):</span>
                  <span className="tabular-nums font-medium text-teal-700">
                    {formatMoney(input.dailyBaseWageRial * 30, unit)}
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  step={unit === 'toman' ? 500_000 : 5_000_000}
                  value={Math.round(
                    state.customMonthlyBase30Rial / multiplierToRial
                  )}
                  onChange={(e) =>
                    updateState({
                      customMonthlyBase30Rial:
                        Number(e.target.value) * multiplierToRial,
                    })
                  }
                  className="w-full px-3 py-2 text-sm tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>
            )}
          </div>

          {/* Seniority, Marriage & Children */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-700">
                  پایه سنوات (حداقل ۱ سال سابقه)
                </div>
                <div className="text-xs text-slate-500 tabular-nums">
                  نرخ پایه سال اول:{' '}
                  {formatMoney(reg.baseSeniorityMonthly1YrRial, unit)} در ماه
                </div>
              </div>
              <button
                type="button"
                onClick={() => updateState({ hasSeniority: !state.hasSeniority })}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  state.hasSeniority
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {state.hasSeniority ? 'فعال (دارای سابقه)' : 'غیرفعال'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-700">حق تأهل</div>
                <div className="text-xs text-slate-500 tabular-nums">
                  مبلغ مصوب: {formatMoney(reg.marriageAllowanceRial, unit)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => updateState({ isMarried: !state.isMarried })}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  state.isMarried
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {state.isMarried ? 'متأهل' : 'مجرد'}
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-semibold text-slate-700">
                  تعداد فرزندان مشمول حق اولاد
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateState({
                        childrenCount: Math.max(0, state.childrenCount - 1),
                      })
                    }
                    className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm font-bold cursor-pointer"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-bold tabular-nums">
                    {toPersianDigits(state.childrenCount)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateState({ childrenCount: state.childrenCount + 1 })
                    }
                    className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-xs text-slate-600">
                  شرط ۷۲۰ روز سابقه بیمه تأمین اجتماعی (ماده ۸۶)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateState({
                      has720DaysInsurance: !state.has720DaysInsurance,
                    })
                  }
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors shrink-0 cursor-pointer ${
                    state.has720DaysInsurance
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {state.has720DaysInsurance ? 'احراز شده' : 'کمتر از ۷۲۰ روز'}
                </button>
              </div>
            </div>
          </div>

          {/* Overtime & Variable Earnings (including EOS Scorecard link) */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <label className="block text-xs font-semibold text-slate-700">
              اضافه‌کاری، نوبت‌کاری و پاداش متغیر
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <span className="text-xs text-slate-500 block">اضافه‌کار (ساعت)</span>
                <input
                  type="number"
                  min={0}
                  value={state.overtimeHours}
                  onChange={(e) =>
                    updateState({ overtimeHours: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-1.5 text-sm tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-500 block">تعطیل‌کار (ساعت)</span>
                <input
                  type="number"
                  min={0}
                  value={state.holidayHours}
                  onChange={(e) =>
                    updateState({ holidayHours: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-1.5 text-sm tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-500 block">شب‌کاری (ساعت)</span>
                <input
                  type="number"
                  min={0}
                  value={state.nightShiftHours}
                  onChange={(e) =>
                    updateState({ nightShiftHours: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-1.5 text-sm tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <span className="text-xs text-slate-500 block">
                پاداش متغیر دستی / آکورد ({unitLabel})
              </span>
              <input
                type="number"
                min={0}
                step={unit === 'toman' ? 500_000 : 5_000_000}
                value={Math.round(state.otherVariableBonusRial / multiplierToRial)}
                onChange={(e) =>
                  updateState({
                    otherVariableBonusRial:
                      Number(e.target.value) * multiplierToRial,
                  })
                }
                className="w-full px-3 py-2 text-sm tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>

            <div className="flex items-center justify-between gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <div className="text-xs font-medium text-slate-700">
                  اتصال پاداش اسکورکارد EOS به فیش حقوقی
                </div>
                <div className="text-xs text-slate-500 tabular-nums">
                  مبلغ اسکورکارد فعلی: {formatMoney(computed.scorecardBonusRial, unit)}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateState({ includeEosInPayroll: !state.includeEosInPayroll })
                }
                className={`px-2.5 py-1 text-xs font-medium rounded-md shrink-0 cursor-pointer ${
                  state.includeEosInPayroll
                    ? 'bg-teal-700 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {state.includeEosInPayroll ? 'متصل' : 'غیرفعال'}
              </button>
            </div>
          </div>

          {/* Eid & Severance Inputs */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <label className="block text-xs font-semibold text-slate-700">
              محاسبه عیدی و سنوات پایان خدمت
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <span className="text-xs text-slate-500 block">کارکرد سال (روز)</span>
                <input
                  type="number"
                  min={0}
                  max={366}
                  value={state.annualWorkedDays}
                  onChange={(e) =>
                    updateState({ annualWorkedDays: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-1.5 text-sm tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-500 block">سنوات (سال)</span>
                <input
                  type="number"
                  min={0}
                  value={state.serviceYearsForSeverance}
                  onChange={(e) =>
                    updateState({
                      serviceYearsForSeverance: Number(e.target.value),
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-sm tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-500 block">سنوات (روز کسری)</span>
                <input
                  type="number"
                  min={0}
                  max={364}
                  value={state.serviceExtraDaysForSeverance}
                  onChange={(e) =>
                    updateState({
                      serviceExtraDaysForSeverance: Number(e.target.value),
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-sm tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Official Payslip + Tax Waterfall + Eid/Severance */}
        <div className="lg:col-span-7 space-y-6">
          {/* Standard Payslip */}
          <section className="border border-slate-200 bg-white rounded-xl p-6 space-y-5 print-only-full">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  فیش حقوقی {state.employeeName || 'پرسنل'} (سال{' '}
                  {toPersianDigits(year)} · ماه {toPersianDigits(state.monthDays)} روزه)
                </h2>
                <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  کارکرد مؤثر: {toPersianDigits(input.workDays)} روز · واحد مبالغ:{' '}
                  {unitLabel}
                </div>
              </div>
              <div className="no-print flex items-center gap-2 shrink-0">
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
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>خروجی اکسل (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>چاپ فیش</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Earnings Column */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-500 pb-1 border-b border-slate-200">
                  مزایای حکم و کارکرد (بستانکار)
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      حقوق پایه ({toPersianDigits(input.workDays)} روز)
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatMoney(result.basePayRial, unit, false)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">پایه سنوات</span>
                    <span className="font-semibold tabular-nums">
                      {formatMoney(result.seniorityPayRial, unit, false)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">حق مسکن</span>
                    <span className="font-semibold tabular-nums">
                      {formatMoney(result.housingPayRial, unit, false)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">بن کارگری (خواربار)</span>
                    <span className="font-semibold tabular-nums">
                      {formatMoney(result.couponPayRial, unit, false)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">حق تأهل</span>
                    <span className="font-semibold tabular-nums">
                      {formatMoney(result.marriagePayRial, unit, false)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      حق اولاد ({toPersianDigits(state.childrenCount)} فرزند)
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatMoney(result.childAllowancePayRial, unit, false)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      اضافه‌کاری ({toPersianDigits(state.overtimeHours)} ساعت × ۱۴۰٪)
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatMoney(result.overtimePayRial, unit, false)}
                    </span>
                  </div>
                  {result.holidayPayRial > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">
                        تعطیل‌کاری ({toPersianDigits(state.holidayHours)} ساعت)
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatMoney(result.holidayPayRial, unit, false)}
                      </span>
                    </div>
                  )}
                  {result.nightShiftPayRial > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">
                        فوق‌العاده شب‌کاری ({toPersianDigits(state.nightShiftHours)}{' '}
                        ساعت)
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatMoney(result.nightShiftPayRial, unit, false)}
                      </span>
                    </div>
                  )}
                  {computed.scorecardBonusRial > 0 && (
                    <div className="flex justify-between">
                      <span className="text-teal-800 font-medium">
                        پاداش اسکورکارد EOS ({toPersianDigits(state.scorecardAchievementPct)}٪)
                      </span>
                      <span className="font-semibold text-teal-800 tabular-nums">
                        {formatMoney(computed.scorecardBonusRial, unit, false)}
                      </span>
                    </div>
                  )}
                  {state.otherVariableBonusRial > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">پاداش متغیر و آکورد</span>
                      <span className="font-semibold tabular-nums">
                        {formatMoney(state.otherVariableBonusRial, unit, false)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between pt-3 border-t border-slate-200 text-sm font-bold text-slate-900">
                  <span>جمع حقوق و مزایا</span>
                  <span className="tabular-nums">
                    {formatMoney(result.grossEarningsRial, unit)}
                  </span>
                </div>
              </div>

              {/* Deductions & Employer Share Column */}
              <div className="space-y-4">
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-slate-500 pb-1 border-b border-slate-200">
                    کسورات قانونی کارگر (بدهکار)
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">بیمه تأمین اجتماعی (۷٪)</span>
                      <span className="font-semibold text-rose-700 tabular-nums">
                        {formatMoney(result.employeeInsuranceRial, unit, false)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">مالیات بر درآمد حقوق</span>
                      <span className="font-semibold text-amber-700 tabular-nums">
                        {formatMoney(result.totalPayrollTaxRial, unit, false)}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-slate-200 text-sm font-bold text-slate-900">
                    <span>جمع کسورات</span>
                    <span className="tabular-nums text-rose-700">
                      {formatMoney(result.totalDeductionsRial, unit)}
                    </span>
                  </div>
                </div>

                {/* Net Pay Highlight */}
                <div className="bg-slate-900 text-white rounded-lg p-4 space-y-1">
                  <div className="text-xs text-slate-300">خالص قابل پرداخت به کارگر</div>
                  <div className="text-2xl font-bold tabular-nums">
                    {formatMoney(result.netPayRial, unit)}
                  </div>
                </div>

                {/* Employer Obligations */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5 text-xs">
                  <div className="font-semibold text-slate-800">
                    تعهدات و هزینه واقعی کارفرما (CTC):
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>بیمه سهم کارفرما (۲۰٪) + بیکاری (۳٪)</span>
                    <span className="tabular-nums font-medium">
                      {formatMoney(result.totalEmployerInsuranceRial, unit)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>ذخیره ماهانه عیدی، سنوات و مرخصی</span>
                    <span className="tabular-nums font-medium">
                      {formatMoney(computed.totalStatutoryReservesRial, unit)}
                    </span>
                  </div>
                  {computed.totalEosReservesRial > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>ذخیره ماهانه راک فصلی و سود V/TO (EOS)</span>
                      <span className="tabular-nums font-medium">
                        {formatMoney(computed.totalEosReservesRial, unit)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-teal-700 font-bold pt-1 border-t border-slate-200">
                    <span>هزینه واقعی کل کارفرما (CTC)</span>
                    <span className="tabular-nums">
                      {formatMoney(computed.totalCtcMonthlyRial, unit)} (
                      {toPersianDigits(computed.ctcMultiplierToNet.toFixed(2))}× خالص)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Insurance vs Tax Basis Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-200 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                <div className="text-slate-500">
                  مبنای مشمول بیمه ماه (با اعمال سقف ۷ برابر)
                </div>
                <div className="font-bold text-slate-900 tabular-nums">
                  {formatMoney(result.cappedInsuranceBasisRial, unit)}
                </div>
                <div className="text-slate-500 tabular-nums">
                  سقف ماهانه: {formatMoney(result.insuranceMonthlyCeilingRial, unit)}
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                <div className="text-slate-500">
                  درآمد مشمول مالیات حقوق (پس از کسر معافیت‌های مسکن/بن/اولاد)
                </div>
                <div className="font-bold text-slate-900 tabular-nums">
                  {formatMoney(result.taxableIncomeRial, unit)}
                </div>
                <div className="text-slate-500 tabular-nums">
                  سقف معافیت پایه: {formatMoney(reg.taxMonthlyExemptionRial, unit)}
                </div>
              </div>
            </div>
          </section>

          {/* Progressive Tax Step-by-Step Breakdown */}
          <section className="border border-slate-200 bg-white rounded-xl p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                کالبدشکافی پله‌به‌پله مالیات بر درآمد حقوق ({toPersianDigits(year)})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                محاسبه تصاعدی بر اساس درآمد مشمول مالیات (
                {formatMoney(result.taxableIncomeRial, unit)})
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs md:text-sm text-right">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">پله مالیاتی</th>
                    <th className="py-2.5 px-3 font-semibold">نرخ</th>
                    <th className="py-2.5 px-3 font-semibold">مبلغ قرارگرفته در پله</th>
                    <th className="py-2.5 px-3 font-semibold">مالیات این پله</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {result.taxSteps.map((step) => (
                    <tr
                      key={step.bracketId}
                      className={
                        step.sliceAmountRial > 0
                          ? 'bg-white'
                          : 'bg-slate-50/50 text-slate-400'
                      }
                    >
                      <td className="py-2.5 px-3 font-medium">{step.label}</td>
                      <td className="py-2.5 px-3 tabular-nums">
                        {formatPercentFa(step.rate)}
                      </td>
                      <td className="py-2.5 px-3 tabular-nums">
                        {formatMoney(step.sliceAmountRial, unit)}
                      </td>
                      <td className="py-2.5 px-3 tabular-nums font-semibold">
                        {formatMoney(step.taxAmountRial, unit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Eid & Severance Pay Calculator Output */}
          <section className="border border-slate-200 bg-white rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              نتیجه محاسبه عیدی سالانه و حق سنوات پایان خدمت
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-200 bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="text-xs text-slate-500">
                  عیدی کارکرد {toPersianDigits(state.annualWorkedDays)} روز در سال
                </div>
                <div className="text-xl font-bold text-slate-900 tabular-nums">
                  {formatMoney(result.eidPayableRial, unit)}
                </div>
                <div className="text-xs text-slate-600 space-y-1 pt-1 border-t border-slate-200 tabular-nums">
                  <div>
                    حداقل ۶۰ روز فرد: {formatMoney(result.eidMinAnnualRial, unit)}
                  </div>
                  <div>
                    سقف قانونی ۹۰ روز: {formatMoney(result.eidMaxCapAnnualRial, unit)}
                  </div>
                  <div>
                    مالیات احتمالی مازاد بر ۱/۱۲ معافیت:{' '}
                    {result.eidEstimatedTaxRial > 0
                      ? formatMoney(result.eidEstimatedTaxRial, unit)
                      : 'معاف از مالیات'}
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="text-xs text-slate-500">
                  حق سنوات ({toPersianDigits(state.serviceYearsForSeverance)} سال و{' '}
                  {toPersianDigits(state.serviceExtraDaysForSeverance)} روز سابقه)
                </div>
                <div className="text-xl font-bold text-teal-700 tabular-nums">
                  {formatMoney(result.severancePayableRial, unit)}
                </div>
                <div className="text-xs text-slate-600 space-y-1 pt-1 border-t border-slate-200">
                  <div>مبنای ماهانه: حقوق پایه + پایه سنوات (۳۰ روزه)</div>
                  <div className="text-emerald-700 font-medium">
                    معاف کامل از بیمه تأمین اجتماعی و مالیات حقوق
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
