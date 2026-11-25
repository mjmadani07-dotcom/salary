# Legal Review Register — Payroll 1405

**Status:** Research register, not a legal opinion or approval.  
**Prepared:** 2026-11-25  
**Product scope:** One finance manager, one local device, employees subject to Iranian Labour Law / Social Security in the general case. Special insurance regimes, fixed-wage occupations and non-labour-law employment systems require separate applicability checks.

## 1. Evidence standard

The existence of a formula in the application, Excel, a news article or a secondary legal portal does not establish legal approval.

For every production RuleSet, the review file must contain:
1. Issuing authority and exact circular/law identifier.
2. Signed or verifiable primary copy, effective date, amendments and applicability.
3. Exact text/paragraph that supports the rule.
4. Interpretation for the relevant employment type and employer.
5. Reviewer, review date and explicit approval/rejection.
6. Unit and integration test cases for the approved interpretation.

Where this repository currently links a re-publication or news report rather than the issuer's own copy, the source is marked **primary-copy verification required**. None of the items below should be interpreted as formal sign-off.

## 2. Reviewed 1405 sources and findings

| ID | Topic / source | Evidence located | Implementation impact | Status |
|---|---|---|---|---|
| LR-1405-01 | Wage circular 6682 dated 1405/01/31, based on Supreme Labour Council resolution 1404/12/24 | Circular identity and general 45% + 519,549 Rial/day adjustment, with a minimum daily wage floor of 5,541,850 Rial, are reproduced in the Social Security 1405 insurance circular and the job-classification directive. | Retain annual versioning. A single formula is not sufficient for minimum-wage, other-level, classified jobs, piece-rate and special cases. | Reproduced source; signed original and applicability require review. |
| LR-1405-02 | Social Security insurance-wage circular dated 1405/02/07 | The official Social Security website has a dedicated 1405 insurance-wage circular page and links to the circular PDF and fixed-wage annexes. The reproduced text states 5,541,850 Rial minimum daily insurable wage (except fixed-wage activities), 45% + 519,549 Rial for other levels, 166,667 Rial daily seniority for eligible workers, insurance treatment of household-consumption allowance, housing and marriage allowance, and a 7x daily minimum-wage ceiling adjusted for 29/30/31-day months. | Keep the general-case 7x ceiling and month-day scaling in the RuleSet, but match the actual employer/workshop to the relevant fixed-wage or general regime and verify every allowance classification. | Official landing page verified; the linked attachment has not yet been archived/reviewed in the project evidence pack. Employer/employee applicability and sign-off remain open. |
| LR-1405-03 | Job-classification implementation directive dated 1405/01/31 | For approved job-classification workshops, wage elements treated as wages (including rank, position, hardship, retention and past seniority elements) are increased 45% under its conditions. It gives a 20-group 1405 seniority table from 166,667 to 172,267 Rial/day. New 1405 seniority base is not increased by 45%; eligibility is one year in the same workshop or one year since the last seniority step, including cases where end-of-service benefits were settled. | Employee model needs approved job-classification applicability and group number. Current employee wage history stores a daily seniority amount but not the 20-group source/rule or last seniority date. Do not apply group 1's amount to all classified employees. | High-impact P0; signed original, workshop coverage and wage-component interpretation need legal review. |
| LR-1405-04 | Budget 1405 tax instruction 200/1005/ص dated 1405/01/31 | Reproduced instruction and budget table support annual exemption of 4,800,000,000 Rial and annual progressive bands: 10%, 15%, 20%, 25%, 30%. Monthly equivalents are used in the current RuleSet. | RuleSet values should be traced to the enacted budget table. YTD, multiple-source income and additional/variable payments still need a complete reconciliation method. | Values cross-checked against published table; signed circular and final statutory attachment must be retained. |
| LR-1405-05 | Tax instruction 200/1405/59 dated 1405/07/27 (amending clause 3 of 200/1403/39) | Reproduced text says payments under specified agreements and benefits whose cap/amount is approved by Cabinet or Supreme Labour Council (examples include housing, family allowance, child allowance and household-consumption allowance) are considered within “customary limits” for purposes of that instruction; other payments are assessed against documents, law and court decisions. | Correct identifier is **200/1405/59**, not the inverted form 59/1405/200. This is not a blanket unlimited exemption. The marriage allowance is not in the examples listed in this clause and must not be assumed to share the same treatment without legal review. | Reproduced full text; exact scope, interpretation and signed original need review. |
| LR-1405-06 | Fixed-wage special occupations: instruction 168/1405/5000 dated 1405/02/02; second-half update 2539/1405/5000 dated 1405/08/19 | Reproductions describe fixed daily insurance wages for defined occupations/industries, with the second-half update effective from 1405/07/01. | Do not apply these values to general employees. Add a distinct rule only after the employee's occupation/workshop is shown to fall within the relevant annex/category. | Applicability-specific; annexes and signed versions required before implementation. |
| LR-1405-07 | Paid-leave and payable-day semantics | Labour Law articles 64–66 are listed in the compliance source pack; product now records monthly balances and an unpaid-leave reconciliation acknowledgement. | Do not equate worked days, presence days and payable days. Do not automatically deduct unpaid leave until legal/contractual day conversion is defined and approved. | Technical review gate implemented; legal/contract interpretation pending. |

