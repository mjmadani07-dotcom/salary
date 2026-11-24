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
- Optional notes

Each record is uniquely identified by employee + fiscal year + month. Saving a new version for the same employee-period replaces that period's record; it does not overwrite another month.

## Integration with payroll

During payroll-run calculation, saved attendance for the selected year and month takes precedence over the corresponding manually entered values in the run roster. If no attendance record exists for an employee-period, the existing roster values remain as a compatibility fallback.

The payroll calculation engine remains the single source of payroll calculations. Attendance records only supply inputs; they do not calculate wages or statutory benefits.

## Local storage and legacy vault compatibility

- New installations store attendance in the local IndexedDB database.
- IndexedDB schema version is now 4.
- If an installation already has the legacy encrypted vault configured, attendance records are stored in the existing encrypted-record store and require that vault to be unlocked.
- No new password or separate vault setup is introduced.

## Validation and limitations

The ledger validates period bounds, worked days, non-negative hours and bonus amounts, and annual worked-day bounds.

This first implementation records monthly totals rather than daily punch-in/punch-out events. It does not yet model absence categories, paid/unpaid leave balances, missions, shift rosters, daily schedules, or partial-month wage segmentation. The annual worked-days value is entered as an input; it is not yet derived automatically from a year-long attendance ledger.

Attendance records should be checked against the employer's approved attendance source before payroll is finalized.
