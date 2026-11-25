import ExcelJS from 'exceljs';
import {
  getPayrollRuleSet,
} from '../data/payrollRuleRegistry';
import {
  getPayrollPayItem,
} from '../data/payrollPayItemCatalog';
import type { PayrollInput, PayrollResult } from './payrollEngine';
import type { PayrollRunResult } from './payrollRunEngine';

export interface EosExcelConfig {
  seatName: string;
  isGwcQualified: boolean;
  seatMonthlyBaseRial: number;
  scorecardBudgetRial: number;
  scorecardAchievementPct: number;
  scorecardBonusRial: number;
  quarterlyRockBudgetRial: number;
  companyRocksPct: number;
  individualRocksPct: number;
  quarterlyRockEarnedRial: number;
  monthlyRockReserveRial: number;
  annualProfitShareRial: number;
  monthlyProfitReserveRial: number;
  totalEosReservesRial: number;
  totalCtcMonthlyRial: number;
  totalCtcAnnualRial: number;
}

export interface PayrollExcelSnapshot {
  employeeCode?: string;
  employeeName: string;
  periodLabel?: string;
  input: PayrollInput;
  result: PayrollResult;
  eos?: EosExcelConfig;
}

function styleHeaderRow(row: ExcelJS.Row, bgColor = 'FF0F172A') {
  row.height = 30;
  row.eachCell((cell) => {
    cell.font = { name: 'Tahoma', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
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
  row.height = 25;
  row.eachCell((cell) => {
    cell.font = {
      name: 'Tahoma',
      size: 10,
      bold: isTotal,
      color: { argb: isTotal ? 'FF0F172A' : 'FF1E293B' },
    };
    if (isTotal) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
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

function setRialFormat(sheet: ExcelJS.Worksheet, columns: number[]) {
  for (const column of columns) {
    sheet.getColumn(column).numFmt = '#,##0;[Red]-#,##0';
  }
}

function addKeyValue(
  sheet: ExcelJS.Worksheet,
  title: string,
  value: string | number,
  note = ''
) {
  const row = sheet.addRow([title, value, note]);
  styleDataRow(row);
  row.getCell(1).alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
  row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
  if (typeof value === 'number') row.getCell(2).numFmt = '#,##0;[Red]-#,##0';
  return row;
}

/**
 * Builds an XLSX representation of an already-calculated payroll snapshot.
 * This adapter deliberately contains no payroll formulas: all amounts must
 * come from PayrollResult produced by the central payroll engine.
 */
export async function buildPayrollExcelWorkbook(
  snapshot: PayrollExcelSnapshot
): Promise<ExcelJS.Workbook> {
  const { input, result } = snapshot;
  const ruleSet = getPayrollRuleSet(input.year);

  if (result.ruleSetId !== ruleSet.id || result.ruleSetVersion !== ruleSet.version) {
    throw new Error(
      'Payroll export rejected: the result RuleSet does not match the selected payroll period.'
    );
  }

  const resolved =
    ExcelJS?.Workbook
      ? ExcelJS
      : (ExcelJS as unknown as { default?: typeof ExcelJS })?.default;
  const WorkbookCtor = resolved?.Workbook ?? ExcelJS.Workbook;
  const workbook = new WorkbookCtor();

  workbook.creator = 'مرجع حقوق و دستمزد ایران';
  workbook.created = new Date();
  workbook.subject = 'Exported payroll calculation snapshot';
  workbook.title = `فیش حقوقی ${snapshot.employeeName} - ${input.year}`;
  workbook.description = 'Values exported from the central payroll calculation engine. No independent payroll formulas are embedded.';

  // Sheet 1: payroll summary — all values are copied from PayrollResult.
  const summary = workbook.addWorksheet('خلاصه حقوق', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });
  summary.columns = [
    { header: 'عنوان', width: 38 },
    { header: 'مقدار', width: 26 },
    { header: 'توضیحات', width: 58 },
  ];
  styleHeaderRow(summary.getRow(1), 'FF0F766E');
  addKeyValue(summary, 'نام کارمند', snapshot.employeeName);
  addKeyValue(summary, 'کد پرسنلی', snapshot.employeeCode ?? 'ثبت نشده');
  addKeyValue(summary, 'دوره حقوق', snapshot.periodLabel ?? `سال ${input.year} · ماه ${input.monthDays} روزه`);
  addKeyValue(summary, 'شناسه مجموعه قواعد', result.ruleSetId);
  addKeyValue(summary, 'نسخه قواعد', result.ruleSetVersion);
  addKeyValue(summary, 'وضعیت تأیید حقوقی', result.ruleSetApprovalStatus);
  addKeyValue(summary, 'روزهای تقویمی ماه', input.monthDays);
  addKeyValue(summary, 'روزهای کارکرد ورودی', input.workDays);
  summary.addRow([]);
  addKeyValue(summary, 'حقوق پایه', result.basePayRial);
  addKeyValue(summary, 'پایه سنوات', result.seniorityPayRial);
  addKeyValue(summary, 'حق مسکن', result.housingPayRial);
  addKeyValue(summary, 'بن کارگری', result.couponPayRial);
  addKeyValue(summary, 'حق تأهل', result.marriagePayRial);
  addKeyValue(summary, 'حق اولاد', result.childAllowancePayRial);
  addKeyValue(summary, 'اضافه‌کاری', result.overtimePayRial);
  addKeyValue(summary, 'شب‌کاری', result.nightShiftPayRial);
  addKeyValue(summary, 'کار در تعطیل / جمعه‌کاری (عنوان ورودی فعلی)', result.holidayPayRial);
  addKeyValue(summary, 'پاداش متغیر', result.variableBonusRial);
  addKeyValue(summary, 'جمع ناخالص', result.grossEarningsRial);
  addKeyValue(summary, 'بیمه سهم کارگر', result.employeeInsuranceRial);
  addKeyValue(summary, 'مالیات حقوق', result.totalPayrollTaxRial);
  addKeyValue(summary, 'جمع کسورات', result.totalDeductionsRial);
  addKeyValue(summary, 'خالص پرداختی', result.netPayRial);
  addKeyValue(summary, 'بیمه سهم کارفرما', result.totalEmployerInsuranceRial);
  addKeyValue(summary, 'هزینه مستقیم کارفرما', result.totalEmployerCostRial);
  addKeyValue(summary, 'ذخیره ماهانه عیدی', result.monthlyEidReserveRial);
  addKeyValue(summary, 'ذخیره ماهانه سنوات', result.monthlySeveranceReserveRial);
  addKeyValue(summary, 'ذخیره ماهانه مرخصی', result.monthlyLeaveReserveRial);
  addKeyValue(summary, 'CTC ماهانه موتور حقوق', result.ctcMonthlyRial);
  addKeyValue(summary, 'CTC سالانه موتور حقوق', result.ctcAnnualRial);
  summary.addRow([]);
  const warningHeader = summary.addRow(['هشدارهای بررسی حقوقی', '', '']);
  styleHeaderRow(warningHeader, 'FFB45309');
  if (result.legalReviewRequiredItems.length === 0) {
    addKeyValue(summary, 'وضعیت', 'بدون هشدار ثبت‌شده');
  } else {
    result.legalReviewRequiredItems.forEach((warning, index) => {
      addKeyValue(summary, `هشدار ${index + 1}`, warning);
    });
  }
  setRialFormat(summary, [2]);
  summary.getColumn(1).alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
  summary.getColumn(3).alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };

  // Sheet 2: pay-item detail — catalog classification plus engine output.
  const detail = workbook.addWorksheet('جزئیات اقلام', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });
  detail.columns = [
    { header: 'شناسه قلم', width: 24 },
    { header: 'عنوان قلم', width: 34 },
    { header: 'مبلغ (ریال)', width: 22 },
    { header: 'مبنای بیمه (ریال)', width: 22 },
    { header: 'مبنای مالیات (ریال)', width: 22 },
    { header: 'وضعیت بیمه', width: 20 },
    { header: 'وضعیت مالیات', width: 20 },
    { header: 'وضعیت بازبینی حقوقی', width: 24 },
  ];
  styleHeaderRow(detail.getRow(1), 'FF0F766E');
  result.payItemBreakdown.forEach((line) => {
    const item = getPayrollPayItem(line.itemId);
    const row = detail.addRow([
      item.id,
      item.title,
      line.amountRial,
      line.insuranceBasisRial,
      line.taxableBasisRial,
      item.insuranceTreatment,
      item.taxTreatment,
      item.reviewStatus,
    ]);
    styleDataRow(row);
  });
  setRialFormat(detail, [3, 4, 5]);
  detail.autoFilter = { from: 'A1', to: 'H1' };

  // Sheet 3: insurance and tax — statutory results and progressive breakdown.
  const tax = workbook.addWorksheet('بیمه و مالیات', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });
  tax.columns = [
    { header: 'عنوان', width: 38 },
    { header: 'مقدار (ریال)', width: 24 },
    { header: 'شرح', width: 56 },
  ];
  styleHeaderRow(tax.getRow(1), 'FF334155');
  addKeyValue(tax, 'جمع اقلام مشمول بیمه پیش از سقف', result.insuranceSubjectEarningsRial);
  addKeyValue(tax, 'سقف بیمه دوره', result.insuranceMonthlyCeilingRial);
  addKeyValue(tax, 'مبنای بیمه پس از اعمال سقف', result.cappedInsuranceBasisRial);
  addKeyValue(tax, 'نرخ سهم کارگر', ruleSet.regulations.insuranceEmployeeRate * 100, 'درصد');
  addKeyValue(tax, 'بیمه سهم کارگر', result.employeeInsuranceRial);
  addKeyValue(tax, 'بیمه سهم پایه کارفرما', result.employerInsuranceBaseRial);
  addKeyValue(tax, 'بیمه بیکاری سهم کارفرما', result.unemploymentInsuranceRial);
  addKeyValue(tax, 'جمع بیمه سهم کارفرما', result.totalEmployerInsuranceRial);
  addKeyValue(tax, 'درآمد مشمول مالیات حقوق', result.taxableIncomeRial);
  addKeyValue(tax, 'مالیات حقوق', result.totalPayrollTaxRial);
  addKeyValue(tax, 'نرخ مؤثر مالیاتی', result.effectiveTaxRate * 100, 'درصد');
  tax.addRow([]);
  const stepsHeader = tax.addRow(['پله مالیاتی', 'درآمد واقع‌شده در پله (ریال)', 'نرخ و مالیات همان پله']);
  styleHeaderRow(stepsHeader, 'FF0F766E');
  result.taxSteps.forEach((step) => {
    tax.addRow([
      step.label,
      step.sliceAmountRial,
      `${(step.rate * 100).toFixed(2)}% · ${step.taxAmountRial.toLocaleString('en-US')} ریال`,
    ]);
  });
  setRialFormat(tax, [2]);

  // Sheet 4: annual entitlements and settlement estimates from PayrollResult.
  const settlement = workbook.addWorksheet('عیدی و سنوات', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });
  settlement.columns = [
    { header: 'عنوان', width: 42 },
    { header: 'مقدار (ریال)', width: 26 },
    { header: 'شرح', width: 58 },
  ];
  styleHeaderRow(settlement.getRow(1), 'FF334155');
  addKeyValue(settlement, 'روز کارکرد سال برای عیدی', input.annualWorkedDays);
  addKeyValue(settlement, 'عیدی بر مبنای مزد فرد', result.eidMinAnnualRial);
  addKeyValue(settlement, 'سقف عیدی قانونی', result.eidMaxCapAnnualRial);
  addKeyValue(settlement, 'عیدی قابل پرداخت بر مبنای ورودی فعلی', result.eidPayableRial);
  addKeyValue(settlement, 'بخش مازاد بر معافیت ثبت‌شده', result.eidTaxableExcessRial);
  addKeyValue(settlement, 'مالیات تخمینی عیدی', result.eidEstimatedTaxRial, 'برآورد موتور؛ وضعیت مالیاتی نیازمند تطبیق نهایی');
  addKeyValue(settlement, 'سابقه سنوات (سال)', input.serviceYearsForSeverance);
  addKeyValue(settlement, 'سابقه سنوات (روز اضافه)', input.serviceExtraDaysForSeverance);
  addKeyValue(settlement, 'مبلغ سنوات پایان خدمت', result.severancePayableRial);
  setRialFormat(settlement, [2]);

  // Sheet 5: rule parameters used by this exact calculation.
  const rates = workbook.addWorksheet('نرخ‌ها و قواعد', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });
  rates.columns = [
    { header: 'پارامتر', width: 42 },
    { header: 'مقدار', width: 26 },
    { header: 'توضیح', width: 60 },
  ];
  styleHeaderRow(rates.getRow(1));
  addKeyValue(rates, 'RuleSet ID', ruleSet.id);
  addKeyValue(rates, 'RuleSet Version', ruleSet.version);
  addKeyValue(rates, 'سال مالی', ruleSet.year);
  addKeyValue(rates, 'تاریخ شروع اعتبار', ruleSet.effectiveFromJalali);
  addKeyValue(rates, 'تاریخ پایان اعتبار', ruleSet.effectiveToJalali ?? 'بدون تاریخ پایان ثبت‌شده');
  addKeyValue(rates, 'وضعیت تأیید حقوقی', ruleSet.approvalStatus);
  addKeyValue(rates, 'حداقل مزد روزانه', ruleSet.regulations.minDailyWageRial);
  addKeyValue(rates, 'پایه سنوات روزانه', ruleSet.regulations.baseSeniorityDaily1YrRial);
  addKeyValue(rates, 'درصد افزایش سایر سطوح مزدی', ruleSet.regulations.otherLevelsIncreaseRate * 100, 'درصد');
  addKeyValue(rates, 'افزایش ثابت روزانه سایر سطوح', ruleSet.regulations.otherLevelsDailyFixedIncreaseRial);
  addKeyValue(rates, 'حق مسکن ماهانه', ruleSet.regulations.housingAllowanceRial);
  addKeyValue(rates, 'بن کارگری ماهانه', ruleSet.regulations.workerCouponRial);
  addKeyValue(rates, 'حق تأهل ماهانه', ruleSet.regulations.marriageAllowanceRial);
  addKeyValue(rates, 'حق اولاد هر فرزند', ruleSet.regulations.childAllowancePerChildRial);
  addKeyValue(rates, 'سقف بیمه (ضریب حداقل مزد)', ruleSet.regulations.insuranceCeilingMultiplier);
  addKeyValue(rates, 'نرخ بیمه کارگر', ruleSet.regulations.insuranceEmployeeRate * 100, 'درصد');
  addKeyValue(rates, 'نرخ بیمه پایه کارفرما', ruleSet.regulations.insuranceEmployerBaseRate * 100, 'درصد');
  addKeyValue(rates, 'نرخ بیمه بیکاری', ruleSet.regulations.unemploymentInsuranceRate * 100, 'درصد');
  addKeyValue(rates, 'معافیت ماهانه مالیات حقوق', ruleSet.regulations.taxMonthlyExemptionRial);
  addKeyValue(rates, 'معافیت سالانه مالیات حقوق', ruleSet.regulations.taxAnnualExemptionRial);
  rates.addRow([]);
  const bracketHeader = rates.addRow(['پله مالیاتی', 'حداقل ماهانه (ریال)', 'حداکثر ماهانه (ریال) / نرخ']);
  styleHeaderRow(bracketHeader, 'FF0F766E');
  ruleSet.regulations.taxBrackets.forEach((bracket) => {
    rates.addRow([
      bracket.label,
      bracket.minMonthlyRial,
      `${bracket.maxMonthlyRial === null ? 'بدون سقف' : bracket.maxMonthlyRial.toLocaleString('en-US')} · ${(bracket.rate * 100).toFixed(2)}%`,
    ]);
  });
  setRialFormat(rates, [2]);

  // Sheet 6: EOS — export the already evaluated EOS results; do not re-run its formulas.
  if (snapshot.eos) {
    const eosData = snapshot.eos;
    const eosSheet = workbook.addWorksheet('جبران خدمات EOS', {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
    });
    eosSheet.columns = [
      { header: 'عنوان', width: 42 },
      { header: 'مقدار', width: 28 },
      { header: 'شرح', width: 58 },
    ];
    styleHeaderRow(eosSheet.getRow(1), 'FF0F766E');
    addKeyValue(eosSheet, 'صندلی / نقش', eosData.seatName);
    addKeyValue(eosSheet, 'احراز شرایط GWC', eosData.isGwcQualified ? 'بله' : 'خیر');
    addKeyValue(eosSheet, 'حقوق پایه ماهانه صندلی', eosData.seatMonthlyBaseRial);
    addKeyValue(eosSheet, 'بودجه اسکورکارد', eosData.scorecardBudgetRial);
    addKeyValue(eosSheet, 'درصد تحقق اسکورکارد', eosData.scorecardAchievementPct);
    addKeyValue(eosSheet, 'پاداش محاسبه‌شده اسکورکارد', eosData.scorecardBonusRial);
    addKeyValue(eosSheet, 'بودجه راک فصلی', eosData.quarterlyRockBudgetRial);
    addKeyValue(eosSheet, 'تحقق راک سازمان', eosData.companyRocksPct);
    addKeyValue(eosSheet, 'تحقق راک فردی', eosData.individualRocksPct);
    addKeyValue(eosSheet, 'پاداش فصلی راک', eosData.quarterlyRockEarnedRial);
    addKeyValue(eosSheet, 'ذخیره ماهانه راک', eosData.monthlyRockReserveRial);
    addKeyValue(eosSheet, 'سهم سود سالانه', eosData.annualProfitShareRial);
    addKeyValue(eosSheet, 'ذخیره ماهانه سهم سود', eosData.monthlyProfitReserveRial);
    addKeyValue(eosSheet, 'جمع ذخایر EOS', eosData.totalEosReservesRial);
    addKeyValue(eosSheet, 'CTC ماهانه همراه EOS', eosData.totalCtcMonthlyRial);
    addKeyValue(eosSheet, 'CTC سالانه همراه EOS', eosData.totalCtcAnnualRial);
    setRialFormat(eosSheet, [2]);
  }


  // Excel-compatible detailed calculation output (A:AN). Values are sourced
  // exclusively from PayrollRunResult and its input snapshot; no payroll formula
  // is duplicated in this workbook.
  const calculations = workbook.addWorksheet('محاسبات حقوق', {
    views: [{ rightToLeft: true, state: 'frozen', xSplit: 4, ySplit: 1 }],
  });
  calculations.columns = [
    { header: 'شناسه فیش', width: 24 },
    { header: 'سال', width: 10 },
    { header: 'ماه', width: 8 },
    { header: 'کد پرسنلی', width: 16 },
    { header: 'نام', width: 24 },
    { header: 'سمت', width: 24 },
    { header: 'مرکز هزینه', width: 20 },
    { header: 'روز ماه', width: 10 },
    { header: 'روز مبنای محاسبه', width: 16 },
    { header: 'مزد روزانه', width: 18 },
    { header: 'حقوق پایه', width: 18 },
    { header: 'بن', width: 16 },
    { header: 'مسکن', width: 16 },
    { header: 'حق تأهل', width: 16 },
    { header: 'پایه سنوات', width: 16 },
    { header: 'حق اولاد', width: 16 },
    { header: 'اضافه‌کاری', width: 18 },
    { header: 'شب‌کاری', width: 18 },
    { header: 'جمعه‌کاری', width: 18 },
    { header: 'مأموریت', width: 18 },
    { header: 'مزایای مشمول بیمه', width: 20 },
    { header: 'مزایای غیرمشمول بیمه', width: 22 },
    { header: 'پاداش', width: 18 },
    { header: 'اصلاح حقوق', width: 18 },
    { header: 'ناخالص', width: 20 },
    { header: 'مبنای بیمه پیش از سقف', width: 23 },
    { header: 'بیمه کارگر', width: 18 },
    { header: 'بیمه کارفرما', width: 18 },
    { header: 'درآمد مشمول مالیات', width: 22 },
    { header: 'مالیات', width: 18 },
    { header: 'وام/قسط', width: 18 },
    { header: 'مساعده', width: 18 },
    { header: 'سایر کسورات', width: 18 },
    { header: 'جمع کسورات', width: 18 },
    { header: 'خالص پرداختی', width: 20 },
    { header: 'هزینه مستقیم کارفرما', width: 24 },
    { header: 'شماره حساب', width: 26 },
    { header: 'شماره شبا', width: 32 },
    { header: 'تاریخ پرداخت', width: 16 },
    { header: 'وضعیت کنترل', width: 28 },
    { header: 'تعطیل‌کاری عمومی (مبلغ)', width: 22 },
    { header: 'مرخصی استحقاقی (روز)', width: 20 },
    { header: 'استعلاجی (روز)', width: 18 },
    { header: 'غیبت بدون حقوق (روز)', width: 22 },
    { header: 'اضافه‌کاری (ساعت)', width: 18 },
    { header: 'شب‌کاری (ساعت)', width: 18 },
    { header: 'تعطیل‌کاری عمومی (ساعت)', width: 22 },
    { header: 'جمعه‌کاری (ساعت)', width: 18 },
    { header: 'مأموریت (روز)', width: 18 },
    { header: 'ذخایر ماهانه', width: 20 },
    { header: 'CTC ماهانه', width: 20 },
    { header: 'CTC سالانه‌شده', width: 22 },
    { header: 'یادداشت ماهانه', width: 42 },
  ];
  styleHeaderRow(calculations.getRow(1), 'FF0F766E');
  run.lines.forEach((line) => {
    const input = line.payrollInput;
    const result = line.result;
    const calculatedStatus = line.status === 'calculated'
      ? 'محاسبه شد - نیازمند بررسی و تأیید'
      : line.status === 'blocked'
        ? 'مسدود - نیازمند اصلاح'
        : 'خارج از محاسبه';
    calculations.addRow([
      input.payslipId || run.fiscalYear + '-' + String(run.month).padStart(2, '0') + '-' + line.personnelCode,
      run.fiscalYear,
      run.month,
      line.personnelCode,
      line.fullName,
      line.jobTitle ?? '',
      line.costCenter ?? '',
      run.monthDays,
      input.workDays,
      input.dailyBaseWageRial,
      result?.basePayRial ?? null,
      result?.couponPayRial ?? null,
      result?.housingPayRial ?? null,
      result?.marriagePayRial ?? null,
      result?.seniorityPayRial ?? null,
      result?.childAllowancePayRial ?? null,
      result?.overtimePayRial ?? null,
      result?.nightShiftPayRial ?? null,
      result?.fridayWorkPayRial ?? null,
      result?.missionPayRial ?? null,
      result?.insuredBenefitsRial ?? null,
      result?.nonInsuredBenefitsRial ?? null,
      result?.variableBonusRial ?? null,
      result?.signedCorrectionRial ?? null,
      result?.grossEarningsRial ?? null,
      result?.insuranceSubjectEarningsRial ?? null,
      result?.employeeInsuranceRial ?? null,
      result?.totalEmployerInsuranceRial ?? null,
      result?.taxableIncomeRial ?? null,
      result?.totalPayrollTaxRial ?? null,
      result?.loanDeductionRial ?? null,
      result?.advanceDeductionRial ?? null,
      result?.otherDeductionsRial ?? null,
      result?.totalDeductionsRial ?? null,
      result?.netPayRial ?? null,
      result?.totalEmployerCostRial ?? null,
      line.bankAccountNumber ?? '',
      line.bankIban ?? '',
      input.paymentDate ?? '',
      calculatedStatus,
      result?.holidayPayRial ?? null,
      input.paidLeaveDays ?? 0,
      input.sickLeaveDays ?? 0,
      input.unpaidAbsenceDays ?? 0,
      input.overtimeHours,
      input.nightShiftHours,
      input.holidayHours,
      input.fridayHours ?? 0,
      input.missionDays ?? 0,
      result?.totalMonthlyReservesRial ?? null,
      result?.ctcMonthlyRial ?? null,
      result?.ctcAnnualRial ?? null,
      input.monthlyNotes ?? '',
    ]);
  });
  setRialFormat(calculations, [
    10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
    26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 41, 50, 51, 52,
  ]);
  calculations.autoFilter = { from: 'A1', to: 'AZ1' };

  // Period management summary and cost-center consolidation.
  const monthlySummary = workbook.addWorksheet('خلاصه ماهانه', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });
  monthlySummary.columns = [
    { header: 'شاخص', width: 36 },
    { header: 'مبلغ/تعداد', width: 26 },
    { header: 'مرکز هزینه', width: 24 },
    { header: 'تعداد نفر', width: 14 },
    { header: 'ناخالص', width: 22 },
    { header: 'بیمه کارفرما', width: 22 },
    { header: 'خالص', width: 22 },
    { header: 'هزینه کل کارفرما', width: 24 },
    { header: 'CTC ماهانه', width: 22 },
  ];
  styleHeaderRow(monthlySummary.getRow(1), 'FF0F766E');
  addKeyValue(monthlySummary, 'سال گزارش', run.fiscalYear);
  addKeyValue(monthlySummary, 'ماه گزارش', run.month);
  addKeyValue(monthlySummary, 'شناسه Snapshot', run.runId);
  addKeyValue(monthlySummary, 'تعداد کل کارکنان/ردیف‌ها', run.totals.employeeCount);
  addKeyValue(monthlySummary, 'تعداد محاسبه‌شده', run.totals.calculatedCount);
  addKeyValue(monthlySummary, 'تعداد نیازمند اصلاح', run.totals.blockedCount);
  addKeyValue(monthlySummary, 'تعداد خارج از محاسبه', run.totals.excludedCount);
  addKeyValue(monthlySummary, 'جمع ناخالص', run.totals.grossEarningsRial);
  addKeyValue(monthlySummary, 'بیمه سهم کارگر', run.totals.employeeInsuranceRial);
  addKeyValue(monthlySummary, 'بیمه سهم کارفرما', run.totals.employerInsuranceRial);
  addKeyValue(monthlySummary, 'مالیات حقوق', run.totals.payrollTaxRial);
  addKeyValue(monthlySummary, 'جمع کسورات', run.totals.totalDeductionsRial);
  addKeyValue(monthlySummary, 'خالص پرداختی', run.totals.netPayRial);
  addKeyValue(monthlySummary, 'هزینه مستقیم کارفرما', run.totals.directEmployerCostRial);
  addKeyValue(monthlySummary, 'ذخایر ماهانه', run.totals.monthlyReservesRial);
  addKeyValue(monthlySummary, 'CTC ماهانه', run.totals.ctcMonthlyRial);
  addKeyValue(monthlySummary, 'CTC سالانه‌شده', run.totals.ctcAnnualRial);
  monthlySummary.addRow([]);
  const costCenterHeader = monthlySummary.addRow([
    'تفکیک مرکز هزینه', '', 'مرکز هزینه', 'تعداد نفر', 'ناخالص',
    'بیمه کارفرما', 'خالص', 'هزینه مستقیم', 'CTC ماهانه',
  ]);
  styleHeaderRow(costCenterHeader, 'FF334155');
  const costCenters = new Map<string, {
    count: number; gross: number; employerInsurance: number; net: number;
    directCost: number; ctc: number;
  }>();
  run.lines.filter((line) => line.status === 'calculated' && line.result).forEach((line) => {
    const name = (line.costCenter ?? '').trim() || 'بدون مرکز هزینه';
    const current = costCenters.get(name) ?? {
      count: 0, gross: 0, employerInsurance: 0, net: 0, directCost: 0, ctc: 0,
    };
    current.count += 1;
    current.gross += line.result!.grossEarningsRial;
    current.employerInsurance += line.result!.totalEmployerInsuranceRial;
    current.net += line.result!.netPayRial;
    current.directCost += line.result!.totalEmployerCostRial;
    current.ctc += line.result!.ctcMonthlyRial;
    costCenters.set(name, current);
  });
  [...costCenters.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fa')).forEach(([name, values]) => {
    monthlySummary.addRow([
      '', '', name, values.count, values.gross, values.employerInsurance,
      values.net, values.directCost, values.ctc,
    ]);
  });
  setRialFormat(monthlySummary, [2, 5, 6, 7, 8, 9]);

  // A bank transfer register; only calculated, non-blocked payroll lines are exported.
  const bankRegister = workbook.addWorksheet('لیست پرداخت بانکی', {
    views: [{ rightToLeft: true, state: 'frozen', xSplit: 2, ySplit: 1 }],
  });
  bankRegister.columns = [
    { header: 'کد پرسنلی', width: 16 },
    { header: 'نام کارمند', width: 26 },
    { header: 'شماره حساب', width: 28 },
    { header: 'شماره شبا', width: 34 },
    { header: 'مبلغ خالص قابل پرداخت (ریال)', width: 28 },
    { header: 'شناسه فیش', width: 26 },
    { header: 'تاریخ پرداخت', width: 18 },
    { header: 'مرکز هزینه', width: 22 },
  ];
  styleHeaderRow(bankRegister.getRow(1), 'FF334155');
  run.lines.filter((line) => line.status === 'calculated' && line.result).forEach((line) => {
    bankRegister.addRow([
      line.personnelCode,
      line.fullName,
      line.bankAccountNumber ?? '',
      line.bankIban ?? '',
      line.result!.netPayRial,
      line.payrollInput.payslipId || run.fiscalYear + '-' + String(run.month).padStart(2, '0') + '-' + line.personnelCode,
      line.payrollInput.paymentDate ?? '',
      line.costCenter ?? '',
    ]);
  });
  setRialFormat(bankRegister, [5]);
  bankRegister.autoFilter = { from: 'A1', to: 'H1' };

  // A separate print-ready payslip sheet for every calculated employee.
  const usedSheetNames = new Set(workbook.worksheets.map((sheet) => sheet.name.toLocaleLowerCase()));
  run.lines.filter((line) => line.status === 'calculated' && line.result).forEach((line) => {
    const rawName = 'فیش ' + line.personnelCode;
    let sheetName = rawName.replace(/[\\/?*\[\]:]/g, '-').slice(0, 31);
    let suffix = 2;
    while (usedSheetNames.has(sheetName.toLocaleLowerCase())) {
      const tail = '-' + suffix;
      sheetName = rawName.slice(0, 31 - tail.length) + tail;
      suffix += 1;
    }
    usedSheetNames.add(sheetName.toLocaleLowerCase());
    const slip = workbook.addWorksheet(sheetName, {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
      pageSetup: {
        paperSize: 9,
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
      },
    });
    slip.columns = [
      { width: 30 }, { width: 24 }, { width: 26 }, { width: 24 }, { width: 24 },
    ];
    slip.mergeCells('A1:E1');
    slip.getCell('A1').value = 'فیش حقوق و دستمزد';
    styleHeaderRow(slip.getRow(1), 'FF0F766E');
    slip.addRow(['نام کارمند', line.fullName, 'کد پرسنلی', line.personnelCode, '']);
    slip.addRow(['عنوان شغلی', line.jobTitle ?? 'ثبت نشده', 'مرکز هزینه', line.costCenter ?? 'ثبت نشده', '']);
    slip.addRow(['دوره', run.fiscalYear + ' / ' + String(run.month), 'شناسه فیش',
      line.payrollInput.payslipId || run.fiscalYear + '-' + String(run.month).padStart(2, '0') + '-' + line.personnelCode, '']);
    slip.addRow(['تاریخ پرداخت', line.payrollInput.paymentDate || 'ثبت نشده',
      'شماره بیمه', line.insuranceNumber ?? 'ثبت نشده', '']);
    slip.addRow(['شماره حساب', line.bankAccountNumber ?? 'ثبت نشده', 'شماره شبا', line.bankIban ?? 'ثبت نشده', '']);
    slip.addRow([]);
    const attendanceHeader = slip.addRow(['خلاصه کارکرد', '', 'مقدار', '', '']);
    styleHeaderRow(attendanceHeader, 'FF334155');
    [
      ['روز ماه', run.monthDays],
      ['روز کارکرد مبنای محاسبه', line.payrollInput.workDays],
      ['مرخصی استحقاقی', line.payrollInput.paidLeaveDays ?? 0],
      ['مرخصی استعلاجی', line.payrollInput.sickLeaveDays ?? 0],
      ['غیبت بدون حقوق', line.payrollInput.unpaidAbsenceDays ?? 0],
      ['اضافه‌کاری (ساعت)', line.payrollInput.overtimeHours],
      ['شب‌کاری (ساعت)', line.payrollInput.nightShiftHours],
      ['تعطیل‌کاری عمومی (ساعت)', line.payrollInput.holidayHours],
      ['جمعه‌کاری (ساعت)', line.payrollInput.fridayHours ?? 0],
      ['مأموریت (روز)', line.payrollInput.missionDays ?? 0],
    ].forEach(([label, value]) => slip.addRow([label, value, '', '', '']));
    slip.addRow([]);
    const earningHeader = slip.addRow(['اقلام پرداختی', 'مبلغ (ریال)', '', 'اقلام کسری', 'مبلغ (ریال)']);
    styleHeaderRow(earningHeader, 'FF0F766E');
    const earningLines = line.result!.payItemBreakdown.filter((itemLine) =>
      getPayrollPayItem(itemLine.itemId).kind === 'earning' && itemLine.amountRial !== 0
    );
    const deductionLines = line.result!.payItemBreakdown.filter((itemLine) =>
      getPayrollPayItem(itemLine.itemId).kind === 'deduction' && itemLine.amountRial !== 0
    );
    const maxLines = Math.max(earningLines.length, deductionLines.length, 1);
    for (let index = 0; index < maxLines; index += 1) {
      const earning = earningLines[index];
      const deduction = deductionLines[index];
      slip.addRow([
        earning ? getPayrollPayItem(earning.itemId).title : '',
        earning ? earning.amountRial : null,
        '',
        deduction ? getPayrollPayItem(deduction.itemId).title : '',
        deduction ? deduction.amountRial : null,
      ]);
    }
    slip.addRow(['بیمه سهم کارگر', line.result!.employeeInsuranceRial, '', 'مالیات حقوق', line.result!.totalPayrollTaxRial]);
    slip.addRow(['جمع ناخالص', line.result!.grossEarningsRial, '', 'جمع کسورات', line.result!.totalDeductionsRial]);
    slip.addRow(['خالص پرداختی', line.result!.netPayRial, '', 'بیمه سهم کارفرما', line.result!.totalEmployerInsuranceRial]);
    slip.addRow(['هزینه مستقیم کارفرما', line.result!.totalEmployerCostRial, '', 'CTC ماهانه', line.result!.ctcMonthlyRial]);
    slip.addRow(['ذخایر ماهانه کارفرما', line.result!.totalMonthlyReservesRial, '', 'وضعیت قواعد', line.result!.ruleSetApprovalStatus]);
    slip.addRow([]);
    slip.addRow(['وضعیت تأیید', 'محاسبه‌شده؛ نیازمند بررسی و تأیید مالی', '', '', '']);
    slip.addRow(['هشدارهای حقوقی', line.result!.legalReviewRequiredItems.join('؛ '), '', '', '']);
    slip.addRow(['یادداشت ماهانه', line.payrollInput.monthlyNotes ?? '', '', '', '']);
    slip.eachRow((row, rowNumber) => {
      if (rowNumber > 1) styleDataRow(row, rowNumber >= slip.rowCount - 3);
    });
    slip.getColumn(2).numFmt = '#,##0;[Red]-#,##0';
    slip.getColumn(5).numFmt = '#,##0;[Red]-#,##0';
    slip.getColumn(1).alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
    slip.getColumn(4).alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
    slip.getColumn(2).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    slip.getColumn(5).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    slip.pageSetup.printArea = 'A1:E' + slip.rowCount;
  });

  // The settlement worksheet exports only amounts already produced by the
  // central engine. Missing settlement inputs remain blank instead of being
  // guessed; column N is explicitly a subtotal, not a final payable settlement.
  const settlement = workbook.addWorksheet('عیدی و تسویه', {
    views: [{ rightToLeft: true, state: 'frozen', xSplit: 2, ySplit: 3 }],
  });
  settlement.columns = [
    { header: 'کد پرسنلی', width: 16 },
    { header: 'نام', width: 26 },
    { header: 'ماه کارکرد سال (نیازمند ثبت مستقل)', width: 28 },
    { header: 'روز کارکرد سال', width: 18 },
    { header: 'مزد روزانه پایان', width: 20 },
    { header: 'حقوق ماهانه مبنا', width: 22 },
    { header: 'عیدی حداقل محاسبه‌شده', width: 22 },
    { header: 'سقف عیدی قانونی محاسبه‌شده', width: 25 },
    { header: 'عیدی قابل پرداخت موتور', width: 22 },
    { header: 'سنوات پایان کار موتور', width: 22 },
    { header: 'مانده مرخصی (روز)', width: 20 },
    { header: 'بازخرید مرخصی (نیازمند قاعده/تأیید)', width: 30 },
    { header: 'سایر مطالبات (ورودی مستقل)', width: 24 },
    { header: 'جمع عیدی و سنوات محاسبه‌شده (غیرنهایی)', width: 34 },
  ];
  styleHeaderRow(settlement.getRow(1), 'FF334155');
  run.lines.forEach((line) => {
    const result = line.result;
    const input = line.payrollInput;
    const finalDailyBase = input.dailyBaseWageRial + input.dailySeniorityRial;
    settlement.addRow([
      line.personnelCode,
      line.fullName,
      null,
      input.annualWorkedDays,
      finalDailyBase,
      finalDailyBase * 30,
      result?.eidMinAnnualRial ?? null,
      result?.eidMaxCapAnnualRial ?? null,
      result?.eidPayableRial ?? null,
      result?.severancePayableRial ?? null,
      line.leaveBalanceDays ?? null,
      null,
      null,
      result ? result.eidPayableRial + result.severancePayableRial : null,
    ]);
  });
  settlement.insertRow(1, [
    'توجه: ستون‌های ماه کارکرد، بازخرید مرخصی و سایر مطالبات در این Snapshot ورودی/محاسبه مصوب ندارند. ستون آخر فقط جمع عیدی و سنوات محاسبه‌شده است و جمع نهایی تسویه محسوب نمی‌شود.',
  ]);
  settlement.mergeCells('A1:N1');
  settlement.getRow(1).height = 38;
  settlement.getRow(1).font = { name: 'Tahoma', size: 10, bold: true, color: { argb: 'FF9A3412' } };
  settlement.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
  settlement.getRow(1).alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
  settlement.getRow(2).eachCell((cell) => {
    cell.font = { name: 'Tahoma', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  setRialFormat(settlement, [5, 6, 7, 8, 9, 10, 14]);
  settlement.autoFilter = { from: 'A2', to: 'N' + settlement.rowCount };

  for (const sheet of workbook.worksheets) {
    sheet.eachRow((row) => styleDataRow(row));
    styleHeaderRow(sheet.getRow(1));
    sheet.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }];
  }

  return workbook;
}

