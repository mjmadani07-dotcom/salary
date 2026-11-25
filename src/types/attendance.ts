export type ShiftWorkPattern =
  | 'non-shift'
  | 'morning-evening'
  | 'morning-evening-night'
  | 'morning-night'
  | 'evening-night';

export interface MonthlyAttendanceRecord {
  attendanceId: string;
  employeeId: string;
  personnelCode: string;
  fiscalYear: '1404' | '1405';
  month: number;
  monthDays: 29 | 30 | 31;
  workedDays: number;
  overtimeHours: number;
  nightShiftHours: number;
  /** Monthly rotation classification under Labour Law articles 55–56. */
  shiftWorkPattern?: ShiftWorkPattern;
  holidayHours: number;
  variableBonusRial: number;
  annualWorkedDays: number;
  /** Paid leave from the separate leave ledger; mirrored here only for the period snapshot. */
  paidLeaveDays?: number;
  /** Distinct monthly inputs from the Excel reference sheet. */
  sickLeaveDays?: number;
  unpaidAbsenceDays?: number;
  fridayHours?: number;
  missionDays?: number;
  insuredBenefitsRial?: number;
  nonInsuredBenefitsRial?: number;
  loanDeductionRial?: number;
  advanceDeductionRial?: number;
  otherDeductionsRial?: number;
  /** Signed correction: positive increases gross; negative reduces it. */
  signedCorrectionRial?: number;
  payslipId?: string;
  paymentDate?: string;
  /** Exact unpaid-leave days reviewed by the finance manager and reflected in the payroll-day input. */
  reviewedUnpaidLeaveDays?: number;
  notes: string;
  updatedAt: string;
}

export type MonthlyAttendanceDraft = Omit<MonthlyAttendanceRecord, 'attendanceId' | 'updatedAt'>;
