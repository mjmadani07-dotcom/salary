import { useMemo, useState } from 'react';
import { Search, CheckCircle2, ShieldAlert, Scale } from 'lucide-react';
import {
  APPLICABILITY_MATRIX,
  ApplicabilityStatus,
} from '../data/payrollRegulations';
import { toPersianDigits } from '../utils/payrollEngine';

type MatrixFilter = 'all' | 'insurance-included' | 'tax-exempt' | 'both-included';

function StatusText({
  status,
  label,
}: {
  status: ApplicabilityStatus;
  label: string;
}) {
  if (status === 'included') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700">
        <Scale className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }
  if (status === 'exempt') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
}

export function ApplicabilityMatrixView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<MatrixFilter>('all');

  const filteredItems = useMemo(() => {
    return APPLICABILITY_MATRIX.filter((item) => {
      const matchesSearch =
        !searchQuery.trim() ||
        item.title.includes(searchQuery.trim()) ||
        item.legalBasis.includes(searchQuery.trim()) ||
        item.category.includes(searchQuery.trim());

      if (!matchesSearch) return false;

      if (filter === 'insurance-included') {
        return item.insuranceStatus === 'included';
      }
      if (filter === 'tax-exempt') {
        return item.taxStatus === 'exempt' || item.taxStatus === 'conditional';
      }
      if (filter === 'both-included') {
        return (
          item.insuranceStatus === 'included' && item.taxStatus === 'included'
        );
      }
      return true;
    });
  }, [searchQuery, filter]);

  return (
    <div className="space-y-6">
      <section className="border border-slate-200 bg-white rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">
              تطبیق قانون تأمین اجتماعی · قانون مالیات‌های مستقیم · آرای دیوان عدالت اداری
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900">
              ۳. جدول تفکیکی مشمولیت بیمه و مالیات بر درآمد حقوق
            </h2>
            <p className="text-sm text-slate-600">
              بررسی دقیق وضعیت شمول یا معافیت هر یک از اقلام فیش حقوقی از کسر حق بیمه (۳۰٪) و مالیات پلکانی حقوق
            </p>
          </div>

          <div className="text-xs text-slate-500 tabular-nums shrink-0">
            نمایش {toPersianDigits(filteredItems.length)} از {toPersianDigits(APPLICABILITY_MATRIX.length)} آیتم حقوقی
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی عنوان آیتم یا مستند قانونی (مثلاً: عیدی، مسکن، آکورد)..."
              className="w-full pr-9 pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              همه آیتم‌ها
            </button>
            <button
              type="button"
              onClick={() => setFilter('both-included')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filter === 'both-included'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              مشمول هر دو
            </button>
            <button
              type="button"
              onClick={() => setFilter('insurance-included')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filter === 'insurance-included'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              مشمول بیمه
            </button>
            <button
              type="button"
              onClick={() => setFilter('tax-exempt')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filter === 'tax-exempt'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              معاف / مشروط مالیاتی
            </button>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          {filteredItems.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <div className="text-sm font-medium text-slate-700">
                هیچ آیتمی مطابق جستجوی شما یافت نشد.
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilter('all');
                }}
                className="px-4 py-2 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors cursor-pointer"
              >
                پاک‌کردن فیلترها
              </button>
            </div>
          ) : (
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 font-semibold min-w-[200px]">آیتم حقوقی</th>
                  <th className="py-3.5 px-4 font-semibold min-w-[210px]">بیمه تأمین اجتماعی (۳۰٪)</th>
                  <th className="py-3.5 px-4 font-semibold min-w-[220px]">مالیات بر درآمد حقوق</th>
                  <th className="py-3.5 px-4 font-semibold min-w-[220px]">مستند قانونی و نکته اکسل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 align-top">
                    <td className="py-4 px-4 space-y-1">
                      <div className="font-bold text-slate-900">{item.title}</div>
                      <div className="text-xs text-slate-500">{item.category}</div>
                    </td>
                    <td className="py-4 px-4 space-y-1.5">
                      <StatusText
                        status={item.insuranceStatus}
                        label={item.insuranceLabel}
                      />
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {item.insuranceRule}
                      </p>
                    </td>
                    <td className="py-4 px-4 space-y-1.5">
                      <StatusText status={item.taxStatus} label={item.taxLabel} />
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {item.taxRule}
                      </p>
                    </td>
                    <td className="py-4 px-4 space-y-1.5">
                      <div className="text-xs font-medium text-slate-700">
                        {item.legalBasis}
                      </div>
                      <div className="text-xs text-slate-500 leading-relaxed font-mono-code text-right" dir="rtl">
                        {item.excelNote}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
