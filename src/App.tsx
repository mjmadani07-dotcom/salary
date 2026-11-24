import { useState } from 'react';
import { YEAR_REGULATIONS } from './data/payrollRegulations';
import { formatMoney, toPersianDigits } from './utils/payrollEngine';
import { UnifiedPayrollProvider, useUnifiedPayroll } from './state/UnifiedPayrollContext';
import { ResearchReportView } from './components/ResearchReportView';
import { PayrollCalculatorView } from './components/PayrollCalculatorView';
import { PayrollRunView } from './components/PayrollRunView';
import { EmployerCostView } from './components/EmployerCostView';
import { EosCompensationView } from './components/EosCompensationView';
import { ApplicabilityMatrixView } from './components/ApplicabilityMatrixView';
import { ExcelVaultView } from './components/ExcelVaultView';

type ActiveTab = 'report' | 'run' | 'calculator' | 'ctc' | 'eos' | 'excel';
type ReportSubView = 'laws' | 'matrix';

function AppShell() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('report');
  const [reportSubView, setReportSubView] = useState<ReportSubView>('laws');
  const { state, computed, updateState } = useUnifiedPayroll();
  const { year, unit } = state;

  const reg = YEAR_REGULATIONS[year];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="bg-white border-b border-slate-200 no-print">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('report');
              setReportSubView('laws');
            }}
            className="text-base md:text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            مرجع حقوق و دستمزد ایران
          </button>

          {/* Zone 2: 5 concise single-line nav links */}
          <nav
            aria-label="ناوبری اصلی"
            className="hidden lg:flex items-center gap-5 text-sm font-medium text-slate-600"
          >
            <button
              type="button"
              onClick={() => setActiveTab('report')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'report'
                  ? 'border-teal-700 text-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              قوانین و مشمولیت
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('run')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'run'
                  ? 'border-teal-700 text-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              پردازش دوره حقوق
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('calculator')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'calculator'
                  ? 'border-teal-700 text-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              فیش حقوقی
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ctc')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'ctc'
                  ? 'border-teal-700 text-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              هزینه کارفرما (CTC)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('eos')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'eos'
                  ? 'border-teal-700 text-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              جبران خدمات EOS
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('excel')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'excel'
                  ? 'border-teal-700 text-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              مرجع فرمول‌ها
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('ctc')}
              className="px-4 py-2 text-xs md:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              محاسبه هزینه کارفرما
            </button>
          </div>
        </div>

        {/* Mobile/Tablet Tab Switcher */}
        <div className="lg:hidden border-t border-slate-200 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          {(
            [
              ['report', 'قوانین و مشمولیت'],
              ['run', 'پردازش دوره'],
              ['calculator', 'فیش حقوقی'],
              ['ctc', 'هزینه کارفرما'],
              ['eos', 'جبران خدمات EOS'],
              ['excel', 'مرجع فرمول‌ها'],
            ] as [ActiveTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Workspace Toolbar (Year, Unit & Unified Live Employee Summary) */}
      <div className="bg-white border-b border-slate-200 no-print">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Fiscal Year Segmented Control */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => updateState({ year: '1405' })}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  year === '1405'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                مصوبه ۱۴۰۵
              </button>
              <button
                type="button"
                onClick={() => updateState({ year: '1404' })}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  year === '1404'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                مصوبه ۱۴۰۴
              </button>
            </div>

            {/* Currency Unit Segmented Control */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => updateState({ unit: 'rial' })}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  unit === 'rial'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ریال
              </button>
              <button
                type="button"
                onClick={() => updateState({ unit: 'toman' })}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  unit === 'toman'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                تومان
              </button>
            </div>

            {/* Report vs Applicability Matrix Sub-Switcher when on Report tab */}
            {activeTab === 'report' && (
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setReportSubView('laws')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    reportSubView === 'laws'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  گزارش قوانین و فرمول‌ها
                </button>
                <button
                  type="button"
                  onClick={() => setReportSubView('matrix')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    reportSubView === 'matrix'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  جدول مشمولیت بیمه و مالیات
                </button>
              </div>
            )}
          </div>

          <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2 tabular-nums">
            <span className="font-semibold text-slate-900">
              پرونده متصل: {state.employeeName || 'پرسنل نمونه'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              خالص دریافتی:{' '}
              <strong className="text-teal-700 font-bold">
                {formatMoney(computed.payrollResult.netPayRial, unit)}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              هزینه کارفرما (CTC):{' '}
              <strong className="text-slate-900 font-bold">
                {formatMoney(computed.totalCtcMonthlyRial, unit)}
              </strong>
            </span>
            <span aria-hidden="true" className="hidden 2xl:inline">
              ·
            </span>
            <span className="hidden 2xl:inline text-slate-500">
              حداقل مزد روزانه {toPersianDigits(year)}: {formatMoney(reg.minDailyWageRial, unit)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'report' && reportSubView === 'laws' && (
          <ResearchReportView
            onNavigateCalculator={() => setActiveTab('calculator')}
            onNavigateCtc={() => setActiveTab('ctc')}
          />
        )}
        {activeTab === 'report' && reportSubView === 'matrix' && (
          <ApplicabilityMatrixView />
        )}
        {activeTab === 'run' && <PayrollRunView />}
        {activeTab === 'calculator' && <PayrollCalculatorView />}
        {activeTab === 'ctc' && <EmployerCostView />}
        {activeTab === 'eos' && <EosCompensationView />}
        {activeTab === 'excel' && <ExcelVaultView />}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-slate-200 bg-white mt-auto no-print">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            مرجع قوانین کار ایران، تحلیل هزینه کارفرما (CTC) و نظام جبران خدمات EOS · منطبق با مصوبات ۱۴۰۴ و ۱۴۰۵
          </div>
          <div>
            تمامی تب‌ها و خروجی اکسل به صورت لحظه‌ای به یک موتور محاسباتی واحد متصل هستند.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <UnifiedPayrollProvider>
      <AppShell />
    </UnifiedPayrollProvider>
  );
}
