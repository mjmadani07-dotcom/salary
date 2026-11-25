import { useEffect, useMemo, useState } from 'react';
import type { ClipboardEvent, FormEvent } from 'react';
import {
  Calculator,
  FileSpreadsheet,
  Lock,
  RefreshCw,
  Search,
  UserPlus,
} from 'lucide-react';
import { getPayrollRuleSet } from '../data/payrollRuleRegistry';
import { formatMoney, toPersianDigits } from '../utils/payrollEngine';
import type { PayrollInput } from '../utils/payrollEngine';
import type { PayrollRunWorkflow } from '../types/payrollRunWorkflow';
import { calculatePayrollRun } from '../utils/payrollRunEngine';
import type { PayrollRunEmployee, PayrollRunResult } from '../utils/payrollRunEngine';
import {
  getPayrollVaultStatus,
  isPayrollVaultUnlocked,
  listEmployeeMasterRecords,
  listMonthlyAttendance,
  listAnnualLeaveRecords,
  saveMonthlyAttendance,
  saveMonthlyLeave,
  listSavedEmployees,
  listSavedPayrollRuns,
  loadSavedPayrollRun,
  lockPayrollVault,
  saveEmployee,
  savePayrollRunSnapshot,
  unlockPayrollVault,
} from '../data/payrollLocalDatabase';
import type { EmployeeMasterRecord } from '../types/employee';
import type { MonthlyAttendanceRecord } from '../types/attendance';
import type { MonthlyLeaveDraft, MonthlyLeaveRecord } from '../types/leave';
import { validateMonthlyLeave } from '../utils/leaveLedger';
import {
  calculateServiceDurationJalali,
  resolveEmployeeTerms,
} from '../utils/employeeMaster';
import { createPayrollWorkspaceEmployees } from '../utils/payrollRunWorkspace';
import {
  createMonthlyAttendanceDraftFromPayrollEmployee,
  hydratePayrollEmployeeFromAttendance,
  MONTHLY_UNPAID_LEAVE_REVIEW_ISSUE,
} from '../utils/payrollAttendanceBridge';
import { PAYROLL_GRID_PASTE_FIELDS, parsePayrollGridPasteCell } from '../utils/payrollGridClipboard';
import { parsePayrollMonthlyExcelPaste } from '../utils/payrollMonthlyExcelImport';
import type { PayrollGridPasteField } from '../utils/payrollGridClipboard';
import { downloadPayrollRunExcelWorkbook } from '../utils/excelWorkbookBuilder';
import { useUnifiedPayroll } from '../state/UnifiedPayrollContext';

interface PayrollRunViewProps {
  onNavigateToEmployees: () => void;
}

type RequiredMonthlyIssue = {
  code: string;
  field: string;
  message: string;
  confirmed: boolean;
};

const MONTH_OPTIONS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

function numberValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasIssue(employee: PayrollRunEmployee, code: string): boolean {
  return (employee.masterDataIssues ?? []).some((issue) => issue.code === code);
}

function inputClass(width = 'w-20'): string {
  return `${width} rounded-md border border-slate-300 bg-white px-2 py-2 text-center text-sm tabular-nums outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-400`;
}

