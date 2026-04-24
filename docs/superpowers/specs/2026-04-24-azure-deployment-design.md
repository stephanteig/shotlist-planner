# Azure deployment design

**Date:** 2026-04-24
**Status:** Approved for implementation planning

## Context

Markr is a React + Tauri shot-list planner currently hosted on GitHub Pages with Firebase Auth (Google sign-in) and Firestore (project data). The owner wants to move hosting and data to Azure under a personal subscription, add dev tooling (tests, lint, format), containerize with Docker Compose for local dev, and drive deploys from GitHub Actions.

Zero users exist today, so no data migration is needed.

## Goals

1. Host the web app in Azure Container Apps, same repo, same codebase.
2. Store project JSON in Azure Blob Storage, not Firestore.
3. Keep Firebase Auth (Google sign-in) — web and Tauri desktop — unchanged.
4. Keep Tauri desktop builds shipping from the same repo, unchanged.
5. `docker compose up` gives a working local loop with blob storage emulation.
6. CI runs tests/lint/typecheck on PRs; merges to `main` deploy automatically.
7. Total monthly cost under $10 at expected scale (dozens of users).
8. Resources isolated from the owner's work Azure subscription.

## Non-goals

- Migrating auth off Firebase. Revisit only if Firebase becomes a real constraint.
- Offline Firestore support, iOS/Android, code signing — all pre-existing deferred items.
- A refactor of the existing React code for terseness. Tracked separately; happens after Azure migration is green.
- E2E testing with Playwright. Integration tests against Azurite are enough for now.
- Rate limiting, WAF, CDN caching. Revisit when traffic exists.

## Architecture

```
 Browser SPA / Tauri desktop
      │
      │ 1. Google sign-in via Firebase Auth (unchanged)
      │ 2. HTTPS requests with Authorization: Bearer <firebase-id-token>
      ▼
 Azure Container App (single container)
   Node + Hono
   ├─ serves built React bundle at  /
   └─ API routes at                 /api/*
        ├─ verify Firebase ID token per request
        └─ read/write blobs via Managed Identity
      │
      ▼
 Azure Storage Account — blob container `projects`
   users/{uid}/projects/{projectId}.json
```

**Key invariants**

- Firebase never sees project data. It only handles identity.
- The backend trusts nothing in a request except what it re-verifies from the Firebase ID token signature (uid, email, expiration).
- No connection strings or API keys stored in the backend container. Managed Identity grants blob access; Google's public JWKS is fetched to verify tokens.
- Same container image runs in prod and local dev. Only the blob client credential differs.

**Data flow — save a project**

Frontend debounces 1.2s → `PUT /api/projects/:id` with Firebase ID token → backend verifies token (signature, audience, expiry) → writes blob at `users/{uid}/projects/:id.json`.

**Data flow — load on sign-in**

Frontend → `GET /api/projects` with token → backend lists `users/{uid}/projects/` prefix → returns array → frontend merges with localStorage by `updatedAt`.

## Components

### Backend (`src/server/`)

Hono app with four small modules:

| File | Purpose | Approx. lines |
|---|---|---|
| `index.ts` | Hono app wiring, static file serve, route registration | ~30 |
| `auth.ts` | Firebase ID token verification middleware (JWKS cached) | ~40 |
| `blob.ts` | Blob client factory (Azurite vs DefaultAzureCredential), CRUD helpers | ~50 |
| `routes.ts` | `GET /api/projects`, `PUT /api/projects/:id`, `DELETE /api/projects/:id` | ~40 |

### Frontend

`src/lib/firestore.ts` → `src/lib/api.ts` with the same three functions (`fetchCloudProjects`, `upsertCloudProject`, `deleteCloudProject`). Store code (`projectStore.ts`) does not change. All callers keep working.

The `api.ts` client attaches the Firebase ID token as `Authorization: Bearer <token>` on every request via `auth.currentUser.getIdToken()`.

### Tauri desktop

No code changes required beyond the shared `api.ts` swap. Rust OAuth listener stays as-is. Desktop builds need `VITE_API_URL` at build time pointing at the deployed ACA URL — there's no same-origin fallback because the frontend runs off a `tauri://` scheme. Added to the `build-desktop.yml` secrets.

### API routing by environment