| LR-1405-08 | Labour Law wage definitions and working-time premiums: articles 35–36 and 55–62 | Consolidated Labour Law text reproduces wage (Art. 35), fixed wage and fixed job-related benefits (Art. 36), rotating shift definition and premiums (Arts. 55–57), night premium only for non-shift workers (Art. 58), overtime consent/rate/ordinary daily limit (Art. 59), exceptional overtime (Art. 60), prohibition for night/hazardous work (Art. 61), and Friday rest/premium (Art. 62). | Supports keeping non-shift night work distinct from shift work and treating the wage basis and overlap between premiums as explicit review questions. The software now captures the monthly pattern and applies the statutory rates; it still lacks daily shift/overtime evidence. Friday premium uses the same base+seniority hourly basis as overtime but remains subject to interpretation review. | Consolidated reproduction located; signed/official consolidated copy, subsequent amendments and interpretation of the wage base require verification. |
| LR-1405-09 | Rotating-shift allowance wage basis: Ministry of Cooperatives, Labour and Social Welfare circular 237853 dated 1402/11/10 | Reproduced circular amends paragraph 9 of Labour Relations Instruction 22 and states that the basis for shift-work allowance is the worker's “wage or salary”, removing “fixed wage / base wage” wording. | The engine applies Article 56's monthly percentage to period base salary + seniority as an explicit provisional proxy; the inclusion of other wage components and insurance/tax classification require item-level legal review. | Reproduced copy located; signed original and current applicability require verification. |

### Source links used in the initial research

- Official Social Security landing page for the 1405 insurance-wage circular, with links to the circular PDF and fixed-wage annexes (published 1405/02/08; updated 1405/02/10): https://tamin.ir/news/item/197716
- Social Security 1405 insurance-wage circular dated 1405/02/07: https://hoghogh.ai/circulars/c-37c3a40f
- Ministry of Labour circular 237853 dated 1402/11/10 on the wage basis for rotating-shift allowance (reproduced copy): https://bidbarg.net/regulation/circular/237853/
- Consolidated Iranian Labour Law (articles 35–36 and 55–62; reproduced PDF): https://shenasname.ir/wp-content/uploads/2025/02/%D9%82%D8%A7%D9%86%D9%88%D9%86-%DA%A9%D8%A7%D8%B1-%D8%A8%D8%A7-%D8%A7%D8%B5%D9%84%D8%A7%D8%AD%D8%A7%D8%AA-%D8%A8%D8%B9%D8%AF%DB%8C.pdf
- Job-classification directive dated 1405/01/31: https://hoghogh.ai/circulars/c-bda98aa9
- Tax amendment 200/1405/59 dated 1405/07/27: https://hoghogh.ai/circulars/c-a051712e
- Budget 1405 tax instruction and table (reproduced PDF): https://taxiniran.com/wp-content/uploads/2026/09/بخشنامه-احکام-مالیاتی-قانون-بودجه-سال-۱۴۰۵-کل-کشور.pdf
- Budget 1405 tax-band summary: https://www.tasnimnews.ir/fa/news/1405/01/13/3555053/جزئیات-مالیات-حقوق-امسال
- Fixed-wage special occupations 168/1405/5000: https://gzita.com/law/tamin/O1D0776ITFL1ATH65J8RVGVO717SZJ6S
- Fixed-wage special occupations second-half update 2539/1405/5000: https://kargozin.com/بخشنامه-دستمزد-مقطوع-شش-ماهه-دوم-سال-۱۴۰۵/

