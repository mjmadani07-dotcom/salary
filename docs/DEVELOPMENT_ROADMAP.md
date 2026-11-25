# Payroll Application — Development Roadmap

## 1. Product boundary

The application is designed for one finance manager operating on one local Windows device to maintain employee records and calculate payroll for multiple employees in one payroll period.

The application is not a multi-user or cloud payroll platform. The following are outside the current product scope:

- Multiple companies or workspaces.
- Multiple application users, user roles or organization-wide authorization.
- Server-side application hosting and cloud synchronization.
- Full operational implementation of EOS (Accountability Chart, Scorecard, Rocks and organization-wide EOS workflow).

The existing EOS calculation/simulator screens and calculations are retained as-is. Deferring EOS development does not mean deleting existing EOS functionality.

## 2. Architecture decisions

1. The TypeScript payroll engine is the single calculation core.
2. Annual rates and statutory parameters belong to versioned RuleSets with effective dates and source references.
3. The central Pay Item Catalog owns pay-item inclusion/classification metadata.
4. Excel is the minimum coverage baseline for inputs and outputs, not the authority for payroll formulas or legal interpretation. The software must preserve every Excel input, while calculation rules may improve on incomplete spreadsheet formulas based on verified law, contracts and explicit controls. Excel must not become a parallel calculation engine.
5. Internal monetary amounts are Rial. Toman is a display/input-output unit only.
6. New installations use local IndexedDB and do not require a vault passphrase or app-level encryption setup.
7. Existing encrypted-vault records remain readable through the original vault/passphrase path; they must not be silently deleted or converted.
8. Backup/restore is mandatory before operational reliance on the local database.
9. Missing legal or employment evidence must create a validation issue or review warning, not a silent default.

## 3. Implemented on the current development branch

- Versioned payroll Rule Registry for 1404 and 1405, with legal-review status.
- Central pay-item catalog and calculation engine for single and batch payroll.
- Base input validation and other-level wage adjustment helper.
- Formula-free XLSX exports produced from central calculation snapshots.
- Employee master directory with Jalali hire/termination dates, status, contract history and effective-dated daily wage history.
- PayrollRun selection from employee master and resolution of effective contract/wage at period start.
- Blockers for mid-period hire/termination, wage changes and contract changes until segmented proration is implemented.
- Local IndexedDB storage for employees and payroll-run snapshots.
- Monthly attendance and leave ledgers are loaded into the matching unsnapshotted PayrollRun workspace. Paid leave is read from the leave ledger; unpaid leave requires an exact acknowledgement that clears when work/payable-day inputs change. Sick leave, unpaid absence and mission days are stored separately, but their payable-day and legal effects remain intentionally disabled until an approved rule is supplied. This is a monthly aggregate model, not daily timekeeping.
- Compatibility with records stored in the legacy encrypted vault.
- CI tests, TypeScript validation and production build.

## 4. Remaining work, in execution order

