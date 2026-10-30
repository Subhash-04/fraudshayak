# Fraud Sahayak — Business Requirements Document

**Document status:** Proposed government procurement/pilot baseline. Not a contract, legal opinion, certification or approval to process real citizen evidence.

## 1. Purpose and scope

Sell the service to government for government-led scale-up and integration with an authorised government WhatsApp number. Deliver bilingual, assisted financial-incident intake through WhatsApp and voice, with reviewed complaint preparation and consented handover.

Current prototype capabilities and simulations are described in [features](features.md). Government integrations, real messaging and verified official tracking are additional scope.

## 2. Stakeholders and roles

Citizens/victims; government programme owner; helpline operators; authorised reviewing officers; bank contacts; vendor operations; security/privacy and procurement teams; approved channel and hosting providers.

Government roles must use least privilege. A victim may access only their own case. Officers require explicit jurisdiction/assignment rules; support access must be authorised, logged and time-limited.

## 3. Functional requirements and acceptance

| ID | Requirement | Acceptance condition | Current position |
|---|---|---|---|
| BR-01 | Authorised helpline menu | Test calls route 1 to opted-in WhatsApp and 2 to live intake; cancellation works | Browser simulation |
| BR-02 | Government WhatsApp number | Approved sender, opt-in, signed webhooks and genuine message receipts demonstrated in sandbox | Proposed |
| BR-03 | English / Telugu intake | Both journeys preserve facts and allow language changes; evaluation includes native-speaker review | Prototype; evaluation required |
| BR-04 | Voice consent and accuracy | Explain recording/processing, obtain consent and allow correction before facts are used | Browser review exists; live channel proposed |
| BR-05 | Adaptive questions | Short answers accumulate; already supplied facts are not repeatedly requested | Implemented; broader regression coverage required |
| BR-06 | Incident categorisation | Explain suggested category, allow correction and distinguish mistaken payments from unauthorised fraud | Model/checklist support; targeted validation required |
| BR-07 | Completeness gates | Missing required facts remain visible; explicit unknown does not imply official acceptability | Implemented prototype |
| BR-08 | Evidence handling | Approved types/limits, malware controls, local extraction, reviewable gaps; no invented contents | Local extraction exists; hardening required |
| BR-09 | Financial review | Verify displayed amounts/references against user confirmation; flag conflicts rather than silently resolving | Partial |
| BR-10 | Facts and draft approval | Separate fact confirmation from final approval; edits invalidate stale approval | Implemented prototype |
| BR-11 | Export | Download a readable draft and evidence index marked not filed | PDF/JSON prototype |
| BR-12 | Official submission | Only authorised API/contract; submit exact approved version idempotently and retain genuine receipt | Proposed; manual guidance exists |
| BR-13 | Progress tracking | Separate local, submitted, acknowledged and verified status; show provenance and last verified time | User-entered reference only |
| BR-14 | SMS ticket | Use approved templates and delivery receipts; never label an app ticket official | Simulation |
| BR-15 | Bank handover | Separate consent, verified recipient, approved packet version and receipt/failure evidence | Prepared-not-sent simulation |
| BR-16 | Human escalation | Route uncertainty, distress, disputed facts and integration failure to an authorised operator | Proposed operator workflow |
| BR-17 | Audit | Record consent, corrections, model/version, approvals, submission attempts and access without secret logging | Partial summaries |
| BR-18 | Urgent assistance | Clearly direct urgent victims to their bank and 1930; never delay advice until draft completion | Guidance exists; all entry paths need validation |

## 4. Data and privacy requirements

- Define government/vendor/provider responsibilities and lawful processing before collection.
- Collect only necessary information. Never request OTPs, PINs, passwords, CVVs or wallet seed phrases.
- Record purpose-specific WhatsApp, recording and bank-sharing consent; provide withdrawal/deletion handling subject to lawful retention.
- Keep uploaded evidence and OCR extraction local to the approved service environment; external model access to evidence is not permitted by the current product boundary.
- Disclose externally processed voice recordings and user-entered text. Model/provider, retention and cross-border processing must pass buyer review; local OCR alone does not make all data local.
- Use approved encrypted durable storage, encrypted transport, key management, backups and restore tests.
- Agree retention periods per data type before pilot. Do not invent statutory retention periods or claim automatic compliance.
- Redact operational logs, restrict exports and implement access review and incident response.
- Assess applicable Indian privacy, cybersecurity, records and accessibility obligations with qualified government/legal reviewers. Do not claim certification from this document.

## 5. Non-functional requirements

The following are **proposed pilot targets for buyer agreement**, not measured production performance or an SLA:

| Area | Proposed acceptance |
|---|---|
| Availability | Agree a pilot service window and support coverage before go-live |
| Capacity | Buyer defines peak concurrent sessions and daily case/message volumes; load-test agreed envelope |
| Responsiveness | Measure p50/p95 separately for intake, final review and approval; agree thresholds from pilot data |
| Reliability | Duplicate webhook/retry tests create no duplicate case submission or ticket |
| Recovery | Agree RPO/RTO, prove backup restore and queued-message recovery |
| Security | Independent assessment; no unresolved critical/high findings without approved risk treatment |
| Accessibility | Validate keyboard/screen-reader operation, clear language and non-voice alternative |
| Model quality | Grounded facts only; unknowns remain explicit; report extraction and category errors by language/scenario |
| Observability | Alert on failed deliveries, queue backlog, model errors and failed official acknowledgements |

## 6. Required integrations and prerequisites

1. Government-approved WhatsApp Business ownership/access and template policies.
2. Authorised telephony/IVR and SMS providers with consent and receipt semantics.
3. Agreed case identity, duplicate detection, authentication and operator roles.
4. Approved model/hosting contracts, processing locations and retention terms.
5. Bank recipient verification and authorised handover contracts.
6. Explicit official cybercrime submission/status API access, if available and authorised.

No OTP/captcha bypass, screen-scraping assumption or generic right to send citizen files to banks is included.

## 7. Case-state and exception rules

States must distinguish intake, missing information, facts confirmed, draft prepared, approved, handover pending, official submitted, acknowledged and verified status. A local assistance ticket is a separate identifier.

- New facts invalidate any incompatible draft/approval and require review again.
- Timeouts are pending/failed, never successful by assumption.
- Provider delivery is not bank acceptance or government filing.
- An official reference must have provenance; user-entered references remain unverified.
- Rejected/failed handovers retain the approved version and a visible retry/escalation route.
- Do not manufacture details to satisfy narrative length; build the narrative from confirmed facts across messages.

## 8. Pilot exit criteria and deliverables

Deliver source/build instructions, architecture and threat model, tested adapters, provider configuration/runbooks, retention and incident-response procedures, operator training, regression/evaluation reports, load/recovery evidence and documented limitations.

Exit requires end-to-end bilingual journeys; incorrect/ambiguous and mistaken-payment cases; evidence failures; duplicate/reordered webhooks; consent refusal; stale drafts; provider/official API outages; unauthorised access attempts; and verified rollback/recovery. The buyer signs acceptance against agreed criteria. A successful demo alone is insufficient.

## 9. Open procurement decisions

- Sponsoring department, jurisdiction, authorised number and integration owner.
- Pilot volume, service hours, languages and human staffing.
- Hosting region, evidence storage, retention and controller/processor responsibilities.
- Official/bank API availability and fallback process.
- Pricing, provider costs, support SLA, intellectual property and exit/export terms.

## 10. Exclusions

No guaranteed fraud determination, fund freeze, refund, recovery, police action or government endorsement. This BRD does not authorise autonomous filing or waive bank identity/evidence requirements.
