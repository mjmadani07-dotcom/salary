export interface EosPrinciple {
  number: string;
  title: string;
  sourceBook: string;
  summary: string;
  operationalRule: string;
}

export interface EosBonusLayer {
  id: string;
  title: string;
  eosSource: string;
  cadence: string;
  triggerRule: string;
  iranianLawTreatment: string;
}

export interface EosChecklistStep {
  id: string;
  stepNumber: string;
  title: string;
  description: string;
}

export const EOS_FIVE_PRINCIPLES: EosPrinciple[] = [
  {
    number: '۰۱',
    title: 'تفکیک مطلق ارزیابی عملکرد از گفتگوهای افزایش حقوق',
    sourceBook: 'How to Be a Great Boss',
    summary:
      'در جلسات ارزیابی عملکرد (نشست‌های فصلی ۵-۵-۵ و ارزیابی سالانه) هرگز نباید درباره افزایش حقوق، نرخ دستمزد یا تعدیل‌های مالی بحث شود.',
    operationalRule:
      'تمرکز جلسات ۵-۵-۵ باید ۱۰۰٪ بر ارزش‌های محوری، مسئولیت‌های صندلی و راک‌ها باشد؛ گفتگوهای تعدیل حقوق در تقویم کاملاً مجزا برگزار می‌شوند تا گارد دفاعی ایجاد نشود.',
  },
  {
    number: '۰۲',
    title: 'تعیین حقوق پایه بر اساس «نرخ بازار برای صندلی» (Seat Market Rate)',
    sourceBook: 'The EOS Life & Traction',
    summary:
      'حقوق پایه متعلق به «صندلی» در چارت پاسخگویی (Accountability Chart) است، نه مدرک تحصیلی یا ویژگی‌های فردی؛ و پرداخت منصفانه بالاتر از متوسط بازار تشویق می‌شود.',
    operationalRule:
      'فرد زمانی مستحق دریافت بسته کامل صندلی است که هر سه شرط GWC را احراز کند: درک نقش (Get it)، خواستن قلبی (Want it) و ظرفیت اجرایی (Capacity). در ایران، حداقل حقوق صندلی نمی‌تواند از کف مصوب شورای عالی کار کمتر باشد.',
  },
  {
    number: '۰۳',
    title: 'اتصال پاداش‌های متغیر به شاخص‌های عددی کارت امتیاز (Scorecard)',
    sourceBook: 'Data',
    summary:
      'هر صندلی در سازمان باید حداقل یک عدد مشخص و قابل اندازه‌گیری (Measurable) در کارت امتیاز داشته باشد تا پاداش عملکردی بر مبنای داده، نه احساس درونی مدیر (Gut Feeling) توزیع شود.',
    operationalRule:
      'تحقق زیر ۸۰٪ معادل صفر٪ پاداش؛ بین ۸۰٪ تا ۹۹٪ پرداخت تناسبی؛ ۱۰۰٪ معادل کامل پاداش پایه؛ و بالای ۱۰۵٪ مشمول ضریب تشویقی ۱۲۰٪ تا ۱۵۰٪ می‌شود.',
  },
  {
    number: '۰۴',
    title: 'پاداش فصلی تحقق اهداف ۹۰ روزه (Quarterly Rocks Bonus)',
    sourceBook: 'Traction & What the Heck Is EOS?',
    summary:
      'اولویت‌های حیاتی هر فصل در قالب «راک‌ها» تعریف می‌شوند و تکمیل به‌موقع راک‌های فردی و دپارتمانی محرک اعطای پاداش فصلی است.',
    operationalRule:
      'شرط حد نصاب ۸۰٪ سازمانی: تنها زمانی که نرخ تکمیل کل راک‌های سازمان حداقل ۸۰٪ باشد، بودجه پاداش فصلی آزاد شده و به صاحبان راک‌های تکمیل‌شده پرداخت می‌گردد.',
  },
  {
    number: '۰۵',
    title: 'منع مطلق پاداش مالی مستقیم برای رعایت «ارزش‌های محوری»',
    sourceBook: 'People: Dare to Build an Intentional Culture',
    summary:
      'هرگز برای رعایت ارزش‌های محوری شرکت پول نقد یا پاداش مالی مستقیم ندهید؛ ارزش‌های محوری هویت سازمان هستند و نباید معامله‌گرانه (Transactional) شوند.',
    operationalRule:
      'ارزش‌های محوری منحصراً از طریق تقدیر کلامی در جلسات عمومی (Core Values Callouts)، لوح تقدیر و قدردانی معنوی تقویت می‌شوند.',
  },
];

export const EOS_BONUS_LAYERS: EosBonusLayer[] = [
  {
    id: 'scorecard',
    title: 'پاداش عملکردی کارت امتیاز (Scorecard Bonus)',
    eosSource: 'شاخص‌های عددی پیش‌رو (Measurables)',
    cadence: 'ماهانه / هفتگی',
    triggerRule: 'تحقق ۸۰٪ به بالا (ضریب پله‌ای تا ۱۵۰٪ در عملکرد بالای ۱۰۵٪)',
    iranianLawTreatment:
      'در حکم «پاداش متغیر و کارانه» ماه پرداخت لحاظ شده و مشمول بیمه تأمین اجتماعی (تا سقف ۷ برابر) و مالیات پلکانی حقوق است.',
  },
  {
    id: 'rocks',
    title: 'پاداش فصلی راک‌ها (Quarterly Rock Bonus)',
    eosSource: 'نرخ تکمیل راک‌های ۹۰ روزه',
    cadence: 'فصلی (هر ۳ ماه)',
    triggerRule: 'شرط تحقق ≥۸۰٪ راک‌های کل سازمان + تکمیل راک‌های فردی',
    iranianLawTreatment:
      'در ماه تسویه فصل مشمول بیمه (تا سقف ۷ برابر) و مالیات حقوق است؛ در بودجه CTC کارفرما به‌صورت ذخیره ۱/۳ ماهانه لحاظ می‌شود.',
  },
  {
    id: 'profit-sharing',
    title: 'مشارکت در سود (Profit Sharing / Gainsharing)',
    eosSource: 'سود خالص مازاد بر برنامه ۱ ساله (V/TO)',
    cadence: 'سالانه / نیم‌سال',
    triggerRule: 'تخصیص درصدی (مثلاً ۱۵٪ تا ۳۰٪) از سود مازاد بر تارگت V/TO',
    iranianLawTreatment:
      'در زمان پرداخت به عنوان پاداش عملکردی سالانه مشمول مالیات حقوق و بیمه ماه پرداخت (تا سقف ۷ برابر همان ماه) است.',
  },
];

