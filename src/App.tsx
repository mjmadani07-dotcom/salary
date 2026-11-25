import { useState } from 'react';
import { EmployeeDirectoryView } from './components/EmployeeDirectoryView';
import { PayrollRunView } from './components/PayrollRunView';
import { PayrollReportsView } from './components/PayrollReportsView';
import { PayrollBackupView } from './components/PayrollBackupView';
import { EmployeeDebtLedgerView } from './components/EmployeeDebtLedgerView';
import { UnifiedPayrollProvider, useUnifiedPayroll } from './state/UnifiedPayrollContext';

type ActiveTab = 'employees' | 'run' | 'reports' | 'debts' | 'backup';

const NAV_ITEMS: Array<{ id: ActiveTab; label: string }> = [
  { id: 'employees', label: 'کارکنان' },
  { id: 'run', label: 'حقوق ماهانه' },
  { id: 'reports', label: 'گزارش و خروجی' },
  { id: 'debts', label: 'دفتر بدهی و کسورات' },
  { id: 'backup', label: 'پشتیبان‌گیری' },
];

function AppShell() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('run');
  const { state, updateState } = useUnifiedPayroll();
  const { year, unit } = state;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 no-print">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 min-h-16 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 py-3">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('run')}
              className="text-base md:text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap"
            >
              حقوق و هزینه کارکنان
            </button>
            <div className="flex items-center gap-2 lg:hidden">
              <span className="text-xs text-slate-500">سال {year}</span>
            </div>
          </div>

          <nav aria-label="ناوبری اصلی" className="flex items-center gap-2 overflow-x-auto">
            {NAV_ITEMS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                aria-current={activeTab === id ? 'page' : undefined}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  activeTab === id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="bg-white border-b border-slate-200 no-print">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">سال محاسبات</span>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => updateState({ year: '1405' })}
                aria-pressed={year === '1405'}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  year === '1405' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ۱۴۰۵
              </button>
              <button
                type="button"
                onClick={() => updateState({ year: '1404' })}
                aria-pressed={year === '1404'}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  year === '1404' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ۱۴۰۴
              </button>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200" aria-hidden="true" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">واحد مبلغ</span>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => updateState({ unit: 'rial' })}
                aria-pressed={unit === 'rial'}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  unit === 'rial' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ریال
              </button>
              <button
                type="button"
                onClick={() => updateState({ unit: 'toman' })}
                aria-pressed={unit === 'toman'}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  unit === 'toman' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                تومان
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {activeTab === 'employees' && <EmployeeDirectoryView />}
        {activeTab === 'run' && <PayrollRunView onNavigateToEmployees={() => setActiveTab('employees')} />}
        {activeTab === 'reports' && (
          <PayrollReportsView onNavigateToPayroll={() => setActiveTab('run')} />
        )}
        {activeTab === 'debts' && <EmployeeDebtLedgerView />}
        {activeTab === 'backup' && <PayrollBackupView />}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-auto no-print">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>سامانه محلی محاسبه حقوق، خالص دریافتی و هزینه کارفرما (CTC)</span>
          <span>تمام محاسبات از موتور مرکزی و داده‌های ذخیره‌شده روی همین دستگاه انجام می‌شوند.</span>
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
