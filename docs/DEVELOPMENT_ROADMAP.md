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
4. Excel is used for reference, data exchange and exports; it must not become a parallel calculation engine.
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
- [ ] Apply the employee-level insurance/tax flags through an explicitly reconciled rule with the pay-item catalog.
- [ ] Implement the remaining monthly and settlement inputs in the Excel coverage matrix without removing or merging any source input. Secondary fields may use progressive disclosure, but each must remain independently stored and traceable.

### Phase 2 — Legal rules and calculation integrity
- [x] Create a structured 1405 legal source review register and identify source/implementation gaps.
- [ ] Complete the primary-source legal pack with issuer-signed copies for wage, insurance, tax and statutory benefits.
- [ ] Obtain documented review/sign-off for RuleSets 1404 and 1405.
- [ ] Complete pay-item insurance/tax/wage classifications and special-case handling.
- [ ] Add the missing seniority, dependent eligibility, job group and actual insurance-history data. The 1405 twenty-group seniority schedule is now listed as SRC-014; the current employee model still lacks approved-plan/group and last-seniority-date evidence.
- [ ] Complete shift, overtime, night, Friday, holiday and mission rules with overlap controls.
- [ ] Add the legal acceptance scenarios in PAYROLL_RULES_AND_COMPLIANCE.md to automated tests.
- [ ] Add effective-dated multi-segment proration for mid-period hire, termination, wage and contract changes.

**Gate:** no unresolved P0 legal item may be silently treated as an approved production rule.

### Phase 3 — Attendance/leave to payroll integration
- [ ] Define the meaning of actual attendance days, paid days, paid leave, unpaid leave, absence and payable days.
- [ ] Reconcile the current monthly attendance totals with the above model without breaking existing records.
- [x] Load selected-period attendance and leave records into the PayrollRun workspace for unsnapshotted periods, without overlaying historical saved snapshots.
- [x] Synchronize workdays, overtime, night work, holiday work, variable bonus and annual worked days between PayrollRun and the monthly attendance ledger.
- [x] Require an exact unpaid-leave acknowledgement and invalidate it when payable/worked days change; no automatic unpaid-leave deduction is guessed.
- [ ] Integrate paid leave into the monthly payable-day reconciliation.
- [ ] Add distinct sick-leave, absence and mission-day inputs and define their approved treatment.
- [ ] Prevent duplicate or unreviewed monthly values when a period is recalculated, restored or exported.
- [ ] Define the legally/contractually approved conversion from attendance and leave categories to payable days before automating any deduction.
- [ ] Keep daily event capture, shift rosters and mission data as separate extensions after the monthly model is stable.

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
- [ ] Connect eligible reviewed deductions to the payroll approval/payment workflow, with explicit manager confirmation.
- [ ] Prevent duplicate posting when a payroll run is recalculated, corrected or exported.
- [ ] Add debt correction/reversal, account closure, write-off and termination settlement workflows.

### Phase 5 — Payroll approval and payment workflow
- [ ] Implement Draft, Validation Failed, Ready for Review, Approved, Paid, Closed and Corrected states.
- [ ] Persist immutable payroll calculation snapshots with RuleSet version and input trace.
- [ ] Show blocking issues and review warnings before approval.
- [ ] Record finance-manager approval and payment date/reference.
- [ ] Protect approved/paid/closed periods from silent recalculation.
- [ ] Provide correction runs with traceability instead of overwriting historical results.
- [ ] Complete employee payslip, payroll register and payment/bank exports.

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

The 8-sheet Excel input audit is documented in [EXCEL_INPUT_COVERAGE_MATRIX.md](./EXCEL_INPUT_COVERAGE_MATRIX.md). Employee-master fields have been extended compatibly, family facts can seed new payroll periods, and effective wage type/seniority eligibility are applied when explicitly recorded. The selected-period attendance/leave ledgers are now loaded into unsnapshotted PayrollRun workspaces; six monthly attendance values synchronize bidirectionally, and unpaid-leave reconciliation is a blocking review gate. Paid leave, sick leave, mission, separate allowance categories, signed corrections, payment date, debt deductions, employee insurance/tax flags and settlement inputs are still outstanding. Latest verified code CI [45611741782](https://github.com/mjmadani07-dotcom/salary/actions/runs/45611741782) passed 68 tests, TypeScript validation and production build at code commit `29e66e1c7f5a4c1bfa6c5dc48671c2253fe7aee6`. Documentation-only updates may have newer commits. The pull request remains open and unmerged.
