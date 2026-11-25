export type EmployeeStatus = 'active' | 'inactive';
export type EmploymentContractType = 'permanent' | 'fixed-term' | 'temporary' | 'project' | 'other';

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
  contractNumber: string;
  contractType: EmploymentContractType;
  jobTitle: string;
  department: string;
  contractFromJalali: string;
  contractToJalali: string;
  weeklyHours: string;
  dailyBaseWageRial: string;
  dailySeniorityRial: string;
  wageFromJalali: string;
}
