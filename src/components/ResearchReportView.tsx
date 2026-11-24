import { useState } from 'react';
import { Check, Copy, BookOpen, Calculator, FileSpreadsheet } from 'lucide-react';
import {
  LEGACY_AUDIT_POINTS,
  RESEARCH_SECTION_1,
  YEAR_REGULATIONS,
} from '../data/payrollRegulations';
import { formatMoney, formatPercentFa, toPersianDigits } from '../utils/payrollEngine';
import { downloadPayrollExcelWorkbook } from '../utils/excelWorkbookBuilder';
import { useUnifiedPayroll } from '../state/UnifiedPayrollContext';

interface ResearchReportViewProps {
  onNavigateCalculator: () => void;
  onNavigateCtc: () => void;
}

export function ResearchReportView({
  onNavigateCalculator,
  onNavigateCtc,
}: ResearchReportViewProps) {
  const { state, computed } = useUnifiedPayroll();
  const { year, unit } = state;
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeAnchor, setActiveAnchor] = useState<string>('section-1');
  const reg = YEAR_REGULATIONS[year];

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
    } catch {
      // Fallback ignored in restricted frames
    }
  };

  const insuranceCeiling30 =
    reg.minDailyWageRial * reg.insuranceCeilingMultiplier * 30;
  const insuranceCeiling31 =
    reg.minDailyWageRial * reg.insuranceCeilingMultiplier * 31;
  const insuranceCeiling29 =
    reg.minDailyWageRial * reg.insuranceCeilingMultiplier * 29;

  const taxExcelFormula1405 =
    '=MAX(0, MIN(A2, 800000000)-400000000)*0.1 + MAX(0, MIN(A2, 1000000000)-800000000)*0.15 + MAX(0, MIN(A2, 1200000000)-1000000000)*0.2 + MAX(0, MIN(A2, 1400000000)-1200000000)*0.25 + MAX(0, A2-1400000000)*0.3';
  const taxExcelFormula1404 =
    '=MAX(0, MIN(A2, 300000000)-240000000)*0.1 + MAX(0, MIN(A2, 380000000)-300000000)*0.15 + MAX(0, MIN(A2, 500000000)-380000000)*0.2 + MAX(0, MIN(A2, 666666667)-500000000)*0.25 + MAX(0, A2-666666667)*0.3';
  const activeTaxFormula = year === '1405' ? taxExcelFormula1405 : taxExcelFormula1404;

  const insuranceExcelFormula =
    year === '1405'
      ? '=ROUND(MIN(B2, 5541850 * 7 * C2) * 0.07, 0)'
      : '=ROUND(MIN(B2, 3463656 * 7 * C2) * 0.07, 0)';

  const jumpTo = (id: string) => {
    setActiveAnchor(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-8">
      {/* Executive Summary Banner */}
      <section className="border border-slate-200 bg-white rounded-xl p-6 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="text-xs font-medium text-slate-500 flex flex-wrap items-center gap-2">
              <span>گزارش پژوهشی رسمی</span>
              <span aria-hidden="true">·</span>
              <span>قانون کار ایران</span>
              <span aria-hidden="true">·</span>
              <span>بخشنامه‌های سازمان تأمین اجتماعی و قانون بودجه {toPersianDigits(year)}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight text-balance">
              قوانین، الزامات و فرمول‌های محاسباتی حقوق و دستمزد ایران
            </h1>
            <p className="text-sm md:text-base text-slate-600 leading-relaxed">
              مجموعه کامل ضوابط قانونی شورای عالی کار، فرمول‌های ریاضی دقیق و الگوریتم‌های آماده اکسل برای محاسبه حقوق پایه (۲۹، ۳۰ و ۳۱ روزه)، مزایای مستمر و رفاهی، حق بیمه ۳۰ درصدی و مالیات پلکانی حقوق.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() =>
                void downloadPayrollExcelWorkbook({
                  employeeName: state.employeeName || 'پرسنل تنظیم‌شده شما',
                  periodLabel: `سال ${year} · ماه ${computed.payrollInput.monthDays} روزه`,
                  input: computed.payrollInput,
                  result: computed.payrollResult,
                  eos: {
                    seatName: state.employeeName || 'پرسنل تنظیم‌شده شما',
                    isGwcQualified: computed.isGwcQualified,
                    seatMonthlyBaseRial: computed.payrollInput.dailyBaseWageRial * 30,
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
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-teal-700" />
              <span>دانلود فایل اکسل کامل (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={onNavigateCalculator}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Calculator className="w-4 h-4" />
              <span>اجرای محاسبه در فیش حقوقی</span>
            </button>
          </div>
        </div>

        {/* 4-column Key Regulation Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-200">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">حداقل حقوق پایه ۳۰ روزه ({toPersianDigits(year)})</div>
            <div className="text-lg font-bold text-slate-900 tabular-nums">
              {formatMoney(reg.minMonthlyWage30Rial, unit)}
            </div>
            <div className="text-xs text-slate-500 tabular-nums">
              روزانه: {formatMoney(reg.minDailyWageRial, unit)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-500">حق مسکن + بن کارگری</div>
            <div className="text-lg font-bold text-slate-900 tabular-nums">
              {formatMoney(reg.housingAllowanceRial + reg.workerCouponRial, unit)}
            </div>
            <div className="text-xs text-slate-500 tabular-nums">
              مسکن {formatMoney(reg.housingAllowanceRial, unit)} · بن {formatMoney(reg.workerCouponRial, unit)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-500">سقف دستمزد مشمول بیمه (ماه ۳۰ روزه)</div>
            <div className="text-lg font-bold text-slate-900 tabular-nums">
              {formatMoney(insuranceCeiling30, unit)}
            </div>
            <div className="text-xs text-slate-500">۷ برابر حداقل دستمزد روزانه × روزهای ماه</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-500">سقف معافیت مالیاتی ماهانه</div>
            <div className="text-lg font-bold text-teal-700 tabular-nums">
              {formatMoney(reg.taxMonthlyExemptionRial, unit)}
            </div>
            <div className="text-xs text-slate-500 tabular-nums">
              سالانه: {formatMoney(reg.taxAnnualExemptionRial, unit)}
            </div>
          </div>
        </div>
      </section>

      {/* Section Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => jumpTo('section-1')}
          className={`px-3.5 py-2 text-xs md:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeAnchor === 'section-1'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
          }`}
        >
          بخش ۱: مزایا و آیتم‌های حکم حقوقی
        </button>
        <button
          type="button"
          onClick={() => jumpTo('section-2-insurance')}
          className={`px-3.5 py-2 text-xs md:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeAnchor === 'section-2-insurance'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
          }`}
        >
          بخش ۲-الف: بیمه تأمین اجتماعی و سقف کسر
        </button>
        <button
          type="button"
          onClick={() => jumpTo('section-2-tax')}
          className={`px-3.5 py-2 text-xs md:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeAnchor === 'section-2-tax'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
          }`}
        >
          بخش ۲-ب: مالیات پلکانی بر درآمد حقوق
        </button>
        <button
          type="button"
          onClick={() => jumpTo('section-audit')}
          className={`px-3.5 py-2 text-xs md:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeAnchor === 'section-audit'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
          }`}
        >
          راستی‌آزمایی پیش‌نویس‌های قدیمی و CTC
        </button>
      </div>

      {/* SECTION 1: Mandatory Items */}
      <section id="section-1" className="space-y-5 scroll-mt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              ۱. مزایا و آیتم‌های اجباری حکم حقوقی (قانون کار ایران)
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              تحلیل حقوقی، نرخ‌های مصوب رسمی و فرمول‌های ریاضی و اکسل برای هشت رکن اصلی محاسبه دستمزد
            </p>
          </div>
          <BookOpen className="w-5 h-5 text-slate-400 shrink-0 hidden sm:block" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {RESEARCH_SECTION_1.map((item) => (
            <article
              key={item.id}
              className="border border-slate-200 bg-white rounded-xl p-6 flex flex-col justify-between gap-5"
            >
              <div className="space-y-3">
                <div className="text-xs text-slate-500 flex items-center justify-between gap-2">
                  <span>{item.legalRef}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {item.index}. {item.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {item.summary}
                </p>
                <ul className="space-y-2 pt-1">
                  {item.details.map((point, idx) => (
                    <li
                      key={idx}
                      className="text-xs md:text-sm text-slate-700 leading-relaxed flex items-start gap-2"
                    >
                      <span className="text-teal-700 font-bold select-none mt-0.5">—</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-200">
                {/* Official Rates Comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-slate-500 block">نرخ مصوب ۱۴۰۵:</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {item.ratesByYear.y1405}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">نرخ مصوب ۱۴۰۴:</span>
                    <span className="font-medium text-slate-700 tabular-nums">
                      {item.ratesByYear.y1404}
                    </span>
                  </div>
                </div>

                {/* Math Formula */}
                <div className="space-y-1">
                  <div className="text-xs font-medium text-slate-500">فرمول ریاضی:</div>
                  <div className="font-mono-code text-xs bg-slate-900 text-slate-100 px-3 py-2.5 rounded-lg overflow-x-auto">
                    {item.mathFormula}
                  </div>
                </div>

                {/* Excel Formula */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500">فرمول آماده اکسل:</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(item.id, item.excelFormula)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-900 px-2 py-1 rounded hover:bg-teal-50 transition-colors cursor-pointer"
                    >
                      {copiedId === item.id ? (
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
                    {item.excelFormula}
                  </div>
                  <div className="text-xs text-slate-500">{item.excelLegend}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* SECTION 2A: Social Security Insurance */}
      <section
        id="section-2-insurance"
        className="border border-slate-200 bg-white rounded-xl p-6 md:p-8 space-y-6 scroll-mt-6"
      >
        <div className="space-y-1">
          <div className="text-xs text-slate-500">
            ماده ۲۸ و ۳۹ قانون تأمین اجتماعی · قانون بیمه بیکاری
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            ۲-الف. بیمه تأمین اجتماعی (سهم کارگر، کارفرما و سقف ماهانه)
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            نرخ کل حق بیمه تأمین اجتماعی برابر با ۳۰٪ از مجموع دستمزد و مزایای مشمول بیمه (تا سقف ۷ برابر حداقل دستمزد قانونی) است. حق بیمه بیکاری (۳٪) در قالب سهم ۲۳ درصدی کارفرما پرداخت می‌شود.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-1">
            <div className="text-xs text-slate-500">سهم بیمه کارگر (کسر از حقوق)</div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">۷٪</div>
            <div className="text-xs text-slate-600">
              از خالص حقوق پرسنل کسر و به سازمان تأمین اجتماعی واریز می‌شود.
            </div>
          </div>
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-1">
            <div className="text-xs text-slate-500">سهم بیمه کارفرما (پایه)</div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">۲۰٪</div>
            <div className="text-xs text-slate-600">
              تعهد کارفرما به عنوان هزینه پرسنلی؛ از حقوق کارگر کسر نمی‌شود.
            </div>
          </div>
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-1">
            <div className="text-xs text-slate-500">سهم بیمه بیکاری (عهده کارفرما)</div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">۳٪</div>
            <div className="text-xs text-slate-600">
              مجموع تعهد کارفرما: ۲۳٪ (۲۰٪ پایه + ۳٪ بیکاری) و جمع کل لیست بیمه: ۳۰٪.
            </div>
          </div>
        </div>

        {/* Ceiling Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">نوع ماه تقویمی</th>
                <th className="py-3 px-4 font-semibold">فرمول سقف درآمد مشمول بیمه</th>
                <th className="py-3 px-4 font-semibold">سقف حقوق مشمول ({toPersianDigits(year)})</th>
                <th className="py-3 px-4 font-semibold">حداکثر حق بیمه ۷٪ کارگر</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 font-medium text-slate-900">ماه‌های ۳۱ روزه (نیمه اول سال)</td>
                <td className="py-3 px-4 font-mono-code text-xs text-slate-700">
                  MinDailyWage × 7 × 31
                </td>
                <td className="py-3 px-4 tabular-nums font-semibold text-slate-900">
                  {formatMoney(insuranceCeiling31, unit)}
                </td>
                <td className="py-3 px-4 tabular-nums text-teal-700 font-semibold">
                  {formatMoney(Math.round(insuranceCeiling31 * 0.07), unit)}
                </td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 font-medium text-slate-900">ماه‌های ۳۰ روزه (نیمه دوم و اسفند کبیسه)</td>
                <td className="py-3 px-4 font-mono-code text-xs text-slate-700">
                  MinDailyWage × 7 × 30
                </td>
                <td className="py-3 px-4 tabular-nums font-semibold text-slate-900">
                  {formatMoney(insuranceCeiling30, unit)}
                </td>
                <td className="py-3 px-4 tabular-nums text-teal-700 font-semibold">
                  {formatMoney(Math.round(insuranceCeiling30 * 0.07), unit)}
                </td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 font-medium text-slate-900">ماه ۲۹ روزه (اسفند غیرکبیسه)</td>
                <td className="py-3 px-4 font-mono-code text-xs text-slate-700">
                  MinDailyWage × 7 × 29
                </td>
                <td className="py-3 px-4 tabular-nums font-semibold text-slate-900">
                  {formatMoney(insuranceCeiling29, unit)}
                </td>
                <td className="py-3 px-4 tabular-nums text-teal-700 font-semibold">
                  {formatMoney(Math.round(insuranceCeiling29 * 0.07), unit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              فرمول اکسل محاسبه حق بیمه ۷٪ کارگر با اعمال سقف قانونی ({toPersianDigits(year)}):
            </span>
            <button
              type="button"
              onClick={() => handleCopy('ins-formula', insuranceExcelFormula)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-900 px-2 py-1 rounded hover:bg-teal-50 transition-colors cursor-pointer"
            >
              {copiedId === 'ins-formula' ? (
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
            {insuranceExcelFormula}
          </div>
          <div className="text-xs text-slate-500">
            B2: جمع حقوق و مزایای مشمول بیمه ماه | C2: تعداد روزهای ماه (۲۹، ۳۰ یا ۳۱) — برای سهم ۲۳٪ کارفرما ضریب 0.07 را به 0.23 تغییر دهید.
          </div>
        </div>
      </section>

      {/* SECTION 2B: Progressive Income Tax */}
      <section
        id="section-2-tax"
        className="border border-slate-200 bg-white rounded-xl p-6 md:p-8 space-y-6 scroll-mt-6"
      >
        <div className="space-y-1">
          <div className="text-xs text-slate-500">
            مواد ۸۲ تا ۸۶ قانون مالیات‌های مستقیم · قانون بودجه کل کشور سال {toPersianDigits(year)}
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            ۲-ب. مالیات بر درآمد حقوق و جدول پله‌های پلکانی ({toPersianDigits(year)})
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            مالیات حقوق در ایران به‌صورت «پلکانی تصاعدی» محاسبه می‌شود؛ به این معنا که نرخ هر پله صرفاً نسبت به مازاد درآمد قرارگرفته در همان بازه اعمال می‌گردد و کل درآمد با نرخ پله آخر ضرب نمی‌شود.
          </p>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">عنوان پله</th>
                <th className="py-3 px-4 font-semibold">بازه درآمد ماهانه</th>
                <th className="py-3 px-4 font-semibold">بازه درآمد سالانه</th>
                <th className="py-3 px-4 font-semibold">نرخ مالیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {reg.taxBrackets.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-medium text-slate-900">{b.label}</td>
                  <td className="py-3 px-4 tabular-nums text-slate-700">
                    {b.minMonthlyRial === 0
                      ? `تا ${formatMoney(b.maxMonthlyRial!, unit)}`
                      : b.maxMonthlyRial
                      ? `از ${formatMoney(b.minMonthlyRial, unit)} تا ${formatMoney(b.maxMonthlyRial, unit)}`
                      : `مازاد بر ${formatMoney(b.minMonthlyRial, unit)}`}
                  </td>
                  <td className="py-3 px-4 tabular-nums text-slate-700">
                    {b.minMonthlyRial === 0
                      ? `تا ${formatMoney(b.maxMonthlyRial! * 12, unit)}`
                      : b.maxMonthlyRial
                      ? `از ${formatMoney(b.minMonthlyRial * 12, unit)} تا ${formatMoney(b.maxMonthlyRial * 12, unit)}`
                      : `مازاد بر ${formatMoney(b.minMonthlyRial * 12, unit)}`}
                  </td>
                  <td className="py-3 px-4 tabular-nums font-bold text-slate-900">
                    {b.rate === 0 ? '۰٪ (معاف)' : formatPercentFa(b.rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              فرمول اکسل پلکانی مالیات حقوق ماهانه بر حسب ریال ({toPersianDigits(year)}):
            </span>
            <button
              type="button"
              onClick={() => handleCopy('tax-formula', activeTaxFormula)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-900 px-2 py-1 rounded hover:bg-teal-50 transition-colors cursor-pointer"
            >
              {copiedId === 'tax-formula' ? (
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
          <div className="font-mono-code text-xs bg-slate-900 text-slate-100 px-3 py-3 rounded-lg overflow-x-auto">
            {activeTaxFormula}
          </div>
          <div className="text-xs text-slate-500">
            A2: جمع درآمد مشمول مالیات ماه (بر حسب ریال). این فرمول دقیقاً معادل پله‌های مالیاتی بدون نیاز به IF تودرتوی پیچیده است و در تمام نسخه‌های اکسل بدون خطا اجرا می‌شود.
          </div>
        </div>
      </section>

      {/* SECTION AUDIT: Verification of Older Drafts & CTC Integration */}
      <section
        id="section-audit"
        className="border border-slate-200 bg-white rounded-xl p-6 md:p-8 space-y-5 scroll-mt-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">
              تدقیق حقوقی اسناد پژوهشی · مقایسه مصوبات ۱۴۰۲–۱۴۰۳ با قوانین ۱۴۰۴–۱۴۰۵
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              راستی‌آزمایی نکات و فرمول‌های اسناد ارسالی (به‌روزرسانی و CTC)
            </h2>
            <p className="text-sm text-slate-600">
              بخش‌های تحلیلی هزینه واقعی کارفرما (CTC) به سامانه اضافه شد و ارقام منسوخ‌شده سال‌های قبل با آخرین بخشنامه‌های سال ۱۴۰۵ جایگزین گردید.
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateCtc}
            className="px-4 py-2 text-xs md:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            مشاهده محاسبه‌گر هزینه کارفرما (CTC)
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs md:text-sm text-right">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold min-w-[180px]">موضوع بررسی</th>
                <th className="py-3 px-4 font-semibold min-w-[240px]">وضعیت در متن ارسالی</th>
                <th className="py-3 px-4 font-semibold min-w-[260px]">وضعیت صحیح و به‌روز ({toPersianDigits(year)})</th>
                <th className="py-3 px-4 font-semibold">نتیجه</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {LEGACY_AUDIT_POINTS.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 align-top">
                  <td className="py-3.5 px-4 font-semibold text-slate-900">{row.topic}</td>
                  <td className="py-3.5 px-4 text-slate-600 leading-relaxed">{row.outdatedClaim}</td>
                  <td className="py-3.5 px-4 text-slate-800 leading-relaxed">{row.currentStatus}</td>
                  <td className="py-3.5 px-4 font-semibold whitespace-nowrap">
                    <span
                      className={
                        row.verdict === 'افزوده شد'
                          ? 'text-teal-700'
                          : row.verdict === 'تصحیح حقوقی'
                          ? 'text-amber-700'
                          : 'text-rose-700'
                      }
                    >
                      {row.verdict}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
