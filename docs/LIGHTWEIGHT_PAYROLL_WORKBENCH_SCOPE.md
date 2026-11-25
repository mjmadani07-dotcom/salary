# Lightweight Payroll Workbench — Product Scope

| Attribute | Value |
|---|---|
| Product | Lightweight Payroll Workbench |
| Target branch | `feat/lightweight-payroll-workbench` |
| Baseline branch | `feat/payroll-rule-registry-engine` |
| Baseline commit | `264738e80a8745aa993a8582e519a277b95232bb` |
| Platform | Windows desktop, local-first |
| Primary user | One finance/payroll manager |
| Document status | Product direction for this branch |

## 1. Product intent

The product is a **local payroll and employer-cost workbench**, not a general-purpose HR, attendance, accounting, or enterprise workforce-management system.

Its purpose is to replace the finance manager's recurring payroll spreadsheets with a clearer and safer interface for:

1. maintaining the minimum employee information required for payroll;
2. entering monthly payroll inputs for all employees in one period-oriented workspace;
3. calculating employee gross earnings, deductions, net pay, employer cost and CTC;
4. reviewing totals and employee-level results; and
5. importing/exporting Excel data and keeping local backups.

The application should feel like a well-designed, spreadsheet-oriented desktop tool. It should reduce repetitive data entry and formula maintenance without making the user operate a complex HR workflow.

## 2. Target operating model

- One finance manager operates the application.
- The application runs locally on one Windows computer using a supported browser; the current scope does not require a standalone installer.
- Data is stored locally; internet access is not required for normal payroll work.
- There is one employer/company context. Multi-company and multi-workspace support are not product requirements.
- There are no application roles, concurrent users, cloud synchronization, server deployment, or enterprise approval chains.
- The application is designed to work comfortably with small and medium employee lists (for example, 10, 50 or 200 employees).
- The manager remains responsible for checking inputs and reviewing results before using payroll outputs.

## 3. Primary navigation and workflows

The main navigation should contain only three work areas.

### 3.1 Employees

A simple employee register containing the information that is genuinely needed by the payroll calculation:

- personnel code (unique);
- first and last name;
- active/inactive status;
- national ID and insurance number, when needed for statutory calculations or reports;
- hire date / service information needed for seniority, Eid and severance calculations;
- current base wage and seniority wage;
- relevant family/dependent and insurance-eligibility facts;
- only the minimum job/contract attributes required to choose or validate a payroll rule.

The list should support add, edit, deactivate, search and basic validation. Employee entry should not require the user to build a multi-event contract history or maintain a full HR file.

Where historical wage or contract information is necessary to calculate a past period correctly, retain the underlying capability, but keep it out of the routine entry path. A historical change must not silently alter a previously saved payroll period.

### 3.2 Monthly payroll

This is the primary daily workspace.

- The manager selects the fiscal year and month.
- The application loads active employees and their relevant employee-master defaults.
- The manager enters or adjusts monthly values in one spreadsheet-like grid.
- Common inputs should be editable directly in the grid; less common details may be available in a compact row detail panel.
- The manager can calculate or recalculate the entire period and immediately see validation issues.
- Blocked rows must explain what input is missing or inconsistent. The application must not silently invent legally significant values.
- The manager can save the period and reopen its saved results later.

The monthly grid should use only the inputs that materially affect the current payroll rules. Expected examples include payable/work days, overtime, night/holiday hours, variable earnings, and any required monthly eligibility or service facts not reliably available from the employee record.

Do not require daily attendance events, shift rosters, leave applications, or separate ledgers merely to calculate a normal monthly payroll. If the manager has already reconciled workdays outside the application, entering the approved monthly totals must be sufficient.

### 3.3 Reports and exports

One consolidated reporting area should show, for the selected period:

