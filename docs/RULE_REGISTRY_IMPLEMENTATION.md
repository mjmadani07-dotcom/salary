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

Files: `src/utils/payrollEngine.ts`, `src/utils/wageRules.ts`

- Resolves the RuleSet by fiscal year.
- Uses the central catalog to assemble gross earnings.
- Uses the catalog to calculate the insurable and taxable bases.
- Returns RuleSet ID/version/approval state.
- Returns per-item gross, insurance and taxable breakdowns.
- Returns a list of items and RuleSet metadata requiring legal review.
- Validates payroll inputs before calculation and rejects invalid negative or out-of-range values.
- Calculates the annual "other wage levels" adjustment from the previous daily wage using the year-specific percentage plus fixed daily increment and applies the annual minimum-wage floor.
- The 1405 increase parameters are 45% + 519,549 Rial/day. The 1404 parameters are 32% + 310,535 Rial/day. These values remain subject to source verification and legal sign-off.
- The helper does not replace job-classification group tables, piece-rate rules or special collective agreements.

The existing progressive tax calculation, insurance ceiling, overtime/night/holiday formulas, annual reserve formulas and settlement formulas are retained as the current calculation baseline.

### 4. Excel export adapter

File: `src/utils/excelWorkbookBuilder.ts`

- The workbook builder accepts a `PayrollExcelSnapshot` containing the exact `PayrollInput` and `PayrollResult` already calculated by the central engine.
- It rejects a snapshot whose RuleSet ID/version does not match the selected period.
- All payroll, insurance, tax, net-pay, annual settlement and CTC values are copied from the central result.
- The workbook has no independent Excel formulas for payroll, insurance, tax, settlement or CTC calculations.
- The single-employee workbook includes calculation summary, pay-item classifications, insurance/tax breakdown, annual entitlements, RuleSet parameters and already-evaluated EOS figures.
- `buildPayrollRunExcelWorkbook` exports the complete multi-employee PayrollRunResult with payroll register, employee pay-item detail, tax brackets and validation/legal-review warnings.
- Both workbook builders reject formulas: they serialize calculated values only.
- The formula vault remains a separate reference library for users who explicitly want to copy formulas into their own spreadsheets. Those snippets are not executed by the software calculation engine.

### 5. Multi-employee payroll run foundation

Files:
- `src/utils/payrollRunEngine.ts`
- `src/components/PayrollRunView.tsx`

- A payroll run delegates every employee to the same `calculatePayroll` function.
- Duplicate employee IDs/personnel codes, invalid inputs, inactive employees and period mismatches are flagged or excluded instead of being silently calculated.
- Aggregate totals are sums of employee-level `PayrollResult` values; no separate payroll formula set is introduced.
- The new Payroll Run page supports adding employees in the current browser session and reviewing per-employee results and period totals.
- Employee profiles and payroll-run snapshots are stored locally in IndexedDB on the current device.
- New installations use the local database directly; no separate account, workspace, server or passphrase setup is required.
- Payroll remains a single-operator workflow: one finance manager uses the application to maintain employee records and calculate a payroll period for multiple employees.
- Existing installations that already created the earlier encrypted vault remain supported. Those records are unlocked with their existing passphrase and are not silently converted or deleted.
- The local database belongs to the current browser profile. Versioned JSON backup/restore is implemented, including a safety copy before destructive restore; clean-profile and legacy-vault recovery tests remain operational acceptance gates. Native Windows installer packaging is outside the lightweight product scope.
- Local storage must therefore be protected through the Windows user account and device security. Do not treat browser-local storage as a substitute for backups.

### 6. Regression tests and CI

