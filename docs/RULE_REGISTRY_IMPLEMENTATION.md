# Rule Registry and Central Payroll Engine — Implementation Notes

## Scope of this change

This implementation establishes the first executable layer of the payroll rules architecture described in [PAYROLL_RULES_AND_COMPLIANCE.md](./PAYROLL_RULES_AND_COMPLIANCE.md).

It does **not** claim that all 1405 payroll rules have received formal legal approval.

## What changed

### 1. Versioned Rule Registry

File: `src/data/payrollRuleRegistry.ts`

- Annual parameters and tax brackets for 1404 and 1405 now live in `RULE_SETS`.
- Each set has a stable ID, version, Jalali year, source references and legal approval state.
- Both current sets are explicitly `pending-legal-review`.
- `validatePayrollRuleSet` checks internal consistency of amounts, rates and progressive tax brackets.
- `getPayrollRuleSet` is the runtime entry point for the calculation engine.

The old `YEAR_REGULATIONS` export remains in `src/data/payrollRegulations.ts` as a compatibility projection. It no longer owns duplicate annual values.

### 2. Central Pay Item Catalog

File: `src/data/payrollPayItemCatalog.ts`

The catalog defines each pay item independently for:
- inclusion in monthly gross;
- insurance basis treatment;
- taxable-income treatment;
- inclusion in the overtime base;
- inclusion in employer cost;
- legal review status and legal-basis notes.

It also provides shared aggregation functions for insurance basis, taxable income and pending legal-review warnings.

A catalog classification marked `pending-legal-review` documents the current baseline behavior; it must not be interpreted as legal approval.

### 3. Calculation engine integration

File: `src/utils/payrollEngine.ts`

- Resolves the RuleSet by fiscal year.
- Uses the central catalog to assemble gross earnings.
- Uses the catalog to calculate the insurable and taxable bases.
- Returns RuleSet ID/version/approval state.
- Returns per-item gross, insurance and taxable breakdowns.
- Returns a list of items and RuleSet metadata requiring legal review.

The existing progressive tax calculation, insurance ceiling, overtime/night/holiday formulas, annual reserve formulas and settlement formulas are otherwise retained in this first refactor.

### 4. Excel export adapter

File: `src/utils/excelWorkbookBuilder.ts`

- The workbook builder accepts a `PayrollExcelSnapshot` containing the exact `PayrollInput` and `PayrollResult` already calculated by the central engine.
- It rejects a snapshot whose RuleSet ID/version does not match the selected period.
- All payroll, insurance, tax, net-pay, annual settlement and CTC values are copied from the central result.
- The workbook has no independent Excel formulas for payroll, insurance, tax, settlement or CTC calculations.
- The workbook includes calculation summary, pay-item classifications, insurance/tax breakdown, annual entitlements, RuleSet parameters and already-evaluated EOS figures.
- The formula vault remains a separate reference library for users who explicitly want to copy formulas into their own spreadsheets. Those snippets are not executed by the software calculation engine.

### 5. Multi-employee payroll run foundation

Files:
- `src/utils/payrollRunEngine.ts`
- `src/components/PayrollRunView.tsx`

- A payroll run delegates every employee to the same `calculatePayroll` function.
- Duplicate employee IDs/personnel codes, invalid inputs, inactive employees and period mismatches are flagged or excluded instead of being silently calculated.
- Aggregate totals are sums of employee-level `PayrollResult` values; no separate payroll formula set is introduced.
- The new Payroll Run page supports adding employees in the current browser session and reviewing per-employee results and period totals.
- The current list is in-memory only. It is not a persistent employee database and must not be used as permanent payroll record storage.

### 6. Regression tests and CI

- `src/utils/payrollEngine.test.ts` tests RuleSet consistency, tax brackets, gross pay, insurance ceiling, taxable income, item classification and compliance metadata.
- `src/utils/excelWorkbookBuilder.test.ts` verifies exported values equal the central result, the workbook contains no formula cells and mismatched RuleSet versions are rejected.
- `src/utils/payrollRunEngine.test.ts` tests multi-employee totals, duplicate codes, invalid inputs, fiscal-period mismatches and inactive employee exclusion.
- `npm test` / `bun run test` runs the test suite.
- GitHub Actions validates tests, TypeScript and production build on pushes to this branch and pull requests to main.

## Important limitations not closed by this change

1. **Legal approval is pending.** The registry has source references, but the 1404/1405 legal source pack and all rule interpretations still require review and sign-off.
2. **Some classifications represent the current engine behavior.** In particular welfare-benefit tax treatment, marriage allowance, child allowance evidence, overtime and night/holiday overlap remain review items.
3. **Dependent eligibility is not implemented.** The existing input still accepts a child count and a 720-day insurance boolean; it does not yet hold per-child eligibility evidence or actual insurance history.
4. **Seniority eligibility is still input-driven.** The engine has not yet been connected to employment start dates or last seniority-increase dates.
5. **The Excel builder still contains independent spreadsheet formulas.** This change centralizes the web calculation engine; it does not yet remove all duplicated formulas from `excelWorkbookBuilder.ts` or the formula library UI. That is a subsequent integration task.
6. **No multi-employee payroll run has been introduced.** Employee master data, contracts, attendance, leave ledger, loans and approval workflow remain future work.
7. **No retroactive/YTD tax engine has been introduced.** Current monthly progressive tax remains the existing behavior.

## Required next work

1. Complete the legal source pack and sign off the RuleSets.
2. Expand the catalog and make every formula consume catalog/rule data rather than hardcoded constants.
3. Add legal date-effective rules for seniority, work-time patterns, Friday/holiday work, mission, leave, annual bonus and severance.
4. Convert the Excel builder and formula library into render/export adapters over the calculation output; no independent payroll formulas should remain.
5. Add persistent employee/contract records and secure payroll-period snapshots.
6. Add attendance, leave, loan and deduction ledgers.
7. Add YTD/multi-source tax, audit and approval/payment workflows.
8. Add import/export integration tests for employee lists and attendance inputs.

## Operational warning

Until the legal review is complete and the remaining integration work is closed, this branch is a development baseline. It must not be represented as a fully compliant or production-approved payroll system.


## Current Excel and multi-employee status

The Excel workbook is now an output adapter only. The calculation result is generated once by `calculatePayroll` and serialized to XLSX. The exported file is a snapshot of one employee calculation from the current single-employee views. Multi-employee calculations are available through `calculatePayrollRun` and the Payroll Run workspace; batch-to-XLSX export and durable storage are not yet implemented.

The Payroll Run workspace is intentionally labelled as review-only. Its current state is ephemeral browser memory. It does not yet persist employee data or authorize approval/payment.
