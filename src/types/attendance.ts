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
  holidayHours: number;
  variableBonusRial: number;
  annualWorkedDays: number;
  /** Exact unpaid-leave days reviewed by the finance manager and reflected in the payroll-day input. */
  reviewedUnpaidLeaveDays?: number;
  notes: string;
  updatedAt: string;
}

export type MonthlyAttendanceDraft = Omit<MonthlyAttendanceRecord, 'attendanceId' | 'updatedAt'>;
