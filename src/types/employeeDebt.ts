export type EmployeeDebtType = 'advance' | 'loan';
export type DebtRepaymentPlan = 'fixed-installment' | 'manual';
export type DebtPaymentMethod = 'cash' | 'bank' | 'other';
export type OtherDeductionReviewStatus = 'proposed' | 'reviewed' | 'cancelled';

export interface DebtPeriod {
  fiscalYear: string;
  month: number;
}

export interface EmployeeDebtAccount {
  debtId: string;
  employeeId: string;
  personnelCode: string;
  employeeName: string;
  debtType: EmployeeDebtType;
  principalRial: number;
  issueDateJalali: string;
  purpose: string;
  repaymentPlan: DebtRepaymentPlan;
  monthlyInstallmentRial: number | null;
  firstDueFiscalYear: string | null;
  firstDueMonth: number | null;
  installmentLimit: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type EmployeeDebtAccountDraft = Omit<EmployeeDebtAccount,
  'debtId' | 'createdAt' | 'updatedAt'
>;

export interface EmployeeDebtRepayment {
  repaymentId: string;
  debtId: string;
  employeeId: string;
  personnelCode: string;
  amountRial: number;
  fiscalYear: string;
  month: number;
  repaymentDateJalali: string;
  paymentMethod: DebtPaymentMethod;
  reference: string;
  notes: string;
  createdAt: string;
}

export type EmployeeDebtRepaymentDraft = Omit<EmployeeDebtRepayment,
  'repaymentId' | 'createdAt'
>;

export interface EmployeeOtherDeduction {
  deductionId: string;
  employeeId: string;
  personnelCode: string;
  employeeName: string;
  fiscalYear: string;
  month: number;
  title: string;
  amountRial: number;
  authorizationReference: string;
  reviewStatus: OtherDeductionReviewStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type EmployeeOtherDeductionDraft = Omit<EmployeeOtherDeduction,
  'deductionId' | 'createdAt' | 'updatedAt'
>;

export interface DebtIssue {
  code: string;
  field: string;
  message: string;
}

export interface DebtScheduleSummary {
  outstandingRial: number;
  paidToDateRial: number;
  currentInstallmentRial: number;
  overdueRial: number;
  totalDueRial: number;
  installmentNumber: number | null;
  installmentsRemaining: number | null;
}
