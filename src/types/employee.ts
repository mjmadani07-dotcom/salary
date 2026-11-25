export type EmployeeStatus = 'active' | 'inactive';
export type EmploymentContractType = 'permanent' | 'fixed-term' | 'temporary' | 'project' | 'other';
export type EmployeeWageType = 'minimum' | 'custom';

export interface EmploymentContract {
  contractId: string;
  contractNumber: string;
  contractType: EmploymentContractType;
  jobTitle: string;
  department: string;
  effectiveFromJalali: string;
  effectiveToJalali: string | null;
  weeklyHours: number;
  notes: string;
}

export interface WageHistoryEntry {
  wageEntryId: string;
  effectiveFromJalali: string;
  dailyBaseWageRial: number;
  dailySeniorityRial: number;
  /** Whether this wage entry is the statutory minimum or an individually agreed/custom wage. */
  wageType?: EmployeeWageType;
  /** Whether seniority allowance is applicable under the employee's terms. */
  seniorityEligible?: boolean;
  notes: string;
}

export interface EmployeeMasterRecord {
  employeeId: string;
  personnelCode: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  hireDateJalali: string;
  terminationDateJalali: string | null;
  status: EmployeeStatus;
  insuranceNumber: string;
  /** Optional payment details; digits are preserved as text to retain leading zeroes. */
  bankAccountNumber?: string;
  bankIban?: string;
  /** Stable family facts; period snapshots may still override them where needed. */
  isMarried?: boolean;
  eligibleChildrenCount?: number;
  /** Employee-level flags from the Excel source; not yet overrides for pay-item classifications. */
  insuranceSubject?: boolean;
  taxSubject?: boolean;
  costCenter?: string;
  notes?: string;
  contracts: EmploymentContract[];
  wageHistory: WageHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeMasterDraft {
  personnelCode: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  hireDateJalali: string;
  terminationDateJalali: string;
  status: EmployeeStatus;
  insuranceNumber: string;
  bankAccountNumber: string;
  bankIban: string;
  isMarried: 'yes' | 'no' | '';
  eligibleChildrenCount: string;
  insuranceSubject: 'yes' | 'no' | '';
  taxSubject: 'yes' | 'no' | '';
  costCenter: string;
  notes: string;
  contractNumber: string;
  contractType: EmploymentContractType;
  jobTitle: string;
  department: string;
  contractFromJalali: string;
  contractToJalali: string;
  weeklyHours: string;
  dailyBaseWageRial: string;
  dailySeniorityRial: string;
  wageType: EmployeeWageType;
  seniorityEligible: 'yes' | 'no' | '';
  wageFromJalali: string;
}