**Important:** These URLs are source discovery/traceability links. A secondary portal's description or reproduced body must not be described as the issuing authority's official hosting location unless that is independently established.

## 3. Priority questions requiring legal reviewer decision

| Priority | Question | Affected calculation/data | Do not implement as a default until |
|---|---|---|---|
| P0 | Which wage elements form “fixed wage / wage base” for overtime, Eid, severance and insurance under each employment/approved job-classification type? | Overtime, Eid, severance, insurance base | A legal reviewer maps each pay item to each calculation basis. |
| P0 | Does the employee belong to a workshop with an approved job-classification plan, and which group (1–20) applies? | Daily base wage, seniority, wage-component adjustments | Workshop approval and group evidence are recorded in employee/contract data. |
| P0 | What date and rule establish seniority eligibility, including the last seniority increase date and prior settlements? | Seniority entitlement | The one-year eligibility and effective-date rules are documented and tested. |
| P0 | Which allowance/treatment is insuranceable and taxable, and how does “customary limits” apply to actual amounts? | Pay-item catalog, insurance/tax bases | Primary text, amount limits, evidence requirements and item-specific interpretation are approved. |
| P0 | Is marriage allowance subject to the same tax treatment as the examples in 200/1405/59? | Marriage-allowance taxable income | A documented legal conclusion exists; no analogy is assumed. |
| P0 | How are YTD and multiple-source salary incomes reconciled, including variable and one-off payments? | Salary tax withholding and annual adjustment | The approved withholding/annual adjustment method and source fields are defined. |
| P0 | Which insurance exceptions, fixed-wage professions and employer exemptions apply to this employer and each employee? | Employer/employee insurance | The actual occupation/workshop and exemption evidence are recorded. |
| P0 | How should paid leave, unpaid leave, medical leave, absence and payable days interact? | Workdays and prorated pay | An approved payable-day model exists and tests prevent underpayment/double deduction. |
| P1 | What is the correct hourly divisor for each work pattern and wage basis? | Overtime and other hourly premiums | The applicable rule is verified for each contract/time pattern. |
| P1 | Which wage components are included in the Article 56 rotating-shift allowance after circular 237853/1402? | Shift-work wage base and monthly premium | A signed circular copy, applicable interpretation and item-by-item wage mapping are approved. |
| P1 | How do night, shift, Friday, official holiday and overtime hours overlap? | Premium calculations | An overlap matrix with legal basis and tests is approved. |
| P1 | How are Eid, unused leave cash-out and severance taxed/insured at settlement? | Net settlement and employer cost | Current-year tax/insurance rules and last-wage basis are confirmed. |
| P1 | Which special wage circular annex applies from 1405/07/01 onward? | Special insurance wage base | The relevant activity/occupation is matched to the annex. |

## 4. Current code/data gap mapping

| Area | Current branch capability | Remaining gap |
|---|---|---|
| Rule Registry | RuleSets for 1404 and 1405 | Legal sign-off and primary-source attachment |
| Wage adjustment | Other-level increase helper: percentage + fixed daily amount + minimum floor | Multi-component wage and group-classification logic |
| Employee master | Hire date, contract history, effective-dated daily base and seniority wage | Job-classification group, approved-plan flag, last seniority date and supporting evidence |
| Attendance | Monthly worked/payable-day value, monthly shift-pattern selector and monthly hour totals | Daily events/rosters, overtime consent/limits, weekly and four-week working-time checks, paid-day semantics |
| Leave | Monthly leave balance; unpaid-leave reconciliation gate blocks mismatches | Legal conversion to payable days, daily approval and automatic entitlement policy |
| Insurance | General rates and 7x cap in the calculation engine | Special regimes and complete item classification |
| Tax | Annual RuleSet values with monthly progressive calculation | YTD/multiple-source reconciliation, fully reviewed allowances and one-off payment treatment |
| Employee deductions | Initial local tracking ledger implemented | Separate advance/loan/repayment and reviewed other-deduction records exist; lawful recovery review and approved payroll posting remain open. No automatic payroll deduction occurs. |

## 5. Implementation rule

No source-discovery result in this file is legal approval. Keep the affected rule in "pending-legal-review" or block the affected scenario until a reviewer records the decision. Do not silently change the 1405 engine to mirror an Excel formula or a secondary website's interpretation.
