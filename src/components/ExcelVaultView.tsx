import { useState } from 'react';
import { Check, Copy, Download, FileSpreadsheet } from 'lucide-react';
import { YEAR_REGULATIONS } from '../data/payrollRegulations';
import { toPersianDigits } from '../utils/payrollEngine';
import { downloadPayrollExcelWorkbook } from '../utils/excelWorkbookBuilder';
import { useUnifiedPayroll } from '../state/UnifiedPayrollContext';

interface CellMapping {
  workDays: string;
  monthDays: string;
  dailyWage: string;
  serviceDays: string;
  dailySeniority: string;
  childrenCount: string;
  insuranceDays: string;
  overtimeHours: string;
  taxableIncome: string;
  insuranceBasis: string;
}

export function ExcelVaultView() {
  const { state, computed } = useUnifiedPayroll();
  const year = state.year;
  const reg = YEAR_REGULATIONS[year];
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [cells, setCells] = useState<CellMapping>({
    workDays: 'B2',
    monthDays: 'C2',
    dailyWage: 'D2',
    serviceDays: 'E2',
    dailySeniority: 'F2',
    childrenCount: 'G2',
    insuranceDays: 'H2',
    overtimeHours: 'I2',
    insuranceBasis: 'J2',
    taxableIncome: 'K2',
  });

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const formulas = [
    {
      id: 'excel-base',
      title: '۱. حقوق پایه ماهانه (تطبیق خودکار ۲۹، ۳۰ و ۳۱ روزه)',
      desc: 'اگر کارکرد کامل باشد متناسب با روزهای ماه، و در صورت کسر کار بر اساس روزهای کارکرد ضرب در مزد روزانه محاسبه می‌شود.',
      formula: `=ROUND(${cells.dailyWage}*MIN(${cells.workDays},${cells.monthDays}), 0)`,
    },
    {
      id: 'excel-seniority',
      title: '۲. پایه سنوات ماهانه (شرط ۳۶۵ روز سابقه در کارگاه)',
      desc: 'تنها در صورتی که سابقه کار در کارگاه به ۳۶۵ روز یا بیشتر رسیده باشد مبلغ پایه سنوات را محاسبه می‌کند.',
      formula: `=IF(${cells.serviceDays}>=365, ROUND(${cells.dailySeniority}*${cells.workDays}, 0), 0)`,
    },
    {
      id: 'excel-housing-coupon',
      title: `۳. حق مسکن و بن کارگری متناسب با کارکرد (${toPersianDigits(year)})`,
      desc: `مجموع حق مسکن (${reg.housingAllowanceRial.toLocaleString('en-US')} ریال) و بن کارگری (${reg.workerCouponRial.toLocaleString('en-US')} ریال) متناسب با روز کارکرد.`,
      formula: `=ROUND(((${reg.housingAllowanceRial}+${reg.workerCouponRial})/${cells.monthDays})*${cells.workDays}, 0)`,
    },
    {
      id: 'excel-child',
      title: `۴. حق اولاد (شرط ۷۲۰ روز بیمه، بدون محدودیت تعداد فرزند - ${toPersianDigits(year)})`,
      desc: `در صورت احراز ۷۲۰ روز سابقه بیمه، به ازای هر فرزند معادل ۳ برابر حداقل دستمزد روزانه (${reg.minDailyWageRial.toLocaleString('en-US')} ریال) اعمال می‌شود.`,
      formula: `=IF(${cells.insuranceDays}>=720, ROUND(${cells.childrenCount}*(3*${reg.minDailyWageRial})*(${cells.workDays}/${cells.monthDays}), 0), 0)`,
    },
    {
      id: 'excel-overtime',
      title: '۵. فوق‌العاده اضافه‌کاری (ضریب ۱۴۰٪ بر مبنای ۲۲۰ ساعت)',
      desc: 'نرخ یک ساعت عادی بر اساس (مزد پایه ۳۰ روزه + پایه سنوات ۳۰ روزه) تقسیم بر ۲۲۰ ساعت و ضربدر ۱.۴ محاسبه می‌شود.',
      formula: `=ROUND((((${cells.dailyWage}+IF(${cells.serviceDays}>=365,${cells.dailySeniority},0))*30)/220)*1.4*${cells.overtimeHours}, 0)`,
    },
    {
      id: 'excel-insurance',
      title: `۶. بیمه تأمین اجتماعی ۷٪ سهم کارگر با سقف ۷ برابر (${toPersianDigits(year)})`,
      desc: 'جمع درآمد مشمول بیمه با سقف قانونی (۷ برابر حداقل مزد روزانه × روزهای ماه) مقایسه شده و ۷٪ از مبلغ کمتر کسر می‌شود.',
      formula: `=ROUND(MIN(${cells.insuranceBasis}, ${reg.minDailyWageRial}*7*${cells.monthDays})*0.07, 0)`,
    },
    {
      id: 'excel-employer-insurance',
      title: `۷. بیمه ۲۳٪ سهم کارفرما (۲۰٪ پایه + ۳٪ بیکاری - ${toPersianDigits(year)})`,
      desc: 'سهم کارفرما شامل ۲۰٪ بیمه عادی و ۳٪ بیمه بیکاری روی همان مبنای سقف‌گذاری‌شده است.',
      formula: `=ROUND(MIN(${cells.insuranceBasis}, ${reg.minDailyWageRial}*7*${cells.monthDays})*0.23, 0)`,
    },
    {
      id: 'excel-tax',
      title: `۸. مالیات پلکانی حقوق ماهانه بر حسب ریال (${toPersianDigits(year)})`,
      desc: 'محاسبه دقیق پلکانی برای نرخ‌های ۰٪، ۱۰٪، ۱۵٪، ۲۰٪، ۲۵٪ و ۳۰٪ با استفاده از تابع MAX/MIN بدون خطای تودرتو.',
      formula:
        year === '1405'
          ? `=ROUND(MAX(0,MIN(${cells.taxableIncome},800000000)-400000000)*0.1+MAX(0,MIN(${cells.taxableIncome},1000000000)-800000000)*0.15+MAX(0,MIN(${cells.taxableIncome},1200000000)-1000000000)*0.2+MAX(0,MIN(${cells.taxableIncome},1400000000)-1200000000)*0.25+MAX(0,${cells.taxableIncome}-1400000000)*0.3, 0)`
          : `=ROUND(MAX(0,MIN(${cells.taxableIncome},300000000)-240000000)*0.1+MAX(0,MIN(${cells.taxableIncome},380000000)-300000000)*0.15+MAX(0,MIN(${cells.taxableIncome},500000000)-380000000)*0.2+MAX(0,MIN(${cells.taxableIncome},666666667)-500000000)*0.25+MAX(0,${cells.taxableIncome}-666666667)*0.3, 0)`,
    },
    {
      id: 'excel-eid',
      title: `۹. عیدی سالانه (حداقل ۶۰ روز فرد تا سقف ۹۰ روز حداقل مزد - ${toPersianDigits(year)})`,
      desc: 'برای کارکرد یک سال کامل و کمتر از آن (بر مبنای روزهای کارکرد سال تقسیم بر ۳۶۵).',
      formula: `=ROUND((MIN(${cells.dailyWage}*60, ${reg.minDailyWageRial}*90)/365)*365, 0)`,
    },
    {
      id: 'excel-severance',
      title: '۱۰. حق سنوات پایان خدمت (به ازای هر روز کارکرد)',
      desc: 'مبنای آخرین پایه حقوق ۳۰ روزه + پایه سنوات ۳۰ روزه تقسیم بر ۳۶۵ روز ضربدر کل روزهای سابقه تسویه.',
      formula: `=ROUND((((${cells.dailyWage}+IF(${cells.serviceDays}>=365,${cells.dailySeniority},0))*30)/365)*${cells.serviceDays}, 0)`,
    },
    {
      id: 'excel-ctc-reserves',
      title: `۱۱. ذخیره ماهانه عیدی، سنوات و بازخرید مرخصی (برای محاسبه CTC - ${toPersianDigits(year)})`,
      desc: 'مجموع ۱/۱۲ عیدی قانونی + ۱/۱۲ آخرین مزد و سنوات + ۲.۱۶۶۷ روز ذخیره مرخصی استحقاقی (۲۶ روز در سال).',
      formula: `=ROUND((MIN(${cells.dailyWage}*60,${reg.minDailyWageRial}*90)/12) + (((${cells.dailyWage}+IF(${cells.serviceDays}>=365,${cells.dailySeniority},0))*30)/12) + (${cells.dailyWage}*(26/12)), 0)`,
    },
    {
      id: 'excel-ctc-total',
      title: '۱۲. هزینه واقعی کل کارفرما (CTC) و ضریب نسبت به خالص دریافتی',
      desc: 'جمع حقوق ناخالص + ۲۳٪ بیمه کارفرما + مجموع ذخایر ماهانه عیدی، سنوات و مرخصی. برای ضریب واقعی، CTC را بر خالص پرداختی تقسیم کنید.',
      formula: '=Gross_Earnings + Employer_Ins_23 + Monthly_Reserves_Total   |   Multiplier = CTC / Net_Pay',
    },
    {
      id: 'excel-eos-scorecard',
      title: '۱۳. پاداش ماهانه اسکورکارد EOS (با پله‌های ۸۰٪ تا ۱۰۵٪+ و شرط GWC)',
      desc: 'تحقق زیر ۸۰٪ = صفر؛ بین ۸۰٪ تا ۹۹٪ = تناسبی؛ ۱۰۰٪ تا ۱۰۴٪ = ۱۰۰٪؛ از ۱۰۵٪ به بالا = ۱۲۵٪ پاداش پایه (مشروط به احراز GWC=1).',
      formula: '=IF(GWC=1, ROUND(Scorecard_Budget * IF(Score_Pct<0.8, 0, IF(Score_Pct<1, Score_Pct, IF(Score_Pct<1.05, 1, 1.25))), 0), 0)',
    },
    {
      id: 'excel-eos-rocks',
      title: '۱۴. پاداش فصلی راک‌های ۹۰ روزه EOS (شرط حد نصاب ۸۰٪ کل سازمان)',
      desc: 'تنها در صورت رسیدن نرخ تکمیل راک‌های کل شرکت به ۸۰٪ یا بیشتر، پاداش فصلی بر اساس تحقق راک فرد آزاد می‌شود.',
      formula: '=IF(AND(GWC=1, Company_Rocks_Pct>=0.8), ROUND(Rock_Budget * Individual_Rocks_Pct, 0), 0)',
    },
  ];

  const handleDownloadCsvTemplate = () => {
    const headers = [
      'نام پرسنل',
      'روز کارکرد',
      'طول ماه',
      'مزد روزانه (ریال)',
      'سابقه کارگاه (روز)',
      'پایه سنوات روزانه (ریال)',
      'تعداد فرزند',
      'کل سابقه بیمه (روز)',
      'ساعات اضافه کاری',
      'حقوق پایه محاسبه شده',
      'پایه سنوات ماهانه',
      'حق مسکن و بن',
      'حق اولاد',
      'اضافه کاری',
      'جمع مشمول بیمه',
      'بیمه کارگر ۷ درصد',
      'جمع مشمول مالیات',
      'مالیات پلکانی',
      'خالص پرداختی به کارمند',
      'بیمه ۲۳ درصد کارفرما',
      'ذخیره ماهانه عیدی، سنوات و مرخصی',
      'هزینه واقعی کل کارفرما (CTC)',
      'ضریب واقعی هزینه به خالص',
    ];

    const row2 = [
      'نمونه پرسنل ۱',
      '30',
      '30',
      String(reg.minDailyWageRial),
      '400',
      String(reg.baseSeniorityDaily1YrRial),
      '1',
      '900',
      '10',
      '=ROUND(D2*MIN(B2,C2),0)',
      '=IF(E2>=365,ROUND(F2*B2,0),0)',
      `=ROUND(((${reg.housingAllowanceRial}+${reg.workerCouponRial})/C2)*B2,0)`,
      `=IF(H2>=720,ROUND(G2*(3*${reg.minDailyWageRial})*(B2/C2),0),0)`,
      '=ROUND((((D2+IF(E2>=365,F2,0))*30)/220)*1.4*I2,0)',
      '=J2+K2+L2+N2',
      `=ROUND(MIN(O2,${reg.minDailyWageRial}*7*C2)*0.07,0)`,
      '=J2+K2+N2',
      year === '1405'
        ? '=ROUND(MAX(0,MIN(Q2,800000000)-400000000)*0.1+MAX(0,MIN(Q2,1000000000)-800000000)*0.15+MAX(0,MIN(Q2,1200000000)-1000000000)*0.2+MAX(0,MIN(Q2,1400000000)-1200000000)*0.25+MAX(0,Q2-1400000000)*0.3,0)'
        : '=ROUND(MAX(0,MIN(Q2,300000000)-240000000)*0.1+MAX(0,MIN(Q2,380000000)-300000000)*0.15+MAX(0,MIN(Q2,500000000)-380000000)*0.2+MAX(0,MIN(Q2,666666667)-500000000)*0.25+MAX(0,Q2-666666667)*0.3,0)',
      '=J2+K2+L2+M2+N2-P2-R2',
      `=ROUND(MIN(O2,${reg.minDailyWageRial}*7*C2)*0.23,0)`,
      `=ROUND((MIN(D2*60,${reg.minDailyWageRial}*90)/12)+(((D2+IF(E2>=365,F2,0))*30)/12)+(D2*(26/12)),0)`,
      '=J2+K2+L2+M2+N2+T2+U2',
      '=ROUND(V2/S2,2)',
    ];

    const csvContent =
      '\uFEFF' + [headers.join(','), row2.map((c) => `"${c}"`).join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payroll-ctc-iran-${year}-template.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <section className="border border-slate-200 bg-white rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">
              فرمول‌های مرجع برای استفاده مستقل در Excel و Google Sheets · سال {toPersianDigits(year)}
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900">
              کتابخانه فرمول‌های مرجع اکسل
            </h2>
            <p className="text-sm text-slate-600">
              فرمول‌های این بخش فقط برای کپی و استفاده مستقل در Excel یا Google Sheets هستند و در محاسبات نرم‌افزار اجرا نمی‌شوند. فیش، بیمه، مالیات، CTC و فایل XLSX خروجی از موتور مرکزی TypeScript تولید می‌شوند.
            </p>
            <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 p-3 text-xs leading-6 text-teal-900">
              <strong>تفکیک مهم:</strong> فرمول‌های نمایشی و قابل کپی این کتابخانه، موتور محاسبات نرم‌افزار نیستند. فایل XLSX خروجی از نتایج محاسبه جاری ساخته می‌شود و فرمول حقوق، بیمه یا مالیات موازی ندارد.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
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
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>خروجی Excel از محاسبه جاری (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadCsvTemplate}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>فایل CSV</span>
            </button>
          </div>
        </div>

        {/* Cell Mapping Customizer */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="text-xs font-semibold text-slate-700">
            تطبیق نام ستون/سلول با فایل اکسل شما (پیش‌فرض: ردیف ۲):
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {(
              [
                ['workDays', 'روز کارکرد'],
                ['monthDays', 'طول ماه'],
                ['dailyWage', 'مزد روزانه'],
                ['serviceDays', 'سابقه (روز)'],
                ['dailySeniority', 'سنوات روزانه'],
                ['childrenCount', 'تعداد فرزند'],
                ['insuranceDays', 'سابقه بیمه'],
                ['overtimeHours', 'ساعت اضافه‌کار'],
                ['insuranceBasis', 'جمع مشمول بیمه'],
                ['taxableIncome', 'جمع مشمول مالیات'],
              ] as [keyof CellMapping, string][]
            ).map(([field, label]) => (
              <div key={field} className="space-y-1">
                <label className="text-xs text-slate-500 block">{label}</label>
                <input
                  type="text"
                  value={cells[field]}
                  onChange={(e) =>
                    setCells((prev) => ({
                      ...prev,
                      [field]: e.target.value.toUpperCase() || 'A2',
                    }))
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-mono-code bg-white border border-slate-200 rounded-md focus:outline-none focus:border-teal-700"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Formulas List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {formulas.map((f) => (
            <div
              key={f.id}
              className="border border-slate-200 rounded-xl p-5 bg-white flex flex-col justify-between gap-3"
            >
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">{f.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
              <div className="space-y-2 pt-2">
                <div className="font-mono-code text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
                  {f.formula}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleCopy(f.id, f.formula)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-900 px-2.5 py-1 rounded hover:bg-teal-50 transition-colors cursor-pointer"
                  >
                    {copiedKey === f.id ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>کپی شد</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>کپی فرمول</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