**Employee-level results**
- gross earnings;
- employee insurance contribution;
- payroll tax;
- other configured deductions;
- net pay / take-home pay;
- employer insurance contribution;
- direct employer cost;
- monthly statutory reserves included in the CTC model;
- total monthly CTC.

**Period-level totals**
- employee count;
- total gross earnings;
- total deductions;
- total net pay;
- employee and employer insurance totals;
- payroll tax total;
- total employer cost and total CTC.

The user should be able to inspect an employee's calculation breakdown, print or export a payslip/report, and export a complete period workbook. Excel import should be available for initial migration and practical bulk data entry where supported.

All displayed totals, payslips and workbook outputs must be based on the same saved calculation result. Export files must not contain a second, independently maintained payroll formula engine.

## 4. Calculation and compliance requirements

Simplifying the product must **not** simplify or weaken statutory calculation controls.

- Keep one central calculation engine for payroll and CTC.
- Keep year-specific rule sets and pay-item classifications.
- Preserve input validation, insurance ceilings, progressive tax calculations, eligibility checks, rounding rules and calculation breakdowns already implemented.
- Clearly distinguish gross earnings, employee deductions, net pay, direct employer cost, statutory reserves and CTC.
- Keep internal money values in Rial; Toman is a display/input choice with explicit labeling.
- Every saved period must retain the inputs and calculation result needed to reproduce or explain that period.
- A later change to an employee's wage, status or a rule set must not rewrite a previously saved period.
- If a rule or eligibility condition is still under legal review, show that limitation clearly. Code implementation or a workbook formula is not legal approval.

The current 1404 and 1405 rule sets and their legal-review status must be preserved. This product-scope change does not constitute legal validation or approval of any payroll formula.

## 4.1 Excel reference parity and input preservation

The repository workbook `excel-hoghoogh-dastmozd-1405-igilar.xlsx` is the baseline for input coverage. Its complete field-by-field mapping is maintained in [EXCEL_INPUT_COVERAGE_MATRIX.md](./EXCEL_INPUT_COVERAGE_MATRIX.md).

- Every input in the reference workbook must have an independently stored destination in the application, including informational and reconciliation inputs that do not directly enter a formula.
- The simplified UI may place infrequent inputs in a row-detail panel or an expanded section. Progressive disclosure is allowed; removing an input or merging two distinct inputs is not.
- Employee master facts, period-specific inputs, annual settlement inputs, versioned legal parameters and calculated outputs must remain distinct. A monthly value must not silently overwrite a permanent employee fact.
- Monthly aggregates such as sick leave, unpaid absence, mission days, insured/non-insured benefits, deductions and signed corrections must remain separately identifiable. The application must not substitute a superficially similar field (for example, a bonus field) without an explicit, tested mapping.
- A value stored in a separate attendance, leave or debt ledger is not considered covered by the payroll workflow until the selected-period value is loaded, reconciled and retained in the payroll snapshot.
- The Excel workbook is a compatibility and reconciliation baseline, not automatic legal authority. Any formula conflict must be documented and tested before choosing the application rule.

## 5. What is outside the core product

The following capabilities must not shape the main navigation, data-entry model or release criteria for this branch:

- multi-company / multi-workspace administration;
- multiple users, user roles and permissions;
- cloud accounts, synchronization or server deployment;
- enterprise approval workflows, e-signatures and configurable authorization chains;
- daily time-and-attendance management, shift scheduling or a full leave-management system;
- a standalone employee loan/advance accounting ledger;
- a full HR information system or elaborate contract lifecycle management;
- accounting, ERP, banking or payment execution integrations;
- a full EOS / performance-management / scorecard / Rocks / profit-sharing workflow;
- automatic deduction of employee advances, loans or debts from payroll.

Some of these features already exist in the baseline branch. Their existence is not a reason to keep them in the routine workflow. They may be hidden, parked or treated as legacy/optional modules after impact is assessed. Do not delete their data or remove their persistence structures without a separate compatibility and migration decision.

