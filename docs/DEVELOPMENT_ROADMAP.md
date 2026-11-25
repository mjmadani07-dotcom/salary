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
- [x] Complete the technical formula-by-formula comparison for the 22 monthly columns and record differences in [EXCEL_INPUT_COVERAGE_MATRIX.md](./EXCEL_INPUT_COVERAGE_MATRIX.md).
- [ ] Obtain finance/legal decisions for the unresolved tax-base differences and overlap between holiday work, Friday work and overtime; this is an external approval gate, not a reason to copy Excel formulas blindly.
- [x] Add explicit settlement inputs for months and days worked, separate wage bases with source/confirmation, verified leave balance and encashment basis, prior advances/payments, other claims and authorized deductions.
- [x] Add settlement calculations: Eid pro-rata by actual worked days (not Excel's month shortcut), severance by actual service duration, and unused leave without applying the annual 9-day carryover cap at termination.
- [x] Add encrypted/local settlement persistence, draft/review/approved/paid transitions, append-only audit events, immutable approved/paid cases and dedicated Excel export.
- [ ] Complete settlement tax/mandatory deduction rules and obtain legal sign-off for each wage basis and special termination reason.

### Phase 2 — Legal rules and calculation integrity
- [x] Create the 1405 legal source review register and identify source/implementation gaps.
- [ ] Complete the primary-source legal pack with issuer-authentic copies for wage, insurance, tax and statutory benefits.
- [ ] Obtain documented reviewer sign-off for RuleSets 1404 and 1405.
- [ ] Complete pay-item insurance/tax/wage classifications and special-case handling, including aggregation of taxable payments and legally exempt items.
- [x] Implement monthly shift-pattern capture and Article 56 rate differentiation (10%, 15%, 22.5%) separately from the 35% non-shift night premium; the wage-component basis remains pending legal review.
- [x] Move the remaining Excel hourly divisor, overtime multiplier and non-shift night premium into the 1404/1405 versioned RuleSets; validate the annual leave carryover cap and months-per-year parameters. The 9-day carryover cap is stored but not enforced until legal interpretation is approved.
- [x] Keep overtime, Friday and holiday inputs as monthly aggregates; calculate configured premiums and expose legal/overlap warnings. Daily clock-in/out, scheduling and roster management are explicitly outside this lightweight product.
- [x] Keep detailed daily/weekly attendance evidence external to the app. The finance manager must verify consent, daily/weekly limits, prohibited-work restrictions, rest days and overlap from the employer's approved timekeeping records before approving any affected payroll.
- [x] Use the same hourly wage basis (base wage + seniority) for Friday premium as overtime and emit explicit warnings when monthly overtime/Friday/holiday categories may overlap; detailed legal basis still requires sign-off.
- [ ] Complete mission allowance rules: qualifying distance/overnight conditions, minimum allowance, transport/travel reimbursement and insurance/tax treatment.
- [ ] Complete seniority, dependent eligibility, job-group and actual insurance-history evidence where applicable to the launch population.
- [x] Keep mid-period hire/termination, wage changes and contract changes blocked; multi-segment proration is not part of this release. Such cases must not be included in the launch population unless supported by a separately approved process.
- [ ] Add automated acceptance scenarios after the legal interpretation is approved; do not encode unresolved interpretations as final rules.

**Gate:** no unresolved P0 legal item may be silently treated as an approved production rule. The application may calculate a monthly aggregate, but it does not certify the external attendance evidence.

### Phase 3 — Attendance/leave to payroll integration
- [x] Keep workdays, paid leave, sick leave, unpaid absence and mission days as separate, independently stored monthly inputs; do not automatically convert one category into another without an approved legal/contractual rule.
- [x] Load selected-period attendance and leave records into unsnapshotted PayrollRun workspaces without overlaying historical saved snapshots.
- [x] Synchronize monthly payroll inputs with the attendance record through the bridge, preserving each Excel input as a separate field.
- [x] Require exact unpaid-leave acknowledgement and invalidate it when payable/worked-day inputs change; do not apply an automatic deduction.
- [x] Read paid-leave usage from the Leave Ledger into the monthly payroll field and retain it in the snapshot; Excel import updates the existing monthly leave record only after balance validation.
- [x] Keep sick-leave, unpaid-absence and mission-day effects on payable days disabled until an approved rule is entered in the RuleSet; the finance manager must reconcile monthly totals against the external approved records before approval.
- [x] Keep daily event capture and shift rosters out of this product. The product accepts manager-reconciled monthly totals; any case lacking external supporting evidence remains unsuitable for approval.
- [x] Keep the debt ledger separate from payroll. The ledger does not auto-post; monthly payroll deduction fields remain explicit inputs and the finance manager must enter only the single authorized amount from the documented source.

### Phase 4 — Optional employee debt and deductions tracking
The standalone ledger is an optional supporting recordkeeping module, not a payroll subledger or a prerequisite for Go-Live. Its scope is intentionally limited; see [EMPLOYEE_DEBT_LEDGER_IMPLEMENTATION.md](./EMPLOYEE_DEBT_LEDGER_IMPLEMENTATION.md).

- [x] Record advances/loans, principal, purpose, issue date and fixed/manual repayment plans.
- [x] Record repayments as separate transactions and maintain outstanding balances and due/overdue amounts.
- [x] Keep other agreed deductions separate with a supporting reference and proposed/reviewed/cancelled status.
- [x] Preserve legacy encrypted-vault compatibility; new installations use local IndexedDB without a new passphrase.
- [x] Do not auto-post debt-ledger transactions to payroll. This is a deliberate product boundary, not an unfinished integration.
- [x] Keep direct ledger-to-payroll posting, automatic installment deduction, duplicate-posting automation, debt write-off/reversal and termination settlement out of the current release; place them in the post-launch backlog.
- [ ] When a manual deduction is entered in payroll, verify its lawful/contractual basis and source document before approval; this is a legal/finance control, not an automated ledger integration.

### Phase 5 — Payroll review, payment recording and correction
- [x] Persist immutable calculation-result snapshots with RuleSet version and employee/input trace.
- [x] Retain snapshots once they reach finance review; only validation-failed runs may be discarded.
- [x] Implement the single-manager lifecycle: Ready for Review → Approved → Paid → Closed; validation-failed runs cannot be approved. This is a local recordkeeping workflow, not a multi-user approval chain or separation-of-duties system.
- [x] Record finance-manager approval reference, payment date/reference/actual amount, reason for a payment difference and close reference.
- [x] Append approval, payment and close events to the workflow audit trail; prevent mutation/deletion of approved, paid and closed snapshots.
- [x] Show blockers and legal-review warnings in payroll results and exports.
- [x] Generate employee payslips, payroll register, cost-centre summary and bank-preparation register from the same PayrollRunResult.
- [x] Add a correction-run operation for approved/paid/closed periods: preserve the source snapshot, require a reason, validate period/status, link a new immutable snapshot and retain traceability after reload.
- [x] Keep bank-specific transfer files, bank-statement import/reconciliation and payment execution integrations outside this release. The app prepares the bank register and records payment metadata entered by the manager.
- [x] No separate persisted Draft state is required for the one-manager/local-device scope: the unsaved PayrollRun workspace is Draft; a durable, immutable version is created when calculation is saved.

### Phase 6 — Local backup, restore and data portability

- [x] Define a versioned JSON backup format (format v1) covering all current IndexedDB stores: employee master, contracts/wage history, attendance, leave, debts/repayments, other deductions, payroll snapshots, settlements and vault records.
- [x] Validate format/version, required stores, record-array shape, unknown stores and encryption-state consistency before restore.
- [x] Export a complete local database backup.
- [x] Restore all included stores in one IndexedDB read/write transaction with full-replacement semantics.
- [x] Create and download a separate safety backup of the current database automatically before an accepted restore; do not begin restore if the safety export fails.
- [ ] Verify restore on a fresh browser profile/device, including record counts and the ability to open and use restored payroll periods.
- [ ] Test upgrades from supported historical database schemas (including legacy encrypted-vault data) and verify no record loss.
- [x] Audit application persistence outside IndexedDB: the only `localStorage` use in the app source is the EOS implementation checklist (`iran-payroll-eos-checklist-v1`). It is non-payroll progress state, intentionally excluded from the payroll backup; payroll records remain in the documented IndexedDB stores.
- [ ] Define a simple offline procedure for storing, retaining and periodically testing backup files on a second physical storage location.

### Phase 7 — Finalization & Go-Live (hard-stop milestone)

This is the terminal milestone for the current product scope. Once every gate below is accepted, development of this version stops; new ideas move to a separate post-launch backlog. Do not add convenience features or broaden the architecture while a release gate remains open.

**Gate A — legal and payroll-rule approval**
- [ ] Obtain signed/issuer-verifiable primary copies for the applicable 1405 wage, insurance, tax and statutory-benefit rules, plus amendments effective during the payroll period.
- [ ] Obtain documented reviewer decisions for all P0 entries in [LEGAL_REVIEW_REGISTER.md](./LEGAL_REVIEW_REGISTER.md), including wage bases, insurance/tax classifications, dependent eligibility, seniority/job-classification applicability, payable-day semantics, and lawful deductions.
- [ ] Resolve or explicitly exclude special regimes that do not apply to the employer/workers; do not silently use general-case rates for them.
- [ ] Approve the external attendance-record source and manager verification procedure for overtime, night work, shifts, Friday/weekly rest and official-holiday overlap. The app does not provide daily timekeeping; monthly totals alone do not prove daily consent, limits or non-overlap.
- [ ] Approve mission eligibility, minimum allowance and separate travel-cost reimbursement.
- [ ] Approve settlement tax/insurance treatment and wage bases for the applicable termination reasons.

**Gate B — complete and controlled data**
- [ ] Reconcile all 19 employee fields, 22 monthly input columns, 20 Excel parameters, 5 settlement inputs and report selectors against the current implementation; record any intentional exclusion and its replacement control.
- [ ] Complete the employee evidence needed for seniority, insured history and eligible dependents, and classify job-classification/fixed-wage applicability where relevant.
- [ ] Obtain an approved monthly reconciliation policy for worked/payable days, paid leave, sick leave, unpaid absence and mission days; until then, keep the categories separate and do not infer payable days automatically.
- [ ] For every deduction actually used in the launch population, identify one authoritative source and retain its legal/contractual authorization reference. The optional debt ledger is not auto-posted to payroll; the manager enters one final amount in the monthly payroll input.
- [ ] Confirm that the launch population contains no unsupported mid-period hire, termination, wage or contract change; retain validation blockers for such cases instead of implementing multi-segment proration in this release.

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
- Latest verified code-bearing closeout commit: `711f1ff3de2e8e07398445ed80203ae2d73fddf4`.
- CI run on the current branch tree: [`45683857664`](https://github.com/mjmadani07-dotcom/salary/actions/runs/45683857664), completed successfully: 118 tests passed, TypeScript check passed and Vite production build passed. The new acceptance test covers 29-, 30- and 31-day payroll periods. This verifies automated code checks only, not legal approval or operational acceptance.
- Monthly shift-pattern capture, period-scoped persistence, Article 56 rate differentiation and suppression of the Article 58 35% non-shift premium for rotating patterns are implemented. The shift allowance wage base and item classification remain legal-review items.
- The 20 Excel legal parameters are now traceable to the versioned RuleSet; hourly divisor, overtime multiplier, non-shift night premium and months-per-year are consumed by the calculation/validation code. The annual leave carryover cap is configured but not applied pending legal review. Rule changes are controlled through reviewed RuleSet releases, not direct operator editing.
- Monthly attendance and leave ledgers, paid-leave integration, unpaid-leave acknowledgement, employee debt tracking, employee master/contract history, batch payroll calculation and XLSX reports are implemented to the documented boundaries.
- The saved-run approval/payment/close workflow and versioned database backup/restore code are implemented. A pre-restore safety backup is now downloaded automatically before destructive restore. Fresh-profile, schema-migration and legacy-vault restore verification remain operational tests.
- **Still blocks Go-Live:** signed primary legal sources and reviewer approval; approved pay-item tax/insurance/wage classifications and any legally required YTD treatment; an approved payable-day/leave/mission policy; external attendance evidence and manager verification for any overtime/shift/Friday/holiday case; legal authorization for each deduction actually used; job-classification/seniority/dependent evidence where applicable; exclusion/blocking of unsupported mid-period changes; a real closed-period correction exercise; clean-profile/legacy-vault restore testing; and real-period parallel reconciliation.
- No PR has been merged. The open PR #1 targets a different branch; this branch remains unmerged.

## 7. Change-control rule after the freeze

From this point, work is limited to: (1) defects or P0 gaps that block the Phase 7 gates, (2) updating tests and documentation required to prove a gate, and (3) narrowly scoped data-safety fixes. New dashboards, convenience screens, architecture expansion, EOS development or speculative enhancements are post-launch backlog items and must not be added to this release.

## 8. Finalization execution plan — scope is frozen

The Phase 7 milestone above is the sole finish line. The following execution order governs the remaining work; it is not permission to add product features.

| Order | Work package | Owner / evidence | Completion rule |
|---|---|---|---|
| F0 | Freeze feature scope | Development | No new screens, modules, integrations or architecture changes. Only defects, release blockers, proof tests and data-safety fixes are allowed. |
| F1 | Reconcile implementation against the Excel coverage matrix and all 22 monthly inputs | Development + finance owner | **Technical mapping completed** in the coverage matrix, including all 20 legal parameters in versioned RuleSets. Finance/legal decisions on unresolved formula differences and employee-specific applicability remain external acceptance items. |
| F2 | Close technical calculation gaps that can be decided from approved rules | Development | Add regression tests only after the applicable interpretation is approved. Unapproved wage bases, tax/insurance classifications, leave/day rules and mission rules remain blocked or visibly pending; they are not guessed. |
| F3 | Close data-safety and recovery proof | Development + device operator | Test backup/export and restore on a clean browser profile; verify record counts, open restored periods, legacy Vault compatibility and schema migration; document second-location backup procedure. |
| F4 | Run end-to-end acceptance | Development + finance owner | Verify a complete period from employee selection through calculation, payslips, XLSX, approval, payment, close and correction run. All views must reconcile to the same immutable result. |
| F5 | Parallel payroll pilot | Finance owner | Run at least one real period in parallel with the currently approved process; reconcile every employee and pay item; resolve every unexplained difference. |
| F6 | Legal/finance release authorization | Authorized company reviewers | Archive primary legal sources, item-level decisions, employee evidence, signed reconciliation and written approval for the exact launch population and effective period. |
| F7 | Go-Live and stop | Finance owner + product owner | Archive a known-good backup and acceptance pack. Declare Go-Live only when all Phase 7 exit rules pass; otherwise keep the affected cases blocked and label the app technical-preview only. |

### 8.1 Work that can be completed in code versus external decisions

**Development-owned closeout work:** documentation/code consistency; exact Excel-field traceability; calculation and export regression coverage; validation blockers and warnings; correction-run acceptance; backup/restore tests and migration safety; fixing reproducible defects found by those tests.

**Not solvable by adding code:** issuer-authentic legal circulars, legal interpretation/sign-off, employer-specific job-classification and insurance applicability, employee evidence (dependents/seniority/insured history), approval of the external attendance/timekeeping source, lawful authorization for actual deductions, finance-owner reconciliation against a real payroll period, and written Go-Live authorization. These require source documents, company data or decisions from authorized people.

### 8.2 Explicit exclusions for this release

Daily time-clock/roster management, automatic debt-ledger posting, bank API/payment execution, multi-user approvals, multi-company/workspace support, cloud sync, a full desktop installer and expanded EOS workflows remain outside this release. They must not be implemented merely to make the remaining checklist look shorter. Where daily attendance evidence is required, the approved external source and the manager's verification record are the control.

### 8.3 Closeout reporting rule

Every remaining item must be reported as one of: **implemented and tested**, **implemented but operationally unverified**, **blocked on legal/finance evidence**, or **excluded by product boundary**. Do not mark an item complete solely because a UI field, formula or test stub exists.
