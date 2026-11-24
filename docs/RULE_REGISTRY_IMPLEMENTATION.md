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
- Employee profiles and payroll snapshots are persisted in the versioned browser IndexedDB database.
- A local vault is initialized with a user-defined passphrase; AES-GCM-256 encrypts every employee and payroll-run payload.
- The encryption key is derived with PBKDF2-HMAC-SHA-256 (600,000 iterations) and is held only in module memory while the vault is unlocked.
- Opaque HMAC identifiers and a keyed personnel-code token preserve record lookup and unique-code enforcement without storing personnel codes as IndexedDB keys or indexes.
- The first vault setup migrates legacy plaintext records in a single IndexedDB transaction; encrypted records and vault metadata are committed together before legacy stores are cleared.
- PayrollRun snapshots remain reloadable after the vault is unlocked, and the period result can be exported without recalculation.
- A lock action clears the in-memory key reference and hides employee/run state from the Payroll Run screen.
- The vault is still browser-local: it does not provide user identity, company/workspace authorization, organization backup/recovery, multi-device sync or audited access control.

### 6. Regression tests and CI

- `src/utils/payrollEngine.test.ts` tests RuleSet consistency, tax brackets, gross pay, insurance ceiling, taxable income, item classification and compliance metadata.
- `src/utils/excelWorkbookBuilder.test.ts` verifies exported values equal the central result, the workbook contains no formula cells and mismatched RuleSet versions are rejected.
- `src/utils/payrollRunEngine.test.ts` tests multi-employee totals, duplicate codes, invalid inputs, fiscal-period mismatches and inactive employee exclusion.
- Wage adjustment cases for 1404 and 1405 are covered by `src/utils/payrollEngine.test.ts`.
- `npm test` / `bun run test` runs the test suite.
- GitHub Actions validates tests, TypeScript and production build on pushes to this branch and pull requests to main.

## Important limitations not closed by this change

1. **Legal approval is pending.** The registry has source references, but the 1404/1405 legal source pack and all rule interpretations still require review and sign-off.
2. **Some classifications represent the current engine behavior.** In particular welfare-benefit tax treatment, marriage allowance, child allowance evidence, overtime and night/holiday overlap remain review items.
3. **Dependent eligibility is not implemented.** The existing input still accepts a child count and a 720-day insurance boolean; it does not yet hold per-child eligibility evidence or actual insurance history.
4. **Seniority eligibility is still input-driven.** The engine has not yet been connected to employment start dates or last seniority-increase dates.
5. **Local vault encryption is not complete production data governance.** Employee entries and payroll snapshots are encrypted at rest in IndexedDB, but remain local to one browser profile/device. There is no account authentication, company/workspace authorization, backup/restore, multi-device synchronization or audited access control. Loss of the passphrase or local browser data can make records unrecoverable.
6. **Employment history and statutory ledgers remain incomplete.** Contracts, wage history, actual insurance history, per-dependent eligibility, attendance, leave ledger, loans, deductions and payment workflow remain future work.
7. **No retroactive/YTD tax engine has been introduced.** Current monthly progressive tax remains the existing behavior.

## Required next work

1. Complete the legal source pack and sign off the RuleSets.
2. Expand the catalog and make every formula consume catalog/rule data rather than hardcoded constants.
3. Add legal date-effective rules for seniority, work-time patterns, Friday/holiday work, mission, leave, annual bonus and severance.
4. Convert the Excel builder and formula library into render/export adapters over the calculation output; no independent payroll formulas should remain.
5. Add independently tested backup/restore, company/workspace authorization and a protected persistence design appropriate to the Windows deployment; the current browser vault is only a local encryption layer.
6. Add employee contracts, wage history, group classification and dependent eligibility records.
7. Add attendance, shift, mission, leave, loan and deduction ledgers.
8. Add YTD/multi-source tax, audit, approval/payment and correction workflows.
9. Add data migration, backup/restore and access-control tests.

## Operational warning

Until the legal review is complete and the remaining integration work is closed, this branch is a development baseline. It must not be represented as a fully compliant or production-approved payroll system.


## Current Excel and multi-employee status

The Excel workbook is now an output adapter only. The single-employee calculation result is generated once by `calculatePayroll`; a batch run delegates every employee to that same function and then serializes the returned PayrollRunResult. Both single-employee and multi-employee XLSX exports contain values only and do not contain independent payroll formulas.

The Payroll Run workspace is intentionally labelled as review-only. Employee profiles and payroll-run snapshots are encrypted in browser IndexedDB behind a local passphrase vault. This does not provide account authentication, company/workspace access control, backup/recovery or payment authorization.


## Wage adjustment scope

The initial other-level wage helper implements the annual percentage-plus-fixed daily adjustment from the prior-year daily base wage and applies the statutory minimum wage floor. Job-classification tables are not yet applied automatically. The 1405 group-based seniority schedule is recorded as research source SRC-014 in the compliance specification, but employee job-group assignment and the relevant group-specific seniority progression still require implementation and legal confirmation.


## Local persistence implementation

File: `src/data/payrollLocalDatabase.ts`

- Creates schema version 2 of the `iran-payroll-local` IndexedDB database and retains the version-1 stores only for one-time migration.
- Stores active employee and payroll-run records in an `encryptedRecords` object store; the clear-text legacy stores are cleared only in the same transaction that commits the encrypted records and vault metadata.
- Encrypts payloads with AES-GCM-256 using a fresh 96-bit IV per record and binds ciphertext to its opaque record ID as authenticated additional data.
- Derives separate encryption and lookup keys from the passphrase with PBKDF2-HMAC-SHA-256, a unique 128-bit random salt and 600,000 iterations.
- Keeps non-exportable Web Crypto keys in memory only; they are not written to IndexedDB.
- Uses keyed HMAC tokens for opaque employee/run record IDs and a unique personnel-code index without exposing employee identifiers or codes in database keys/indexes.
- Provides passphrase setup, unlock, explicit lock, list/save/delete, payroll-run history and legacy-record migration.
- Wrong passphrases fail closed; the application does not persist the passphrase or offer a recovery/reset mechanism.

**Security boundary:** encryption at rest reduces exposure from direct inspection of IndexedDB, but it does not protect data while the app is unlocked or against a compromised browser/device or malicious script executing in the app origin. There is still no account authentication, company/workspace authorization, backup/restore, multi-device sync or audit trail. Clearing browser storage, device failure or loss of the passphrase can make records unrecoverable. Logical clearing of legacy stores is not a guarantee of forensic erasure from storage media. The vault is not yet an approved enterprise payroll repository.
