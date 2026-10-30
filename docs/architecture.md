# Fraud Sahayak — Architecture

## Scope and status

This document separates the **implemented prototype** from the **proposed government-operated service**. The supplied architecture image is a target concept, not evidence of live government connectivity. The orchestrator uses LangGraph from the LangChain ecosystem. The primary case model is accessed through Replit OpenAI integration; the historical filename `gemini-agent.ts` does not identify the active provider.

[View the standalone architecture diagram](architecture.svg).

## Implemented architecture

```mermaid
flowchart TD
    U["Victim: English / Telugu"] --> H["Browser helpline simulation"]
    H --> W["1: WhatsApp-style web chat"]
    H --> C["2: Browser spoken intake"]
    W --> UI["React / Vite web client"]
    C --> UI
    UI --> AUTH["Clerk authentication"]
    UI --> API["Express API: owner-scoped cases and validation"]
    API --> G["LangGraph conversation workflow"]
    K["Sourced category guide + deterministic completeness rules"] --> G
    G --> I["Conversation intake and classification"]
    I --> F["Financial review when facts are complete"]
    G --> AI["Replit OpenAI: user-entered text facts"]
    API --> STT["Replit OpenAI speech transcription; review before sending"]
    API --> E["Local image OCR / PDF text extraction"]
    E --> EC["Evidence checks and gap summaries"]
    F --> D["Complaint preparation"]
    EC --> D
    D --> R["Victim review and explicit draft approval"]
    R --> OUT["PDF / JSON export and official filing guidance"]
    OUT --> P["User submits on official portal"]
    P --> REF["User records acknowledgement: unverified"]
    API --> DB[("PostgreSQL: cases, messages, consent and activity")]
    API --> FS[("Local evidence files: production durability gap")]
```

The six responsibilities in the concept image are conversation, classification, financial analysis, evidence checks, complaint writing and reporting/tracking. They are **not six independent always-running workers**. The current graph coordinates conversation, classification and financial review; evidence, drafting and reporting also run through API-driven helpers. Deterministic gates, templates and local extraction complement model-assisted steps.

## Trust and data boundaries

| Data | Current processing | Boundary |
|---|---|---|
| Typed incident facts | API, database, model-assisted intake/review | Best-effort secret redaction; never ask for OTP/PIN/CVV/passwords |
| Short voice recordings | OpenAI transcription | External processing; user reviews transcript before sending |
| Images, PDFs and extracted OCR text | Local service extraction | Do not send evidence bytes or OCR text to external models |
| Evidence file bytes | Server filesystem | Not durable enough for an autoscaling production evidence store |
| Drafts and approval | Application and database | Approval is not government submission |
| Ticket / bank packet | Application simulation | No proof of SMS delivery or bank receipt |
| Official acknowledgement | Entered by user | Unverified unless a future authorised connector verifies it |

## Proposed government deployment

```mermaid
flowchart TD
    V["Victim"] --> TEL["Authorised helpline / IVR"]
    TEL -->|"1 + explicit opt-in"| WA["Government-owned WhatsApp Business number"]
    TEL -->|"2 + recording consent"| CALL["Live voice intake"]
    WA --> GW["Signed webhook gateway + deduplication + abuse controls"]
    CALL --> GW
    GW --> Q["Durable queue + bounded retries + human escalation"]
    Q --> CORE["Government-approved case orchestration"]
    CORE --> PERSON["Victim fact confirmation and draft approval"]
    PERSON --> OFF["Authorised official filing adapter, if approved"]
    OFF --> ACK["Verified acknowledgement / status events"]
    CORE --> BANK["Consented verified bank handover"]
    CORE --> STORE[("Durable encrypted evidence store + case database")]
    CORE --> OPS["Operator console, audit, monitoring and retention"]
```

**All components in this second diagram are a target deployment design, not a claim of delivery.** Provider contracts, government authorisation, approved models/hosting, lawful processing and API access must precede integration. Do not automate portal OTP/captcha or claim an official reference from a local ticket.

## Deployment considerations

- Existing services: API at `/api`, web application at `/`, illustrative video at `/fraud-sahayak-walkthrough/`.
- PostgreSQL holds structured state. Do not depend on process memory for cross-instance case continuity.
- Move production evidence to an approved durable store before real-world rollout; preserve the local-extraction privacy boundary.
- Add durable delivery jobs, idempotency keys and verified provider receipts for real messaging.
- Government tenancy, operator roles, disaster recovery, retention enforcement, comprehensive immutable audit and load validation require further implementation.
- Consult [installation](installation-guide.md), [feature status](features.md), and [business requirements](business-requirements.md) before procurement or launch.
