# fraudshayak

**Fraud Sahayak** is an English/Telugu financial-fraud complaint preparation app. It helps people describe an incident, organise evidence, review reported losses, and prepare a complaint for user-controlled filing with India's National Cyber Crime Reporting Portal.

## Features

- Private, authenticated case workspaces using Clerk.
- Chat and browser voice dictation, with transcript review before sending.
- Replit OpenAI-assisted intake, classification and case review.
- A sourced questionnaire covering 16 financial-fraud categories/scenarios.
- Local screenshot/PDF extraction and basic financial consistency checks.
- Missing-detail checks, explicit fact confirmation and stale-draft protection.
- Editable complaint drafts, approval, PDF/JSON export and official filing guidance.
- Agent execution records and user-reported acknowledgement recording.

**Important:** This is not a government service. It does not automatically file complaints, verify official case progress, freeze funds or guarantee recovery. Users submit complaints themselves through [cybercrime.gov.in](https://www.cybercrime.gov.in/). For urgent financial cybercrime, contact the bank and **1930** without waiting to finish this app.

## Repository layout

| Directory | Purpose |
|---|---|
| `artifacts/fraud-sahayak` | React/Vite web app |
| `artifacts/api-server` | Express API and case-agent workflow |
| `artifacts/mockup-sandbox` | Design/component preview sandbox |
| `lib/db` | PostgreSQL/Drizzle schema |
| `lib/api-spec` | OpenAPI contract and code generation |
| `lib/api-client-react` | Generated client and React hooks |
| `lib/api-zod` | Generated validation schemas |
| `lib/integrations-openai-ai-server` | Replit OpenAI client |
| `docs` | Feature audit and sourced complaint guidance |

## Setup

Use **Node.js 24** and **pnpm**.

```sh
pnpm install
pnpm run typecheck
```

Configure credentials through your environment's secrets manager; never commit them:

- `DATABASE_URL`
- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `SESSION_SECRET`

The existing OpenAI client expects Replit AI Integrations configuration. Do not assume a standard provider API key alone replaces that configuration.

For a newly configured **development** database, review and apply the schema:

```sh
pnpm --filter @workspace/db run push
```

This command can change a database schema. Do not run it against production without reviewing your deployment/migration process.

On Replit, use the included artifact service configuration. For manual development, each service needs its own port:

```sh
# API terminal
PORT=8080 pnpm --filter @workspace/api-server run dev

# Web terminal
PORT=25915 BASE_PATH=/ pnpm --filter @workspace/fraud-sahayak run dev
```

The frontend uses same-origin `/api` routes. Outside the included artifact router, configure a reverse proxy that routes `/api` to the API server and other application paths to the web server. Configure Clerk for your application origin.

## Documentation and checks

- [Feature audit and implementation limitations](docs/feature-audit.md)
- [Financial fraud categories, collection details and filing steps](docs/financial-fraud-reference.md)
- Agent reference data: `artifacts/api-server/src/fraud/knowledge/financial-fraud.json`

```sh
pnpm run typecheck
node --test artifacts/fraud-sahayak/src/lib/draft-readiness.test.mjs
pnpm --filter @workspace/api-server exec esbuild \
  src/fraud/knowledge/requirements.test.ts \
  --bundle --platform=node --format=cjs \
  --outfile=/tmp/fraud-requirements.test.cjs
node --test /tmp/fraud-requirements.test.cjs
```

## Privacy and security limits

Do not enter OTPs, PINs, passwords, CVVs, full card numbers or wallet seed phrases. Uploaded financial evidence and OCR text stay local to the service; reviewed voice recordings are sent to OpenAI for transcription. Text redaction is best effort, not a guarantee.

This is not a compliance certification or a fully production-hardened deployment. Review the audit document before handling real-world evidence. Database records, credentials, uploaded evidence and private Replit session/checkpoint history are not part of this source-code export.