| Environment | Frontend calls | How |
|---|---|---|
| Web in prod (ACA) | `/api/projects` (relative) | Same container serves static + API — same origin |
| Web in local dev (compose) | `/api/projects` (relative) | Vite dev server proxies `/api/*` → `http://localhost:8080` via `server.proxy` in `vite.config.ts` |
| Tauri desktop | `${VITE_API_URL}/api/projects` | `VITE_API_URL` baked in at build time; points at ACA prod URL |

This keeps the frontend code path identical for web dev and web prod (relative URLs, no CORS). Only Tauri needs the absolute URL env var.

## Error handling

Backend errors map to HTTP status directly:

- Missing or invalid token → `401`
- Token valid but user tries to access `users/{other-uid}/*` → `403`
- Blob not found on `GET`/`DELETE` → `404`
- Azurite/Storage transient failure → `502` with a log line; client retries once
- Malformed JSON body → `400`

Frontend treats `401` as "session expired" and triggers sign-out. All other errors surface via the existing `toast()` helper.

No custom error-class hierarchy. Throw standard `Error` with a message; Hono middleware maps it to a response.

## Azure resources

All in **Norway East**, resource group **`rg-markr`** on the owner's personal subscription.

| Resource | Name | SKU | Purpose |
|---|---|---|---|
| Resource group | `rg-markr` | — | Isolation boundary |
| Storage account | `stmarkr<4-char-suffix>` | Standard_LRS | Blob container `projects` |
| Log Analytics workspace | `log-markr` | Pay-as-you-go | Required by ACA |
| Container Apps environment | `cae-markr` | Consumption | Managed host |
| Container App | `ca-markr` | min=0, max=2 | Runs the Node image |
| User-assigned managed identity | `id-markr` | — | ACA → Storage auth |

The managed identity `id-markr` is assigned the **Storage Blob Data Contributor** role scoped to the storage account.

The GitHub Actions federated credential is assigned **Contributor** on `rg-markr` only, never on the subscription.

**Expected monthly cost:** $0.10 idle, $2–5 under light use.

**Provisioning:** single `infra/main.bicep` file, applied idempotently on every deploy via `az deployment group create`. Bicep chosen over Terraform because Azure-only + no state backend to manage; ~30 lines of declarative resource definitions.

## Container registry

Images pushed to **GHCR** (`ghcr.io/stephanteig/markr:<sha>`). Free for the owner's repo. ACA pulls using a one-time fine-scoped PAT set via `az containerapp registry set`. No ACR resource.

Swapping to ACR later is a ~10-line Bicep change plus one workflow edit if the cost tradeoff shifts.

## Dev tooling

| Concern | Tool | Config |
|---|---|---|
| Tests | Vitest | Entry in `vite.config.ts` |
| Lint + format | Biome | `biome.json` |
| Typecheck | `tsc --noEmit` | Existing `tsconfig.json` |

**Test scope:**
1. **Backend integration tests** (`src/server/__tests__/*.test.ts`) — Vitest hitting real HTTP endpoints with Azurite running in Docker. Covers token validation, CRUD against real blob storage, authorization (user A can't read user B's blobs). ~5 files.
2. **Frontend unit tests** for logic modules — `mergeProjects`, JSON import/export parsing, api-client token attachment. Not components. ~3 files.

**Scripts (`package.json`):**

```
npm run dev         # docker compose up with live reload
npm run test        # vitest run
npm run test:watch  # vitest
npm run check       # biome check --apply && tsc --noEmit
npm run build       # build frontend + backend into dist/
```

**Explicitly excluded:** husky, lint-staged, commitlint, Renovate, Codecov, semantic-release, Playwright.

## Local development

`compose.yaml` defines two services:

- `azurite` (Microsoft's storage emulator image) — exposes blob port `10000`.
- `app` — built from `Dockerfile.dev`, source-mounted, runs Vite on `5173` and Hono on `8080` via `concurrently`.

Developer workflow:

1. `cp .env.example .env.local`, fill in `VITE_FIREBASE_*`.
2. `docker compose up` — everything starts.
3. Open `http://localhost:5173`.
4. `docker compose down -v` resets all local state.

**Blob credential branches on env:**

```ts
const client = process.env.AZURITE_CONNECTION
  ? BlobServiceClient.fromConnectionString(process.env.AZURITE_CONNECTION)
  : new BlobServiceClient(
      `https://${process.env.STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
      new DefaultAzureCredential()
    );
