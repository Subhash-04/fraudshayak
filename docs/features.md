# Fraud Sahayak — Feature List

**Status legend:** Implemented = a code path exists, not a production certification. Partial = material limitations remain. Simulation = no external communication. Proposed = future government rollout.

## Current product

| Feature | Status | Scope / limitation |
|---|---|---|
| Private authenticated case workspaces | Implemented | Clerk-backed, owner-scoped access |
| English and Telugu text intake | Implemented | Language support needs broader independent evaluation |
| Helpline entry: press 1 / press 2 | Simulation | Browser menu, not a live telephone number |
| WhatsApp-style chat and invitation | Simulation | No live WhatsApp sender or delivery |
| Browser voice entry | Implemented | Short audio transcription; review before sending |
| Spoken questions | Implemented | Depends on available matching browser voice |
| Adaptive intake | Implemented | Extract facts across short replies; ask for gaps |
| Category-specific checklists | Implemented | 16 app scenarios; not 16 official portal categories |
| Model-assisted classification | Implemented | Suggestions and confidence are not proof of fraud |
| Financial review | Partial | Basic loss, transaction and consistency checks; not forensic verification |
| Local image OCR / PDF extraction | Partial | Extraction errors possible; evidence needs user review |
| Secret warnings and redaction | Partial | Best effort; not comprehensive data-loss prevention |
| Facts confirmation | Implemented | Separate from approving the final draft |
| Complaint generation and editing | Implemented | Preparation aid, not legal advice or official registration |
| Approval and stale-draft blocking | Implemented | Current facts must match the reviewed draft |
| PDF / JSON export | Implemented | App-generated documents, not government-issued receipts |
| Agent activity records | Partial | Execution summaries/polling, not complete immutable event history |
| App ticket and SMS outbox | Simulation | Local reference, not an official acknowledgement |
| Bank pre-visit packet | Simulation | Prepared with consent; not delivered to a bank |
| Official filing guidance | Implemented | Victim submits through the official channel |
| Acknowledgement recording | Partial | User-entered and unverified |
| Illustrated process video | Implemented | Fictional walkthrough, not proof of a live integration |

## Proposed government service

- Integrate with a government-owned, authorised WhatsApp Business number.
- Add live IVR/call intake with approved recording and processing consent.
- Add approved SMS templates, real delivery receipts and retry handling.
- Provide a government operator review/escalation console.
- Hand over approved case packets to verified bank recipients with granular consent.
- Connect official submission/status APIs only where expressly authorised.
- Add durable evidence storage, tenant isolation, retention/deletion, operational monitoring, recovery procedures and load validation.

## Explicit exclusions

No guaranteed accuracy or recovery; no automatic freezing/reversal of funds; no impersonation of 1930; no bypass of OTP/captcha; no assumption of government or bank partnership; no claim that a WhatsApp invitation or local ticket constitutes official filing.

See [detailed audit](feature-audit.md) for implementation gaps, [business requirements](business-requirements.md) for acceptance criteria, and [category reference](financial-fraud-reference.md) for collection guidance.
