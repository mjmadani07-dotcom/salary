export interface MonthlyLeaveRecord {
  leaveId: string;
  employeeId: string;
  personnelCode: string;
  fiscalYear: '1404' | '1405';
  month: number;
  openingBalanceDays: number;
  accruedDays: number;
  paidLeaveUsedDays: number;
  unpaidLeaveUsedDays: number;
  adjustmentDays: number;
  closingBalanceDays: number;
  notes: string;
  updatedAt: string;
}

export type MonthlyLeaveDraft = Omit<MonthlyLeaveRecord, 'leaveId' | 'closingBalanceDays' | 'updatedAt'>;
