export type PayItemKind = 'earning' | 'deduction' | 'employer-cost' | 'informational';
export type InsuranceTreatment = 'included' | 'excluded' | 'not-applicable';
export type TaxTreatment = 'taxable' | 'exempt' | 'taxable-excess' | 'not-applicable';
export type RuleReviewStatus = 'baseline' | 'pending-legal-review';

export interface PayrollPayItemDefinition {
  id: string;
  title: string;
  kind: PayItemKind;
  insuranceTreatment: InsuranceTreatment;
  taxTreatment: TaxTreatment;
  includedInOvertimeBase: boolean;
  includedInMonthlyGross: boolean;
  includedInCtc: boolean;
  reviewStatus: RuleReviewStatus;
  legalBasis: string[];
  implementationNote: string;
}

export interface PayrollPayItemLine {
  itemId: string;
  amountRial: number;
  taxableAmountRial?: number;
}

export const PAYROLL_PAY_ITEM_CATALOG: PayrollPayItemDefinition[] = [
  {
    id: 'base-salary',
    title: 'حقوق پایه / مزد شغل',
    kind: 'earning',
    insuranceTreatment: 'included',
    taxTreatment: 'taxable',
    includedInOvertimeBase: true,
    includedInMonthlyGross: true,
    includedInCtc: true,
    reviewStatus: 'baseline',
    legalBasis: ['قانون کار، مواد 35 تا 37', 'قانون تأمین اجتماعی، مواد 2 و 30', 'قانون مالیات‌های مستقیم، ماده 83'],
    implementationNote: 'در موتور فعلی از مزد روزانه × روز کارکرد محاسبه می‌شود؛ تفکیک مزد شغل/مزد مبنا و طرح طبقه‌بندی هنوز کامل نیست.',
  },
  {
    id: 'base-seniority',
    title: 'پایه سنوات',
    kind: 'earning',
    insuranceTreatment: 'included',
    taxTreatment: 'taxable',
    includedInOvertimeBase: true,
    includedInMonthlyGross: true,
    includedInCtc: true,
    reviewStatus: 'pending-legal-review',
    legalBasis: ['مصوبات سالانه شورای عالی کار', 'بخشنامه دستمزد مبنای کسر حق بیمه'],
    implementationNote: 'طبقه‌بندی فعلی بر اساس مبلغ/پرچم ورودی است؛ استحقاق باید از تاریخ استخدام و تاریخ آخرین پایه سنوات استخراج شود.',
  },
  {
    id: 'housing-allowance',
    title: 'حق مسکن',
    kind: 'earning',
    insuranceTreatment: 'included',
    taxTreatment: 'taxable-excess',
    includedInOvertimeBase: false,
    includedInMonthlyGross: true,
    includedInCtc: true,
    reviewStatus: 'pending-legal-review',
    legalBasis: ['مصوبه هیئت وزیران', 'بخشنامه دستمزد مبنای کسر حق بیمه', 'بخشنامه مالیاتی مزایای رفاهی سال 1405'],
    implementationNote: 'در موتور فعلی بیمه‌ای است و برای مالیات فقط مبلغ مازاد بر سقف تنظیمی مشمول می‌شود؛ حدود و تاریخ اعتبار معافیت باید تأیید حقوقی شود.',
  },
  {
    id: 'worker-coupon',
    title: 'بن کارگری / کمک‌هزینه اقلام مصرفی خانوار',
    kind: 'earning',
    insuranceTreatment: 'included',
    taxTreatment: 'taxable-excess',
    includedInOvertimeBase: false,
    includedInMonthlyGross: true,
    includedInCtc: true,
    reviewStatus: 'pending-legal-review',
    legalBasis: ['مصوبه شورای عالی کار', 'بخشنامه دستمزد مبنای کسر حق بیمه', 'بخشنامه مالیاتی مزایای رفاهی سال 1405'],
    implementationNote: 'در موتور فعلی بیمه‌ای است و برای مالیات فقط مبلغ مازاد بر سقف تنظیمی مشمول می‌شود؛ حدود و تاریخ اعتبار معافیت باید تأیید حقوقی شود.',
  },
  {
    id: 'marriage-allowance',
    title: 'حق تأهل',
    kind: 'earning',
    insuranceTreatment: 'included',
    taxTreatment: 'taxable',
    includedInOvertimeBase: false,
    includedInMonthlyGross: true,
    includedInCtc: true,
    reviewStatus: 'pending-legal-review',
    legalBasis: ['مصوبه شورای عالی کار', 'بخشنامه دستمزد مبنای کسر حق بیمه', 'بخشنامه مالیاتی مزایای رفاهی سال 1405'],
    implementationNote: 'رفتار مالیاتی فعلی taxable است؛ اثر بخشنامه 1405 و حدود متعارف باید پیش از تأیید RuleSet تعیین تکلیف شود.',
  },
  {
    id: 'child-allowance',
    title: 'حق اولاد / کمک عائله‌مندی',
    kind: 'earning',
    insuranceTreatment: 'excluded',
    taxTreatment: 'exempt',
    includedInOvertimeBase: false,
    includedInMonthlyGross: true,
    includedInCtc: true,
    reviewStatus: 'pending-legal-review',
    legalBasis: ['قانون تأمین اجتماعی، ماده 86', 'قانون اصلاح قوانین تنظیم جمعیت و خانواده', 'بخشنامه مالیاتی مزایای رفاهی سال 1405'],
    implementationNote: 'از مبنای بیمه و مالیات در موتور فعلی حذف می‌شود؛ احراز 720 روز و شرایط هر فرزند هنوز کامل نیست و محدودیت دو فرزند نباید اعمال شود.',
  },
  {
    id: 'overtime',
    title: 'فوق‌العاده اضافه‌کاری',
    kind: 'earning',
    insuranceTreatment: 'included',
    taxTreatment: 'taxable',
    includedInOvertimeBase: false,
    includedInMonthlyGross: true,
    includedInCtc: true,
    reviewStatus: 'pending-legal-review',
    legalBasis: ['قانون کار، مواد 59 تا 61', 'قانون تأمین اجتماعی، ماده 2', 'قانون مالیات‌های مستقیم، مواد 82 و 83'],
    implementationNote: 'ضریب 1.4 پیاده‌سازی شده؛ رضایت/استثنا، سقف روزانه و منع‌های قانونی هنوز کنترل نمی‌شوند.',
  },
  {
    id: 'night-shift',
    title: 'فوق‌العاده شب‌کاری غیرنوبتی',
    kind: 'earning',
    insuranceTreatment: 'included',
    taxTreatment: 'taxable',
    includedInOvertimeBase: false,
    includedInMonthlyGross: true,
    includedInCtc: true,
    reviewStatus: 'pending-legal-review',
    legalBasis: ['قانون کار، ماده 58', 'قانون تأمین اجتماعی، ماده 2', 'قانون مالیات‌های مستقیم، مواد 82 و 83'],
    implementationNote: 'ضریب 35% برای شب‌کاری غیرنوبتی پیاده‌سازی شده؛ تفکیک نوبت‌کاری و کنترل هم‌پوشانی در این مرحله انجام نشده است.',
  },
  {
    id: 'holiday-work',
    title: 'کار در تعطیل / جمعه‌کاری',
    kind: 'earning',
    insuranceTreatment: 'included',
    taxTreatment: 'taxable',
    includedInOvertimeBase: false,
    includedInMonthlyGross: true,
    includedInCtc: true,
    reviewStatus: 'pending-legal-review',
    legalBasis: ['قانون کار، ماده 62', 'قانون تأمین اجتماعی، ماده 2', 'قانون مالیات‌های مستقیم، مواد 82 و 83'],
    implementationNote: 'کد فعلی یک ورودی holidayHours با ضریب 1.4 دارد؛ این عنوان نباید به معنی پیاده‌سازی کامل جمعه‌کاری ماده 62 تلقی شود.',
  },
  {
    id: 'variable-bonus',
    title: 'پاداش متغیر / کارانه / آکورد',
    kind: 'earning',
    insuranceTreatment: 'included',
    taxTreatment: 'taxable',
    includedInOvertimeBase: false,
    includedInMonthlyGross: true,
    includedInCtc: true,
    reviewStatus: 'pending-legal-review',
    legalBasis: ['قانون تأمین اجتماعی، ماده 2', 'قانون مالیات‌های مستقیم، مواد 82 و 83'],
    implementationNote: 'رفتار عمومی فعلی مشمول بیمه و مالیات است؛ پرداخت موردی/غیرمرتبط با کارکرد یا موارد استثنا باید جداگانه تعیین تکلیف شود.',
  },
  {
    id: 'eid-bonus',
    title: 'عیدی و پاداش پایان سال',
    kind: 'earning',
    insuranceTreatment: 'excluded',
    taxTreatment: 'taxable-excess',
    includedInOvertimeBase: false,
    includedInMonthlyGross: false,
    includedInCtc: true,
    reviewStatus: 'pending-legal-review',
    legalBasis: ['قانون تعیین عیدی و پاداش سالانه کارگران', 'قانون مالیات‌های مستقیم، ماده 91 و قانون بودجه سال مربوط'],
    implementationNote: 'خارج از ناخالص ماهانه است؛ روش فعلی مازاد مالیاتی ثابت 10% است و باید با قانون بودجه و تکلیف کسر مالیات سالانه تطبیق داده شود.',
  },
  {
    id: 'severance-pay',
    title: 'مزایای پایان کار / سنوات پایان خدمت',
    kind: 'earning',
    insuranceTreatment: 'excluded',
    taxTreatment: 'exempt',
    includedInOvertimeBase: false,
    includedInMonthlyGross: false,
    includedInCtc: true,
    reviewStatus: 'pending-legal-review',
    legalBasis: ['قانون کار، ماده 24', 'قانون مالیات‌های مستقیم، ماده 91'],
    implementationNote: 'خارج از ناخالص ماهانه است؛ تعریف آخرین حقوق و اثر اجزای مزد و تسویه‌های علی‌الحساب نیازمند تکمیل است.',
  },
  {
    id: 'leave-encashment',
    title: 'بازخرید مرخصی استفاده‌نشده',
    kind: 'earning',
    insuranceTreatment: 'excluded',
    taxTreatment: 'exempt',
    includedInOvertimeBase: false,
    includedInMonthlyGross: false,
    includedInCtc: true,
    reviewStatus: 'pending-legal-review',
    legalBasis: ['قانون کار، مواد 64 تا 66', 'قانون مالیات‌های مستقیم، ماده 91'],
    implementationNote: 'فقط ذخیره تخمینی CTC در موتور فعلی وجود دارد؛ دفتر مانده واقعی و روش تسویه پیاده‌سازی نشده است.',
  },
  {
    id: 'mission-allowance',
    title: 'فوق‌العاده مأموریت و هزینه سفر',
    kind: 'earning',
    insuranceTreatment: 'not-applicable',
    taxTreatment: 'not-applicable',
    includedInOvertimeBase: false,
    includedInMonthlyGross: false,
    includedInCtc: true,
    reviewStatus: 'pending-legal-review',
    legalBasis: ['قانون کار، ماده 46', 'قواعد مالیاتی و بیمه‌ای مرتبط'],
    implementationNote: 'در موتور فعلی پیاده‌سازی نشده؛ فوق‌العاده مأموریت باید از بازپرداخت هزینه مستند سفر تفکیک شود.',
  },
  {
    id: 'non-cash-benefit',
    title: 'مزایای غیرنقدی',
    kind: 'earning',
    insuranceTreatment: 'not-applicable',
    taxTreatment: 'taxable-excess',
    includedInOvertimeBase: false,
    includedInMonthlyGross: true,
    includedInCtc: true,
    reviewStatus: 'pending-legal-review',
    legalBasis: ['قانون مالیات‌های مستقیم، مواد 83 و 91', 'قانون بودجه سال مربوط'],
    implementationNote: 'نیازمند ارزش‌گذاری و سقف/معافیت قانونی سال مربوط؛ در این مرحله در موتور محاسبه نشده است.',
  },
  {
    id: 'loan-installment',
    title: 'قسط وام پرسنلی',
    kind: 'deduction',
    insuranceTreatment: 'not-applicable',
    taxTreatment: 'not-applicable',
    includedInOvertimeBase: false,
    includedInMonthlyGross: false,
    includedInCtc: false,
    reviewStatus: 'baseline',
    legalBasis: ['قانون کار، ماده 45 و مقررات مرتبط'],
    implementationNote: 'در موتور اصلی فعلی مدیریت دفتر وام و اقساط وجود ندارد.',
  },
  {
    id: 'salary-advance',
    title: 'مساعده',
    kind: 'deduction',
    insuranceTreatment: 'not-applicable',
    taxTreatment: 'not-applicable',
    includedInOvertimeBase: false,
    includedInMonthlyGross: false,
    includedInCtc: false,
    reviewStatus: 'baseline',
    legalBasis: ['قانون کار، ماده 45 و مقررات مرتبط'],
    implementationNote: 'در موتور اصلی فعلی مدیریت مساعده و مانده آن وجود ندارد.',
  },
];

