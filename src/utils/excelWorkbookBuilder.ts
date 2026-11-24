import ExcelJS from 'exceljs';
import {
  APPLICABILITY_MATRIX,
  FiscalYear,
  LEGACY_AUDIT_POINTS,
  YEAR_REGULATIONS,
} from '../data/payrollRegulations';
import { PayrollInput } from './payrollEngine';

export interface ExcelSampleRow {
  code: string;
  name: string;
  monthDays: number;
  workDays: number;
  dailyWage: number;
  serviceDays: number;
  dailySeniority: number;
  isMarried: 0 | 1;
  childrenCount: number;
  insuranceDays: number;
  overtimeHours: number;
  variableBonus: number;
}

export interface EosExcelConfig {
  seatName: string;
  isGwcQualified: boolean;
  seatMonthlyBaseRial: number;
  scorecardBudgetRial: number;
  scorecardAchievementPct: number;
  quarterlyRockBudgetRial: number;
  companyRocksPct: number;
  individualRocksPct: number;
  annualProfitShareRial: number;
}

function styleHeaderRow(row: ExcelJS.Row, bgColor = 'FF0F172A') {
  row.height = 28;
  row.eachCell((cell) => {
    cell.font = { name: 'Tahoma', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bgColor },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });
}

function styleDataRow(row: ExcelJS.Row, isTotal = false) {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = {
      name: 'Tahoma',
      size: 10,
      bold: isTotal,
      color: { argb: isTotal ? 'FF0F172A' : 'FF1E293B' },
    };
    if (isTotal) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' },
      };
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: isTotal ? 'double' : 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
  });
}

