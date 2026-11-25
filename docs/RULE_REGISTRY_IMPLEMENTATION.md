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
- The local database belongs to the current browser profile. The application does not yet include built-in backup/restore or native Windows packaging.
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

1. **Legal approval is pending.** The 1404/1405 registry contains source references, but both RuleSets and unresolved legal classifications still require documented review and sign-off.
2. **Catalog coverage is incomplete.** Welfare-benefit tax treatment, marriage allowance, child allowance evidence, overtime and night/holiday overlap, mission expenses and special insurance cases remain review items.
3. **Dependent eligibility is not implemented.** The current payroll input accepts a child count and a 720-day insurance boolean; it does not retain per-child eligibility evidence or actual insurance history.
4. **Seniority eligibility remains incomplete.** Employee start dates and effective wage history are available, but the engine still needs legally reviewed seniority eligibility and group-specific progression rules.
5. **Attendance and leave ledgers are implemented at monthly-total/balance level.** Attendance totals feed matching PayrollRun inputs. Leave balances are stored with carry-forward recalculation. The finance manager must reconcile the monthly work/payroll-day input with the exact unpaid-leave quantity; PayrollRun blocks an employee when that review is missing or stale. No automatic deduction is applied. Daily events, shifts, mission and the legally/contractually controlled conversion between attendance, paid leave, unpaid leave and payable days are not complete.
6. **Loans and deductions are not implemented.** Advance, loan, installment, repayment and other documented deduction records must be introduced as a separate employee ledger.
7. **Approval and payment workflow is not implemented.** PayrollRun calculations and snapshots exist, but approval, payment, close and correction states do not.
8. **No retroactive/YTD tax engine has been introduced.** Current monthly progressive tax remains the existing behavior.
9. **Backup/restore and native Windows packaging are not implemented.** New-install data is local to the current browser profile. Existing encrypted-vault records remain supported and require their original passphrase; new installations do not require a vault passphrase.
10. **The full operational EOS system is deferred.** Existing EOS calculation/simulator features remain in the product, but no Accountability Chart, Scorecard/Rocks operating workflow or EOS administration work is planned in the current scope.

## Required next work

1. Keep the compliance specification, implementation notes and pull-request description synchronized with the actual branch state.
2. Complete the legal source pack and obtain documented legal review/sign-off for each active annual RuleSet and unresolved pay-item classification. Do not invent legal outcomes in code.
3. Expand the central catalog and make every formula consume versioned rule/catalog data rather than hardcoded constants.
4. Complete statutory/contractual eligibility data: employee insurance history, per-dependent evidence, seniority/group classification and employment/wage changes within a period.
5. Define and test the full semantics of attendance days and payable days. The unpaid-leave review gate is implemented; further daily/shift data and any automatic day/money conversion require a documented legal/contractual policy and double-deduction tests.
6. Add the separate employee advance/loan/installment/repayment and other documented-deduction ledger.
7. Add the single-operator payroll workflow: validation, review, approval, paid, closed and correction snapshots, with audit trace.
8. Add YTD/multi-source tax and the remaining acceptance/regression scenarios after legal rules are approved.
9. Build and test local backup/restore before preparing native Windows packaging. Do not add multi-company/workspace authorization, multi-user access or cloud infrastructure unless the product scope changes.

## Operational warning

Until the legal review is complete and the remaining integration work is closed, this branch is a development baseline. It must not be represented as a fully compliant or production-approved payroll system.


## Current Excel and multi-employee status

The Excel workbook is now an output adapter only. The single-employee calculation result is generated once by `calculatePayroll`; a batch run delegates every employee to that same function and then serializes the returned PayrollRunResult. Both single-employee and multi-employee XLSX exports contain values only and do not contain independent payroll formulas.

The Payroll Run workspace is a single-finance-user workflow for calculating multiple employees in one payroll period. New installations save employee profiles and payroll snapshots directly to local IndexedDB; an older installation that already has an encrypted vault continues to require its existing passphrase. The current storage is tied to the browser profile on this device and built-in backup/restore is not yet available. No account, company/workspace roles, server or multi-user synchronization is part of the target scope.


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

**Data protection boundary:** the new default local storage is not application-level encrypted. Its protection depends on the operating-system user account, device controls and the browser profile. The current branch does not yet provide a built-in backup/restore workflow or native Windows package. The user should keep a separate backup and prevent unauthorized access to the Windows account. Existing encrypted-vault data remains encrypted and requires its original passphrase.