export async function downloadPayrollExcelWorkbook(
  snapshot: PayrollExcelSnapshot
): Promise<void> {
  const workbook = await buildPayrollExcelWorkbook(snapshot);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Iran-Payroll-${snapshot.input.year}-${snapshot.employeeCode ?? 'employee'}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


/**
 * Builds a multi-employee payroll register from the reviewed PayrollRunResult.
 * Every amount is taken from employee-level PayrollResult snapshots; this
 * function intentionally contains no payroll formula or recalculation.
 */
export async function buildPayrollRunExcelWorkbook(
  run: PayrollRunResult
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'مرجع حقوق و دستمزد ایران';
  workbook.created = new Date();
  workbook.title = `دفتر حقوق دوره ${run.fiscalYear}-${String(run.month).padStart(2, '0')}`;
  workbook.subject = 'Multi-employee payroll run snapshot';
  workbook.description = 'Payroll register exported from the central PayrollRunResult. No independent payroll formulas are embedded.';

  const summary = workbook.addWorksheet('خلاصه دوره', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });
  summary.columns = [
    { header: 'عنوان', width: 40 },
    { header: 'مقدار', width: 28 },
    { header: 'توضیح', width: 55 },
  ];
  styleHeaderRow(summary.getRow(1), 'FF0F766E');
  addKeyValue(summary, 'شناسه دوره', run.runId);
  addKeyValue(summary, 'سال مالی', run.fiscalYear);
  addKeyValue(summary, 'ماه', run.month);
  addKeyValue(summary, 'طول ماه', run.monthDays);
  addKeyValue(summary, 'وضعیت دوره', run.status);
  const firstCalculatedResult = run.lines.find((line) => line.result)?.result;
  addKeyValue(summary, 'شناسه مجموعه قواعد', firstCalculatedResult?.ruleSetId ?? 'بدون نتیجه محاسبه‌شده');
  addKeyValue(summary, 'نسخه مجموعه قواعد', firstCalculatedResult?.ruleSetVersion ?? '—');
  addKeyValue(summary, 'وضعیت تأیید حقوقی قواعد', firstCalculatedResult?.ruleSetApprovalStatus ?? '—');
  addKeyValue(summary, 'تعداد کل ردیف‌ها', run.totals.employeeCount);
  addKeyValue(summary, 'تعداد محاسبه‌شده', run.totals.calculatedCount);
  addKeyValue(summary, 'تعداد مسدودشده', run.totals.blockedCount);
  addKeyValue(summary, 'تعداد خارج از دوره', run.totals.excludedCount);
  summary.addRow([]);
  addKeyValue(summary, 'جمع ناخالص', run.totals.grossEarningsRial);
  addKeyValue(summary, 'بیمه سهم کارگر', run.totals.employeeInsuranceRial);
  addKeyValue(summary, 'مالیات حقوق', run.totals.payrollTaxRial);
  addKeyValue(summary, 'جمع کسورات', run.totals.totalDeductionsRial);
  addKeyValue(summary, 'خالص پرداختی', run.totals.netPayRial);
  addKeyValue(summary, 'بیمه سهم کارفرما', run.totals.employerInsuranceRial);
  addKeyValue(summary, 'هزینه مستقیم کارفرما', run.totals.directEmployerCostRial);
  addKeyValue(summary, 'ذخایر ماهانه', run.totals.monthlyReservesRial);
  addKeyValue(summary, 'CTC ماهانه', run.totals.ctcMonthlyRial);
  addKeyValue(summary, 'CTC سالانه', run.totals.ctcAnnualRial);
  if (run.periodIssues.length > 0) {
    summary.addRow([]);
    const header = summary.addRow(['خطاهای سطح دوره', '', '']);
    styleHeaderRow(header, 'FFB45309');
    run.periodIssues.forEach((issue) => addKeyValue(summary, issue.code, issue.message));
  }
  setRialFormat(summary, [2]);

  const register = workbook.addWorksheet('لیست حقوق', {
    views: [{ rightToLeft: true, state: 'frozen', xSplit: 2, ySplit: 1 }],
  });
  register.columns = [
    { header: 'کد پرسنلی', width: 16 },
    { header: 'نام کارمند', width: 26 },
    { header: 'وضعیت', width: 18 },
    { header: 'روز کارکرد', width: 12 },
    { header: 'مزد پایه', width: 20 },
    { header: 'پایه سنوات', width: 18 },
    { header: 'حق مسکن', width: 16 },
    { header: 'بن', width: 16 },
    { header: 'حق تأهل', width: 16 },
    { header: 'حق اولاد', width: 16 },
    { header: 'اضافه‌کاری', width: 18 },
    { header: 'شب‌کاری', width: 18 },
    { header: 'کار در تعطیل', width: 18 },
    { header: 'پاداش متغیر', width: 18 },
    { header: 'ناخالص', width: 20 },
    { header: 'مبنای بیمه', width: 20 },
    { header: 'بیمه کارگر', width: 18 },
    { header: 'درآمد مشمول مالیات', width: 22 },
    { header: 'مالیات', width: 18 },
    { header: 'جمع کسورات', width: 18 },
    { header: 'خالص', width: 20 },
    { header: 'بیمه کارفرما', width: 20 },
    { header: 'هزینه مستقیم', width: 20 },
    { header: 'ذخایر ماهانه', width: 20 },
    { header: 'CTC ماهانه', width: 20 },
    { header: 'CTC سالانه', width: 20 },
  ];
  styleHeaderRow(register.getRow(1), 'FF0F766E');

  run.lines.forEach((line) => {
    const result = line.result;
    const input = line.payrollInput;
    const row = register.addRow([
      line.personnelCode,
      line.fullName,
      line.status,
      input.workDays,
      result?.basePayRial ?? null,
      result?.seniorityPayRial ?? null,
      result?.housingPayRial ?? null,
      result?.couponPayRial ?? null,
      result?.marriagePayRial ?? null,
      result?.childAllowancePayRial ?? null,
      result?.overtimePayRial ?? null,
      result?.nightShiftPayRial ?? null,
      result?.holidayPayRial ?? null,
      result?.variableBonusRial ?? null,
      result?.grossEarningsRial ?? null,
      result?.cappedInsuranceBasisRial ?? null,
      result?.employeeInsuranceRial ?? null,
      result?.taxableIncomeRial ?? null,
      result?.totalPayrollTaxRial ?? null,
      result?.totalDeductionsRial ?? null,
      result?.netPayRial ?? null,
      result?.totalEmployerInsuranceRial ?? null,
      result?.totalEmployerCostRial ?? null,
      result?.totalMonthlyReservesRial ?? null,
      result?.ctcMonthlyRial ?? null,
      result?.ctcAnnualRial ?? null,
    ]);
    styleDataRow(row);
  });
  setRialFormat(register, Array.from({ length: 22 }, (_, index) => index + 5));
  register.autoFilter = { from: 'A1', to: 'Z1' };

  const detail = workbook.addWorksheet('جزئیات اقلام', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });
  detail.columns = [
    { header: 'کد پرسنلی', width: 16 },
    { header: 'نام کارمند', width: 26 },
    { header: 'شناسه قلم', width: 24 },
    { header: 'عنوان قلم', width: 34 },
    { header: 'مبلغ (ریال)', width: 22 },
    { header: 'مبنای بیمه (ریال)', width: 22 },
    { header: 'مبنای مالیات (ریال)', width: 22 },
    { header: 'وضعیت بیمه', width: 20 },
    { header: 'وضعیت مالیات', width: 20 },
    { header: 'بازبینی حقوقی', width: 24 },
  ];
  styleHeaderRow(detail.getRow(1), 'FF334155');
  run.lines.forEach((line) => {
    line.result?.payItemBreakdown.forEach((itemLine) => {
      const item = getPayrollPayItem(itemLine.itemId);
      detail.addRow([
        line.personnelCode,
        line.fullName,
        item.id,
        item.title,
        itemLine.amountRial,
        itemLine.insuranceBasisRial,
        itemLine.taxableBasisRial,
        item.insuranceTreatment,
        item.taxTreatment,
        item.reviewStatus,
      ]);
    });
  });
  setRialFormat(detail, [5, 6, 7]);
  detail.autoFilter = { from: 'A1', to: 'J1' };

  const tax = workbook.addWorksheet('پله‌های مالیات', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });
  tax.columns = [
    { header: 'کد پرسنلی', width: 16 },
    { header: 'نام کارمند', width: 26 },
    { header: 'شناسه پله', width: 16 },
    { header: 'عنوان پله', width: 30 },
    { header: 'درآمد واقع‌شده (ریال)', width: 24 },
    { header: 'نرخ', width: 14 },
    { header: 'مالیات (ریال)', width: 22 },
  ];
  styleHeaderRow(tax.getRow(1), 'FF334155');
  run.lines.forEach((line) => {
    line.result?.taxSteps.forEach((step) => {
      tax.addRow([
        line.personnelCode,
        line.fullName,
        step.bracketId,
        step.label,
        step.sliceAmountRial,
        step.rate,
        step.taxAmountRial,
      ]);
    });
  });
  setRialFormat(tax, [5, 7]);
  tax.getColumn(6).numFmt = '0.00%';

  const issues = workbook.addWorksheet('هشدارها', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });
  issues.columns = [
    { header: 'دامنه', width: 18 },
    { header: 'کد پرسنلی', width: 16 },
    { header: 'نام کارمند', width: 26 },
    { header: 'کد هشدار', width: 34 },
    { header: 'شرح', width: 80 },
  ];
  styleHeaderRow(issues.getRow(1), 'FFB45309');
  run.periodIssues.forEach((issue) => {
    issues.addRow(['دوره', '', '', issue.code, issue.message]);
  });
  run.lines.forEach((line) => {
    line.issues.forEach((issue) => {
      issues.addRow(['کارمند', line.personnelCode, line.fullName, issue.code, issue.message]);
    });
    line.result?.legalReviewRequiredItems.forEach((warning) => {
      issues.addRow(['بازبینی حقوقی', line.personnelCode, line.fullName, 'LEGAL_REVIEW', warning]);
    });
  });

  for (const sheet of workbook.worksheets) {
    sheet.eachRow((row) => styleDataRow(row));
    styleHeaderRow(sheet.getRow(1));
    sheet.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }];
  }

  return workbook;
}

export async function downloadPayrollRunExcelWorkbook(
  run: PayrollRunResult
): Promise<void> {
  const workbook = await buildPayrollRunExcelWorkbook(run);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Iran-Payroll-Run-${run.fiscalYear}-${String(run.month).padStart(2, '0')}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