export async function downloadPayrollExcelWorkbook(
  year: FiscalYear,
  customInput?: PayrollInput,
  eosConfig?: EosExcelConfig
): Promise<void> {
  const reg = YEAR_REGULATIONS[year];
  const resolved =
    ExcelJS?.Workbook
      ? ExcelJS
      : (ExcelJS as unknown as { default?: typeof ExcelJS })?.default;
  const WorkbookCtor = resolved?.Workbook ?? ExcelJS.Workbook;
  const wb = new WorkbookCtor();
  wb.creator = 'مرجع جامع حقوق و دستمزد ایران';
  wb.created = new Date();

  const paramSheetName = 'تنظیمات و نرخ‌ها';
  const payrollSheetName = 'محاسبه حقوق و CTC';
  const eidSheetName = 'عیدی و سنوات';
  const matrixSheetName = 'جدول مشمولیت';
  const taxAuditSheetName = 'مالیات و تدقیق';

  // =========================================================================
  // SHEET 1: Parameters & Official Rates
  // =========================================================================
  const wsParam = wb.addWorksheet(paramSheetName, {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });
  wsParam.columns = [
    { header: 'ردیف', key: 'idx', width: 8 },
    { header: 'عنوان پارامتر قانونی', key: 'title', width: 42 },
    { header: 'مقدار مصوب (ریال / ضریب)', key: 'value', width: 24 },
    { header: 'توضیحات و مستند قانونی', key: 'note', width: 52 },
  ];
  styleHeaderRow(wsParam.getRow(1));

  const paramRows = [
    [1, 'سال مالی مصوبه', Number(year), 'مصوبه شورای عالی کار و قانون بودجه کل کشور'],
    [2, 'حداقل دستمزد روزانه مصوب', reg.minDailyWageRial, 'مبنای محاسبه حداقل مزد، حق اولاد و سقف بیمه'],
    [3, 'حداقل حقوق پایه ماهانه (۳۰ روزه)', reg.minMonthlyWage30Rial, 'معادل ۳۰ برابر حداقل دستمزد روزانه'],
    [4, 'پایه سنوات روزانه (سابقه یک سال)', reg.baseSeniorityDaily1YrRial, 'متعلق به کارگران با سابقه حداقل ۳۶۵ روز در کارگاه'],
    [5, 'حق مسکن ماهانه مصوب', reg.housingAllowanceRial, 'مصوب هیئت وزیران (متناسب با کارکرد)'],
    [6, 'بن کارگری ماهانه مصوب', reg.workerCouponRial, 'کمک‌هزینه اقلام مصرفی خانوار مصوب شورای عالی کار'],
    [7, 'حق تأهل ماهانه مصوب', reg.marriageAllowanceRial, 'متعلق به کارگران متأهل (زن و مرد)'],
    [8, 'ضریب سقف دستمزد مشمول بیمه', reg.insuranceCeilingMultiplier, 'حداکثر ۷ برابر حداقل دستمزد روزانه در روزهای ماه'],
    [9, 'نرخ بیمه سهم کارگر', reg.insuranceEmployeeRate, 'کسر از حقوق مشمول کارگر (۷٪)'],
    [10, 'نرخ بیمه سهم کارفرما (پایه)', reg.insuranceEmployerBaseRate, 'تعهد کارفرما (۲۰٪)'],
    [11, 'نرخ بیمه بیکاری (سهم کارفرما)', reg.unemploymentInsuranceRate, 'تعهد کارفرما طبق قانون بیمه بیکاری (۳٪)'],
    [12, 'سقف معافیت مالیاتی ماهانه', reg.taxMonthlyExemptionRial, 'یک‌دوازدهم معافیت سالانه قانون بودجه'],
    [13, 'سقف معافیت مالیاتی عیدی سالانه', reg.eidTaxExemptionCapRial, 'معادل ۱/۱۲ معافیت مالیاتی سالانه (بند ۱۰ ماده ۹۱ ق.م.م)'],
  ];

  // Note: row 2 is سال مالی, row 3 is minDailyWage -> C3 is minDailyWage!
  // Let's keep exact cell map clear:
  // C2: Year, C3: minDailyWage, C4: minMonthlyWage30, C5: baseSeniorityDaily,
  // C6: housingAllowance, C7: workerCoupon, C8: marriageAllowance,
  // C9: ceilingMultiplier, C10: empInsRate, C11: employerBaseRate, C12: unemploymentRate, C13: taxMonthlyExemption
  paramRows.forEach((r) => {
    const row = wsParam.addRow(r);
    styleDataRow(row);
    const valCell = row.getCell(3);
    if (typeof r[2] === 'number' && r[2] >= 1000) {
      valCell.numFmt = '#,##0';
    } else if (typeof r[2] === 'number' && r[2] < 1) {
      valCell.numFmt = '0.0%';
    }
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
  });

  // =========================================================================
  // SHEET 2: Main Payroll & CTC Calculator
  // =========================================================================
  const wsPay = wb.addWorksheet(payrollSheetName, {
    views: [{ rightToLeft: true, state: 'frozen', xSplit: 2, ySplit: 1 }],
  });

  const payHeaders = [
    'کد پرسنلی', // A
    'نام پرسنل', // B
    'طول ماه (روز)', // C
    'کارکرد (روز)', // D
    'مزد روزانه پایه', // E
    'سابقه کارگاه (روز)', // F
    'پایه سنوات روزانه', // G
    'متأهل (۱/۰)', // H
    'تعداد فرزند', // I
    'سابقه کل بیمه (روز)', // J
    'ساعت اضافه‌کار', // K
    'پاداش متغیر/آکورد', // L
    'حقوق پایه ماهانه', // M
    'پایه سنوات ماهانه', // N
    'حق مسکن', // O
    'بن کارگری', // P
    'حق تأهل', // Q
    'حق اولاد', // R
    'فوق‌العاده اضافه‌کاری', // S
    'جمع ناخالص (Gross)', // T
    'درآمد مشمول بیمه', // U
    'بیمه کارگر (۷٪)', // V
    'درآمد مشمول مالیات', // W
    'مالیات پلکانی حقوق', // X
    'خالص پرداختی (Net)', // Y
    'بیمه کارفرما (۲۳٪)', // Z
    'ذخیره ماهانه عیدی', // AA
    'ذخیره ماهانه سنوات', // AB
    'ذخیره بازخرید مرخصی', // AC
    'هزینه واقعی کارفرما (CTC)', // AD
    'هزینه سالانه کارفرما', // AE
    'ضریب هزینه به خالص', // AF
  ];

  wsPay.addRow(payHeaders);
  styleHeaderRow(wsPay.getRow(1), 'FF0F766E');

  const widths = [
    12, 22, 12, 12, 16, 15, 16, 11, 11, 16, 13, 17, 18, 17, 15, 15, 14, 16, 18,
    20, 19, 17, 19, 18, 20, 18, 17, 17, 18, 22, 22, 16,
  ];
  widths.forEach((w, idx) => {
    wsPay.getColumn(idx + 1).width = w;
  });

  const sampleEmployees: ExcelSampleRow[] = [
    ...(customInput
      ? [
          {
            code: 'P-100',
            name: 'پرسنل تنظیم‌شده شما',
            monthDays: customInput.monthDays,
            workDays: customInput.workDays,
            dailyWage: customInput.dailyBaseWageRial,
            serviceDays: customInput.dailySeniorityRial > 0 ? 400 : 120,
            dailySeniority:
              customInput.dailySeniorityRial > 0
                ? customInput.dailySeniorityRial
                : reg.baseSeniorityDaily1YrRial,
            isMarried: (customInput.isMarried ? 1 : 0) as 0 | 1,
            childrenCount: customInput.childrenCount,
            insuranceDays: customInput.has720DaysInsurance ? 900 : 300,
            overtimeHours: customInput.overtimeHours,
            variableBonus: customInput.variableBonusRial,
          },
        ]
      : []),
    {
      code: 'P-101',
      name: 'حداقل‌بگیر (بدون سابقه)',
      monthDays: 30,
      workDays: 30,
      dailyWage: reg.minDailyWageRial,
      serviceDays: 180,
      dailySeniority: reg.baseSeniorityDaily1YrRial,
      isMarried: 0,
      childrenCount: 0,
      insuranceDays: 200,
      overtimeHours: 0,
      variableBonus: 0,
    },
    {
      code: 'P-102',
      name: 'کارشناس با ۲ فرزند',
      monthDays: 30,
      workDays: 30,
      dailyWage: Math.round(reg.minDailyWageRial * 1.5),
      serviceDays: 730,
      dailySeniority: reg.baseSeniorityDaily1YrRial,
      isMarried: 1,
      childrenCount: 2,
      insuranceDays: 1200,
      overtimeHours: 12,
      variableBonus: 0,
    },
    {
      code: 'P-103',
      name: 'کارشناس ارشد (مشمول مالیات)',
      monthDays: 30,
      workDays: 30,
      dailyWage: 18_000_000, // 54M Toman/mo
      serviceDays: 1100,
      dailySeniority: reg.baseSeniorityDaily1YrRial,
      isMarried: 1,
      childrenCount: 1,
      insuranceDays: 2000,
      overtimeHours: 10,
      variableBonus: 50_000_000,
    },
    {
      code: 'P-104',
      name: 'مدیر فنی (بالای سقف بیمه)',
      monthDays: 30,
      workDays: 30,
      dailyWage: 45_000_000, // 135M Toman/mo
      serviceDays: 1500,
      dailySeniority: reg.baseSeniorityDaily1YrRial,
      isMarried: 1,
      childrenCount: 2,
      insuranceDays: 3200,
      overtimeHours: 0,
      variableBonus: 100_000_000,
    },
  ];

  const P = `'${paramSheetName}'`;
  const taxFormulaForRow = (r: number) =>
    year === '1405'
      ? `ROUND(MAX(0,MIN(W${r},800000000)-400000000)*0.1+MAX(0,MIN(W${r},1000000000)-800000000)*0.15+MAX(0,MIN(W${r},1200000000)-1000000000)*0.2+MAX(0,MIN(W${r},1400000000)-1200000000)*0.25+MAX(0,W${r}-1400000000)*0.3,0)`
      : `ROUND(MAX(0,MIN(W${r},300000000)-240000000)*0.1+MAX(0,MIN(W${r},380000000)-300000000)*0.15+MAX(0,MIN(W${r},500000000)-380000000)*0.2+MAX(0,MIN(W${r},666666667)-500000000)*0.25+MAX(0,W${r}-666666667)*0.3,0)`;

  sampleEmployees.forEach((emp, idx) => {
    const r = idx + 2;
    const row = wsPay.addRow([
      emp.code,
      emp.name,
      emp.monthDays,
      emp.workDays,
      emp.dailyWage,
      emp.serviceDays,
      emp.dailySeniority,
      emp.isMarried,
      emp.childrenCount,
      emp.insuranceDays,
      emp.overtimeHours,
      emp.variableBonus,
      { formula: `ROUND(E${r}*MIN(D${r},C${r}),0)` }, // M: Base Pay
      { formula: `IF(F${r}>=365,ROUND(G${r}*MIN(D${r},C${r}),0),0)` }, // N: Seniority
      { formula: `ROUND((${P}!$C$6/C${r})*D${r},0)` }, // O: Housing
      { formula: `ROUND((${P}!$C$7/C${r})*D${r},0)` }, // P: Coupon
      { formula: `IF(H${r}=1,ROUND((${P}!$C$8/C${r})*D${r},0),0)` }, // Q: Marriage
      {
        formula: `IF(J${r}>=720,ROUND(I${r}*(3*${P}!$C$3)*(D${r}/C${r}),0),0)`,
      }, // R: Child allowance
      {
        formula: `ROUND((((E${r}+IF(F${r}>=365,G${r},0))*30)/220)*1.4*K${r},0)`,
      }, // S: Overtime
      { formula: `L${r}+SUM(M${r}:S${r})` }, // T: Gross
      { formula: `T${r}-R${r}` }, // U: Insurable
      {
        formula: `ROUND(MIN(U${r},${P}!$C$3*${P}!$C$9*C${r})*${P}!$C$10,0)`,
      }, // V: Employee 7%
      { formula: `M${r}+N${r}+Q${r}+S${r}+L${r}` }, // W: Taxable
      { formula: taxFormulaForRow(r) }, // X: Tax
      { formula: `T${r}-V${r}-X${r}` }, // Y: Net
      {
        formula: `ROUND(MIN(U${r},${P}!$C$3*${P}!$C$9*C${r})*(${P}!$C$11+${P}!$C$12),0)`,
      }, // Z: Employer 23%
      { formula: `ROUND((MIN(E${r}*60,${P}!$C$3*90)/12)*(D${r}/C${r}),0)` }, // AA: Monthly Eid Reserve
      {
        formula: `ROUND((((E${r}+IF(F${r}>=365,G${r},0))*30)/12)*(D${r}/C${r}),0)`,
      }, // AB: Monthly Severance Reserve
      {
        formula: `ROUND((E${r}+IF(F${r}>=365,G${r},0))*(26/12)*(D${r}/C${r}),0)`,
      }, // AC: Monthly Leave Reserve
      { formula: `T${r}+Z${r}+AA${r}+AB${r}+AC${r}` }, // AD: Monthly CTC
      { formula: `AD${r}*12` }, // AE: Annual CTC
      { formula: `IF(Y${r}>0,ROUND(AD${r}/Y${r},2),0)` }, // AF: Multiplier
    ]);
    styleDataRow(row);
    for (let col = 5; col <= 31; col++) {
      if (col === 6 || col === 8 || col === 9 || col === 10 || col === 11) continue;
      row.getCell(col).numFmt = '#,##0';
    }
    row.getCell(32).numFmt = '0.00';
    row.getCell(20).font = { name: 'Tahoma', size: 10, bold: true };
    row.getCell(25).font = { name: 'Tahoma', size: 10, bold: true, color: { argb: 'FF0F766E' } };
    row.getCell(30).font = { name: 'Tahoma', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  });

  // Total Row
  const lastEmpRow = sampleEmployees.length + 1;
  const totalRowNum = lastEmpRow + 1;
  const totalRowCells: (string | { formula: string })[] = [
    'جمع کل',
    `${sampleEmployees.length} نفر`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ];
  // Columns L (12) through AE (31)
  const colLetters = [
    'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    'AA', 'AB', 'AC', 'AD', 'AE',
  ];
  colLetters.forEach((colL) => {
    totalRowCells.push({ formula: `SUM(${colL}2:${colL}${lastEmpRow})` });
  });
  totalRowCells.push({
    formula: `IF(Y${totalRowNum}>0,ROUND(AD${totalRowNum}/Y${totalRowNum},2),0)`,
  });
  const totalRow = wsPay.addRow(totalRowCells);
  styleDataRow(totalRow, true);
  for (let col = 12; col <= 31; col++) {
    totalRow.getCell(col).numFmt = '#,##0';
  }
  totalRow.getCell(32).numFmt = '0.00';

  // =========================================================================
  // SHEET 3: Eid & Severance Pay
  // =========================================================================
  const wsEid = wb.addWorksheet(eidSheetName, {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });
  wsEid.columns = [
    { header: 'نام پرسنل', width: 22 },
    { header: 'مزد روزانه پایه (ریال)', width: 20 },
    { header: 'پایه سنوات روزانه (ریال)', width: 20 },
    { header: 'کارکرد سال جاری (روز)', width: 18 },
    { header: 'سابقه کل تسویه (روز)', width: 18 },
    { header: 'عیدی ۶۰ روزه فرد', width: 20 },
    { header: 'سقف قانونی عیدی (۹۰ روز حداقل)', width: 24 },
    { header: 'عیدی قابل پرداخت', width: 22 },
    { header: 'مالیات احتمالی مازاد عیدی', width: 22 },
    { header: 'حق سنوات پایان خدمت (معاف)', width: 24 },
  ];
  styleHeaderRow(wsEid.getRow(1));

  const eidSamples = [
    ['نمونه ۱ (حداقل‌بگیر یک‌ساله)', reg.minDailyWageRial, 0, 365, 365],
    ['نمونه ۲ (کارکرد ۲۰۰ روز در سال)', reg.minDailyWageRial * 1.5, reg.baseSeniorityDaily1YrRial, 200, 565],
    ['نمونه ۳ (حقوق بالا - مشمول سقف ۹۰ روز)', 18_000_000, reg.baseSeniorityDaily1YrRial, 365, 1100],
  ];
  eidSamples.forEach((s, idx) => {
    const r = idx + 2;
    const row = wsEid.addRow([
      s[0],
      s[1],
      s[2],
      s[3],
      s[4],
      { formula: `ROUND(B${r}*60,0)` },
      { formula: `ROUND(${P}!$C$3*90,0)` },
      { formula: `ROUND((MIN(F${r},G${r})/365)*D${r},0)` },
      { formula: `ROUND(MAX(0,H${r}-${P}!$C$14)*0.1,0)` },
      { formula: `ROUND((((B${r}+C${r})*30)/365)*E${r},0)` },
    ]);
    styleDataRow(row);
    [2, 3, 6, 7, 8, 9, 10].forEach((c) => {
      row.getCell(c).numFmt = '#,##0';
    });
  });

  // =========================================================================
  // SHEET 4: Insurance & Tax Applicability Matrix
  // =========================================================================
  const wsMatrix = wb.addWorksheet(matrixSheetName, {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });
  wsMatrix.columns = [
    { header: 'ردیف', width: 8 },
    { header: 'عنوان آیتم حقوقی', width: 32 },
    { header: 'دسته‌بندی', width: 22 },
    { header: 'وضعیت بیمه تأمین اجتماعی', width: 26 },
    { header: 'وضعیت مالیات حقوق', width: 28 },
    { header: 'مستند قانونی', width: 38 },
    { header: 'توضیح فرمول‌نویسی اکسل', width: 42 },
  ];
  styleHeaderRow(wsMatrix.getRow(1));

  APPLICABILITY_MATRIX.forEach((item, idx) => {
    const row = wsMatrix.addRow([
      idx + 1,
      item.title,
      item.category,
      item.insuranceLabel,
      item.taxLabel,
      item.legalBasis,
      item.excelNote,
    ]);
    styleDataRow(row);
    row.height = 32;
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
    row.getCell(7).alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
  });

  // =========================================================================
  // SHEET 5: Tax Brackets & Legacy Audit
  // =========================================================================
  const wsTax = wb.addWorksheet(taxAuditSheetName, {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });
  wsTax.columns = [
    { header: 'عنوان پله / موضوع', width: 30 },
    { header: 'از (ماهانه ریال / متن قدیمی)', width: 32 },
    { header: 'تا (ماهانه ریال / وضعیت جدید)', width: 36 },
    { header: 'نرخ / نتیجه', width: 20 },
  ];
  styleHeaderRow(wsTax.getRow(1));

  reg.taxBrackets.forEach((b) => {
    const row = wsTax.addRow([
      b.label,
      b.minMonthlyRial,
      b.maxMonthlyRial ?? 'به بالا (بدون سقف)',
      b.rate,
    ]);
    styleDataRow(row);
    row.getCell(2).numFmt = '#,##0';
    if (typeof b.maxMonthlyRial === 'number') {
      row.getCell(3).numFmt = '#,##0';
    }
    row.getCell(4).numFmt = '0%';
  });

  wsTax.addRow([]);
  const auditHeader = wsTax.addRow([
    'موضوع بررسی و تطبیق قوانین',
    'وضعیت در متن قدیمی (۱۴۰۲–۱۴۰۳)',
    `وضعیت به‌روزشده (${year})`,
    'نتیجه تدقیق',
  ]);
  styleHeaderRow(auditHeader, 'FF334155');

  LEGACY_AUDIT_POINTS.forEach((pt) => {
    const row = wsTax.addRow([
      pt.topic,
      pt.outdatedClaim,
      pt.currentStatus,
      pt.verdict,
    ]);
    styleDataRow(row);
    row.height = 42;
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
  });

  // =========================================================================
  // SHEET 6: EOS Compensation Model (Scorecard + Rocks + Profit Sharing)
  // =========================================================================
  const wsEos = wb.addWorksheet('نظام جبران خدمات EOS', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });
  wsEos.columns = [
    { header: 'صندلی در چارت پاسخگویی', width: 26 }, // A
    { header: 'احراز GWC (۱=بله، ۰=خیر)', width: 18 }, // B
    { header: 'حقوق پایه صندلی (ماهانه ریال)', width: 22 }, // C
    { header: 'بودجه پاداش اسکورکارد', width: 20 }, // D
    { header: 'تحقق اسکورکارد (٪)', width: 16 }, // E
    { header: 'پاداش اسکورکارد ماهانه (فرمول)', width: 24 }, // F
    { header: 'بودجه پاداش راک فصلی', width: 20 }, // G
    { header: 'تحقق راک کل سازمان (٪)', width: 18 }, // H
    { header: 'تحقق راک فردی (٪)', width: 16 }, // I
    { header: 'پاداش فصلی راک‌ها (شرط ۸۰٪)', width: 24 }, // J
    { header: 'ذخیره ماهانه راک (۱/۳)', width: 20 }, // K
    { header: 'سهم سود سالانه V/TO', width: 20 }, // L
    { header: 'کل جبران خدمات ماهانه صندلی (با ذخیره سود)', width: 28 }, // M
  ];
  styleHeaderRow(wsEos.getRow(1), 'FF0F766E');

  const eosSamples: (string | number)[][] = [
    ...(eosConfig
      ? [
          [
            eosConfig.seatName,
            eosConfig.isGwcQualified ? 1 : 0,
            eosConfig.seatMonthlyBaseRial,
            eosConfig.scorecardBudgetRial,
            eosConfig.scorecardAchievementPct / 100,
            eosConfig.quarterlyRockBudgetRial,
            eosConfig.companyRocksPct / 100,
            eosConfig.individualRocksPct / 100,
            eosConfig.annualProfitShareRial,
          ],
        ]
      : []),
    ['مدیر فروش (Sales)', 1, 500_000_000, 100_000_000, 1.08, 200_000_000, 0.85, 1.0, 600_000_000],
    ['راهبر عملیات (Integrator)', 1, 800_000_000, 150_000_000, 0.92, 300_000_000, 0.85, 1.0, 1_200_000_000],
    ['کارشناس پشتیبانی (زیر ۸۰٪)', 1, 250_000_000, 50_000_000, 0.74, 90_000_000, 0.75, 1.0, 0],
  ];

  eosSamples.forEach((s, idx) => {
    const r = idx + 2;
    const row = wsEos.addRow([
      s[0],
      s[1],
      s[2],
      s[3],
      s[4],
      {
        formula: `IF(B${r}=1,ROUND(D${r}*IF(E${r}<0.8,0,IF(E${r}<1,E${r},IF(E${r}<1.05,1,1.25))),0),0)`,
      }, // F: Scorecard
      s[5],
      s[6],
      s[7],
      {
        formula: `IF(AND(B${r}=1,H${r}>=0.8),ROUND(G${r}*I${r},0),0)`,
      }, // J: Quarterly Rocks
      { formula: `ROUND(J${r}/3,0)` }, // K: Monthly Rock Reserve
      s[8],
      { formula: `C${r}+F${r}+K${r}+ROUND(L${r}/12,0)` }, // M: Total Monthly EOS Package
    ]);
    styleDataRow(row);
    [3, 4, 6, 7, 10, 11, 12, 13].forEach((c) => {
      row.getCell(c).numFmt = '#,##0';
    });
    [5, 8, 9].forEach((c) => {
      row.getCell(c).numFmt = '0%';
    });
  });

  // Generate & trigger download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Iran-Payroll-CTC-${year}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