export const EOS_OWNERS_BOX_RULES = [
  {
    title: 'سهام‌دار در داخل شرکت یک کارمند صندلی است',
    detail:
      'اگر بنیان‌گذار یا سهام‌دار صندلی اجرایی (مانند Visionary یا Integrator) دارد، حقوق ماهانه او منحصراً بر اساس نرخ بازار آن صندلی (Seat Market Rate) تعیین می‌شود، نه بر اساس درصد سهام.',
  },
  {
    title: 'تفکیک کامل صندوق مالکان (Owner’s Box) از حقوق شغلی',
    detail:
      'سود سهام‌داری (Profit Distribution) از محل سود خالص به صندوق مالکان تعلق دارد و نباید با حقوق کارمندی و هزینه تمام‌شده صندلی در صورت سود و زیان خلط شود.',
  },
  {
    title: 'اصل امکان برکناری در جهت خیر والای سازمان (Greater Good)',
    detail:
      'اگر سهام‌داری در صندلی اجرایی خود شروط GWC را احراز نکند یا ارزش‌های محوری را رعایت نکند، باید از صندلی اجرایی کنار برود در حالی که مالکیت سهام و حق سود سالانه او کاملاً محفوظ می‌ماند.',
  },
];

export const EOS_IMPLEMENTATION_CHECKLIST: EosChecklistStep[] = [
  {
    id: 'eos-step-1',
    stepNumber: 'گام ۱',
    title: 'شفاف‌سازی چارت پاسخگویی (Accountability Chart)',
    description: 'تعریف دقیق ۵ مسئولیت اصلی هر صندلی و تفکیک کامل صندلی‌های اجرایی از Owner’s Box.',
  },
  {
    id: 'eos-step-2',
    stepNumber: 'گام ۲',
    title: 'استخراج نرخ بازار صندلی (Seat Market Rate)',
    description: 'تعیین حقوق پایه منصفانه (و ترجیحاً بالاتر از میانگین بازار) مطابق ارزش هر صندلی و کف قانون کار ایران.',
  },
  {
    id: 'eos-step-3',
    stepNumber: 'گام ۳',
    title: 'تعیین عدد مشخص (Measurable) در کارت امتیاز',
    description: 'اختصاص شاخص‌های عددی هفتگی/ماهانه به هر فرد برای حذف کامل قضاوت‌های سلیقه‌ای.',
  },
  {
    id: 'eos-step-4',
    stepNumber: 'گام ۴',
    title: 'جداسازی تقویم جلسات ۵-۵-۵ از بررسی حقوق',
    description: 'برگزاری نشست‌های فصلی رشد و بازخورد ۵-۵-۵ بدون هیچ‌گونه مذاکره مالی در همان جلسه.',
  },
  {
    id: 'eos-step-5',
    stepNumber: 'گام ۵',
    title: 'تصویب آیین‌نامه پاداش اسکورکارد و راک‌های ۹۰ روزه',
    description: 'تثبیت پله‌های ۸۰٪ تا ۱۰۵٪+ اسکورکارد و شرط حد نصاب ۸۰٪ راک‌های کل سازمان.',
  },
  {
    id: 'eos-step-6',
    stepNumber: 'گام ۶',
    title: 'فرمول‌نویسی صندوق مشارکت در سود (V/TO Gainsharing)',
    description: 'تعریف درصد مشخص از سود مازاد بر برنامه ۱ ساله برای توزیع عادلانه میان تیم‌های پاسخگو.',
  },
  {
    id: 'eos-step-7',
    stepNumber: 'گام ۷',
    title: 'استقرار تقدیر معنوی ارزش‌های محوری (Core Values Callouts)',
    description: 'راه‌اندازی فرهنگ قدردانی کلامی در جلسات عمومی و حذف کامل پاداش نقدی برای ارزش‌های محوری.',
  },
];

export function getScorecardMultiplier(
  achievementPercent: number,
  overAchievementRate = 1.25
): { multiplier: number; tierLabel: string } {
  if (achievementPercent < 80) {
    return { multiplier: 0, tierLabel: 'زیر حد نصاب ۸۰٪ (بدون پاداش)' };
  }
  if (achievementPercent < 100) {
    return {
      multiplier: achievementPercent / 100,
      tierLabel: 'بازه ۸۰٪ تا ۹۹٪ (پرداخت تناسبی)',
    };
  }
  if (achievementPercent < 105) {
    return { multiplier: 1, tierLabel: 'تحقق کامل ۱۰۰٪ (پاداش پایه)' };
  }
  return {
    multiplier: overAchievementRate,
    tierLabel: `فوق‌العاده ≥۱۰۵٪ (ضریب ${overAchievementRate * 100}٪)`,
  };
}
