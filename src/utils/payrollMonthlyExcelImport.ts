export const PAYROLL_MONTHLY_EXCEL_HEADERS = [
  'شناسه فیش*',
  'سال',
  'ماه',
  'کد پرسنلی*',
  'روزهای ماه',
  'روز کارکرد',
  'مرخصی استحقاقی',
  'استعلاجی',
  'غیبت بدون حقوق',
  'اضافه‌کاری ساعت',
  'شب‌کاری ساعت',
  'جمعه‌کاری ساعت',
  'مأموریت روز',
  'مزایای مشمول بیمه',
  'مزایای غیرمشمول',
  'پاداش',
  'وام/قسط',
  'مساعده',
  'سایر کسورات',
  'اصلاح حقوق +/-',
  'تاریخ پرداخت',
  'یادداشت',
] as const;

export interface ImportedPayrollMonthlyRow {
  sourceRow: number;
  payslipId: string;
  year: '1404' | '1405';
  month: number;
  personnelCode: string;
  monthDays: 29 | 30 | 31;
  workDays: number;
  paidLeaveDays: number;
  sickLeaveDays: number;
  unpaidAbsenceDays: number;
  overtimeHours: number;
  nightShiftHours: number;
  fridayHours: number;
  missionDays: number;
  insuredBenefitsRial: number;
  nonInsuredBenefitsRial: number;
  variableBonusRial: number;
  loanDeductionRial: number;
  advanceDeductionRial: number;
  otherDeductionsRial: number;
  signedCorrectionRial: number;
  paymentDate: string;
  notes: string;
}

export interface PayrollMonthlyExcelParseResult {
  rows: ImportedPayrollMonthlyRow[];
  errors: string[];
  ignoredBlankRows: number;
  headerDetected: boolean;
}

function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

function normalizeHeader(value: string): string {
  return normalizeDigits(value)
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[\s\u200c\u200f\u200e]/g, '')
    .trim();
}

function parseNumber(value: string, fieldName: string, sourceRow: number, errors: string[], required = false): number {
  const normalized = normalizeDigits(value)
    .trim()
    .replace(/[٬,]/g, '')
    .replace(/٫/g, '.')
    .replace(/[\s\u200c\u200f\u200e]/g, '');
  if (!normalized) {
    if (required) errors.push(`ردیف ${sourceRow}: مقدار «${fieldName}» الزامی است.`);
    return 0;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    errors.push(`ردیف ${sourceRow}: مقدار «${fieldName}» عدد معتبر نیست.`);
    return 0;
  }
  return parsed;
}

function isBlankTemplateRow(cells: string[]): boolean {
  if ((cells[0] ?? '').trim() || (cells[3] ?? '').trim()) return false;
  return cells.slice(1, 22).every((value, index) => {
    const trimmed = normalizeDigits(value).trim();
    if (!trimmed) return true;
    // A formatted Excel template pre-fills year, month and month length with defaults.
    if ([0, 1, 3].includes(index) && Number(trimmed) > 0) return true;
    const numeric = Number(trimmed.replace(/[٬,]/g, '').replace(/٫/g, '.'));
    return Number.isFinite(numeric) && numeric === 0;
  });
}

