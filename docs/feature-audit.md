# Fraud Sahayak feature audit and corrected scope

Reviewed: 28 October 2026, against the supplied INNOSPRINT feature list and current implementation.

**Verdict:** the list is a useful target specification, not an accurate list of fully delivered capabilities. “Implemented” below means a code path exists, not that production readiness, regulatory compliance or universal accuracy has been certified.

## Corrected product summary

Fraud Sahayak is a private English/Telugu fraud-report preparation app with browser voice dictation, local image/PDF extraction, OpenAI-assisted intake/classification/case review, a sourced category questionnaire, factual complaint drafting, review/approval, PDF/JSON export and guided user-controlled NCRP filing. It cannot freeze money, recover funds, automatically lodge an official complaint or verify an official complaint status.

## Requirement-by-requirement comparison

| Supplied claim | Assessment | Correct description |
|---|---|---|
| FR-01 WhatsApp-style intake | Implemented as web chat | This is not a WhatsApp Business integration or telephone service. |
| FR-02 Telugu/English | Implemented paths; further evaluation needed | Language preference and Telugu question translation exist. Do not claim validated dialect coverage or identical quality across languages. |
| Empathetic plain language | Prompted, not guaranteed | Use evaluation cases and user review; no guarantee of consistent tone. |
| FR-05 adaptive questions | Implemented, strengthened | Sourced common/category questions and server-side completeness checks; unknown supplemental answers remain explicit. |
| Structured narrative | Implemented with confirmation | Extract only user-stated facts; users must review dates, amounts and narrative. |
| Phone/voice extension | Documentation outdated | Browser microphone dictation exists now. Phone calls and spoken AI output remain future work. |
| FR-03 first-response urgent guidance | Partial | Safety information and urgent guidance exist; not every initial conversational response is verified to include it. Do not wait to call 1930. |
| FR-04 secret warnings | Implemented | Warnings and instructions exist in the UI/agents. |
| Credential input filters | Best effort, newly hardened | Labeled secrets in chat and returned transcripts are redacted. This is not comprehensive DLP. Audio sent for transcription and original uploaded evidence can contain sensitive material; users must not share it. Old records are not retrospectively scrubbed. |
| AI/no-recovery disclosure | Implemented | Does not freeze accounts, reverse transactions or promise money recovery. |
| FR-06 categories | Implemented, strengthened | 16 app/scenario categories, mapped cautiously to seven corroborated portal subcategories. Actual portal options must be checked live. |
| Confidence and cues | Partial | Classification/model confidence and supporting cues are recorded; not calibrated probabilities or independently established evidence of fraud. |
| User category correction | Implemented | Category selector in the checklist; corrections require fact review and an updated draft. |
| FR-07 normalization | Partial | Amount/date/bank/reference extraction exists. Supplemental time/payment method/each-transaction answers are collected, but not all are normalized into individually verified transaction rows. |
| FR-08 screenshot reading | Partial | Local OCR/PDF extraction and basic amount matching exist. OCR output is not verified financial evidence. |
| FR-09 missing UTR | Implemented as a gap/explicit unknown | Unknown is not invented or certified; the official portal may still require the real reference. |
| Extracted value confirmation | Implemented, strengthened | Category checklist, editable facts, explicit final confirmation, separate draft approval. |
| Evidence checklist | Implemented as collection guidance | Evidence summary and file index; does not prove completeness/authenticity. |
| FR-10 inconsistencies | Partial | Basic amount conflicts; comprehensive date, reference, beneficiary and cross-file conflict resolution is not complete. |
| Evidence-to-conversation feedback | Partial | Amount conflict and missing-field prompts exist; not a complete evidence-understanding loop. |
| Low-confidence OCR warning | Incomplete | Empty/failed extraction is flagged; calibrated blur/quality/confidence scoring is not implemented. |
| FR-11 structured complaint | Implemented, strengthened | Factual template with common/category answers, transaction schedule, evidence index and filing guide. Not legal advice or the live portal form itself. |
| Official-requirement alignment | Partially verified | Reference file records official indexed sources, historical material and a fully retrieved financial-services guide. Direct official pages blocked retrieval. Supplemental app questions are labeled as recommendations. |
| FR-15 editing | Implemented | Case fields and narrative/title are editable; existing drafts are preserved when case facts change. |
| Draft versions | Partial | Incrementing version number exists; full immutable version history/rollback is not available. |
| FR-12 explicit approval | Implemented, strengthened | Approval blocked for missing details and drafts that do not match current facts. |
| FR-13 honest filing status | Implemented | No generated official acknowledgement. User-entered references are labeled unverified. |
| FR-14 official guidance | Implemented | 1930, portal login/OTP/captcha, preview/submit and saving acknowledgement are explained. Actual submission stays on the official portal. |
| FR-19 official tracking | Future | No authorised live submission/status connection. |
| FR-16 real-time activity | Partial | Server-recorded execution summaries and polling exist; not every internal stage independently streams a full input/output trace. |
| Audit trail of every output/action | Partial | Agent summaries and selected actions/approvals logged, not comprehensive immutable event sourcing. |
| Human in the loop | Implemented | Confirmation, corrections, stale-draft checks and approval; no autonomous official filing. |
| FR-17 PDF export | Implemented | Local draft/filing pack PDF and JSON export; not a government-issued PDF. |
| Six specialised AI agents | Needs rewording | Six workflow roles, not six independent OpenAI assistants. Intake/classification and review use OpenAI; extraction, factual drafting and reporting gates deliberately use local/deterministic logic. |
| Encryption in transit/at rest | Not independently verified | Do not certify end-to-end encryption or storage encryption from this code audit. Hosting/storage settings need a security review. |
| Role-based access | Partial | Authenticated per-owner access exists; multiple operational roles/admin permissions are not implemented. |
| Data minimisation/consent/DPDP | Partial, legal review needed | Privacy warnings and local evidence extraction exist. No completed compliance assessment or comprehensive consent lifecycle. |
| Never collects secrets | Overstated | Say “never asks for authentication secrets; best-effort text redaction”. Arbitrary uploads/audio may contain them. |
| Hallucination controls | Implemented, not an accuracy guarantee | Source-quote checks, validated dates/classification, explicit unknowns, completeness gates and user confirmation. Quote matching cannot establish the truth of a claim. |
| Anti-misuse rate limiting | Partial, strengthened | Per-user AI request budget plus provider retry/concurrency limits. In-memory limits are not a distributed production abuse-control system. |
| Retention/deletion request | Missing | No completed retention scheduler, deletion-request UI or evidence purge lifecycle. |
| Graceful failure/state preservation | Partial | Messages/runs saved and errors shown; retries can still need reconciliation. Do not claim lossless idempotent processing for every failure. |
| Fast chat/screenshot processing | Not benchmarked | Model/OCR latency varies. Do not publish speed or capacity guarantees without measurement. |
| Stateless shared-database scale | Architectural direction only | Shared database exists; local evidence files and in-memory queues/budgets constrain multi-instance operation. |
| Containerised deployment | Unsupported claim in current project | No container build/deployment configuration is present; describe it as modular TypeScript services. |
| Hackathon demos | Scenarios, not proof | Run and record each demo. Do not describe all scenarios as passed unless actually tested. |
| More languages/calls/WhatsApp/status/analytics | Roadmap | No claim of delivery. |

