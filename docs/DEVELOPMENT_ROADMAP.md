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
- Monthly attendance totals ledger and monthly leave balance ledger exist as separate modules. In the current lightweight workbench branch, the PayrollRunView does not yet load these records into the payroll calculation; end-to-end ingestion and reconciliation remain open work.
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
- [ ] Add the shift-pattern model and correct distinction between non-shift night premium (35%) and statutory shift allowances (10%, 15%, 22.5%).
- [ ] Add statutory overtime controls (consent, daily limit and prohibited categories) using daily-level attendance evidence.
- [x] Use the same hourly wage basis (base wage + seniority) for Friday premium as overtime; add explicit warnings when monthly overtime/Friday/holiday categories may overlap.
- [ ] Reconcile Friday premium with weekly-rest scheduling, daily time records and official-holiday overlap; current monthly aggregates cannot prove non-overlap.
- [ ] Complete mission allowance using the applicable fixed/base wage floor and separate transport/travel costs, including qualifying distance/overnight conditions.
- [ ] Add the missing seniority, dependent eligibility, job group and actual insurance-history data. The 1405 twenty-group seniority schedule is now listed as SRC-014; the current employee model still lacks approved-plan/group and last-seniority-date evidence.
- [ ] Complete shift, overtime, night, Friday, holiday and mission rules with overlap controls.
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
- [ ] Implement monthly payroll-run Draft, Validation Failed, Ready for Review, Approved, Paid, Closed and Corrected states.
- [x] Persist immutable calculation result snapshots with RuleSet version and employee input/metadata trace.
- [x] Prevent deletion of payroll snapshots once they are ready for finance review; failed calculations may be discarded, while reviewed/approved/paid/closed records are retained for audit.
- [x] Show blocking issues and legal-review warnings in reports and exports.
- [ ] Record monthly payroll finance-manager approval, payment date/reference and bank reconciliation.
- [ ] Protect monthly approved/paid/closed payroll periods from silent recalculation.
- [ ] Provide monthly payroll correction runs with traceability instead of overwriting historical results.
- [x] Implement the separate termination-settlement lifecycle Draft → Ready for Review → Approved → Paid, including append-only event history and immutability after approval/payment.
- [ ] Persist immutable payroll calculation snapshots with RuleSet version and input trace.
- [ ] Show blocking issues and review warnings before approval.
- [ ] Record finance-manager approval and payment date/reference.
- [ ] Protect approved/paid/closed periods from silent recalculation.
- [ ] Provide correction runs with traceability instead of overwriting historical results.
- [x] Generate employee payslip worksheets, payroll register, monthly cost-centre summary and bank transfer register from one PayrollRunResult export.
- [ ] Add bank-specific transfer file formats, monthly payroll payment approvals/references and reconciliation of actual bank transactions.

### Phase 6 — Backup, restore and Windows packaging
- [ ] Define a versioned local backup format covering employee master, contracts, wages, attendance, leave, debts, settings and payroll-run history.
- [ ] Validate backup integrity and detect incomplete/corrupt files.
- [ ] Implement full restore with a clear overwrite/merge policy and pre-restore safety backup.
- [ ] Test restore onto a fresh browser/device profile and test database schema upgrades.
- [ ] Verify legacy encrypted records are preserved and continue to work.
- [ ] Package the application as a standalone Windows desktop app only after backup/restore and local persistence tests pass.
- [ ] Provide a simple installer/update/uninstall and data-location guide.

### Phase 7 — Final operational readiness
- [ ] Close all P0 legal and calculation issues.
- [ ] Pass unit, integration, migration, backup/restore and end-to-end payroll acceptance tests.
- [ ] Reconcile web UI, payslips, XLSX and bank/payment exports against the same payroll snapshot.
- [ ] Verify closed-period immutability and correction audit trail.
- [ ] Update the product documentation and only then assess operational readiness.

## 5. Release boundary

The current branch is a development baseline, not a legally approved production payroll system. Successful tests prove only the currently automated scenarios. Operational use requires legal sign-off, complete P0 validation, verified data backups and a tested restore procedure.

## 6. Current status

Current work branch: `feat/lightweight-payroll-workbench`.

The 8-sheet Excel input audit and formula-gap review are documented in [EXCEL_INPUT_COVERAGE_MATRIX.md](./EXCEL_INPUT_COVERAGE_MATRIX.md). Excel is the complete input/output coverage baseline, not the final calculation authority. Employee master stores the added fields compatibly, and a full A:V Paste/Import validates period, employee, payslip and leave balance while converting source Toman amounts to internal Rial. Payroll output is generated from one PayrollRunResult: detailed A:AN calculations plus AO:BA supplementary fields, monthly KPIs/cost-centre summary, printable per-employee payslips, bank preparation register, pay-item/tax details and warnings. Employee title, cost centre, bank details, insurance number and leave balance are retained in historical snapshots. A separate settlement case module captures all five Excel source inputs plus evidence-backed wage bases, actual worked days and months, leave encashment, prior payments, other claims and authorized deductions. Eid is prorated by worked days; severance uses actual total service duration; termination leave is not capped at the annual 9-day carryover rule. Cases are stored locally (encrypted when the vault is configured), follow Draft → Ready for Review → Approved → Paid, retain append-only event history and cannot be changed after approval except to record payment. Settlement XLSX output includes case details and audit history. **Not production-final:** settlement tax/statutory withholdings, formal approval of wage bases and legal special cases remain open; monthly payroll-run approval/closed-period immutability, bank-specific transfer files and actual bank reconciliation also remain open. Friday premium now uses the same hourly basis as overtime (base wage plus seniority), with explicit warnings when monthly overtime/Friday/holiday categories may overlap; this improves on the Excel formula but remains subject to legal review. Reviewed/approved/paid/closed payroll snapshots cannot be deleted; failed calculations may be discarded. Other material legal gaps remain for shift/night work, daily overtime, weekly rest/Friday, mission travel, lawful deductions and tax item classification. The source workbook omits leave/absence effects from its payable-day formula; software does not inherit that omission by guessing. Negative-net-pay lines are blocked from payable totals. The pull request remains open and unmerged.
