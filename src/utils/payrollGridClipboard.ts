export const PAYROLL_GRID_PASTE_FIELDS = [
  'workDays',
  'overtimeHours',
  'nightShiftHours',
  'holidayHours',
  'variableBonusRial',
  'isMarried',
  'childrenCount',
  'has720DaysInsurance',
  'annualWorkedDays',
] as const;

export type PayrollGridPasteField = (typeof PAYROLL_GRID_PASTE_FIELDS)[number];

export type PayrollGridPasteValue = number | boolean;

export interface ParsedPayrollGridCell {
  valid: boolean;
  empty: boolean;
  value?: PayrollGridPasteValue;
}

function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

function parseNumber(value: string): number | undefined {
  const normalized = normalizeDigits(value)
    .trim()
    .replace(/[٬,]/g, '')
    .replace(/٫/g, '.')
    .replace(/[\s\u200c]/g, '');
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBoolean(value: string): boolean | undefined {
  const normalized = normalizeDigits(value).trim().toLocaleLowerCase().replace(/[\s\u200c]/g, '');
  if (!normalized) return undefined;

  const trueValues = new Set(['1', 'true', 'yes', 'y', 'بله', 'دارد', 'متاهل', 'متأهل']);
  const falseValues = new Set(['0', 'false', 'no', 'n', 'خیر', 'ندارد', 'مجرد']);

  if (trueValues.has(normalized)) return true;
  if (falseValues.has(normalized)) return false;
  return undefined;
}

export function parsePayrollGridPasteCell(
  field: PayrollGridPasteField,
  rawValue: string,
  unitMultiplier = 1
): ParsedPayrollGridCell {
  if (field === 'isMarried' || field === 'has720DaysInsurance') {
    const value = parseBoolean(rawValue);
    return value === undefined
      ? { valid: rawValue.trim().length === 0, empty: rawValue.trim().length === 0 }
      : { valid: true, empty: false, value };
  }

  const parsed = parseNumber(rawValue);
  if (parsed === undefined) {
    return rawValue.trim().length === 0
      ? { valid: true, empty: true, value: 0 }
      : { valid: false, empty: false };
  }

  return {
    valid: true,
    empty: false,
    value: field === 'variableBonusRial' ? parsed * unitMultiplier : parsed,
  };
}