The existing EOS implementation may remain available as legacy functionality where needed, but no new operational EOS development is included in this branch's scope.

## 6. Data and local-storage principles

- Keep the application local-first and preserve local persistence.
- Provide a straightforward, versioned backup and restore mechanism.
- A restore operation must validate the backup and clearly explain whether existing local data will be replaced.
- Do not introduce a new mandatory vault passphrase or encryption setup for new installations.
- Preserve compatibility with existing databases and legacy encrypted-vault records.
- Do not silently discard employee, payroll-period, or legacy ledger data during a UI redesign or schema migration.
- Prefer simplifying forms and views before simplifying or destructively replacing persisted data structures.
- Keep a clear separation between employee master data, period-specific inputs, versioned payroll rules and saved calculation results.

## 7. UX principles

1. **Period-first:** payroll work starts by selecting a month, not by navigating through several independent modules.
2. **Grid-first:** routine monthly entry should be possible without opening a separate form for every employee.
3. **Progressive disclosure:** show essential fields first; expose infrequent or technical details only when needed.
4. **One source of truth:** employee defaults, period inputs and calculation results must have clear ownership.
5. **Immediate feedback:** show missing data, invalid values and calculation warnings beside the affected employee or field.
6. **Plain language:** use familiar Persian payroll terminology and explain technical or legal warnings in context.
7. **No decorative complexity:** dashboards, tabs, status states and settings must exist only when they help the single operator complete or verify payroll work.

## 8. Acceptance criteria for the simplified product

The product direction is met when:

- the main navigation has only Employees, Monthly Payroll, and Reports/Exports;
- an operator can maintain employee master data without creating unnecessary contract, attendance, leave or debt records;
- an operator can prepare a monthly payroll for all active employees from one grid-like workspace;
- the same period can be recalculated after input corrections with clear validation feedback;
- each employee's gross, deductions, net pay, employer cost and CTC can be inspected;
- period totals reconcile to employee-level results;
- payslips and Excel exports reproduce the same result shown in the application;
- prior saved payroll periods remain stable when current employee data or future rules change;
- backup and restore work on a local Windows installation;
- existing data is preserved or explicitly migrated, never silently discarded;
- automated tests, TypeScript validation and production build pass.

## 9. Implementation sequence for this branch

1. **Baseline audit:** map the current navigation, components, persistence models, payroll engine, exports and existing tests. Record which features can be hidden without affecting calculations or stored data.
2. **Navigation simplification:** introduce the three primary work areas while keeping the existing specialist screens accessible only as temporary legacy routes if needed during migration.
3. **Employee workflow:** simplify the routine employee form and resolve duplicate/overlapping employee-entry paths without losing existing records.
4. **Monthly grid:** make the period payroll grid the primary workflow, using the central payroll engine and existing validation.
5. **Reporting and exports:** consolidate employee results and period totals; align payslips and Excel exports with the same calculation result.
6. **Local data safety:** verify persistence, migrations, backup and restore before removing or deprecating legacy screens.
7. **Windows readiness:** validate the local browser-based workflows on the target Windows computer. A standalone installer or native desktop package is not required by this release scope.

Do not begin by deleting ledgers, changing legal formulas, redesigning the calculation engine, or adding new enterprise capabilities. First simplify the user journey and prove that the existing payroll calculations and data remain intact.

## 10. Relationship to earlier development documents

`DEVELOPMENT_ROADMAP.md`, `PAYROLL_RULES_AND_COMPLIANCE.md` and the ledger implementation notes describe work completed or planned under the earlier, broader scope. They remain useful as implementation and compliance history.

For forward development on `feat/lightweight-payroll-workbench`, this document is the authoritative product-scope boundary. Where an earlier roadmap item proposes a workflow excluded here, it is deferred unless the product owner explicitly brings it back into scope. Legal requirements and calculation-integrity controls remain in force regardless of this UX simplification.