const PAYROLL_PAY_ITEM_INDEX = new Map(
  PAYROLL_PAY_ITEM_CATALOG.map((item) => [item.id, item])
);

export function getPayrollPayItem(itemId: string): PayrollPayItemDefinition {
  const item = PAYROLL_PAY_ITEM_INDEX.get(itemId);
  if (!item) {
    throw new Error(`Payroll pay item "${itemId}" is not registered in the central catalog.`);
  }
  return item;
}

export function sumOvertimeBase(lines: PayrollPayItemLine[]): number {
  return lines.reduce((total, line) => {
    const definition = getPayrollPayItem(line.itemId);
    return definition.includedInOvertimeBase
      ? total + Math.max(0, Math.round(line.amountRial))
      : total;
  }, 0);
}

export function sumInsuranceBasis(lines: PayrollPayItemLine[]): number {
  return lines.reduce((total, line) => {
    const definition = getPayrollPayItem(line.itemId);
    return definition.insuranceTreatment === 'included'
      ? total + Math.max(0, Math.round(line.amountRial))
      : total;
  }, 0);
}

export function sumTaxableIncome(lines: PayrollPayItemLine[]): number {
  return lines.reduce((total, line) => {
    const definition = getPayrollPayItem(line.itemId);
    if (definition.taxTreatment === 'taxable') {
      return total + Math.max(0, Math.round(line.amountRial));
    }
    if (definition.taxTreatment === 'taxable-excess') {
      return total + Math.max(0, Math.round(line.taxableAmountRial ?? 0));
    }
    return total;
  }, 0);
}

export function getPendingLegalReviewItems(lines: PayrollPayItemLine[]): string[] {
  const pending = new Set<string>();
  for (const line of lines) {
    const definition = getPayrollPayItem(line.itemId);
    if (
      line.amountRial !== 0 &&
      definition.reviewStatus === 'pending-legal-review'
    ) {
      pending.add(definition.title);
    }
  }
  return [...pending];
}
