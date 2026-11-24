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