## Accuracy policy for agents

- Use Replit OpenAI for language reasoning, not invented “training complete” claims. The current reasoning model is GPT-5.6 Terra; microphone transcription uses OpenAI's transcription model.
- Ask the sourced next question; validate core date/amount/category fields; require an exact supporting user-message quote for each newly extracted field.
- Reject unsupported or malformed extraction instead of filling gaps. Preserve uncertainty and explicit unavailable answers.
- Keep short replies from arbitrarily switching an established category.
- Never send financial evidence files or extracted OCR text to external LLM/OCR providers.
- Perform financial arithmetic locally and use a factual template for the complaint. Model judgment cannot prove authorization, authenticity or a crime.
- An existing analysis is not proof of complete intake. No draft before all required questions are answered and the person explicitly confirms.
- Mark earlier drafts stale after changed facts; require regeneration/review instead of silently replacing the person's edited text.
- Keep “prepared”, “approved”, “user-reported filed” and “officially verified submitted” distinct.
- Never promise 100% accuracy. Evaluate false-positive classifications, wrong amounts/dates, unknown handling, injection resistance, English/Telugu behavior and incomplete-case blocking before any real-world deployment.

## Highest-priority remaining work

1. A privacy/security review, durable evidence storage and a deletion/retention/consent lifecycle.
2. Multi-transaction structured normalization and richer OCR quality/conflict evaluation with a measured English/Telugu benchmark set.
3. Durable retry/idempotency and full revision/event history before claiming production reliability.
4. Official submission/status integration only after an authorised interface and legal permission exist.

No real complaint was submitted as part of this review.
