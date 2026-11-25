import type { FiscalYear } from '../data/payrollRegulations';

export type PayrollSettlementReason =
  | 'contract-end'
  | 'resignation'
  | 'dismissal'
  | 'retirement'
  | 'total-disability'
  | 'death'
  | 'workshop-closure'
  | 'work-related-incapacity'
  | 'other';

export type PayrollSettlementStatus =
  | 'draft'
  | 'ready-for-review'
  | 'approved'
  | 'paid'
  | 'cancelled';

/**
 * Explicit settlement inputs. The three wage bases are separate because the
 * legal basis for Eid, severance and unused leave is not interchangeable.
 */
export interface PayrollSettlementInput {
  settlementId: string;
  employeeId: string;
  personnelCode: string;
  employeeName: string;
  fiscalYear: FiscalYear;
  hireDateJalali: string;
  terminationDateJalali: string;
  reason: PayrollSettlementReason;

  // Excel settlement inputs C and D are retained separately.
  monthsWorkedInYear: number;
  annualWorkedDays: number;
  annualCalendarDays: 365 | 366;

  eidDailyWageBasisRial: number;
  eidWageBasisReference: string;
  eidWageBasisConfirmed: boolean;

  severanceMonthlyWageBasisRial: number;
  severanceWageBasisReference: string;
  severanceWageBasisConfirmed: boolean;

  leaveBalanceDays: number;
  leaveBalanceConfirmed: boolean;
  leaveDailyBasisRial: number;
  leaveBasisReference: string;
  leaveBasisConfirmed: boolean;

  eidAdvancePaidRial: number;
  eidAdvanceReference: string;
  priorSeverancePaidRial: number;
  priorSeveranceReference: string;

  otherClaimsRial: number;
  otherClaimsDescription: string;

  approvedDeductionsRial: number;
  deductionAuthorizationReference: string;
  medicalCommissionReference: string;
  legalBasisReference: string;
  notes: string;
}

export interface PayrollSettlementCalculationResult {
  ruleSetId: string;
  ruleSetVersion: number;
  ruleSetApprovalStatus: string;
  completedServiceYears: number;
  additionalServiceDays: number;
  recognizedServiceYears: number;
  eidMaximumBeforeProrationRial: number;
  eidEntitlementRial: number;
  eidAdvancePaidRial: number;
  eidBalanceRial: number;
  severanceMultiplier: number;
  severanceEntitlementRial: number;
  priorSeverancePaidRial: number;
  severanceBalanceRial: number;
  leaveEncashmentRial: number;
  otherClaimsRial: number;
  totalGrossEntitlementRial: number;
  approvedDeductionsRial: number;
  payableBeforeTaxRial: number;
  legalReviewRequiredItems: string[];
}

export interface PayrollSettlementCase extends PayrollSettlementInput {
  status: PayrollSettlementStatus;
  calculation?: PayrollSettlementCalculationResult;
  createdAt: string;
  updatedAt: string;
  approverName?: string;
  approvalReference?: string;
  approvedAt?: string;
  paymentDate?: string;
  paymentReference?: string;
  paidAmountRial?: number;
  paymentDifferenceReason?: string;
}