function normalizeJalaliDate(value: string, sourceRow: number, errors: string[]): string {
  const raw = normalizeDigits(value).trim();
  if (!raw) return '';
  const parts = raw.replace(/[./]/g, '-').split('-');
  if (parts.length !== 3 || !parts.every((part) => /^\d+$/.test(part))) {
    errors.push(`ردیف ${sourceRow}: تاریخ پرداخت باید به شکل 1405-01-31 باشد.`);
    return '';
  }
  const [year, month, day] = parts.map(Number);
  if (year < 1300 || year > 1500 || month < 1 || month > 12 || day < 1 || day > 31) {
    errors.push(`ردیف ${sourceRow}: تاریخ پرداخت خارج از محدوده معتبر است.`);
    return '';
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Parses the A:V table from the workbook's "کارکرد ماهانه" sheet.
 * Monetary columns in that workbook are denominated in toman; the payroll
 * engine stores monetary amounts in rial, so imported amounts are multiplied by 10.
 * The parser intentionally does not infer payroll rules from Excel formulas.
 */
export function parsePayrollMonthlyExcelPaste(text: string): PayrollMonthlyExcelParseResult {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n');
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();

  const errors: string[] = [];
  const rows: ImportedPayrollMonthlyRow[] = [];
  let ignoredBlankRows = 0;
  let headerDetected = false;
  let startIndex = 0;

  const headerIndex = lines.findIndex((line) => {
    const cells = line.split('\t');
    return normalizeHeader(cells[0] ?? '').includes(normalizeHeader('شناسه فیش')) &&
      normalizeHeader(cells[3] ?? '').includes(normalizeHeader('کد پرسنلی'));
  });

  if (headerIndex >= 0) {
    headerDetected = true;
    startIndex = headerIndex + 1;
    const headerCells = lines[headerIndex].split('\t');
    const actual = headerCells.map(normalizeHeader);
    const expected = PAYROLL_MONTHLY_EXCEL_HEADERS.map(normalizeHeader);
    if (actual.length !== expected.length || expected.some((header, index) => actual[index] !== header)) {
      errors.push('سرستون‌های فایل با قالب استاندارد ۲۲ ستونی شیت «کارکرد ماهانه» مطابقت ندارند.');
    }
  }

  const seenCodes = new Set<string>();
  const seenPayslipIds = new Set<string>();

  for (let lineIndex = startIndex; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (!line.trim()) {
      ignoredBlankRows += 1;
      continue;
    }
    const sourceRow = lineIndex + 1;
    const cells = line.split('\t');
    if (cells.length > 22 || cells.length < 20) {
      errors.push(`ردیف ${sourceRow}: باید ستون‌های A تا V (۲۲ ستون) را کپی کنید؛ ${cells.length} ستون دریافت شد.`);
      continue;
    }
    while (cells.length < 22) cells.push('');

    if (isBlankTemplateRow(cells)) {
      ignoredBlankRows += 1;
      continue;
    }

    const personnelCode = (cells[3] ?? '').trim();
    if (!personnelCode) {
      errors.push(`ردیف ${sourceRow}: کد پرسنلی ستون D خالی است.`);
      continue;
    }

    const yearNumber = parseNumber(cells[1], 'سال', sourceRow, errors, true);
    const month = parseNumber(cells[2], 'ماه', sourceRow, errors, true);
    const monthDays = parseNumber(cells[4], 'روزهای ماه', sourceRow, errors, true);
    const workDays = parseNumber(cells[5], 'روز کارکرد', sourceRow, errors, true);
    const paidLeaveDays = parseNumber(cells[6], 'مرخصی استحقاقی', sourceRow, errors);
    const sickLeaveDays = parseNumber(cells[7], 'استعلاجی', sourceRow, errors);
    const unpaidAbsenceDays = parseNumber(cells[8], 'غیبت بدون حقوق', sourceRow, errors);
    const overtimeHours = parseNumber(cells[9], 'اضافه‌کاری ساعت', sourceRow, errors);
    const nightShiftHours = parseNumber(cells[10], 'شب‌کاری ساعت', sourceRow, errors);
    const fridayHours = parseNumber(cells[11], 'جمعه‌کاری ساعت', sourceRow, errors);
    const missionDays = parseNumber(cells[12], 'مأموریت روز', sourceRow, errors);

    const tomanFields = [
      ['مزایای مشمول بیمه', 13],
      ['مزایای غیرمشمول', 14],
      ['پاداش', 15],
      ['وام/قسط', 16],
      ['مساعده', 17],
      ['سایر کسورات', 18],
      ['اصلاح حقوق +/-', 19],
    ] as const;
    const tomanValues = tomanFields.map(([name, index]) =>
      parseNumber(cells[index], name, sourceRow, errors)
    );
    const [insured, nonInsured, bonus, loan, advance, otherDeductions, correction] = tomanValues;

    if (!Number.isInteger(yearNumber) || !['1404', '1405'].includes(String(yearNumber))) {
      errors.push(`ردیف ${sourceRow}: سال باید ۱۴۰۴ یا ۱۴۰۵ باشد.`);
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      errors.push(`ردیف ${sourceRow}: ماه باید عدد صحیح بین ۱ تا ۱۲ باشد.`);
    }
    if (![29, 30, 31].includes(monthDays)) {
      errors.push(`ردیف ${sourceRow}: روزهای ماه باید ۲۹، ۳۰ یا ۳۱ باشد.`);
    }

    const dayValues: Array<[string, number]> = [
      ['روز کارکرد', workDays],
      ['مرخصی استحقاقی', paidLeaveDays],
      ['استعلاجی', sickLeaveDays],
      ['غیبت بدون حقوق', unpaidAbsenceDays],
      ['مأموریت روز', missionDays],
    ];
    for (const [name, value] of dayValues) {
      if (value < 0 || value > monthDays) {
        errors.push(`ردیف ${sourceRow}: «${name}» باید بین صفر و روزهای ماه باشد.`);
      }
    }
    if (workDays > monthDays) {
      errors.push(`ردیف ${sourceRow}: روز کارکرد از روزهای ماه بیشتر است.`);
    }

    const hourValues: Array<[string, number]> = [
      ['اضافه‌کاری', overtimeHours],
      ['شب‌کاری', nightShiftHours],
      ['جمعه‌کاری', fridayHours],
    ];
    for (const [name, value] of hourValues) {
      if (value < 0) errors.push(`ردیف ${sourceRow}: ساعت «${name}» نمی‌تواند منفی باشد.`);
    }
    for (const [index, value] of tomanValues.entries()) {
      if (index < 6 && value < 0) {
        errors.push(`ردیف ${sourceRow}: مبلغ «${tomanFields[index][0]}» نمی‌تواند منفی باشد.`);
      }
    }

    const normalizedCode = personnelCode.toLocaleLowerCase();
    if (seenCodes.has(normalizedCode)) {
      errors.push(`ردیف ${sourceRow}: کد پرسنلی «${personnelCode}» در فایل تکراری است.`);
    }
    seenCodes.add(normalizedCode);

    const payslipId = (cells[0] ?? '').trim() ||
      `${yearNumber}-${String(month).padStart(2, '0')}-${personnelCode}`;
    if (seenPayslipIds.has(payslipId)) {
      errors.push(`ردیف ${sourceRow}: شناسه فیش «${payslipId}» تکراری است.`);
    }
    seenPayslipIds.add(payslipId);

    const paymentDate = normalizeJalaliDate(cells[20] ?? '', sourceRow, errors);
    rows.push({
      sourceRow,
      payslipId,
      year: String(yearNumber) as '1404' | '1405',
      month,
      personnelCode,
      monthDays: monthDays as 29 | 30 | 31,
      workDays,
      paidLeaveDays,
      sickLeaveDays,
      unpaidAbsenceDays,
      overtimeHours,
      nightShiftHours,
      fridayHours,
      missionDays,
      insuredBenefitsRial: Math.round(insured * 10),
      nonInsuredBenefitsRial: Math.round(nonInsured * 10),
      variableBonusRial: Math.round(bonus * 10),
      loanDeductionRial: Math.round(loan * 10),
      advanceDeductionRial: Math.round(advance * 10),
      otherDeductionsRial: Math.round(otherDeductions * 10),
      signedCorrectionRial: Math.round(correction * 10),
      paymentDate,
      notes: cells[21] ?? '',
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push('هیچ ردیف دارای کد پرسنلی برای ورود پیدا نشد.');
  }

  return { rows, errors, ignoredBlankRows, headerDetected };
}
