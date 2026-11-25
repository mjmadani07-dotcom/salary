# Monthly Leave Ledger — Implementation Notes

## Purpose

The leave ledger keeps a monthly balance history for each employee. It is a local recordkeeping tool for the finance manager; it does not replace the employer's approved leave policy, signed agreements or legal review.

## Monthly fields

- Opening balance (days)
- Accrued entitlement for the month (days)
- Paid leave used (days)
- Unpaid leave used (days)
- Signed adjustment (days; positive or negative)
- Closing balance (calculated)
- Notes / adjustment reference

## Balance formula

Closing balance = opening balance + accrued entitlement - paid leave used + adjustment.

Unpaid leave is recorded separately and is not deducted from the paid-leave balance.

## Carry-forward

For the first month entered for an employee in a fiscal year, the finance manager enters the opening balance from an approved prior record. For subsequent months, the opening balance is taken from the latest earlier recorded month.

If an earlier month is edited, the application recalculates the opening and closing balances of later recorded months for that employee, preserving their accrual, usage and adjustment entries.

## Validation

- Month must be 1–12.
- Day quantities must be finite and non-negative, except signed adjustments.
- Paid leave usage cannot exceed the available balance after accrual and adjustment.
- Closing balance cannot be negative.

## Legal and payroll boundaries

The application does not hard-code a monthly accrual rate in this ledger. The entitlement must be entered according to the applicable, approved legal/contractual basis. This avoids silently assuming one rule for every employee or employer.

Unpaid leave is recorded in this ledger and now participates in a payroll review gate. When a month has unpaid leave, the Attendance screen displays the recorded quantity and asks the finance manager to confirm that the monthly work/payroll-day input has been reconciled with that quantity. PayrollRun blocks that employee if the saved review quantity is missing or differs from the current leave record. Editing the worked-day input clears the confirmation; changing the leave record makes an earlier confirmation stale.

The system deliberately does **not** subtract unpaid leave days or money automatically. The exact conversion from leave days to payable days depends on the approved employment/attendance policy and must not be guessed. The manager must reconcile the attendance input and acknowledge the current leave quantity before payroll calculation can proceed. This avoids silently applying an unapproved formula or deducting the same absence twice.

Daily leave requests, leave categories beyond paid/unpaid, approval workflow, and automatic accrual rules are not included in this stage.

The existing payroll CTC calculation has its own annual-leave reserve assumption. This ledger does not currently replace or reconcile that reserve calculation. These are separate concepts and require a later, explicit policy decision before being linked.
