# Fraud Sahayak — Installation Guide

## 1. Prerequisites

- Node.js **24**, pnpm **10** compatible with the lockfile, Git and PostgreSQL.
- A configured Clerk application.
- Access to the Replit OpenAI integration used by this project.
- A same-origin application router or reverse proxy.

These instructions run the prototype. They do not provision a government phone number, WhatsApp sender, SMS service or cybercrime portal integration.

## 2. Get the source

```sh
git clone https://github.com/Subhash-04/fraudshayak.git
cd fraudshayak
pnpm install --frozen-lockfile
```

Do not replace pnpm with npm or create a second lockfile. Installation needs access to the package registry.

## 3. Configure environment variables

Use the deployment platform's secrets manager or a securely injected local process environment. Do not put credentials into source control or a client bundle.

| Variable | Consumer / purpose |
|---|---|
| `DATABASE_URL` | API and database tooling: PostgreSQL connection |
| `CLERK_SECRET_KEY` | API: Clerk authentication |
| `CLERK_PUBLISHABLE_KEY` | Clerk server-side configuration |
| `VITE_CLERK_PUBLISHABLE_KEY` | Web build: public Clerk identifier, not a secret |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | API: integration credential |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | API: integration endpoint |
| `SESSION_SECRET` | Existing environment/session configuration |
| `PORT` | Per-service port; use a different port for each service |
| `BASE_PATH` | Frontend public routing prefix |

The AI client is integration-specific. A normal OpenAI key alone is not a documented drop-in replacement. Configure Clerk's allowed origins for the development and published domains. Changing a `VITE_` variable requires rebuilding the frontend.

## 4. Initialise a development database

After setting `DATABASE_URL` to a **new development database**, inspect the schema under `lib/db/src/schema`, then run:

```sh
pnpm --filter @workspace/db run push
```

This changes the selected database schema. Never point it at production casually; review changes, take backups and follow an approved migration procedure. Do not use a forced schema push as a troubleshooting shortcut.

## 5. Run locally

Use separate terminals with the required variables already injected:

```sh
# API
PORT=8080 pnpm --filter @workspace/api-server run dev

# Web app
PORT=25915 BASE_PATH=/ pnpm --filter @workspace/fraud-sahayak run dev

# Optional animated walkthrough
PORT=19113 BASE_PATH=/fraud-sahayak-walkthrough/ \
  pnpm --filter @workspace/fraud-sahayak-walkthrough run dev
```

On Replit, use the existing managed artifact workflows. Outside that router, configure a reverse proxy:

| Public route | Destination |
|---|---|
| `/api` and subpaths | API service on port 8080 |
| `/fraud-sahayak-walkthrough/` and subpaths | Optional video frontend |
| All remaining app paths | Main web frontend |

Serve over HTTPS for microphone access outside localhost. Speech output depends on installed English/Telugu browser voices; text intake remains available. Do not hardcode a localhost API URL into browser code.

## 6. Check and build

```sh
pnpm run typecheck
node --test artifacts/fraud-sahayak/src/lib/draft-readiness.test.mjs
pnpm --filter @workspace/api-server run build
PORT=25915 BASE_PATH=/ NODE_ENV=production \
  pnpm --filter @workspace/fraud-sahayak run build
PORT=19113 BASE_PATH=/fraud-sahayak-walkthrough/ NODE_ENV=production \
  pnpm --filter @workspace/fraud-sahayak-walkthrough run build
```

Frontend build configuration requires `PORT` and `BASE_PATH` even when generating static files. The artifact router supplies configured values; a bare shell does not.

Output locations:

- API: `artifacts/api-server/dist/index.mjs`
- Web: `artifacts/fraud-sahayak/dist/public`
- Video: `artifacts/fraud-sahayak-walkthrough/dist/public`

Production API command:

```sh
NODE_ENV=production PORT=8080 node --enable-source-maps \
  artifacts/api-server/dist/index.mjs
```

The API startup probe is `/api/healthz`. Frontends need static hosting with SPA fallback and their configured base paths. Per-artifact production settings live in `.replit-artifact/artifact.toml`; do not replace them with a development server.

## 7. Smoke check and troubleshooting

1. Verify `/api/healthz` returns HTTP 200.
2. Sign in, create a fictional case and send a short account.
3. Check that missing questions preserve prior answers.
4. Review the facts, generate a draft, then approve it explicitly.
5. Export the document and confirm it says draft/not officially filed.
6. Use only synthetic evidence until privacy, storage and security controls are approved.

| Symptom | Check |
|---|---|
| `PORT` / `BASE_PATH` required | Supply the per-service environment above |
| Login fails | Clerk keys, allowed origin, HTTPS and build-time public key |
| API calls return HTML or 404 | Reverse-proxy priority: `/api` before SPA fallback |
| Model requests fail | Integration access, endpoint configuration and provider errors |
| Database error | Correct development connection, schema and connectivity |
| No Telugu speech | Installed voice support; use text rather than a wrong-language fallback |
| Evidence disappears after restart/scale | Local filesystem limitation; implement approved durable storage |

For publishing failures, inspect the actual failed build logs. A passing local build is not proof that production credentials, storage or runtime health are correct.
