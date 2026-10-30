# Fraud Sahayak — Government Business Use Case

## Business model

**The business sells Fraud Sahayak to government. Government would scale the service and integrate it with its authorised government WhatsApp number.** This is the intended commercial model, not an existing sale, contract, endorsement or integration.

The citizen-facing service helps victims describe financial incidents in English or Telugu, preserve facts, provide evidence, review a structured complaint and approve it before the authorised next step. Government procurement and operation should determine the final hosting, identity, channels and data policies.

## Problem and value

Victims may be distressed, have incomplete transaction information, speak a regional language, or have to repeat their story across call centres, portals and banks. Structured, consented intake can reduce repeated questioning and improve the completeness of a review-ready packet. These benefits are hypotheses to measure in a pilot, not validated savings or recovery claims.

| Stakeholder | Intended value |
|---|---|
| Victim | Accessible language choice, voice/text options, fewer repeated questions and a reviewed written account |
| Government helpline / cybercrime team | More structured intake, triage cues and human escalation |
| Authorised reviewing officer | Visible missing fields, evidence index and approval trail |
| Bank fraud desk | Consented pre-visit summary without replacing bank identity checks |
| Procurement / programme owner | Measurable pilot outcomes, security review and controlled rollout |

## Primary journey

1. A victim calls the authorised service. Urgent guidance directs them to the bank and 1930 without waiting for drafting.
2. The service offers press 1 for WhatsApp intake or press 2 for continued voice intake.
3. WhatsApp routing requests the recipient number, explains use and records opt-in before sending.
4. The assistant collects a short account, extracts stated facts and asks only relevant missing questions.
5. The victim reviews transaction facts and corrections; uncertain details stay marked unknown.
6. A complaint is drafted and explicitly approved. Unapproved or outdated drafts cannot be submitted.
7. If authorised interfaces exist, the approved packet goes to the official service; otherwise the victim receives guided manual filing.
8. A local assistance ticket is distinguished from the official acknowledgement. Verified status comes only from an authorised source.
9. With separate sharing consent, a bank handover reduces repeat explanation. Bank forms, identification and statutory obligations still apply.

The current prototype simulates channel delivery and bank handover. It does not perform steps involving real providers or official submission.

## Commercial options for procurement

Proposed options, subject to buyer requirements:

- A time-bound, paid pilot with defined scope and acceptance criteria.
- An annual software licence/support agreement plus separately priced implementation.
- A managed service with a contracted capacity band and agreed operating responsibilities.

No price, revenue, government budget or procurement award is asserted. Telephony, WhatsApp/SMS, model use, hosting, storage, monitoring, security assessment, training and support costs need to be estimated separately. Ownership of source code, deployment rights, data and exit assistance must be negotiated explicitly.

## Responsibilities

| Party | Proposed responsibility |
|---|---|
| Vendor | Software delivery, documented limits, integration adapters, testing, support and agreed remediation |
| Government buyer/operator | Authorised numbers, lawful purposes, operating policy, officer access, escalation and procurement approvals |
| Channel/model/hosting providers | Contracted service operation and processing within approved terms |
| Banks / official systems | Verify recipients, accept only authorised handovers and issue their own acknowledgements |

## Rollout and measurable outcomes

1. **Discovery:** agree authority, lawful processing, threat model, channel/API access and baseline metrics.
2. **Sandbox:** synthetic data, signed test webhooks and no official filing.
3. **Limited pilot:** supervised citizen use only after security/privacy and operational approval.
4. **Controlled scale-up:** load tests, queue recovery, operator training, support and rollback readiness.

Measure confirmed-draft completion rate, median/p95 intake time, repeated-question rate, user correction rate, unsupported-fact rate, bilingual comprehension, escalation rate and delivery success. Report denominators and failure cases. Do not use app-ticket counts as official complaint counts or claim recovered funds without independent confirmation.

## Key risks

Incorrect extraction, mistaken transfers being treated as fraud, digital exclusion, voice mistranscription, unlawful evidence sharing, forged messages, provider outages and premature filing. Controls include explicit corrections/approval, human review, accessible alternatives, verified recipients, least-privilege access and transparent draft/submission status.

See [BRD](business-requirements.md) for procurement requirements and [architecture](architecture.md) for implementation boundaries.