### Phase 1 — Documentation and implementation baseline
- [x] Align the compliance specification with implemented attendance and leave ledgers.
- [x] Align implementation notes with actual remaining work.
- [x] Explicitly defer full operational EOS development while retaining current EOS functionality.
- [x] Add a single development roadmap and synchronize the compliance/implementation notes and Pull Request summary with the actual branch state.
- [x] Add a 1405 legal source review register; formal legal approval and issuer-signed primary copies remain outstanding.
- [x] Audit the 8-sheet Excel reference workbook and record all employee, monthly, regulatory, settlement and report-selector inputs in [EXCEL_INPUT_COVERAGE_MATRIX.md](./EXCEL_INPUT_COVERAGE_MATRIX.md).
- [x] Add the missing employee-master inputs from the Excel coverage matrix (bank account/IBAN, family facts, cost center, wage type, seniority eligibility, insurance/tax flags and personnel notes) using backward-compatible optional fields.
- [x] Seed stable marital/eligible-child facts and apply explicitly selected minimum/custom wage type and seniority eligibility when creating a new payroll period.
- [x] Apply employee-level insurance/tax flags to the calculation input: explicit "not subject" suppresses the corresponding basis; "subject" uses the central pay-item catalog. Legal applicability and exceptions remain subject to review.
- [x] Add the remaining monthly Excel inputs to the row-details UI, attendance record, PayrollInput, calculation snapshot and pay-item breakdown: paid leave reference, sick leave, unpaid absence, Friday hours, mission days, insured/non-insured benefits, loan instalment, advance, other deductions, signed correction, payslip ID, payment date and notes.
- [x] Inspect the actual monthly calculation formulas and record confirmed gaps: paid leave, sick leave and unpaid absence are not part of Excel's payable-day formula; its tax basis is gross minus employee insurance; and its overtime/night hourly basis excludes seniority pay. These are recorded as comparison points, not treated as approved legal rules.
- [x] Add full A:V monthly Excel Paste/Import with row, period, personnel-code, payslip-ID and paid-leave-ledger validation; convert source Toman amounts to internal Rial.
- [x] Block payroll lines where deductions create a negative net-pay result; retain the negative calculation for review but exclude it from payable payroll totals.
- [x] Add regression coverage for the 1405 monthly progressive tax thresholds/rates currently configured in the RuleSet.
- [x] Preserve job title, cost centre, bank account/IBAN, insurance number and leave balance in payroll-run output snapshots for historical reporting.
- [x] Complete grouped XLSX outputs from the same PayrollRunResult: detailed A:AN calculation register plus AO:BA supplementary fields, monthly KPIs and cost-centre grouping, printable per-employee payslips, bank transfer register, item/tax details and warnings.
- [x] Add an explicitly non-final settlement output sheet for engine-calculated Eid/severance and leave balance; missing months-worked, leave-encashment and other-claims inputs stay blank rather than being inferred.
- [ ] Complete formula-by-formula legal reconciliation for all 22 columns, including tax-base differences and overlap between holiday work, Friday work and overtime.
- [x] Add explicit settlement inputs for months and days worked, separate wage bases with source/confirmation, verified leave balance and encashment basis, prior advances/payments, other claims and authorized deductions.
- [x] Add settlement calculations: Eid pro-rata by actual worked days (not Excel's month shortcut), severance by actual service duration, and unused leave without applying the annual 9-day carryover cap at termination.
- [x] Add encrypted/local settlement persistence, draft/review/approved/paid transitions, append-only audit events, immutable approved/paid cases and dedicated Excel export.
- [ ] Complete settlement tax/mandatory deduction rules and obtain legal sign-off for each wage basis and special termination reason.

### Phase 2 — Legal rules and calculation integrity
- [x] Create a structured 1405 legal source review register and identify source/implementation gaps.
- [ ] Complete the primary-source legal pack with issuer-signed copies for wage, insurance, tax and statutory benefits.
- [ ] Obtain documented review/sign-off for RuleSets 1404 and 1405.
- [ ] Complete pay-item insurance/tax/wage classifications and special-case handling, including aggregation of all taxable payments and legally exempt items.
- [x] Add monthly shift-pattern capture, persistence and rate differentiation: non-shift night premium (35%) versus Article 56 rotating-shift allowances (10%, 15%, 22.5%); wage-component basis remains pending legal review.
- [ ] Add statutory overtime controls (consent, daily limit and prohibited categories) using daily-level attendance evidence; monthly aggregate overtime now produces a clear legal-review warning and is not treated as proof of compliance.
- [x] Use the same hourly wage basis (base wage + seniority) for Friday premium as overtime; add explicit warnings when monthly overtime/Friday/holiday categories may overlap.
- [ ] Reconcile Friday premium with weekly-rest scheduling, daily time records and official-holiday overlap; current monthly aggregates cannot prove non-overlap.
- [ ] Complete mission allowance using the applicable fixed/base wage floor and separate transport/travel costs, including qualifying distance/overnight conditions.
- [ ] Add the missing seniority, dependent eligibility, job group and actual insurance-history data. The 1405 twenty-group seniority schedule is now listed as SRC-014; the current employee model still lacks approved-plan/group and last-seniority-date evidence.
- [ ] Complete daily shift/roster evidence, overtime limits, Friday/weekly-rest and public-holiday overlap controls, and mission rules.
- [ ] Add the legal acceptance scenarios in PAYROLL_RULES_AND_COMPLIANCE.md to automated tests.
- [ ] Add effective-dated multi-segment proration for mid-period hire, termination, wage and contract changes.

**Gate:** no unresolved P0 legal item may be silently treated as an approved production rule.

### Phase 3 — Attendance/leave to payroll integration
- [ ] Define the legal/contractual meanings of actual attendance days, payable days, paid leave, sick leave, unpaid leave, absence and mission days before automatically converting one category into another.
- [x] Load selected-period attendance and leave records into unsnapshotted PayrollRun workspaces, without overlaying historical saved snapshots.
- [x] Synchronize monthly payroll inputs with the attendance record through the bridge, preserving each added Excel input as a separate field.
- [x] Require exact unpaid-leave acknowledgement and invalidate it when payable/worked days change; do not apply an automatic deduction.
- [x] Read paid-leave usage from the Leave Ledger into the monthly payroll field and retain it in the snapshot; the Excel importer updates the existing monthly leave record only after balance validation, and blocks a positive imported value when no matching leave-ledger record exists.
- [x] Add distinct monthly sick-leave, unpaid-absence and mission-day inputs; their effect on payable days remains disabled pending an approved rule.
- [ ] Add a reconciliation control for paid leave, sick leave, unpaid absence and payable days; prevent double counting between ledgers and monthly inputs.
- [ ] Prevent duplicate deductions between manually entered payroll amounts and employee debt/other-deduction ledgers during recalculation and approval.
- [ ] Keep daily event capture and shift rosters as separate extensions after the monthly aggregate model is accepted.

### Phase 4 — Employee debt and deductions ledger

Implemented initial tracking scope; see [EMPLOYEE_DEBT_LEDGER_IMPLEMENTATION.md](./EMPLOYEE_DEBT_LEDGER_IMPLEMENTATION.md).

- [x] Record advances and loans as independent employee accounts.
- [x] Record principal, purpose, issue date and fixed-installment/manual repayment plan.
- [x] Record each repayment as a separate transaction and maintain outstanding balance.
- [x] Calculate current/overdue installments and show proposed due amounts by period.
- [x] Keep other agreed deductions separate, with supporting reference and proposed/reviewed/cancelled status.
- [x] Preserve legacy encrypted-vault compatibility while keeping new installations password-free.
- [x] Do not auto-post installments or other deductions to payroll.
- [ ] Obtain/record evidence and review of whether a proposed deduction is lawfully/contractually recoverable from wages.
- [ ] Require documented legal/contractual basis and review for manual deductions; enforce applicable statutory restrictions before approval.
- [ ] Connect eligible reviewed deductions to the payroll approval/payment workflow, with explicit manager confirmation.
- [ ] Prevent duplicate posting when a payroll run is recalculated, corrected or exported.
- [ ] Add debt correction/reversal, account closure, write-off and termination settlement workflows.

### Phase 5 — Payroll approval and payment workflow

- [x] Persist immutable calculation-result snapshots with RuleSet version and employee/input trace.
- [x] Retain snapshots once they reach finance review; only validation-failed runs may be discarded.
- [x] Implement the saved-run workflow: Ready for Review → Approved → Paid → Closed; validation-failed runs cannot be approved.
- [x] Require approver identity/reference and payment date/reference/actual amount; require a reason for payment differences.
- [x] Append approval, payment and close events to the workflow audit trail.
- [x] Prevent mutation/deletion of approved, paid and closed snapshots through the workflow controls.
- [x] Show blockers and legal-review warnings in payroll results and exports.
- [x] Generate employee payslips, payroll register, cost-centre summary and bank-preparation register from the same PayrollRunResult.
- [x] Add an explicit correction-run operation/UI for approved/paid/closed periods; validate the original period/status, require a reason, link the new immutable snapshot to the original and preserve the trace on reload.
- [ ] Add bank-specific transfer files only after the bank's technical format is obtained and tested.
- [ ] Reconcile the bank's actual paid transactions to the approved employee-level payment register.
- [ ] Integrate reviewed debt/other-deduction records only after lawful recoverability is approved; require explicit manager confirmation and deterministic duplicate-prevention across recalculation, correction and export.
- [x] No separate persisted Draft state is required for the one-manager/local-device scope: the unsaved PayrollRun workspace is Draft; a durable, immutable version is created when calculation is saved.

### Phase 6 — Local backup, restore and data portability

- [x] Define a versioned JSON backup format (format v1) covering all current IndexedDB stores: employee master, contracts/wage history, attendance, leave, debts/repayments, other deductions, payroll snapshots, settlements and vault records.
- [x] Validate format/version, required stores, record-array shape, unknown stores and encryption-state consistency before restore.
- [x] Export a complete local database backup.
- [x] Restore all included stores in one IndexedDB read/write transaction with full-replacement semantics.
- [x] Create and download a separate safety backup of the current database automatically before an accepted restore; do not begin restore if the safety export fails.
- [ ] Verify restore on a fresh browser profile/device, including record counts and the ability to open and use restored payroll periods.
- [ ] Test upgrades from supported historical database schemas (including legacy encrypted-vault data) and verify no record loss.
- [ ] Confirm whether any app settings are persisted outside IndexedDB and include them in the backup or document why they are intentionally excluded.
- [ ] Define a simple offline procedure for storing, retaining and periodically testing backup files on a second physical storage location.

### Phase 7 — Finalization & Go-Live (hard-stop milestone)

This is the terminal milestone for the current product scope. Once every gate below is accepted, development of this version stops; new ideas move to a separate post-launch backlog. Do not add convenience features or broaden the architecture while a release gate remains open.

**Gate A — legal and payroll-rule approval**
- [ ] Obtain signed/issuer-verifiable primary copies for the applicable 1405 wage, insurance, tax and statutory-benefit rules, plus amendments effective during the payroll period.
- [ ] Obtain documented reviewer decisions for all P0 entries in [LEGAL_REVIEW_REGISTER.md](./LEGAL_REVIEW_REGISTER.md), including wage bases, insurance/tax classifications, dependent eligibility, seniority/job-classification applicability, payable-day semantics, and lawful deductions.
- [ ] Resolve or explicitly exclude special regimes that do not apply to the employer/workers; do not silently use general-case rates for them.
- [ ] Approve the daily/weekly evidence model for overtime, night work, shift work, Friday/weekly rest and official-holiday overlap. Monthly totals alone do not prove daily consent, limits or non-overlap.
- [ ] Approve mission eligibility, minimum allowance and separate travel-cost reimbursement.
- [ ] Approve settlement tax/insurance treatment and wage bases for the applicable termination reasons.

**Gate B — complete and controlled data**
- [ ] Reconcile all 19 employee fields, 22 monthly input columns, 20 Excel parameters, 5 settlement inputs and report selectors against the current implementation; record any intentional exclusion and its replacement control.
- [ ] Complete the employee evidence needed for seniority, insured history and eligible dependents, and classify job-classification/fixed-wage applicability where relevant.
- [ ] Define one approved reconciliation for worked days, payable days, paid leave, sick leave, unpaid absence and mission days; block duplicate or contradictory input.
- [ ] Define the source of truth for each deduction and prevent the same loan, advance or other deduction from being entered both manually and from a ledger.
- [ ] Implement/validate multi-segment proration for mid-period hire, termination, wage or contract changes, or document that no affected case exists in the launch population and block such cases.

**Gate C — release-quality calculations and workflow**
- [ ] Convert each approved legal interpretation into versioned RuleSet/pay-item metadata and regression tests; no pending legal classification may silently enter a final payable result.
- [ ] Automate the applicable acceptance scenarios in this document and the coverage matrix, including 29/30/31-day periods and boundary values.
- [ ] Exercise approval → payment → close and a correction of a real closed period with finance-owner acceptance; confirm immutable historical snapshots and the audit trail.
- [ ] Reconcile web UI, payslips, detailed XLSX, monthly summary and bank-preparation output to the same immutable PayrollRunResult.
- [ ] Confirm all blockers, legal-review warnings, negative-net-pay exclusions and payment differences are visible to the finance manager before approval.

**Gate D — recoverability and operational acceptance**
- [ ] Pass restore tests on a clean browser profile/device, with and without a legacy Vault, and document the tested schema-upgrade path.
- [ ] Verify that the safety backup is produced before destructive restore and that a failed backup prevents restore.
- [ ] Complete at least one real payroll-period parallel run against the approved Excel process; reconcile every employee and every pay-item difference, not just grand totals.
- [ ] Obtain written finance-owner acceptance and legal/payroll reviewer sign-off for the launch population and effective period.
- [ ] Archive the signed rule pack, reconciliation evidence, approved test results and a known-good backup before declaring Go-Live.

**Exit rule:** no unresolved P0 item, no unexplained reconciliation difference, no untested restore path and no missing owner approval. If an external legal or operational decision is unavailable, the affected scenario remains blocked and Go-Live is not declared. The application may be called technically test-passing, but not a legally approved production payroll system.

## 5. Release boundary

The current branch is a development baseline, not a legally approved production payroll system. Green CI proves only the automated scenarios present in the repository. Final operational use requires the Phase 7 gates above, including human legal/finance approval, real-period reconciliation and a demonstrated recovery procedure. The application remains a single-finance-manager, single-local-device product; multi-company, multi-user, cloud sync and full operational EOS are outside this release.

## 6. Current status

- Work branch: `feat/lightweight-payroll-workbench`.
- Latest verified branch commit at this closeout: `6e554729f778a0c13cb176bbe190c3f76a2e14f8`.
- Latest CI run: [`45669674606`](https://github.com/mjmadani07-dotcom/salary/actions/runs/45669674606), completed successfully after the correction-run UI and traceability tests: 115 tests passed, TypeScript passed and Vite production build passed.
- Monthly shift-pattern capture, period-scoped persistence, Article 56 rate differentiation and suppression of the Article 58 35% non-shift premium for rotating patterns are implemented. The shift allowance wage base and item classification remain legal-review items.
- Monthly attendance and leave ledgers, paid-leave integration, unpaid-leave acknowledgement, employee debt tracking, employee master/contract history, batch payroll calculation and XLSX reports are implemented to the documented boundaries.
- The saved-run approval/payment/close workflow and versioned database backup/restore code are implemented. A pre-restore safety backup is now downloaded automatically before destructive restore. Fresh-profile, schema-migration and legacy-vault restore verification remain operational tests.
- **Still blocks Go-Live:** daily attendance/overtime/weekly-rest evidence; approved payable-day and leave treatment; mission conditions/costs; lawful and non-duplicated deductions; complete wage/insurance/tax/pay-item classification and YTD applicability; job-classification/seniority/dependent evidence; mid-period proration; exercising correction-run workflow against an actual closed-period case; bank-specific transfer/reconciliation; signed primary legal sources; restore testing; and real-period parallel reconciliation.
- No PR has been merged. The open PR #1 targets a different branch; this branch remains unmerged.

## 7. Change-control rule after the freeze

From this point, work is limited to: (1) defects or P0 gaps that block the Phase 7 gates, (2) updating tests and documentation required to prove a gate, and (3) narrowly scoped data-safety fixes. New dashboards, convenience screens, architecture expansion, EOS development or speculative enhancements are post-launch backlog items and must not be added to this release.
## 5. Release boundary

The current branch is a development baseline, not a legally approved production payroll system. Successful tests prove only the currently automated scenarios. Operational use requires legal sign-off, complete P0 validation, verified data backups and a tested restore procedure.

## 6. Current status

Current work branch: `feat/lightweight-payroll-workbench`.

The 8-sheet Excel input audit and formula-gap review are documented in [EXCEL_INPUT_COVERAGE_MATRIX.md](./EXCEL_INPUT_COVERAGE_MATRIX.md). Excel is the complete input/output coverage baseline, not the final calculation authority. Employee master stores the added fields compatibly, and a full A:V Paste/Import validates period, employee, payslip and leave balance while converting source Toman amounts to internal Rial. Payroll output is generated from one PayrollRunResult: detailed A:AN calculations plus AO:BA supplementary fields, monthly KPIs/cost-centre summary, printable per-employee payslips, bank preparation register, pay-item/tax details and warnings. Employee title, cost centre, bank details, insurance number and leave balance are retained in historical snapshots. A separate settlement case module captures all five Excel source inputs plus evidence-backed wage bases, actual worked days and months, leave encashment, prior payments, other claims and authorized deductions. Eid is prorated by worked days; severance uses actual total service duration; termination leave is not capped at the annual 9-day carryover rule. Cases are stored locally (encrypted when the vault is configured), follow Draft → Ready for Review → Approved → Paid, retain append-only event history and cannot be changed after approval except to record payment. Settlement XLSX output includes case details and audit history. **Not production-final:** settlement tax/statutory withholdings, formal approval of wage bases and legal special cases remain open; monthly payroll-run approval/closed-period immutability, bank-specific transfer files and actual bank reconciliation also remain open. Friday premium now uses the same hourly basis as overtime (base wage plus seniority), with explicit warnings when monthly overtime/Friday/holiday categories may overlap; this improves on the Excel formula but remains subject to legal review. Reviewed/approved/paid/closed payroll snapshots cannot be deleted; failed calculations may be discarded. Shift-pattern rate differentiation is now implemented, but its wage-component basis remains pending legal review. Other material gaps remain for daily overtime evidence/consent/limits, weekly rest/Friday, mission travel, lawful deductions and tax item classification. The source workbook omits leave/absence effects from its payable-day formula; software does not inherit that omission by guessing. Negative-net-pay lines are blocked from payable totals. The pull request remains open and unmerged.