```

Azurite uses a well-known public connection string — not a secret.

**Two Dockerfiles:**

- `Dockerfile` — multi-stage production build. Stage 1 runs `vite build`; stage 2 runs `tsc` on the server; final `node:20-alpine` image contains both. This runs in ACA.
- `Dockerfile.dev` — single stage, installs deps, runs `npm run dev`.

## CI/CD

Three workflows live in `.github/workflows/`:

| File | Status | Trigger | Job |
|---|---|---|---|
| `ci.yml` | **new** | `pull_request` → `main` | `npm ci && npm run check && npm run test` |
| `deploy.yml` | **new** | `push` → `main` | Build image, push to GHCR, apply Bicep, update ACA |
| `build-desktop.yml` | unchanged | tag `v*` | Mac + Windows installers |
| `deploy-pages.yml` | **delete at cutover** | — | Kept until first ACA deploy is verified, then removed in its own PR |

**`deploy.yml` steps:**

1. `azure/login@v2` via federated OIDC (no client secret)
2. `docker buildx build` + `docker push ghcr.io/stephanteig/markr:<sha>`
3. `az deployment group create -f infra/main.bicep` (idempotent, catches drift)
4. `az containerapp update -n ca-markr --image ghcr.io/stephanteig/markr:<sha>`

**Secrets inventory after migration:**

| Location | What | Notes |
|---|---|---|
| GitHub Actions **variables** (public) | `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | Not secret — federated OIDC |
| GitHub Actions **secrets** | `VITE_FIREBASE_*` (6), `VITE_GOOGLE_DESKTOP_*` (2) | Baked into frontend bundle at build time |
| Azure Container App env | `STORAGE_ACCOUNT_NAME`, `BLOB_CONTAINER_NAME` | Not secret |
| GHCR registry pull | Fine-scoped PAT set once via `az containerapp registry set` | Rotated manually |

**Branch protection** (set once via `gh api`):

- `main` requires PR (no direct push) and passing `ci.yml`.
- At least one approving review on each PR.

## Out of scope

- **Terseness refactor of existing React code.** Separate follow-up spec. Ship Azure migration with tests green first; refactor after under test coverage.
- Auth migration to Azure Entra External Identities.
- Firestore data export tooling (no data to export).

## Risks and open questions

- **Firebase ID token clock skew.** Tokens expire after 1 hour; frontend must refresh via `getIdToken(true)` on 401. Handled by the api client wrapper.
- **Cold start on ACA with min=0.** First request after idle can take 2–5 seconds. Acceptable at expected usage; revisit min=1 if users complain.
- **GHCR pull PAT rotation.** No automatic rotation today. Add a calendar reminder if the PAT is scoped with expiry.
- **Stephan is solo for now** — "1 approving review" on PRs means he'd need a second GitHub account or branch-protection exception. Decide at implementation time: either require review when a collaborator exists, or start with just "passing CI" as the gate.

## Implementation order

The implementation plan should be written by the `writing-plans` skill. The phases below are a suggested sequence; the plan will firm them up:

1. **Backend scaffold** — Hono app, `auth.ts`, `blob.ts`, `routes.ts`, integration tests green locally against Azurite.
2. **Frontend api client** — swap `firestore.ts` for `api.ts`, unit tests for merge + parsing.
3. **Docker + Compose** — `Dockerfile`, `Dockerfile.dev`, `compose.yaml`. `docker compose up` boots end-to-end locally.
4. **Tooling** — `biome.json`, Vitest wiring, npm scripts, remove any lint-unsafe patterns the Biome pass finds.
5. **Bicep** — `infra/main.bicep` with all Azure resources.
6. **CI workflow** — `ci.yml`, replace `deploy-pages.yml` wiring.
7. **Deploy workflow** — `deploy.yml` with OIDC federation, image push, Bicep apply, ACA update.
8. **Branch protection** — `gh api` commands documented and applied.
9. **Cutover** — first successful deploy, manual smoke test, delete `deploy-pages.yml`.

Each phase should land in its own PR so CI gates every step.