export function PayrollRunView({ onNavigateToEmployees }: PayrollRunViewProps) {
  const { state } = useUnifiedPayroll();
  const { year, unit } = state;
  const rules = getPayrollRuleSet(year).regulations;
  const unitMultiplier = unit === 'toman' ? 10 : 1;
  const [month, setMonth] = useState(1);
  const [periodMonthDays, setPeriodMonthDays] = useState<29 | 30 | 31>(31);
  const [employees, setEmployees] = useState<PayrollRunEmployee[]>([]);
  const [employeeMasters, setEmployeeMasters] = useState<EmployeeMasterRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, MonthlyAttendanceRecord>>({});
  const [unpaidLeaveByEmployee, setUnpaidLeaveByEmployee] = useState<Record<string, number>>({});
  const [leaveRecordsByEmployee, setLeaveRecordsByEmployee] = useState<Record<string, MonthlyLeaveRecord>>({});
  const [monthlyExcelPasteText, setMonthlyExcelPasteText] = useState('');
  const [monthlyExcelImportFeedback, setMonthlyExcelImportFeedback] = useState<string | null>(null);
  const [isMonthlyExcelImporting, setIsMonthlyExcelImporting] = useState(false);
  const [expandedDetailsEmployeeIds, setExpandedDetailsEmployeeIds] = useState<Set<string>>(() => new Set());
  const [runResult, setRunResult] = useState<(PayrollRunResult & { workflow?: PayrollRunWorkflow }) | null>(null);
  const [lastSavedRunId, setLastSavedRunId] = useState<string | null>(null);
  const [snapshotEmployeeIds, setSnapshotEmployeeIds] = useState<Set<string>>(() => new Set());
  const [searchText, setSearchText] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const [isLoadingLocalData, setIsLoadingLocalData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [vaultPhase, setVaultPhase] = useState<'checking' | 'locked' | 'unlocked' | 'error'>('checking');
  const [vaultPassword, setVaultPassword] = useState('');
  const [vaultBusy, setVaultBusy] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);

  const format = (value: number) => formatMoney(value, unit);
  const periodLabel = `سال ${toPersianDigits(year)} · ${MONTH_OPTIONS[month - 1]} · ${toPersianDigits(periodMonthDays)} روزه`;
  const periodLocked = ['approved', 'paid', 'closed'].includes(runResult?.workflow?.status ?? '');

  useEffect(() => {
    let active = true;
    getPayrollVaultStatus()
      .then((status) => {
        if (!active) return;
        // New installations use local storage directly. Only legacy vaults
        // configured by an earlier version require their existing passphrase.
        setVaultPhase(
          status.configured && !isPayrollVaultUnlocked() ? 'locked' : 'unlocked'
        );
      })
      .catch((error) => {
        if (!active) return;
        setVaultError(error instanceof Error ? error.message : 'بررسی وضعیت اطلاعات محلی ناموفق بود.');
        setVaultPhase('error');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (vaultPhase !== 'unlocked') {
      setEmployees([]);
      setEmployeeMasters([]);
      setAttendanceRecords({});
      setUnpaidLeaveByEmployee({});
      setLeaveRecordsByEmployee({});
      setRunResult(null);
      setLastSavedRunId(null);
      setSnapshotEmployeeIds(new Set());
      setIsLoadingLocalData(false);
      return;
    }

    let active = true;
    setIsLoadingLocalData(true);
    setStorageError(null);

    const loadWorkspace = async () => {
      try {
        const [savedEmployees, masters, savedRuns, attendanceRows, leaveRows] = await Promise.all([
          listSavedEmployees(),
          listEmployeeMasterRecords(),
          listSavedPayrollRuns(100),
          listMonthlyAttendance(year, month),
          listAnnualLeaveRecords(year),
        ]);
        if (!active) return;

        const matchingRun = savedRuns.find((run) =>
          run.fiscalYear === year &&
          run.month === month &&
          run.monthDays === periodMonthDays
        );
        const savedRun = matchingRun
          ? await loadSavedPayrollRun(matchingRun.runId)
          : undefined;
        if (!active) return;

        const attendanceByEmployee = Object.fromEntries(
          attendanceRows.map((record) => [record.employeeId, record]),
        );
        const selectedLeaveByEmployee = Object.fromEntries(
          leaveRows
            .filter((record) => record.month === month)
            .map((record) => [record.employeeId, record]),
        );
        const snapshotIds = new Set(savedRun?.lines.map((line) => line.employeeId) ?? []);

        const rows = createPayrollWorkspaceEmployees({
          year,
          month,
          monthDays: periodMonthDays,
          housingAllowanceRial: rules.housingAllowanceRial,
          workerCouponRial: rules.workerCouponRial,
          minDailyWageRial: rules.minDailyWageRial,
          employeeMasters: masters,
          savedEmployees,
          savedRun,
        });

        const hydratedRows = rows.map((employee) => {
          if (!employee.isActive || snapshotIds.has(employee.employeeId)) return employee;
          return hydratePayrollEmployeeFromAttendance(
            employee,
            attendanceByEmployee[employee.employeeId],
            selectedLeaveByEmployee[employee.employeeId],
          );
        });

        setEmployeeMasters(masters);
        setAttendanceRecords(attendanceByEmployee);
        setUnpaidLeaveByEmployee(Object.fromEntries(
          Object.entries(selectedLeaveByEmployee).map(([employeeId, record]) => [
            employeeId,
            record.unpaidLeaveUsedDays,
          ]),
        ));
        setLeaveRecordsByEmployee(selectedLeaveByEmployee);
        setEmployees(hydratedRows);
        setRunResult(savedRun ?? null);
        setLastSavedRunId(savedRun?.runId ?? null);
        setSnapshotEmployeeIds(snapshotIds);
      } catch (error) {
        if (active) {
          setStorageError(
            error instanceof Error
              ? error.message
              : 'خواندن اطلاعات کارکنان یا دوره ذخیره‌شده ناموفق بود.'
          );
          setEmployees([]);
          setEmployeeMasters([]);
          setAttendanceRecords({});
          setUnpaidLeaveByEmployee({});
          setLeaveRecordsByEmployee({});
          setRunResult(null);
          setLastSavedRunId(null);
          setSnapshotEmployeeIds(new Set());
        }
      } finally {
        if (active) setIsLoadingLocalData(false);
      }
    };

    void loadWorkspace();
    return () => { active = false; };
  }, [
    year,
    month,
    periodMonthDays,
    rules.housingAllowanceRial,
    rules.workerCouponRial,
    rules.minDailyWageRial,
    vaultPhase,
    reloadVersion,
  ]);

  const handleUnlockVault = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setVaultError(null);
    setVaultBusy(true);
    try {
      await unlockPayrollVault(vaultPassword);
      setVaultPassword('');
      setVaultPhase('unlocked');
    } catch (error) {
      setVaultError(error instanceof Error ? error.message : 'بازکردن اطلاعات ذخیره‌شده ناموفق بود.');
    } finally {
      setVaultBusy(false);
    }
  };

  const handleLockVault = () => {
    lockPayrollVault();
    setVaultPassword('');
    setEmployees([]);
    setEmployeeMasters([]);
    setAttendanceRecords({});
    setUnpaidLeaveByEmployee({});
    setLeaveRecordsByEmployee({});
    setRunResult(null);
    setLastSavedRunId(null);
    setSnapshotEmployeeIds(new Set());
    setVaultPhase('locked');
  };

  const updateEmployee = (
    employee: PayrollRunEmployee,
    payrollPatch: Partial<PayrollInput>,
    confirmation?: RequiredMonthlyIssue
  ): PayrollRunEmployee => {
    let issues = [...(employee.masterDataIssues ?? [])];
    if (confirmation) {
      issues = issues.filter((issue) => issue.code !== confirmation.code);
      if (!confirmation.confirmed) {
        issues.push({
          code: confirmation.code,
          field: confirmation.field,
          message: confirmation.message,
        });
      }
    }

    const workDaysChanged = payrollPatch.workDays !== undefined &&
      payrollPatch.workDays !== employee.payrollInput.workDays;
    if (workDaysChanged && (unpaidLeaveByEmployee[employee.employeeId] ?? 0) > 0) {
      issues = issues.filter((issue) => issue.code !== MONTHLY_UNPAID_LEAVE_REVIEW_ISSUE.code);
      issues.push(MONTHLY_UNPAID_LEAVE_REVIEW_ISSUE);
    }

    const updated: PayrollRunEmployee = {
      ...employee,
      payrollInput: { ...employee.payrollInput, ...payrollPatch },
      masterDataIssues: issues,
    };
    setEmployees((current) =>
      current.map((item) => item.employeeId === employee.employeeId ? updated : item)
    );
    setRunResult(null);
    setLastSavedRunId(null);
    return updated;
  };

  const saveEmployeeAndAttendance = async (employee: PayrollRunEmployee) => {
    await saveEmployee(employee);
    if (!employee.isActive ||
      hasIssue(employee, 'MONTHLY_WORK_DAYS_UNCONFIRMED') ||
      hasIssue(employee, 'MONTHLY_ANNUAL_WORKED_DAYS_UNCONFIRMED')) {
      return;
    }

    const attendanceDraft = createMonthlyAttendanceDraftFromPayrollEmployee(
      employee,
      year,
      month,
      periodMonthDays,
      attendanceRecords[employee.employeeId],
    );
    const savedAttendance = await saveMonthlyAttendance(attendanceDraft);
    setAttendanceRecords((current) => ({
      ...current,
      [employee.employeeId]: savedAttendance,
    }));
  };

  const persistEmployee = async (employee: PayrollRunEmployee) => {
    try {
      await saveEmployeeAndAttendance(employee);
      setStorageError(null);
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? `تغییرات ${employee.fullName} در پایگاه داده محلی ذخیره نشد: ${error.message}`
          : `ذخیره تغییرات ${employee.fullName} ناموفق بود.`
      );
    }
  };

  const applyClipboardMatrix = async (
    startRowIndex: number,
    startField: PayrollGridPasteField,
    clipboardText: string
  ) => {
    const rows = clipboardText.replace(/\r/g, '').split('\n');
    if (rows[rows.length - 1] === '') rows.pop();

    const startColumn = PAYROLL_GRID_PASTE_FIELDS.indexOf(startField);
    if (startColumn < 0 || rows.length === 0) return;

    const nextEmployees = [...employees];
    const changedRows = new Map<string, PayrollRunEmployee>();
    const invalidCells: string[] = [];
    const confirmationRules: Partial<Record<PayrollGridPasteField, Omit<RequiredMonthlyIssue, 'confirmed'>>> = {
      workDays: {
        code: 'MONTHLY_WORK_DAYS_UNCONFIRMED',
        field: 'workDays',
        message: 'روزهای کارکرد این دوره را تأیید یا اصلاح کنید.',
      },
      annualWorkedDays: {
        code: 'MONTHLY_ANNUAL_WORKED_DAYS_UNCONFIRMED',
        field: 'annualWorkedDays',
        message: 'تعداد روزهای کارکرد سال برای محاسبه عیدی را وارد یا تأیید کنید.',
      },
      isMarried: {
        code: 'MONTHLY_MARITAL_STATUS_UNCONFIRMED',
        field: 'isMarried',
        message: 'وضعیت تأهل این کارمند را مشخص کنید.',
      },
      childrenCount: {
        code: 'MONTHLY_CHILDREN_COUNT_UNCONFIRMED',
        field: 'childrenCount',
        message: 'تعداد فرزندان واجد شرایط را مشخص کنید؛ در صورت نداشتن فرزند، عدد صفر را وارد کنید.',
      },
      has720DaysInsurance: {
        code: 'MONTHLY_720_DAY_INSURANCE_UNCONFIRMED',
        field: 'has720DaysInsurance',
        message: 'وضعیت احراز حداقل ۷۲۰ روز سابقه بیمه را مشخص کنید.',
      },
    };

    rows.forEach((line, rowOffset) => {
      const targetEmployee = filteredEmployees[startRowIndex + rowOffset];
      if (!targetEmployee) return;
      const employeeIndex = nextEmployees.findIndex((item) => item.employeeId === targetEmployee.employeeId);
      if (employeeIndex < 0 || !nextEmployees[employeeIndex].isActive) return;

      let updated = nextEmployees[employeeIndex];
      const previousWorkDays = updated.payrollInput.workDays;
      const cells = line.split('\t');
      cells.forEach((rawValue, columnOffset) => {
        const field = PAYROLL_GRID_PASTE_FIELDS[startColumn + columnOffset];
        if (!field) return;

        const parsed = parsePayrollGridPasteCell(field, rawValue, unitMultiplier);
        if (!parsed.valid) {
          invalidCells.push(`${updated.personnelCode} · ستون ${field}: مقدار «${rawValue}» قابل تشخیص نیست.`);
          return;
        }

        const confirmation = confirmationRules[field];
        let issues = [...(updated.masterDataIssues ?? [])];
        if (confirmation) {
          issues = issues.filter((issue) => issue.code !== confirmation.code);
          if (parsed.empty) {
            issues.push({
              code: confirmation.code,
              field: confirmation.field,
              message: confirmation.message,
            });
          }
        }

        if (!parsed.empty || typeof parsed.value === 'number') {
          if (parsed.value !== undefined) {
            const patch = { [field]: parsed.value } as Partial<PayrollInput>;
            updated = {
              ...updated,
              payrollInput: { ...updated.payrollInput, ...patch },
              masterDataIssues: issues,
            };
          } else {
            updated = { ...updated, masterDataIssues: issues };
          }
        } else {
          updated = { ...updated, masterDataIssues: issues };
        }
      });

      if (
        updated.payrollInput.workDays !== previousWorkDays &&
        (unpaidLeaveByEmployee[updated.employeeId] ?? 0) > 0
      ) {
        const issues = (updated.masterDataIssues ?? []).filter(
          (issue) => issue.code !== MONTHLY_UNPAID_LEAVE_REVIEW_ISSUE.code,
        );
        updated = {
          ...updated,
          masterDataIssues: [...issues, MONTHLY_UNPAID_LEAVE_REVIEW_ISSUE],
        };
      }

      nextEmployees[employeeIndex] = updated;
      changedRows.set(updated.employeeId, updated);
    });

    if (changedRows.size === 0) {
      if (invalidCells.length > 0) setStorageError(invalidCells.slice(0, 4).join(' '));
      return;
    }

    setEmployees(nextEmployees);
    setRunResult(null);
    setLastSavedRunId(null);

    const saveErrors = (await Promise.all(
      [...changedRows.values()].map(async (employee) => {
        try {
          await saveEmployeeAndAttendance(employee);
          return null;
        } catch (error) {
          return error instanceof Error
            ? `${employee.personnelCode}: ${error.message}`
            : `ذخیره ${employee.personnelCode} ناموفق بود.`;
        }
      })
    )).filter((message): message is string => message !== null);

    const messages = [
      ...invalidCells.slice(0, 4),
      ...saveErrors.slice(0, 4),
    ];
    setStorageError(messages.length > 0 ? messages.join(' ') : null);
  };

  const handleGridPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const field = target.dataset.gridField as PayrollGridPasteField | undefined;
    const rowIndex = Number(target.dataset.gridRow);
    const text = event.clipboardData.getData('text/plain');

    if (!field || !Number.isInteger(rowIndex) || text.length === 0) {
      return;
    }

    event.preventDefault();
    void applyClipboardMatrix(rowIndex, field, text);
  };


  const importMonthlyExcelRows = async () => {
    if (!monthlyExcelPasteText.trim() || isMonthlyExcelImporting || isSaving) return;
    setIsMonthlyExcelImporting(true);
    setMonthlyExcelImportFeedback(null);

    try {
      const parsed = parsePayrollMonthlyExcelPaste(monthlyExcelPasteText);
      const errors = [...parsed.errors];
      const employeesByCode = new Map(
        employees.map((employee) => [employee.personnelCode.trim().toLocaleLowerCase(), employee])
      );
      const incomingEmployeeIds = new Set<string>();
      const prepared: Array<{
        employee: PayrollRunEmployee;
        leaveDraft?: MonthlyLeaveDraft;
      }> = [];

      for (const row of parsed.rows) {
        if (row.year !== year || row.month !== month || row.monthDays !== periodMonthDays) {
          errors.push(
            `ردیف ${row.sourceRow} (${row.personnelCode}): دوره فایل با دوره انتخاب‌شده نرم‌افزار مطابقت ندارد.`
          );
          continue;
        }

        const employee = employeesByCode.get(row.personnelCode.trim().toLocaleLowerCase());
        if (!employee || !employee.isActive) {
          errors.push(`ردیف ${row.sourceRow}: کارمند فعال با کد «${row.personnelCode}» پیدا نشد.`);
          continue;
        }
        if (incomingEmployeeIds.has(employee.employeeId)) {
          errors.push(`کد پرسنلی «${row.personnelCode}» بیش از یک‌بار در فایل آمده است.`);
          continue;
        }
        incomingEmployeeIds.add(employee.employeeId);

        const duplicatePayslip = employees.find((other) =>
          other.employeeId !== employee.employeeId &&
          (other.payrollInput.payslipId ?? '').trim() === row.payslipId
        );
        if (duplicatePayslip) {
          errors.push(`ردیف ${row.sourceRow}: شناسه فیش «${row.payslipId}» برای کارمند دیگری ثبت شده است.`);
          continue;
        }

        const leaveRecord = leaveRecordsByEmployee[employee.employeeId];
        let leaveDraft: MonthlyLeaveDraft | undefined;
        if (leaveRecord) {
          leaveDraft = {
            employeeId: leaveRecord.employeeId,
            personnelCode: leaveRecord.personnelCode,
            fiscalYear: leaveRecord.fiscalYear,
            month: leaveRecord.month,
            openingBalanceDays: leaveRecord.openingBalanceDays,
            accruedDays: leaveRecord.accruedDays,
            paidLeaveUsedDays: row.paidLeaveDays,
            unpaidLeaveUsedDays: leaveRecord.unpaidLeaveUsedDays,
            adjustmentDays: leaveRecord.adjustmentDays,
            notes: leaveRecord.notes,
          };
          const leaveIssues = validateMonthlyLeave(leaveDraft);
          if (leaveIssues.length > 0) {
            errors.push(
              `ردیف ${row.sourceRow} (${row.personnelCode}): ${leaveIssues.map((issue) => issue.message).join(' ')}`
            );
            continue;
          }
          if (row.paidLeaveDays === leaveRecord.paidLeaveUsedDays) leaveDraft = undefined;
        } else if (row.paidLeaveDays > 0) {
          errors.push(
            `ردیف ${row.sourceRow} (${row.personnelCode}): مرخصی استحقاقی در فایل ثبت شده، اما دفتر مرخصی این ماه وجود ندارد؛ ابتدا مانده و مصرف مرخصی را در دفتر مرخصی ثبت کنید.`
          );
          continue;
        }

        let issues = [...(employee.masterDataIssues ?? [])]
          .filter((issue) => issue.code !== 'MONTHLY_WORK_DAYS_UNCONFIRMED');
        if (employee.payrollInput.workDays !== row.workDays) {
          issues = issues.filter((issue) => issue.code !== MONTHLY_UNPAID_LEAVE_REVIEW_ISSUE.code);
          if ((unpaidLeaveByEmployee[employee.employeeId] ?? 0) > 0) {
            issues.push(MONTHLY_UNPAID_LEAVE_REVIEW_ISSUE);
          }
        }

        const updatedEmployee: PayrollRunEmployee = {
          ...employee,
          payrollInput: {
            ...employee.payrollInput,
            year: row.year,
            monthDays: row.monthDays,
            workDays: row.workDays,
            paidLeaveDays: row.paidLeaveDays,
            sickLeaveDays: row.sickLeaveDays,
            unpaidAbsenceDays: row.unpaidAbsenceDays,
            overtimeHours: row.overtimeHours,
            nightShiftHours: row.nightShiftHours,
            fridayHours: row.fridayHours,
            missionDays: row.missionDays,
            insuredBenefitsRial: row.insuredBenefitsRial,
            nonInsuredBenefitsRial: row.nonInsuredBenefitsRial,
            variableBonusRial: row.variableBonusRial,
            loanDeductionRial: row.loanDeductionRial,
            advanceDeductionRial: row.advanceDeductionRial,
            otherDeductionsRial: row.otherDeductionsRial,
            signedCorrectionRial: row.signedCorrectionRial,
            payslipId: row.payslipId,
            paymentDate: row.paymentDate,
            monthlyNotes: row.notes,
          },
          masterDataIssues: issues,
        };

        prepared.push({ employee: updatedEmployee, leaveDraft });
      }

      if (errors.length > 0) {
        setMonthlyExcelImportFeedback(`ورود انجام نشد؛ هیچ ردیفی ثبت نشد. ${errors.slice(0, 6).join(' ')}`);
        return;
      }

      const nextAttendance = { ...attendanceRecords };
      const nextLeaveRecords = { ...leaveRecordsByEmployee };
      const savedEmployees: PayrollRunEmployee[] = [];

      for (const item of prepared) {
        if (item.leaveDraft) {
          const savedLeave = await saveMonthlyLeave(item.leaveDraft);
          nextLeaveRecords[item.employee.employeeId] = savedLeave;
        }
        await saveEmployee(item.employee);
        const attendanceDraft = createMonthlyAttendanceDraftFromPayrollEmployee(
          item.employee,
          year,
          month,
          periodMonthDays,
          nextAttendance[item.employee.employeeId],
        );
        const savedAttendance = await saveMonthlyAttendance(attendanceDraft);
        nextAttendance[item.employee.employeeId] = savedAttendance;
        savedEmployees.push(item.employee);
      }

      const updatedById = new Map(savedEmployees.map((employee) => [employee.employeeId, employee]));
      setEmployees((current) => current.map((employee) =>
        updatedById.get(employee.employeeId) ?? employee
      ));
      setAttendanceRecords(nextAttendance);
      setLeaveRecordsByEmployee(nextLeaveRecords);
      setRunResult(null);
      setLastSavedRunId(null);
      setMonthlyExcelPasteText('');
      setMonthlyExcelImportFeedback(
        `ورود ${toPersianDigits(savedEmployees.length)} ردیف انجام شد. ${parsed.ignoredBlankRows > 0 ? `${toPersianDigits(parsed.ignoredBlankRows)} ردیف خالی نادیده گرفته شد. ` : ''}مبالغ فایل اکسل که بر حسب تومان هستند، به ریال تبدیل شدند.`
      );
      setStorageError(null);
    } catch (error) {
      setMonthlyExcelImportFeedback(
        error instanceof Error
          ? `ثبت کامل نشد: ${error.message}. اطلاعات دوره را بارگذاری مجدد و ردیف‌های ثبت‌شده را کنترل کنید.`
          : 'ثبت کامل نشد؛ اطلاعات دوره را بارگذاری مجدد و ردیف‌های ثبت‌شده را کنترل کنید.'
      );
      setReloadVersion((value) => value + 1);
    } finally {
      setIsMonthlyExcelImporting(false);
    }
  };

  const updateNumber = (
    employee: PayrollRunEmployee,
    field: 'workDays' | 'overtimeHours' | 'nightShiftHours' | 'holidayHours' |
      'variableBonusRial' | 'annualWorkedDays' | 'childrenCount',
    rawValue: string,
    confirmation?: Omit<RequiredMonthlyIssue, 'confirmed'>,
    multiplier = 1
  ) => {
    const value = numberValue(rawValue) * multiplier;
    const patch = { [field]: value } as Partial<PayrollInput>;
    const next = updateEmployee(
      employee,
      patch,
      confirmation ? { ...confirmation, confirmed: rawValue.trim().length > 0 } : undefined
    );
    return next;
  };

  const updateMonthlyNumber = (
    employee: PayrollRunEmployee,
    field: 'sickLeaveDays' | 'unpaidAbsenceDays' | 'fridayHours' | 'missionDays' |
      'insuredBenefitsRial' | 'nonInsuredBenefitsRial' | 'loanDeductionRial' |
      'advanceDeductionRial' | 'otherDeductionsRial' | 'signedCorrectionRial',
    rawValue: string,
    multiplier = 1,
  ) => updateEmployee(employee, {
    [field]: numberValue(rawValue) * multiplier,
  } as Partial<PayrollInput>);

  const updateMonthlyText = (
    employee: PayrollRunEmployee,
    field: 'payslipId' | 'paymentDate' | 'monthlyNotes',
    value: string,
  ) => updateEmployee(employee, { [field]: value });

  const toggleMonthlyDetails = (employeeId: string) => {
    setExpandedDetailsEmployeeIds((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  };

  const filteredEmployees = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase();
    if (!query) return employees;
    return employees.filter((employee) =>
      employee.personnelCode.toLocaleLowerCase().includes(query) ||
      employee.fullName.toLocaleLowerCase().includes(query)
    );
  }, [employees, searchText]);

  const pendingEmployeeCount = employees.filter((employee) =>
    (employee.masterDataIssues?.length ?? 0) > 0
  ).length;

  const calculateRun = async () => {
    if (employees.length === 0 || isSaving || isLoadingLocalData || isMonthlyExcelImporting || periodLocked) return;
    const correctionOfRunId =
      runResult && lastSavedRunId === runResult.runId
        ? runResult.runId
        : undefined;
    setIsSaving(true);
    setStorageError(null);
    setRunResult(null);
    setLastSavedRunId(null);

    const periodStartJalali = `${year}-${String(month).padStart(2, '0')}-01`;
    const periodEndJalali = `${year}-${String(month).padStart(2, '0')}-${String(periodMonthDays).padStart(2, '0')}`;

    const periodEmployees = employees.map((employee) => {
      const master = employeeMasters.find((item) => item.employeeId === employee.employeeId);
      if (!master) return employee;

      const terms = resolveEmployeeTerms(master, periodStartJalali, periodEndJalali);
      const monthlyIssues = (employee.masterDataIssues ?? []).filter((issue) =>
        issue.code.startsWith('MONTHLY_')
      );
      const isRestoredSnapshotLine = snapshotEmployeeIds.has(employee.employeeId);
      const masterDataIssues = employee.isActive
        ? [
            ...monthlyIssues,
            ...(isRestoredSnapshotLine
              ? (employee.masterDataIssues ?? []).filter((issue) => !issue.code.startsWith('MONTHLY_'))
              : terms.issues.filter((issue) => issue.code !== 'EMPLOYEE_INACTIVE').map((issue) => ({
                  code: issue.code,
                  message: issue.message,
                  field: issue.field,
                }))),
          ]
        : [];

      let serviceDuration = {
        completedYears: employee.payrollInput.serviceYearsForSeverance,
        additionalDays: employee.payrollInput.serviceExtraDaysForSeverance,
      };
      if (employee.isActive && !isRestoredSnapshotLine) {
        try {
          serviceDuration = calculateServiceDurationJalali(master.hireDateJalali, periodEndJalali);
        } catch (error) {
          masterDataIssues.push({
            code: 'INVALID_SERVICE_DURATION',
            field: 'hireDateJalali',
            message: error instanceof Error ? error.message : 'محاسبه سابقه خدمت ناموفق بود.',
          });
        }
      }

      return {
        ...employee,
        personnelCode: master.personnelCode,
        fullName: `${master.firstName} ${master.lastName}`.trim(),
        isActive: employee.isActive,
        masterDataIssues: masterDataIssues.filter((issue) =>
          !(employee.isActive && issue.code === 'EMPLOYEE_INACTIVE')
        ),
        payrollInput: isRestoredSnapshotLine
          ? employee.payrollInput
          : {
              ...employee.payrollInput,
              year,
              monthDays: periodMonthDays,
              dailyBaseWageRial: terms.wage?.dailyBaseWageRial ?? employee.payrollInput.dailyBaseWageRial,
              dailySeniorityRial: terms.wage?.dailySeniorityRial ?? employee.payrollInput.dailySeniorityRial,
              housingAllowanceRial: rules.housingAllowanceRial,
              workerCouponRial: rules.workerCouponRial,
              serviceYearsForSeverance: serviceDuration.completedYears,
              serviceExtraDaysForSeverance: serviceDuration.additionalDays,
            },
      };
    });

    const result = calculatePayrollRun(
      {
        runId: `PAY-${year}-${String(month).padStart(2, '0')}-${Date.now()}`,
        fiscalYear: year,
        month,
        monthDays: periodMonthDays,
      },
      periodEmployees
    );
    setRunResult(result);

    const employeeSaveErrors = (await Promise.all(
      periodEmployees.map(async (employee) => {
        try {
          await saveEmployeeAndAttendance(employee);
          return null;
        } catch (error) {
          return error instanceof Error ? error.message : `ذخیره ${employee.fullName} ناموفق بود.`;
        }
      })
    )).filter((message): message is string => message !== null);

    try {
      await savePayrollRunSnapshot(result, correctionOfRunId);
      const persistedSnapshot = await loadSavedPayrollRun(result.runId);
      if (persistedSnapshot) setRunResult(persistedSnapshot);
      setLastSavedRunId(result.runId);
      setSnapshotEmployeeIds(new Set(result.lines.map((line) => line.employeeId)));
      if (employeeSaveErrors.length > 0) {
        setStorageError(
          `Snapshot دوره ذخیره شد، اما ذخیره آخرین ورودی برخی کارکنان ناموفق بود: ${employeeSaveErrors.slice(0, 3).join('؛ ')}`
        );
      }
    } catch (error) {
      setLastSavedRunId(null);
      setStorageError(
        error instanceof Error
          ? `محاسبه انجام شد، اما ذخیره Snapshot دوره ناموفق بود: ${error.message}`
          : 'محاسبه انجام شد، اما ذخیره Snapshot دوره ناموفق بود.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (vaultPhase === 'checking') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        در حال بررسی اطلاعات ذخیره‌شده…
      </div>
    );
  }

  if (vaultPhase !== 'unlocked') {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">LOCAL DATA</div>
            <h1 className="mt-1 text-xl font-bold text-slate-900">
              {vaultPhase === 'error' ? 'دسترسی به اطلاعات ممکن نیست' : 'بازیابی اطلاعات نسخه قبلی'}
            </h1>
          </div>
        </div>
        {vaultPhase === 'error' ? (
          <div className="mt-5 space-y-3">
            <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {vaultError ?? 'خواندن پایگاه داده محلی ناموفق بود.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              بارگذاری مجدد
            </button>
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              این اطلاعات در نسخه قبلی با عبارت عبور محافظت شده‌اند. برای حفظ و بازیابی همان اطلاعات، عبارت عبور قبلی را وارد کنید. نصب‌های جدید به تعریف گذرواژه جداگانه نیاز ندارند.
            </p>
            <form onSubmit={handleUnlockVault} className="mt-5 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">عبارت عبور قبلی</label>
                <input
                  type="password"
                  value={vaultPassword}
                  onChange={(event) => setVaultPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>
              {vaultError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{vaultError}</div>
              )}
              <button
                type="submit"
                disabled={vaultBusy || !vaultPassword}
                className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
              >
                {vaultBusy ? 'در حال بازیابی…' : 'بازیابی اطلاعات'}
              </button>
            </form>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-xs font-semibold text-teal-700">MONTHLY PAYROLL WORKSPACE</div>
            <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">حقوق ماهانه</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              اطلاعات ماهانه همه کارکنان را در همین جدول وارد کنید. مزد و سابقه از پرونده کارکنان خوانده می‌شود و یک محاسبه گروهی، نتیجه حقوق و هزینه کارفرما را تولید می‌کند.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
              {periodLabel}
            </div>
            {isPayrollVaultUnlocked() && (
              <button
                type="button"
                onClick={handleLockVault}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Lock className="h-3.5 w-3.5" />
                قفل اطلاعات
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">دوره حقوق</label>
              <select
                value={month}
                onChange={(event) => {
                  const nextMonth = numberValue(event.target.value);
                  setMonth(nextMonth);
                  setPeriodMonthDays(nextMonth <= 6 ? 31 : nextMonth <= 11 ? 30 : 29);
                }}
                className="min-w-36 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {MONTH_OPTIONS.map((label, index) => (
                  <option key={label} value={index + 1}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">روزهای ماه</label>
              <select
                value={periodMonthDays}
                onChange={(event) => setPeriodMonthDays(numberValue(event.target.value) as 29 | 30 | 31)}
                className="min-w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {[29, 30, 31].map((days) => (
                  <option key={days} value={days}>{toPersianDigits(days)} روز</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setReloadVersion((value) => value + 1)}
              disabled={isLoadingLocalData || isSaving}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              بارگذاری مجدد کارکنان
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">
              {toPersianDigits(employees.length)} ردیف
            </span>
            <span className={`rounded-full px-3 py-1.5 ${pendingEmployeeCount > 0 ? 'bg-amber-50 text-amber-800' : 'bg-teal-50 text-teal-800'}`}>
              {toPersianDigits(pendingEmployeeCount)} ردیف نیازمند تکمیل
            </span>
          </div>
        </div>
      </section>

      {storageError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {storageError}
        </div>
      )}

      {isLoadingLocalData ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          در حال بازیابی پرونده کارکنان و اطلاعات دوره…
        </div>
      ) : employees.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <UserPlus className="mx-auto h-9 w-9 text-slate-400" />
          <h2 className="mt-3 font-bold text-slate-800">هنوز پرونده کارمندی ثبت نشده است</h2>
          <p className="mt-2 text-sm text-slate-600">
            ابتدا اطلاعات پایه کارکنان و مزد مؤثر آن‌ها را ثبت کنید. سپس همه کارکنان در این جدول ظاهر می‌شوند.
          </p>
          <button
            type="button"
            onClick={onNavigateToEmployees}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <UserPlus className="h-4 w-4" />
            ثبت اطلاعات کارکنان
          </button>
        </section>
      ) : (
        <>
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h2 className="font-bold text-slate-900">ورود گروهی اطلاعات ماهانه</h2>
                <p className="mt-1 text-xs text-slate-500">
                  خانه‌های خالی یا هشدار‌دار را تکمیل کنید؛ برای ثبت صفر، عدد صفر را وارد کنید.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="جست‌وجوی نام یا کد پرسنلی"
                    className="w-full rounded-lg border border-slate-300 py-2 pr-9 pl-3 text-sm sm:w-64"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void calculateRun()}
                  disabled={employees.length === 0 || isSaving || isLoadingLocalData || isMonthlyExcelImporting || periodLocked}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Calculator className="h-4 w-4" />
                  {isSaving ? 'در حال محاسبه و ذخیره…' : 'محاسبه و ذخیره دوره'}
                </button>
              </div>
            </div>


            <div className="border-b border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <label className="min-w-0 flex-1 space-y-1 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">ورود مستقیم فایل اکسل کارکرد ماهانه (ستون‌های A تا V)</span>
                  <textarea
                    rows={3}
                    value={monthlyExcelPasteText}
                    onChange={(event) => setMonthlyExcelPasteText(event.target.value)}
                    placeholder="محدوده ۲۲ ستونی شیت «کارکرد ماهانه» را در اکسل انتخاب و کپی کنید، سپس اینجا بچسبانید."
                    disabled={isMonthlyExcelImporting || isSaving || periodLocked}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void importMonthlyExcelRows()}
                  disabled={!monthlyExcelPasteText.trim() || isMonthlyExcelImporting || isSaving || periodLocked}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  {isMonthlyExcelImporting ? 'در حال ورود اطلاعات…' : 'ورود ۲۲ ستون اکسل'}
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-slate-500">
                سرستون و ردیف‌ها را با هم کپی کنید. مبالغ این فایل بر حسب تومان‌اند و هنگام ورود به ریال تبدیل می‌شوند. در صورت وجود دفتر مرخصی، مصرف مرخصی استحقاقی نیز با کنترل مانده در همان دفتر به‌روزرسانی می‌شود.
              </p>
              {monthlyExcelImportFeedback && (
                <div className={`mt-3 rounded-lg border p-3 text-xs leading-6 ${monthlyExcelImportFeedback.startsWith('ورود انجام نشد') || monthlyExcelImportFeedback.startsWith('ثبت کامل نشد') ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-teal-200 bg-teal-50 text-teal-800'}`}>
                  {monthlyExcelImportFeedback}
                </div>
              )}
            </div>

            {periodLocked && (
              <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">
                این دوره در وضعیت «{runResult?.workflow?.status === 'approved' ? 'تأییدشده' : runResult?.workflow?.status === 'paid' ? 'پرداخت‌شده' : 'بسته‌شده'}» قرار دارد و ورودی‌ها قفل شده‌اند. برای اصلاح، باید یک Snapshot اصلاحی مستقل و قابل ردیابی ایجاد شود؛ این Snapshot قبلی بازنویسی نمی‌شود.
              </div>
            )}
            <div className="overflow-x-auto" onPaste={handleGridPaste}>
              <table className="w-full min-w-[1660px] text-right text-sm">
                <thead className="bg-slate-100 text-xs text-slate-700">
                  <tr>
                    <th className="sticky right-0 z-10 min-w-28 bg-slate-100 p-3">کد پرسنلی</th>
                    <th className="sticky right-28 z-10 min-w-40 bg-slate-100 p-3">نام کارمند</th>
                    <th className="min-w-32 p-3">مزد روزانه</th>
                    <th className="min-w-24 p-3">روز کارکرد</th>
                    <th className="min-w-24 p-3">اضافه‌کاری</th>
                    <th className="min-w-24 p-3">شب‌کاری</th>
                    <th className="min-w-24 p-3">تعطیل‌کاری</th>
                    <th className="min-w-32 p-3">پاداش متغیر ({unit})</th>
                    <th className="min-w-28 p-3">وضعیت تأهل</th>
                    <th className="min-w-24 p-3">فرزند واجد شرایط</th>
                    <th className="min-w-32 p-3">سابقه بیمه ۷۲۰ روز</th>
                    <th className="min-w-28 p-3">کارکرد سالانه</th>
                    <th className="min-w-32 p-3">ورودی‌های تکمیلی اکسل</th>
                    <th className="min-w-44 p-3">وضعیت داده‌ها</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredEmployees.map((employee, rowIndex) => {
                    const disabled = !employee.isActive || isSaving || periodLocked;
                    const rowIssues = employee.masterDataIssues ?? [];
                    const calculatedLine = runResult?.lines.find((line) => line.employeeId === employee.employeeId);
                    const displayedIssues = rowIssues.length > 0 ? rowIssues : calculatedLine?.issues ?? [];
                    const workDaysMissing = hasIssue(employee, 'MONTHLY_WORK_DAYS_UNCONFIRMED');
                    const annualDaysMissing = hasIssue(employee, 'MONTHLY_ANNUAL_WORKED_DAYS_UNCONFIRMED');
                    const maritalMissing = hasIssue(employee, 'MONTHLY_MARITAL_STATUS_UNCONFIRMED');
                    const childrenMissing = hasIssue(employee, 'MONTHLY_CHILDREN_COUNT_UNCONFIRMED');
                    const insuranceMissing = hasIssue(employee, 'MONTHLY_720_DAY_INSURANCE_UNCONFIRMED');
                    const cellClass = 'border-l border-slate-100 px-2 py-2 align-middle';
                    const requiredInputClass = (missing: boolean, width = 'w-20') =>
                      `${inputClass(width)} ${missing ? 'border-amber-400 bg-amber-50 focus:border-amber-500' : ''}`;

                    return (
                      <>
                      <tr
                        key={employee.employeeId}
                        className={employee.isActive ? 'hover:bg-slate-50/70' : 'bg-slate-50 text-slate-400'}
                      >
                        <td className="sticky right-0 z-[1] border-l border-slate-100 bg-inherit p-3 font-semibold tabular-nums">
                          {employee.personnelCode}
                        </td>
                        <td className="sticky right-28 z-[1] border-l border-slate-100 bg-inherit p-3">
                          <div className="min-w-36 font-medium text-slate-800">{employee.fullName}</div>
                          {!employee.isActive && <div className="mt-1 text-[11px] text-slate-500">غیرفعال</div>}
                        </td>
                        <td className={`${cellClass} whitespace-nowrap tabular-nums text-slate-700`}>
                          {format(employee.payrollInput.dailyBaseWageRial)}
                        </td>
                        <td className={cellClass}>
                          <input
                            type="number"
                            min={0}
                            max={periodMonthDays}
                            step={0.5}
                            aria-label={`روز کارکرد ${employee.fullName}`}
                            data-grid-row={rowIndex}
                            data-grid-field="workDays"
                            disabled={disabled}
                            value={workDaysMissing ? '' : employee.payrollInput.workDays}
                            placeholder="روز"
                            className={requiredInputClass(workDaysMissing)}
                            onChange={(event) => updateNumber(employee, 'workDays', event.target.value, {
                              code: 'MONTHLY_WORK_DAYS_UNCONFIRMED',
                              field: 'workDays',
                              message: 'روزهای کارکرد این دوره را تأیید یا اصلاح کنید.',
                            })}
                            onBlur={() => void persistEmployee(employee)}
                          />
                        </td>
                        <td className={cellClass}>
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            aria-label={`اضافه‌کاری ${employee.fullName}`}
                            data-grid-row={rowIndex}
                            data-grid-field="overtimeHours"
                            disabled={disabled}
                            value={employee.payrollInput.overtimeHours}
                            className={inputClass()}
                            onChange={(event) => updateNumber(employee, 'overtimeHours', event.target.value)}
                            onBlur={() => void persistEmployee(employee)}
                          />
                        </td>
                        <td className={cellClass}>
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            aria-label={`شب‌کاری ${employee.fullName}`}
                            data-grid-row={rowIndex}
                            data-grid-field="nightShiftHours"
                            disabled={disabled}
                            value={employee.payrollInput.nightShiftHours}
                            className={inputClass()}
                            onChange={(event) => updateNumber(employee, 'nightShiftHours', event.target.value)}
                            onBlur={() => void persistEmployee(employee)}
                          />
                        </td>
                        <td className={cellClass}>
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            aria-label={`تعطیل‌کاری ${employee.fullName}`}
                            data-grid-row={rowIndex}
                            data-grid-field="holidayHours"
                            disabled={disabled}
                            value={employee.payrollInput.holidayHours}
                            className={inputClass()}
                            onChange={(event) => updateNumber(employee, 'holidayHours', event.target.value)}
                            onBlur={() => void persistEmployee(employee)}
                          />
                        </td>
                        <td className={cellClass}>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            aria-label={`پاداش متغیر ${employee.fullName}`}
                            data-grid-row={rowIndex}
                            data-grid-field="variableBonusRial"
                            disabled={disabled}
                            value={Math.round(employee.payrollInput.variableBonusRial / unitMultiplier)}
                            className={inputClass('w-28')}
                            onChange={(event) => updateNumber(employee, 'variableBonusRial', event.target.value, undefined, unitMultiplier)}
                            onBlur={() => void persistEmployee(employee)}
                          />
                        </td>
                        <td className={cellClass}>
                          <select
                            aria-label={`وضعیت تأهل ${employee.fullName}`}
                            data-grid-row={rowIndex}
                            data-grid-field="isMarried"
                            disabled={disabled}
                            value={maritalMissing ? '' : employee.payrollInput.isMarried ? 'yes' : 'no'}
                            className={`w-24 rounded-md border px-2 py-2 text-xs ${maritalMissing ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-white'}`}
                            onChange={(event) => {
                              const updated = updateEmployee(employee, {
                                isMarried: event.target.value === 'yes',
                              }, {
                                code: 'MONTHLY_MARITAL_STATUS_UNCONFIRMED',
                                field: 'isMarried',
                                message: 'وضعیت تأهل این کارمند را مشخص کنید.',
                                confirmed: true,
                              });
                              void persistEmployee(updated);
                            }}
                          >
                            <option value="">انتخاب کنید</option>
                            <option value="yes">متأهل</option>
                            <option value="no">مجرد</option>
                          </select>
                        </td>
                        <td className={cellClass}>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            aria-label={`تعداد فرزند واجد شرایط ${employee.fullName}`}
                            data-grid-row={rowIndex}
                            data-grid-field="childrenCount"
                            disabled={disabled}
                            value={childrenMissing ? '' : employee.payrollInput.childrenCount}
                            placeholder="۰"
                            className={requiredInputClass(childrenMissing)}
                            onChange={(event) => updateNumber(employee, 'childrenCount', event.target.value, {
                              code: 'MONTHLY_CHILDREN_COUNT_UNCONFIRMED',
                              field: 'childrenCount',
                              message: 'تعداد فرزندان واجد شرایط را مشخص کنید؛ در صورت نداشتن فرزند، عدد صفر را وارد کنید.',
                            })}
                            onBlur={() => void persistEmployee(employee)}
                          />
                        </td>
                        <td className={cellClass}>
                          <select
                            aria-label={`سابقه بیمه ۷۲۰ روز ${employee.fullName}`}
                            data-grid-row={rowIndex}
                            data-grid-field="has720DaysInsurance"
                            disabled={disabled}
                            value={insuranceMissing ? '' : employee.payrollInput.has720DaysInsurance ? 'yes' : 'no'}
                            className={`w-28 rounded-md border px-2 py-2 text-xs ${insuranceMissing ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-white'}`}
                            onChange={(event) => {
                              const updated = updateEmployee(employee, {
                                has720DaysInsurance: event.target.value === 'yes',
                              }, {
                                code: 'MONTHLY_720_DAY_INSURANCE_UNCONFIRMED',
                                field: 'has720DaysInsurance',
                                message: 'وضعیت احراز حداقل ۷۲۰ روز سابقه بیمه را مشخص کنید.',
                                confirmed: true,
                              });
                              void persistEmployee(updated);
                            }}
                          >
                            <option value="">انتخاب کنید</option>
                            <option value="yes">دارد</option>
                            <option value="no">ندارد</option>
                          </select>
                        </td>
                        <td className={cellClass}>
                          <input
                            type="number"
                            min={0}
                            max={366}
                            step={1}
                            aria-label={`روزهای کارکرد سالانه ${employee.fullName}`}
                            data-grid-row={rowIndex}
                            data-grid-field="annualWorkedDays"
                            disabled={disabled}
                            value={annualDaysMissing ? '' : employee.payrollInput.annualWorkedDays}
                            placeholder="روز"
                            className={requiredInputClass(annualDaysMissing)}
                            onChange={(event) => updateNumber(employee, 'annualWorkedDays', event.target.value, {
                              code: 'MONTHLY_ANNUAL_WORKED_DAYS_UNCONFIRMED',
                              field: 'annualWorkedDays',
                              message: 'تعداد روزهای کارکرد سال برای محاسبه عیدی را وارد یا تأیید کنید.',
                            })}
                            onBlur={() => void persistEmployee(employee)}
                          />
                        </td>
                        <td className={cellClass}>
                          <button
                            type="button"
                            disabled={!employee.isActive || isSaving}
                            onClick={() => toggleMonthlyDetails(employee.employeeId)}
                            className="rounded-md border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                          >
                            {expandedDetailsEmployeeIds.has(employee.employeeId) ? 'بستن جزئیات' : 'ورودی‌های بیشتر'}
                          </button>
                        </td>
                        <td className={cellClass}>
                          {displayedIssues.length > 0 ? (
                            <div className="max-w-56">
                              <div className="text-xs font-semibold text-amber-800">
                                {toPersianDigits(displayedIssues.length)} مورد نیازمند بررسی
                              </div>
                              <div className="mt-1 text-[11px] leading-5 text-slate-500" title={displayedIssues.map((issue) => issue.message).join('؛ ')}>
                                {displayedIssues.slice(0, 2).map((issue) => issue.message).join('؛ ')}
                                {displayedIssues.length > 2 ? ' …' : ''}
                              </div>
                            </div>
                          ) : calculatedLine?.status === 'calculated' ? (
                            <span className="text-xs font-semibold text-teal-700">محاسبه شد</span>
                          ) : calculatedLine?.status === 'excluded' || !employee.isActive ? (
                            <span className="text-xs text-slate-500">خارج از محاسبه</span>
                          ) : (
                            <span className="text-xs text-slate-500">آماده ورود اطلاعات</span>
                          )}
                        </td>
                      </tr>
                      {expandedDetailsEmployeeIds.has(employee.employeeId) && (
                        <tr key={`${employee.employeeId}-excel-details`} className="bg-slate-50/70">
                          <td colSpan={14} className="border-b border-slate-200 p-4">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="text-sm font-semibold text-slate-800">ورودی‌های تکمیلی فایل اکسل · {employee.fullName}</div>
                                <p className="mt-1 text-xs text-slate-500">این فیلدها مستقل از هم ذخیره می‌شوند. مرخصی استحقاقی از دفتر مرخصی خوانده می‌شود؛ مرخصی استعلاجی و غیبت بدون حقوق جداگانه‌اند.</p>
                              </div>
                              <span className="text-[11px] text-slate-500">مبالغ به {unit}</span>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              <div className="rounded-lg border border-slate-200 bg-white p-3">
                                <div className="text-xs text-slate-500">مرخصی استحقاقی استفاده‌شده</div>
                                <div className="mt-2 text-sm font-semibold tabular-nums text-slate-800">{toPersianDigits(employee.payrollInput.paidLeaveDays ?? 0)} روز</div>
                                <div className="mt-1 text-[10px] text-slate-500">منبع: دفتر مرخصی؛ برای جلوگیری از ثبت دوگانه فقط در همان دفتر ویرایش می‌شود.</div>
                              </div>
                              <label className="space-y-1 text-xs text-slate-600">مرخصی استعلاجی (روز)
                                <input type="number" min={0} max={periodMonthDays} step={0.5} disabled={disabled} value={employee.payrollInput.sickLeaveDays ?? 0} onChange={(e) => updateMonthlyNumber(employee, 'sickLeaveDays', e.target.value)} onBlur={() => void persistEmployee(employee)} className={inputClass('w-full')} />
                              </label>
                              <label className="space-y-1 text-xs text-slate-600">غیبت بدون حقوق (روز)
                                <input type="number" min={0} max={periodMonthDays} step={0.5} disabled={disabled} value={employee.payrollInput.unpaidAbsenceDays ?? 0} onChange={(e) => updateMonthlyNumber(employee, 'unpaidAbsenceDays', e.target.value)} onBlur={() => void persistEmployee(employee)} className={inputClass('w-full')} />
                              </label>
                              <label className="space-y-1 text-xs text-slate-600">جمعه‌کاری (ساعت)
                                <input type="number" min={0} step={0.5} disabled={disabled} value={employee.payrollInput.fridayHours ?? 0} onChange={(e) => updateMonthlyNumber(employee, 'fridayHours', e.target.value)} onBlur={() => void persistEmployee(employee)} className={inputClass('w-full')} />
                              </label>
                              <label className="space-y-1 text-xs text-slate-600">مأموریت (روز)
                                <input type="number" min={0} max={periodMonthDays} step={0.5} disabled={disabled} value={employee.payrollInput.missionDays ?? 0} onChange={(e) => updateMonthlyNumber(employee, 'missionDays', e.target.value)} onBlur={() => void persistEmployee(employee)} className={inputClass('w-full')} />
                              </label>
                              <label className="space-y-1 text-xs text-slate-600">مزایای مشمول بیمه ({unit})
                                <input type="number" min={0} step={1} disabled={disabled} value={Math.round((employee.payrollInput.insuredBenefitsRial ?? 0) / unitMultiplier)} onChange={(e) => updateMonthlyNumber(employee, 'insuredBenefitsRial', e.target.value, unitMultiplier)} onBlur={() => void persistEmployee(employee)} className={inputClass('w-full')} />
                              </label>
                              <label className="space-y-1 text-xs text-slate-600">مزایای غیرمشمول بیمه ({unit})
                                <input type="number" min={0} step={1} disabled={disabled} value={Math.round((employee.payrollInput.nonInsuredBenefitsRial ?? 0) / unitMultiplier)} onChange={(e) => updateMonthlyNumber(employee, 'nonInsuredBenefitsRial', e.target.value, unitMultiplier)} onBlur={() => void persistEmployee(employee)} className={inputClass('w-full')} />
                              </label>
                              <label className="space-y-1 text-xs text-slate-600">قسط وام ({unit})
                                <input type="number" min={0} step={1} disabled={disabled} value={Math.round((employee.payrollInput.loanDeductionRial ?? 0) / unitMultiplier)} onChange={(e) => updateMonthlyNumber(employee, 'loanDeductionRial', e.target.value, unitMultiplier)} onBlur={() => void persistEmployee(employee)} className={inputClass('w-full')} />
                              </label>
                              <label className="space-y-1 text-xs text-slate-600">مساعده ({unit})
                                <input type="number" min={0} step={1} disabled={disabled} value={Math.round((employee.payrollInput.advanceDeductionRial ?? 0) / unitMultiplier)} onChange={(e) => updateMonthlyNumber(employee, 'advanceDeductionRial', e.target.value, unitMultiplier)} onBlur={() => void persistEmployee(employee)} className={inputClass('w-full')} />
                              </label>
                              <label className="space-y-1 text-xs text-slate-600">سایر کسورات ({unit})
                                <input type="number" min={0} step={1} disabled={disabled} value={Math.round((employee.payrollInput.otherDeductionsRial ?? 0) / unitMultiplier)} onChange={(e) => updateMonthlyNumber(employee, 'otherDeductionsRial', e.target.value, unitMultiplier)} onBlur={() => void persistEmployee(employee)} className={inputClass('w-full')} />
                              </label>
                              <label className="space-y-1 text-xs text-slate-600">اصلاح مثبت/منفی ({unit})
                                <input type="number" step={1} disabled={disabled} value={Math.round((employee.payrollInput.signedCorrectionRial ?? 0) / unitMultiplier)} onChange={(e) => updateMonthlyNumber(employee, 'signedCorrectionRial', e.target.value, unitMultiplier)} onBlur={() => void persistEmployee(employee)} className={inputClass('w-full')} />
                              </label>
                              <label className="space-y-1 text-xs text-slate-600">شناسه فیش
                                <input type="text" maxLength={80} disabled={disabled} value={employee.payrollInput.payslipId ?? ''} onChange={(e) => updateMonthlyText(employee, 'payslipId', e.target.value)} onBlur={() => void persistEmployee(employee)} className={inputClass('w-full')} />
                              </label>
                              <label className="space-y-1 text-xs text-slate-600">تاریخ پرداخت
                                <input type="text" placeholder="1405-01-31" disabled={disabled} value={employee.payrollInput.paymentDate ?? ''} onChange={(e) => updateMonthlyText(employee, 'paymentDate', e.target.value)} onBlur={() => void persistEmployee(employee)} className={inputClass('w-full')} />
                              </label>
                            </div>
                            <label className="mt-3 block space-y-1 text-xs text-slate-600">یادداشت
                              <textarea rows={2} disabled={disabled} value={employee.payrollInput.monthlyNotes ?? ''} onChange={(e) => updateMonthlyText(employee, 'monthlyNotes', e.target.value)} onBlur={() => void persistEmployee(employee)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100" />
                            </label>
                            <p className="mt-3 text-[11px] leading-5 text-amber-800">قسط وام، مساعده و سایر کسورات در این جدول به‌صورت مبلغ ماهانه دستی وارد می‌شوند؛ تا اتصال دفتر بدهی، آن‌ها را هم‌زمان از دفتر بدهی و این قسمت ثبت نکنید. مأموریت و مزایای غیرمشمول/مشمول با طبقه‌بندی فعلی فایل مرجع در محاسبه لحاظ می‌شوند، اما وضعیت حقوقی هر قلم نیازمند بازبینی است.</p>
                          </td>
                        </tr>
                      )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <span>
                نمایش {toPersianDigits(filteredEmployees.length)} از {toPersianDigits(employees.length)} ردیف
              </span>
              <span>تغییرات هر ردیف هنگام خروج از سلول ذخیره می‌شود؛ محاسبه دوره نیز یک Snapshot مستقل می‌سازد.</span>
            </div>
          </section>

          {runResult && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">نتیجه محاسبه دوره</h2>
                  <p className="mt-1 text-xs text-slate-500">{runResult.runId}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={runResult.status === 'ready-for-review' ? 'text-sm font-semibold text-teal-700' : 'text-sm font-semibold text-rose-700'}>
                    {runResult.status === 'ready-for-review' ? 'آماده بررسی' : 'دارای موارد نیازمند اصلاح'}
                  </span>
                  {lastSavedRunId === runResult.runId && (
                    <span className="text-xs text-teal-700">Snapshot ذخیره شد</span>
                  )}
                  <button
                    type="button"
                    onClick={() => void downloadPayrollRunExcelWorkbook(runResult)}
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    خروجی Excel دوره
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['جمع ناخالص', runResult.totals.grossEarningsRial],
                  ['جمع کسورات', runResult.totals.totalDeductionsRial],
                  ['خالص پرداختی', runResult.totals.netPayRial],
                  ['بیمه سهم کارفرما', runResult.totals.employerInsuranceRial],
                  ['هزینه مستقیم کارفرما', runResult.totals.directEmployerCostRial],
                  ['ذخایر ماهانه', runResult.totals.monthlyReservesRial],
                  ['CTC ماهانه', runResult.totals.ctcMonthlyRial],
                  ['CTC سالانه‌شده', runResult.totals.ctcAnnualRial],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">{label}</div>
                    <div className="mt-1 text-base font-bold tabular-nums text-slate-900">{format(Number(value))}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
                <span>کل کارکنان: {toPersianDigits(runResult.totals.employeeCount)}</span>
                <span>محاسبه‌شده: {toPersianDigits(runResult.totals.calculatedCount)}</span>
                <span>نیازمند اصلاح: {toPersianDigits(runResult.totals.blockedCount)}</span>
                <span>خارج از دوره: {toPersianDigits(runResult.totals.excludedCount)}</span>
              </div>

              {runResult.lines.some((line) => line.issues.length > 0) && (
                <div className="mt-5 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <h3 className="text-sm font-semibold text-amber-900">موارد نیازمند تکمیل یا اصلاح</h3>
                  {runResult.lines.filter((line) => line.issues.length > 0).map((line) => (
                    <p key={line.employeeId} className="text-xs leading-6 text-amber-900">
                      <strong>{line.personnelCode} · {line.fullName}:</strong>{' '}
                      {line.issues.map((issue) => issue.message).join('؛ ')}
                    </p>
                  ))}
                </div>
              )}

              {runResult.lines.some((line) => (line.result?.legalReviewRequiredItems.length ?? 0) > 0) && (
                <div className="mt-4 space-y-2 rounded-lg border border-orange-200 bg-orange-50 p-4">
                  <h3 className="text-sm font-semibold text-orange-900">هشدارهای قواعد نیازمند بررسی حقوقی</h3>
                  {runResult.lines.filter((line) => (line.result?.legalReviewRequiredItems.length ?? 0) > 0).map((line) => (
                    <p key={line.employeeId} className="text-xs leading-6 text-orange-900">
                      <strong>{line.personnelCode} · {line.fullName}:</strong>{' '}
                      {line.result?.legalReviewRequiredItems.join('؛ ')}
                    </p>
                  ))}
                </div>
              )}

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[900px] text-right text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="p-3">کد پرسنلی</th>
                      <th className="p-3">نام کارمند</th>
                      <th className="p-3">ناخالص</th>
                      <th className="p-3">بیمه کارگر</th>
                      <th className="p-3">مالیات</th>
                      <th className="p-3">خالص دریافتی</th>
                      <th className="p-3">بیمه کارفرما</th>
                      <th className="p-3">CTC ماهانه</th>
                      <th className="p-3">وضعیت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {runResult.lines.map((line) => (
                      <tr key={line.employeeId}>
                        <td className="p-3 tabular-nums">{line.personnelCode}</td>
                        <td className="p-3">{line.fullName}</td>
                        <td className="p-3 tabular-nums">{line.result ? format(line.result.grossEarningsRial) : '—'}</td>
                        <td className="p-3 tabular-nums">{line.result ? format(line.result.employeeInsuranceRial) : '—'}</td>
                        <td className="p-3 tabular-nums">{line.result ? format(line.result.totalPayrollTaxRial) : '—'}</td>
                        <td className="p-3 tabular-nums font-semibold">{line.result ? format(line.result.netPayRial) : '—'}</td>
                        <td className="p-3 tabular-nums">{line.result ? format(line.result.totalEmployerInsuranceRial) : '—'}</td>
                        <td className="p-3 tabular-nums">{line.result ? format(line.result.ctcMonthlyRial) : '—'}</td>
                        <td className="p-3">
                          {line.status === 'calculated' ? 'محاسبه‌شده' : line.status === 'blocked' ? 'نیازمند اصلاح' : 'خارج از دوره'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600">
        <strong className="text-slate-800">نکته ورود اطلاعات:</strong>{' '}
        روزهای کارکرد و کارکرد سالانه برای هر دوره باید تأیید شوند. اطلاعات تأهل، فرزند و سابقه ۷۲۰ روز بیمه برای کارکنان جدید تا زمان تعیین صریح وارد محاسبه نمی‌شوند. ساعت‌های اضافه‌کاری، شب‌کاری و تعطیل‌کاری و پاداش متغیر در صورت نداشتن مقدار، صفر محسوب می‌شوند. نتیجه «آماده بررسی» به‌معنای تأیید پرداخت یا تأیید حقوقی همه قواعد نیست.
      </section>
    </div>
  );
}
