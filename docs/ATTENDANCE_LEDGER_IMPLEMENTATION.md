# Monthly Attendance Ledger — Implementation Notes

## Purpose

The attendance ledger stores period-specific employee work data independently from the employee master profile. One finance manager enters the monthly figures on the local device; the payroll run reads the saved record for the matching employee, fiscal year and month.

## Stored fields

- Worked days
- Overtime hours
- Night-work hours
- Work on holidays (hours)
- Variable bonus (Rial)
- Annual worked days for the annual bonus input
- Exact unpaid-leave days reviewed by the finance manager and reconciled with the monthly work/payroll-day input (optional for legacy records)
- Optional notes

Each record is uniquely identified by employee + fiscal year + month. Saving a new version for the same employee-period replaces that period's record; it does not overwrite another month.

## Integration with payroll

During payroll-run calculation, saved attendance for the selected year and month takes precedence over the corresponding manually entered values in the run roster. If no attendance record exists for an employee-period, the existing roster values remain as a compatibility fallback.

The attendance screen also reads the monthly leave ledger. When unpaid leave is recorded, the finance manager must explicitly confirm that the monthly attendance/work-day input has been reconciled with that exact unpaid-leave quantity. Editing the worked-day value clears this confirmation. If the leave record is later changed, the old confirmation no longer matches and PayrollRun blocks that employee until the review is repeated.

The payroll calculation engine remains the single source of payroll calculations. Attendance records only supply inputs; they do not calculate wages or statutory benefits.

## Local storage and legacy vault compatibility

- New installations store attendance in the local IndexedDB database.
- IndexedDB schema version is now 5.
- If an installation already has the legacy encrypted vault configured, attendance records are stored in the existing encrypted-record store and require that vault to be unlocked.
- No new password or separate vault setup is introduced.

## Validation and limitations

The ledger validates period bounds, worked days, non-negative hours and bonus amounts, and annual worked-day bounds.

This implementation records monthly totals rather than daily punch-in/punch-out events. It does not yet model daily absence categories, mission, shift rosters, daily schedules, or partial-month wage segmentation. The annual worked-days value is entered as an input; it is not yet derived automatically from a year-long attendance ledger.

**Important payroll boundary:** unpaid leave is not subtracted automatically by the attendance ledger or payroll engine. The review gate requires the finance manager to reconcile the days entered for payroll and acknowledge the exact unpaid-leave days in the leave ledger. This deliberate confirmation prevents a duplicate deduction when the attendance total has already been reduced. The legal/contractual conversion to payable days remains a separate reviewed policy.

Attendance records should be checked against the employer's approved attendance source before payroll is finalized.