- `src/utils/payrollEngine.test.ts` tests RuleSet consistency, tax brackets, gross pay, insurance ceiling, taxable income, item classification and compliance metadata.
- `src/utils/excelWorkbookBuilder.test.ts` verifies exported values equal the central result, the workbook contains no formula cells and mismatched RuleSet versions are rejected.
- `src/utils/payrollRunEngine.test.ts` tests multi-employee totals, duplicate codes, invalid inputs, fiscal-period mismatches and inactive employee exclusion.
- `src/utils/payrollVaultCrypto.test.ts` tests AES-GCM encryption/decryption, authenticated record identity, opaque IDs and deterministic keyed personnel-code tokens.
- Wage adjustment cases for 1404 and 1405 are covered by `src/utils/payrollEngine.test.ts`.
- `npm test` / `bun run test` runs the test suite.
- GitHub Actions validates tests, TypeScript and production build on pushes to this branch and pull requests to main.

## Current limitations and remaining work

The 1404/1405 legal-source review and sign-off status is maintained in [LEGAL_REVIEW_REGISTER.md](./LEGAL_REVIEW_REGISTER.md). The implementation is technically testable, but neither RuleSet is legally approved for production until the applicable primary sources and employer-specific applicability are verified.

1. **Legal approval is pending.** Wage, insurance, tax and statutory-benefit sources, interpretation of disputed wage bases and every pending pay-item classification require documented reviewer sign-off.
2. **Pay-item classification is incomplete.** Tax/insurance/wage treatment of welfare benefits, marriage/child allowances, mission expenses and special insurance cases must be confirmed before the related items are treated as final.
3. **Dependent and insurance evidence is incomplete.** The current inputs can hold child count and a 720-day insurance confirmation, but per-dependent eligibility evidence and actual insurance history are not fully maintained.
4. **Seniority/job-group applicability is incomplete.** Employee hire dates and effective wage history exist; approved-plan group assignment, last-seniority-date evidence and applicable progression rules remain to be confirmed for affected workers.
5. **Attendance and leave are monthly aggregates.** Selected-period attendance and leave data feed PayrollRun; paid leave is reconciled to the leave ledger and unpaid leave requires explicit acknowledgement. The app does not provide daily timekeeping, shift scheduling or a full leave-management system. Detailed daily/weekly evidence must come from the employer's approved external attendance source.
6. **Debt ledger is optional tracking only.** It records advances/loans, repayments and other proposed deductions, but does not auto-post to payroll. This separation is an intentional lightweight product boundary; monthly payroll deduction amounts are entered explicitly and require a documented legal/contractual basis.
7. **Payroll review/payment workflow is implemented.** The one-manager lifecycle supports review, approval, payment recording, close and traceable correction snapshots. It is not an enterprise approval chain, multi-user authorization or bank-payment integration.
8. **No retroactive/YTD multi-source tax engine has been introduced.** Current behavior is the configured monthly progressive tax model; legal review must determine whether YTD or multiple-employer aggregation is required for the actual launch population.
9. **Backup/restore is implemented in code.** A versioned JSON backup covers current IndexedDB stores, restore uses an atomic full replacement, and a safety copy is downloaded before destructive restore. Clean-profile, schema-upgrade and legacy-vault recovery tests remain operational acceptance gates. Native Windows installer packaging and bank-specific interfaces are outside the current core scope.
10. **The full operational EOS system is deferred.** Existing EOS calculation/simulator features remain in the product, but no Accountability Chart, Scorecard/Rocks operating workflow or EOS administration work is planned in this release.

## Required next work

1. Keep the compliance specification, implementation notes and roadmap synchronized with the actual branch state.
2. Archive issuer-authentic primary sources and obtain documented legal review/sign-off for the active RuleSets and each applicable pay-item classification. Do not invent legal outcomes in code.
3. Complete the central pay-item catalog and versioned RuleSet mappings only after the applicable legal interpretations are approved.
4. Complete employee evidence for dependent eligibility, insurance history, seniority and job-group applicability where relevant to the actual launch population.
5. Approve and use an external attendance/leave reconciliation process for monthly totals. Keep daily timekeeping and roster management outside this product; do not infer payable days or statutory compliance from monthly aggregates alone.
6. Keep the debt ledger standalone and optional for this release. Enter only manually authorized deduction amounts in monthly payroll inputs; automatic debt-ledger posting, repayment reversals and write-off flows are post-launch scope.
7. Execute a real closed-period correction exercise and confirm the manager review → approval → paid → closed trail with immutable snapshots.
8. Implement YTD/multi-source tax only if the signed legal review determines it is required for the employer and launch population.
9. Test backup/restore on a clean browser profile/device, including a legacy encrypted vault and supported database upgrades; define and test the external backup-retention procedure. Native Windows installer packaging is not part of the current scope.

