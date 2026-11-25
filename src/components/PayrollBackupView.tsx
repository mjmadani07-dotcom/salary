import { useState } from 'react';
import { Download, FileUp, RotateCcw, ShieldCheck } from 'lucide-react';
import {
  exportPayrollDatabaseBackup,
  restorePayrollDatabaseBackup,
  PAYROLL_DATABASE_SCHEMA_VERSION,
} from '../data/payrollLocalDatabase';
import { validatePayrollDatabaseBackup } from '../utils/payrollDatabaseBackup';

const cardClass = 'rounded-xl border border-slate-200 bg-white p-5 sm:p-6';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40';

function downloadJson(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function PayrollBackupView() {
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);

  const createBackup = async () => {
    setExporting(true);
    setFeedback(null);
    try {
      const backup = await exportPayrollDatabaseBackup();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadJson(JSON.stringify(backup, null, 2), `iran-payroll-backup-${timestamp}.json`);
      const totalRecords = Object.values(backup.stores).reduce((sum, records) => sum + records.length, 0);
      setFeedback({
        kind: 'success',
        text: backup.vaultConfigured
          ? `پشتیبان رمزگذاری‌شده ساخته شد؛ ${totalRecords} رکورد از ${Object.keys(backup.stores).length} مخزن صادر شد. برای بازیابی، عبارت عبور همین Vault لازم است.`
          : `پشتیبان ساخته شد؛ ${totalRecords} رکورد صادر شد. چون Vault فعال نیست، فایل شامل اطلاعات شخصی به‌صورت خوانا است؛ آن را در محل امن نگهداری کنید.`,
      });
    } catch (error) {
      setFeedback({ kind: 'error', text: error instanceof Error ? error.message : 'ساخت فایل پشتیبان ناموفق بود.' });
    } finally {
      setExporting(false);
    }
  };

  const restoreBackup = async (file?: File) => {
    if (!file) return;
    setRestoring(true);
    setFeedback(null);
    try {
      if (file.size > 100 * 1024 * 1024) {
        throw new Error('حجم فایل پشتیبان بیشتر از ۱۰۰ مگابایت است.');
      }
      const parsed: unknown = JSON.parse(await file.text());
      const backup = validatePayrollDatabaseBackup(parsed, PAYROLL_DATABASE_SCHEMA_VERSION);
      const recordCount = Object.values(backup.stores).reduce((sum, records) => sum + records.length, 0);
      const securityNote = backup.vaultConfigured
        ? 'این پشتیبان رمزگذاری‌شده است و پس از بازیابی باید با همان عبارت عبور قبلی Vault را باز کنید.'
        : 'این پشتیبان رمزگذاری‌نشده است و اطلاعات شخصی را در خود دارد.';
      const accepted = window.confirm(
        `هشدار: بازیابی، تمام اطلاعات فعلی این نرم‌افزار را جایگزین می‌کند.\n\n` +
        `تاریخ پشتیبان: ${new Date(backup.createdAt).toLocaleString('fa-IR')}\n` +
        `نسخه پایگاه داده: ${backup.sourceDatabaseVersion}\n` +
        `تعداد رکوردها: ${recordCount}\n\n${securityNote}\n\n` +
        'پیش از ادامه، از اطلاعات فعلی نسخه پشتیبان گرفته‌ای؟'
      );
      if (!accepted) {
        setFeedback({ kind: 'info', text: 'بازیابی لغو شد؛ هیچ داده‌ای تغییر نکرد.' });
        return;
      }

      await restorePayrollDatabaseBackup(backup);
      setFeedback({
        kind: 'success',
        text: 'بازیابی کامل شد. نرم‌افزار برای بارگذاری داده‌های بازیابی‌شده دوباره راه‌اندازی می‌شود.',
      });
      window.location.reload();
    } catch (error) {
      setFeedback({ kind: 'error', text: error instanceof Error ? error.message : 'بازیابی فایل پشتیبان ناموفق بود.' });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 h-6 w-6 text-teal-700" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">پشتیبان‌گیری و بازیابی اطلاعات</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              پشتیبان شامل پرونده کارکنان، قراردادها و مزدها، کارکرد، مرخصی، بدهی‌ها، کسورات، Snapshotهای حقوق، پرونده‌های تسویه و تنظیمات رمزگذاری Vault است.
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className={cardClass}>
          <h2 className="font-bold text-slate-900">ساخت فایل پشتیبان</h2>
          <p className="mt-2 text-xs leading-6 text-slate-600">
            همه مخازن پایگاه داده محلی در یک فایل JSON نسخه‌دار صادر می‌شوند. اگر Vault فعال باشد، رکوردها و مشخصات Vault به‌صورت رمزگذاری‌شده ذخیره می‌شوند؛ کلید رمزگشایی داخل فایل قرار نمی‌گیرد.
          </p>
          <button
            type="button"
            className={`${buttonClass} mt-5 bg-slate-900 text-white hover:bg-slate-800`}
            onClick={() => void createBackup()}
            disabled={exporting || restoring}
          >
            <Download className="h-4 w-4" />
            {exporting ? 'در حال ساخت پشتیبان…' : 'دریافت فایل پشتیبان'}
          </button>
        </section>

        <section className={cardClass}>
          <h2 className="font-bold text-slate-900">بازیابی از فایل پشتیبان</h2>
          <p className="mt-2 text-xs leading-6 text-slate-600">
            بازیابی، همه داده‌های فعلی را با داده‌های فایل جایگزین می‌کند. فقط فایل‌های پشتیبان معتبر همین نرم‌افزار و نسخه‌های سازگار پذیرفته می‌شوند. برای بازکردن Vault رمزگذاری‌شده، عبارت عبور همان پشتیبان لازم است.
          </p>
          <label className={`${buttonClass} mt-5 cursor-pointer border border-slate-300 text-slate-700 hover:bg-slate-50`}>
            <FileUp className="h-4 w-4" />
            {restoring ? 'در حال بازیابی…' : 'انتخاب فایل پشتیبان'}
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              disabled={exporting || restoring}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                void restoreBackup(file);
              }}
            />
          </label>
        </section>
      </div>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-2">
          <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" />
          <div className="text-xs leading-6 text-amber-900">
            <strong>نکات مهم:</strong>
            <ul className="mt-1 list-disc space-y-1 pr-4">
              <li>بازیابی، جایگزینی کامل است و داده‌های فعلی را ادغام نمی‌کند.</li>
              <li>در حالت بدون Vault، فایل پشتیبان حاوی اطلاعات شخصی خوانا است؛ آن را مانند اسناد محرمانه نگهداری کنید.</li>
              <li>در حالت Vault، فایل فقط ciphertext و metadata را نگهداری می‌کند؛ عبارت عبور باید جدا از فایل و در محل امن حفظ شود.</li>
              <li>پس از بازیابی، نرم‌افزار دوباره بارگذاری می‌شود و در صورت رمزگذاری، Vault باید دوباره باز شود.</li>
            </ul>
          </div>
        </div>
      </section>

      {feedback && (
        <div className={`rounded-lg border p-3 text-xs leading-6 ${
          feedback.kind === 'error'
            ? 'border-rose-200 bg-rose-50 text-rose-800'
            : feedback.kind === 'success'
              ? 'border-teal-200 bg-teal-50 text-teal-800'
              : 'border-slate-200 bg-slate-50 text-slate-700'
        }`}>
          {feedback.text}
        </div>
      )}
    </div>
  );
}
