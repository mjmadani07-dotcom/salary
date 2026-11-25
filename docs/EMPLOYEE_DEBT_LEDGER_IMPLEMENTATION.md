# Employee Debt and Other Deductions Ledger

## Purpose and product boundary

This is a local tracking ledger for one finance manager. It records employee advances, loans, repayments and separately documented other deductions.

**Important:** this ledger does not post deductions to payroll. Installments and due amounts are for review and follow-up only. A future connection to the payroll run must use a separate, explicit authorization and approval workflow; the existence of a debt or a reviewed record is not, by itself, permission to deduct wages.

## Data recorded

### Advance / loan account

- Employee identity and personnel code.
- Type: advance or loan.
- Principal amount in Rial.
- Jalali issue date.
- Purpose / reason and optional document reference.
- Repayment plan: fixed monthly installment or manual repayment.
- For a fixed plan: monthly installment, first due year/month and optional installment count.
- Creation and last-update timestamps.

No interest rate, penalty, compounding or capitalized fee is assumed or calculated in this initial ledger.

### Repayment transaction

Each repayment is a separate, append-only transaction:

- Linked debt account and employee.
- Amount in Rial.
- Jalali repayment date and matching fiscal year/month.
- Method: bank, cash or other.
- Optional bank/document reference and notes.
- Creation timestamp.

A repayment cannot exceed the outstanding principal. Repayment records are not edited or deleted through the initial UI; a correction/reversal workflow is a later audit feature.

### Other agreed deduction

This is intentionally separate from a loan/advance account. It records employee, payroll period, title, amount, authorization/document reference, notes and a review status ("proposed", "reviewed", "cancelled").

To mark a record as reviewed, an authorization reference is required. Even when reviewed, it remains a record in this ledger and is **not** automatically included in payroll.

## Calculations

For a debt account:

- Outstanding principal = principal − repayments recorded through the selected period.
- Scheduled installments are derived from the first due period, installment amount and optional installment limit.
- Overdue scheduled amount is shown separately from the current installment.
- A final installment is capped at the remaining principal.
- Manual repayment plans have no automatically scheduled installment.
- The proposed amount due is a tracking figure only; no money is deducted from the employee's net pay.

The application rejects a repayment that exceeds the remaining principal and a repayment date whose year/month disagrees with the entered Jalali date.

## Local persistence and legacy vault compatibility

- IndexedDB schema advances to version 6.
- New installations store the debt accounts, repayment transactions and other-deduction records in local object stores in the current browser profile.
- If the installation already has the legacy encrypted vault configured, these records use the existing encrypted-record store and original vault keys/passphrase.
- No new vault setup or passphrase is required for a new installation.
- No server or cloud synchronization is introduced.

## Current limitations

- No automatic payroll deduction or payroll-run integration.
- No interest, late fee, collateral, guarantor or refinancing logic.
- No legal determination that an advance/loan or other deduction may be withheld from wages; that must be evidenced and reviewed separately.
- No installment change, debt write-off, account closure, repayment reversal or correction workflow yet.
- No debt settlement at termination or final-pay reconciliation.
- No approval chain or digital signatures; the finance manager records the supporting reference.
- No automatic bank-statement import or bank transfer file generation.
- The data remains local to the browser profile and is included in versioned JSON Backup/Restore. A safety backup is downloaded before destructive restore; clean-profile and legacy-vault recovery remain operational acceptance tests.

## Tests

The employee debt ledger tests cover account validation, manual/fixed plans, invalid dates and amounts, repayment-over-balance protection, schedule/arrears calculations, manual repayment behavior and the required authorization reference for a reviewed other deduction.