## Operational warning

Until the legal review is complete and the remaining integration work is closed, this branch is a development baseline. It must not be represented as a fully compliant or production-approved payroll system.


## Current Excel and multi-employee status

The Excel workbook is now an output adapter only. The single-employee calculation result is generated once by `calculatePayroll`; a batch run delegates every employee to that same function and then serializes the returned PayrollRunResult. Both single-employee and multi-employee XLSX exports contain values only and do not contain independent payroll formulas.

The Payroll Run workspace is a single-finance-user workflow for calculating multiple employees in one payroll period. New installations save employee profiles and payroll snapshots directly to local IndexedDB; an older installation that already has an encrypted vault continues to require its existing passphrase. Versioned JSON backup/restore covers the local database, with a safety copy downloaded before destructive restore; clean-profile and legacy-vault restore tests remain open. No account, company/workspace roles, server or multi-user synchronization is part of the target scope.


## Wage adjustment scope

The initial other-level wage helper implements the annual percentage-plus-fixed daily adjustment from the prior-year daily base wage and applies the statutory minimum wage floor. Job-classification tables are not yet applied automatically. The 1405 group-based seniority schedule is recorded as research source SRC-014 in the compliance specification, but employee job-group assignment and the relevant group-specific seniority progression still require implementation and legal confirmation.


## Employee master data and effective-dated history

Files:
- `src/types/employee.ts`
- `src/utils/employeeMaster.ts`
- `src/components/EmployeeDirectoryView.tsx`
- `src/data/payrollLocalDatabase.ts`

The employee directory stores a stable employee ID, personnel code, name, optional national/insurance identifiers, Jalali hire/termination dates, active status, contract history and effective-dated daily base/seniority wage history. Dates are stored in sortable `YYYY-MM-DD` Jalali form. The directory supports create, edit and delete operations, with validation for required data, duplicate IDs, invalid dates and overlapping contracts.

The Payroll Run screen now selects employees from the directory. For the selected payroll period it resolves the contract and latest wage entry effective at the start of the period, then derives completed service years and additional service days from the hire date. It does not silently apply a single wage rate when a wage change occurs during the month: mid-period hire/termination, contract changes and wage changes are currently blocked pending a future proration/multi-segment calculation feature.

The new IndexedDB object store is introduced through schema version 3. When an older encrypted vault is present, employee master records are stored as encrypted records and require that vault to be unlocked. On new installations they use the local employee-master store.

## Local persistence implementation

File: `src/data/payrollLocalDatabase.ts`

- Uses the local IndexedDB database named `iran-payroll-local`.
- On a new installation, employee records are stored in the `employees` object store and payroll snapshots in `payrollRuns`.
- The existing encrypted record store and vault metadata are retained only to preserve access to installations that already configured the earlier passphrase vault.
- Reads, saves, deletes and payroll-run history automatically use the plain local stores when no vault metadata exists; when an older encrypted vault is present, the existing unlock flow is required.
- No network service, user account, organization workspace or multi-user authorization is introduced by this storage layer.

**Data protection boundary:** the new default local storage is not application-level encrypted. Its protection depends on the operating-system user account, device controls and the browser profile. Versioned JSON backup/restore is implemented and creates a safety export before destructive restore, but users must still keep a separate copy on another physical storage location. Clean-profile and legacy-vault restore tests remain required before Go-Live. Native Windows installer packaging is outside the current scope. Existing encrypted-vault data remains encrypted and requires its original passphrase.
