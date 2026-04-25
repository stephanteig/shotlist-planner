# Markr — context for Claude Code

Shot-list planner for filmmakers. Same React + TypeScript codebase ships as a web
app (Azure Container Apps) and a desktop app (Tauri, Mac + Windows).

**Live web:** https://ca-markr.niceflower-81b78cd5.norwayeast.azurecontainerapps.io
**Owner:** stephanteig

## Critical context

These are things that have cost real time to debug. Don't relearn them.

### 1. Desktop OAuth uses Rust PKCE, not Firebase popup

`signInWithPopup` does NOT work in Tauri — `tauri://localhost` can't be authorized
in Firebase. The desktop sign-in flow:

1. `src/lib/auth-desktop.ts` calls a Rust `start_oauth_listener` command
2. `src-tauri/src/lib.rs` binds an ephemeral 127.0.0.1 port and opens the system
   browser to Google's OAuth URL
3. Google redirects back to the local port; Rust parses the code and emits a Tauri event
4. JS exchanges the code for tokens and signs into Firebase via `signInWithCredential`

If you find yourself suggesting `signInWithPopup` for the desktop path, stop and re-read
`src/lib/auth-desktop.ts` and the README "Desktop OAuth (PKCE)" section.

### 2. API routing differs by environment

| Environment | Frontend calls | How it reaches Hono |
|---|---|---|
| Web in prod (ACA) | `/api/projects` (relative) | Same container serves static + API |
| Web in local dev (compose) | `/api/projects` (relative) | Vite dev server proxies via `server.proxy` |
| Tauri desktop | `${VITE_API_URL}/api/projects` | `VITE_API_URL` baked at build time |

`VITE_API_URL` is a GitHub secret consumed by `.github/workflows/build-desktop.yml`.
Don't introduce per-environment branches in `src/lib/api.ts` — the table above is the
contract; `api.ts` just prefixes `import.meta.env.VITE_API_URL ?? ""`.

### 3. Backend is bundled by esbuild, not emitted by tsc

`build:server` runs `esbuild ... --bundle --format=esm`, NOT `tsc -p`. tsc with
`moduleResolution: bundler` emits relative imports without `.js` extensions, which Node
20 ESM rejects at runtime with `ERR_MODULE_NOT_FOUND`. Don't change `build:server` back
to tsc emit. `tsconfig.server.json` is typecheck-only (`noEmit: true`).

### 4. Azurite needs `--skipApiVersionCheck`

The Azure SDK 12.31 sends API version `2026-02-06`. Default Azurite rejects it. Both
`compose.yaml` and `.github/workflows/ci.yml` pass the flag. If you launch Azurite
ad-hoc:

```bash
docker run -d -p 10000:10000 mcr.microsoft.com/azure-storage/azurite \
  azurite-blob --blobHost 0.0.0.0 --skipApiVersionCheck
```

### 5. The `_userId` arg in the api client is unused

`fetchCloudProjects(_userId)`, `upsertCloudProject(_userId, project)`, and
`deleteCloudProject(_userId, projectId)` take a userId but ignore it — the Hono backend
uses the `uid` from the verified Firebase ID token, not anything in the URL or body. The
arg is preserved because `projectStore.ts` still passes `sync.userId!` to keep the call
sites identical to the old `firestore.ts`. Don't remove the args without also editing
the store call sites.

### 6. `npm run dev`, not `docker compose up`

Compose's `${...}` interpolation in `compose.yaml` doesn't read `env_file: .env.local`;
it only reads from the host shell or a top-level `.env`. The `npm run dev` script wraps
`docker compose --env-file .env.local up` so interpolation works. Running
`docker compose up` directly will crash the backend with `Missing required env var:
FIREBASE_PROJECT_ID`.

## How it fits together

```
Browser / Tauri → Firebase Auth → ID token
                                    │
            HTTPS  Authorization: Bearer <token>
                                    ▼
        Azure Container App (single container, Hono)
                ├─ /        → React bundle (dist/client)
                └─ /api/*   → verify token, then blob CRUD
                                    │
                                    ▼
                Azure Blob Storage container `projects`
                  users/{uid}/projects/{id}.json
```

Resources live in resource group `rg-markr` (Norway East) on a personal Azure
subscription. Backend authenticates to storage via a user-assigned Managed Identity —
no secrets in the container.

## Conventions

- **PRs only.** No direct commits to `main`. Formal branch protection isn't applied yet
  (issue #3); treat it as binding anyway.
- **Conventional Commits:** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `ci:`,
  `test:`. Scopes seen in history: `(server)`, `(lib)`, `(infra)`. Match the pattern.
- **Terse code.** No speculative abstractions, dead args, or future-proofing branches.
  Three similar lines beats a premature helper. If a fix can be done in 10 lines or 50,
  take the 10.
- **Tests first** for backend modules. Real Azurite, real signed JWTs (see
  `src/server/__tests__/fixtures.ts`) — no mocks for our own infrastructure.
- **`npm run check && npm test` is the canonical pre-flight.** Don't claim work is done
  without running both. CI runs the same commands.

## Tech debt — already triaged

- **Issue #3** — apply branch protection rule (admin-only)
- **Issue #4** — clean up 41 pre-existing Biome lint warnings (deferred React refactor)
- **Issue #5** — shrink prod Docker image (~215 MB of frontend deps in runtime)

If `npm run check` flags something in `src/components/`, `src/pages/`, or pre-existing
`src/lib/` files that's covered by issue #4's warning list, leave it alone. That
refactor is sequenced and out of scope for unrelated work.

## Where to look

- `docs/superpowers/specs/2026-04-24-azure-deployment-design.md` — the design this
  codebase shipped against. Read for architecture questions.
- `docs/superpowers/plans/2026-04-24-azure-deployment.md` — the implementation plan.
  Useful as a reference for how something was built.
- `infra/main.bicep` — every Azure resource is declared here. `deploy.yml` re-applies
  it idempotently on every push to `main`.
- `compose.yaml` + `Dockerfile.dev` — local dev stack.
- `Dockerfile` — production multi-stage build. CMD is `node dist/server/index.js`
  (the esbuild bundle).
- `.github/workflows/` — `ci.yml` (PR checks), `deploy.yml` (push-to-main → ACA),
  `build-desktop.yml` (`v*` tag → Mac/Windows installers).

## Non-obvious operational facts

- Firebase Auth domain allowlist includes the ACA URL. If a custom domain is mapped to
  ACA later, add it: Firebase Console → Authentication → Settings → Authorized domains.
- The deploy SP needs **User Access Administrator** on `rg-markr` (in addition to
  Contributor) so Bicep can create the role assignment that grants the managed identity
  blob access. If `rg-markr` is ever recreated from scratch, redo this.
- GHCR package is private; ACA pulls using a fine-grained PAT stored as the
  `GHCR_PULL_TOKEN` secret. The PAT expires — set a calendar reminder.
- GitHub Actions variables (public): `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
  `AZURE_SUBSCRIPTION_ID`, `GHCR_USERNAME`. Secrets: `VITE_FIREBASE_*`,
  `VITE_GOOGLE_DESKTOP_*`, `VITE_API_URL`, `GHCR_PULL_TOKEN`.
