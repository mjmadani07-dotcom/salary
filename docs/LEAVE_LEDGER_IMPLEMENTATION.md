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

Unpaid leave is currently recorded in this ledger only. It is not yet automatically deducted from attendance workdays or payroll inputs. Daily leave requests, leave categories beyond paid/unpaid, approval workflow, and automatic accrual rules are not included in this stage.

The existing payroll CTC calculation has its own annual-leave reserve assumption. This ledger does not currently replace or reconcile that reserve calculation. These are separate concepts and require a later, explicit policy decision before being linked.
