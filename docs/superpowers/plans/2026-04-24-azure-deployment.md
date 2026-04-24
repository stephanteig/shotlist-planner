# Azure Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Markr from GitHub Pages + Firestore to Azure Container Apps + Blob Storage, keeping Firebase Auth unchanged and Tauri desktop builds working.

**Architecture:** Single Node + Hono container on Azure Container Apps serves the built React bundle at `/` and API routes at `/api/*`. Project JSON blobs live in Azure Blob Storage at `users/{uid}/projects/{id}.json`, accessed via user-assigned Managed Identity. Firebase Auth continues to handle Google sign-in for web (popup) and Tauri desktop (Rust PKCE). The backend verifies Firebase ID tokens per request using Google's public JWKS; no Firebase Admin SDK, no secrets in the container.

**Tech Stack:** Node 20, Hono, TypeScript, Vitest, Biome, `jose` (JWT verify), `@azure/identity`, `@azure/storage-blob`, `@hono/node-server`, Azurite (local blob emulator), Docker, Bicep, Azure Container Apps, GitHub Actions with OIDC federation.

**Design doc:** `docs/superpowers/specs/2026-04-24-azure-deployment-design.md`

---

## Prerequisites (owner does once, outside this plan)

These are **manual** Azure/GitHub actions the repo owner performs. They produce identifiers used by the plan's later tasks.

1. **Azure subscription access.** Confirm `az account show` returns the personal subscription; `az account set --subscription <sub-id>` if needed.
2. **GitHub CLI authenticated.** `gh auth status` returns logged in.
3. **Repository collaborators:** confirmed solo. Branch-protection rule in Task 17 will not require review approvals until a collaborator exists.

No other prereqs. Azure resources are created by Task 11 (Bicep) and the OIDC federated app registration is created by Task 14.

---

## File plan

| File | Action | Responsibility |
|---|---|---|
| `package.json` | modify | Add deps, scripts |
| `tsconfig.json` | modify | Exclude `src/server/` (server uses its own config) |
| `tsconfig.server.json` | create | TS config for backend (Node target, CommonJS/ESM) |
| `biome.json` | create | Single-file lint + format config |
| `vite.config.ts` | modify | Add dev-server proxy `/api/*` → `:8080`, add Vitest config |
| `.env.example` | modify | Add Azure + API env vars |
| `src/server/index.ts` | create | Hono app, static serve, routes wiring |
| `src/server/auth.ts` | create | Firebase ID token verifier (jose + JWKS) |
| `src/server/blob.ts` | create | Blob client factory + CRUD helpers |
| `src/server/routes.ts` | create | `GET/PUT/DELETE /api/projects` |
| `src/server/env.ts` | create | Env var loader with validation |
| `src/server/__tests__/auth.test.ts` | create | Token verification tests (real crypto, test JWKS) |
| `src/server/__tests__/blob.test.ts` | create | Blob CRUD against Azurite |
| `src/server/__tests__/routes.test.ts` | create | HTTP integration tests |
| `src/server/__tests__/fixtures.ts` | create | Test helpers (make test tokens, clear container) |
| `src/lib/merge.ts` | create | Pure `mergeProjects` logic (moved from firestore.ts) |
| `src/lib/__tests__/merge.test.ts` | create | Unit tests for merge |
| `src/lib/api.ts` | create | Frontend API client (replaces firestore.ts) |
| `src/lib/__tests__/api.test.ts` | create | api client unit tests (mock fetch) |
| `src/lib/firestore.ts` | delete | Replaced by api.ts |
| `src/store/projectStore.ts` | modify | Import from `@/lib/api` and `@/lib/merge` instead of `@/lib/firestore` |
| `Dockerfile` | create | Multi-stage prod build |
| `Dockerfile.dev` | create | Dev image (source-mounted) |
| `compose.yaml` | create | `azurite` + `app` services |
| `.dockerignore` | create | Exclude node_modules, dist, .git |
| `infra/main.bicep` | create | All Azure resources |
| `infra/parameters.json` | create | Bicep parameters (region, names) |
| `.github/workflows/ci.yml` | create | PR lint + typecheck + tests |
| `.github/workflows/deploy.yml` | create | Main push → build + push image + apply Bicep + update ACA |
| `.github/workflows/build-desktop.yml` | modify | Add `VITE_API_URL` secret for Tauri builds |
| `.github/workflows/deploy-pages.yml` | delete at cutover | Replaced by `deploy.yml` |
| `README.md` | modify | Update dev instructions for `docker compose up` flow |

---

## Phase 1 — Dev tooling

### Task 1: Install backend + tooling dependencies

**Files:**
- Modify: `package.json` (root)

Adds Hono, Azure SDKs, JWT lib, test runner, linter, and related dev deps. No new source files yet — just make them installable.

- [ ] **Step 1: Run install commands**

```bash
npm install hono @hono/node-server jose @azure/identity @azure/storage-blob
npm install -D vitest @biomejs/biome tsx concurrently @types/node undici
```

- [ ] **Step 2: Verify package.json shape**

Open `package.json` and confirm these entries exist under `dependencies`:

```
"hono": "^4.x",
"@hono/node-server": "^1.x",
"jose": "^5.x",
"@azure/identity": "^4.x",
"@azure/storage-blob": "^12.x"
```

And under `devDependencies`:

```
"vitest": "^1.x",
"@biomejs/biome": "^1.x",
"tsx": "^4.x",
"concurrently": "^8.x",
"@types/node": "^20.x",
"undici": "^6.x"
```

Actual patch versions will differ; majors should match.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add backend and tooling dependencies"
```

---

### Task 2: Add Biome config, Vitest config, server tsconfig, npm scripts

**Files:**
- Create: `biome.json`
- Create: `tsconfig.server.json`
- Modify: `tsconfig.json`
- Modify: `vite.config.ts`
- Modify: `package.json` (scripts section)

- [ ] **Step 1: Write `biome.json`**

Exact file contents:

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "files": {
    "ignore": ["dist/**", "node_modules/**", "src-tauri/target/**", "pages-repo/**"]
  },
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": { "noNonNullAssertion": "off" },
      "suspicious": { "noExplicitAny": "warn" }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": { "quoteStyle": "double", "trailingCommas": "es5" }
  }
}
```

- [ ] **Step 2: Write `tsconfig.server.json`**

Exact contents:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["node", "vitest/globals"],
    "outDir": "./dist/server",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": false,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src/server/**/*.ts", "src/types/**/*.ts", "src/lib/merge.ts"],
  "exclude": ["src/server/__tests__/**", "node_modules", "dist"]
}
```

Note: `merge.ts` is shared between frontend and backend, so the server tsconfig includes it. Tests are excluded from build but included for typecheck via Vitest.

- [ ] **Step 3: Modify `tsconfig.json` to exclude server code**

Change the existing `"include": ["src"]` line to exclude the server directory so the frontend typecheck doesn't try to compile it:

```json
"include": ["src"],
"exclude": ["src/server"],
```

The root `tsconfig.json` now only covers frontend code; `tsconfig.server.json` covers backend code and shared utilities.

- [ ] **Step 4: Update `vite.config.ts` — add dev proxy and Vitest config**

Change the existing file to:

```ts
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? "/shotlist-planner/" : "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: false,
      },
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: ["es2021", "chrome100", "safari15"],
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore"],
          vendor: ["react", "react-dom", "react-router-dom"],
          dnd: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/__tests__/*.test.ts", "src/**/*.test.ts"],
    exclude: ["node_modules", "dist", "src-tauri"],
    testTimeout: 15000,
  },
});
```

The `server.proxy` entry makes browser fetches to `/api/*` transparently proxy to the Hono backend at `:8080` during dev.

- [ ] **Step 5: Update `package.json` scripts**

Replace the existing `scripts` block with:

```json
"scripts": {
  "dev": "docker compose up",
  "dev:web": "vite",
  "dev:server": "tsx watch src/server/index.ts",
  "dev:all": "concurrently -n vite,server \"npm:dev:web\" \"npm:dev:server\"",
  "vite:dev": "vite",
  "vite:build": "vite build",
  "build:server": "tsc -p tsconfig.server.json",
  "build": "npm run build:server && npm run vite:build",
  "start": "node dist/server/index.js",
  "test": "vitest run",
  "test:watch": "vitest",
  "check": "biome check . && tsc --noEmit && tsc --noEmit -p tsconfig.server.json",
  "check:fix": "biome check --apply . && tsc --noEmit && tsc --noEmit -p tsconfig.server.json",
  "tauri": "tauri",
  "tauri:dev": "tauri dev",
  "tauri:build": "tauri build"
}
```

The old `"tauri"` script called `tauri`; that's preserved as an alias. `dev` is the new compose-driven flow; `dev:all` is a non-Docker fallback if someone wants to run without containers.

- [ ] **Step 6: Run `npm run check:fix` once to apply any style fixes, then `npm run check` to confirm clean**

```bash
npm run check:fix
npm run check
```

Expected first command: Biome applies any formatting fixes. Second command: both typechecks and Biome return success with 0 reports.

`check` is the CI-safe version (read-only). `check:fix` is for local use when you want Biome to fix formatting in place. CI calls `npm run check` and expects no modifications.

- [ ] **Step 7: Commit**

```bash
git add biome.json tsconfig.json tsconfig.server.json vite.config.ts package.json
git commit -m "chore: add Biome, Vitest, server tsconfig, and npm scripts"
```

---

## Phase 2 — Backend

### Task 3: Environment + config module

**Files:**
- Create: `src/server/env.ts`
- Create: `src/server/__tests__/env.test.ts`

The env module centralizes config loading and fails fast if required vars are missing. Tests document the required vs optional contract.

- [ ] **Step 1: Write the failing test — `src/server/__tests__/env.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadEnv } from "../env";

const REQUIRED = ["FIREBASE_PROJECT_ID", "STORAGE_ACCOUNT_NAME", "BLOB_CONTAINER_NAME"];

describe("loadEnv", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    for (const k of REQUIRED) delete process.env[k];
    delete process.env.AZURITE_CONNECTION;
    delete process.env.PORT;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws when required vars are missing", () => {
    expect(() => loadEnv()).toThrow(/FIREBASE_PROJECT_ID/);
  });

  it("returns config when all required vars present", () => {
    process.env.FIREBASE_PROJECT_ID = "markr-dev";
    process.env.STORAGE_ACCOUNT_NAME = "stmarkrdev";
    process.env.BLOB_CONTAINER_NAME = "projects";
    const cfg = loadEnv();
    expect(cfg.firebaseProjectId).toBe("markr-dev");
    expect(cfg.storageAccountName).toBe("stmarkrdev");
    expect(cfg.blobContainerName).toBe("projects");
    expect(cfg.port).toBe(8080);
  });

  it("allows AZURITE_CONNECTION to override credential mode", () => {
    process.env.FIREBASE_PROJECT_ID = "markr-dev";
    process.env.STORAGE_ACCOUNT_NAME = "stmarkrdev";
    process.env.BLOB_CONTAINER_NAME = "projects";
    process.env.AZURITE_CONNECTION = "UseDevelopmentStorage=true";
    const cfg = loadEnv();
    expect(cfg.azuriteConnection).toBe("UseDevelopmentStorage=true");
  });

  it("respects PORT override", () => {
    process.env.FIREBASE_PROJECT_ID = "markr-dev";
    process.env.STORAGE_ACCOUNT_NAME = "stmarkrdev";
    process.env.BLOB_CONTAINER_NAME = "projects";
    process.env.PORT = "3000";
    expect(loadEnv().port).toBe(3000);
  });
});
```

- [ ] **Step 2: Run the test — should fail with "module not found"**

```bash
npx vitest run src/server/__tests__/env.test.ts
```

Expected: FAIL — "Failed to resolve import '../env'".

- [ ] **Step 3: Write `src/server/env.ts`**

```ts
export interface Config {
  firebaseProjectId: string;
  storageAccountName: string;
  blobContainerName: string;
  azuriteConnection?: string;
  port: number;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export function loadEnv(): Config {
  return {
    firebaseProjectId: required("FIREBASE_PROJECT_ID"),
    storageAccountName: required("STORAGE_ACCOUNT_NAME"),
    blobContainerName: required("BLOB_CONTAINER_NAME"),
    azuriteConnection: process.env.AZURITE_CONNECTION,
    port: Number(process.env.PORT ?? "8080"),
  };
}
```

- [ ] **Step 4: Run the test — should pass**

```bash
npx vitest run src/server/__tests__/env.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/server/env.ts src/server/__tests__/env.test.ts
git commit -m "feat(server): env loader with fail-fast validation"
```

---

### Task 4: Firebase ID token verification middleware

**Files:**
- Create: `src/server/auth.ts`
- Create: `src/server/__tests__/fixtures.ts`
- Create: `src/server/__tests__/auth.test.ts`

Tokens are verified using `jose` against a JWKS. In production the JWKS is Google's public keys for Firebase. In tests we inject a local JWKS built from a keypair the test owns, so the tests exercise real signature verification without touching the internet.

- [ ] **Step 1: Write test fixtures — `src/server/__tests__/fixtures.ts`**

```ts
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import type { JWK } from "jose";

export interface TestSigner {
  jwks: { keys: JWK[] };
  issueToken(opts: {
    sub: string;
    email?: string;
    issuer: string;
    audience: string;
    expiresIn?: string;
  }): Promise<string>;
}

export async function makeTestSigner(): Promise<TestSigner> {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "test-key-1";
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";

  return {
    jwks: { keys: [publicJwk] },
    async issueToken({ sub, email, issuer, audience, expiresIn = "1h" }) {
      const jwt = new SignJWT({ email })
        .setProtectedHeader({ alg: "RS256", kid: "test-key-1" })
        .setSubject(sub)
        .setIssuer(issuer)
        .setAudience(audience)
        .setIssuedAt()
        .setExpirationTime(expiresIn);
      return jwt.sign(privateKey);
    },
  };
}
```

- [ ] **Step 2: Write the failing test — `src/server/__tests__/auth.test.ts`**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { createLocalJWKSet } from "jose";
import { createVerifier } from "../auth";
import { makeTestSigner, TestSigner } from "./fixtures";

const PROJECT_ID = "markr-test";
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;

describe("createVerifier", () => {
  let signer: TestSigner;

  beforeAll(async () => {
    signer = await makeTestSigner();
  });

  function verifier() {
    return createVerifier({
      projectId: PROJECT_ID,
      jwks: createLocalJWKSet(signer.jwks),
    });
  }

  it("accepts a valid token and returns uid + email", async () => {
    const token = await signer.issueToken({
      sub: "user-123",
      email: "alice@example.com",
      issuer: ISSUER,
      audience: PROJECT_ID,
    });
    const claims = await verifier().verify(token);
    expect(claims.uid).toBe("user-123");
    expect(claims.email).toBe("alice@example.com");
  });

  it("rejects a token with wrong issuer", async () => {
    const token = await signer.issueToken({
      sub: "user-123",
      issuer: "https://securetoken.google.com/other-project",
      audience: PROJECT_ID,
    });
    await expect(verifier().verify(token)).rejects.toThrow();
  });

  it("rejects a token with wrong audience", async () => {
    const token = await signer.issueToken({
      sub: "user-123",
      issuer: ISSUER,
      audience: "other-project",
    });
    await expect(verifier().verify(token)).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const token = await signer.issueToken({
      sub: "user-123",
      issuer: ISSUER,
      audience: PROJECT_ID,
      expiresIn: "-1s",
    });
    await expect(verifier().verify(token)).rejects.toThrow();
  });

  it("rejects a malformed token", async () => {
    await expect(verifier().verify("not-a-jwt")).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run the test — fails because auth.ts does not exist**

```bash
npx vitest run src/server/__tests__/auth.test.ts
```

Expected: FAIL — "Failed to resolve import '../auth'".

- [ ] **Step 4: Write `src/server/auth.ts`**

```ts
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface TokenClaims {
  uid: string;
  email?: string;
}

export interface Verifier {
  verify(token: string): Promise<TokenClaims>;
}

export function createVerifier(opts: {
  projectId: string;
  jwks: JWTVerifyGetKey;
}): Verifier {
  const issuer = `https://securetoken.google.com/${opts.projectId}`;
  return {
    async verify(token) {
      const { payload } = await jwtVerify(token, opts.jwks, {
        issuer,
        audience: opts.projectId,
      });
      if (typeof payload.sub !== "string" || !payload.sub) {
        throw new Error("Token missing sub");
      }
      return {
        uid: payload.sub,
        email: typeof payload.email === "string" ? payload.email : undefined,
      };
    },
  };
}

export function createFirebaseJwks(): JWTVerifyGetKey {
  return createRemoteJWKSet(
    new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
  );
}
```

- [ ] **Step 5: Run the test — should pass**

```bash
npx vitest run src/server/__tests__/auth.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/server/auth.ts src/server/__tests__/fixtures.ts src/server/__tests__/auth.test.ts
git commit -m "feat(server): Firebase ID token verification via jose"
```

---

### Task 5: Blob CRUD helpers

**Files:**
- Create: `src/server/blob.ts`
- Create: `src/server/__tests__/blob.test.ts`

The blob module exposes four functions: `listUserProjects`, `getUserProject`, `putUserProject`, `deleteUserProject`. All are scoped by `uid` — callers cannot bypass the per-user prefix. Tests run against Azurite on `localhost:10000` (launched via `docker compose up azurite` before running tests).

- [ ] **Step 1: Start Azurite for tests**

```bash
docker run -d --name markr-test-azurite -p 10000:10000 mcr.microsoft.com/azure-storage/azurite azurite-blob --blobHost 0.0.0.0
```

Or if the container already exists:

```bash
docker start markr-test-azurite
```

Confirm it's listening:

```bash
curl -s http://127.0.0.1:10000/devstoreaccount1 -I | head -1
```

Expected: any HTTP response (200, 400, or 404 is fine — means the server is up; connection refused means it's not).

- [ ] **Step 2: Write the failing test — `src/server/__tests__/blob.test.ts`**

```ts
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { BlobServiceClient } from "@azure/storage-blob";
import {
  createBlobStore,
  listUserProjects,
  getUserProject,
  putUserProject,
  deleteUserProject,
  BlobStore,
} from "../blob";

// Azurite well-known dev credentials
const AZURITE_CONNECTION =
  "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;" +
  "AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;" +
  "BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;";

const CONTAINER = "markr-test";
let store: BlobStore;

async function resetContainer() {
  const service = BlobServiceClient.fromConnectionString(AZURITE_CONNECTION);
  const container = service.getContainerClient(CONTAINER);
  await container.deleteIfExists();
  await container.create();
}

describe("blob store", () => {
  beforeAll(async () => {
    await resetContainer();
    store = createBlobStore({
      connectionString: AZURITE_CONNECTION,
      container: CONTAINER,
    });
  });

  beforeEach(resetContainer);

  it("put then get returns the same JSON", async () => {
    const project = { id: "p1", name: "Film A", updatedAt: "2026-01-01T00:00:00Z" };
    await putUserProject(store, "user-a", "p1", project);
    const got = await getUserProject(store, "user-a", "p1");
    expect(got).toEqual(project);
  });

  it("get returns null for missing blob", async () => {
    const got = await getUserProject(store, "user-a", "missing");
    expect(got).toBeNull();
  });

  it("list returns only the caller's projects", async () => {
    await putUserProject(store, "user-a", "p1", { id: "p1" });
    await putUserProject(store, "user-a", "p2", { id: "p2" });
    await putUserProject(store, "user-b", "p3", { id: "p3" });
    const listA = await listUserProjects(store, "user-a");
    expect(listA.map((p: any) => p.id).sort()).toEqual(["p1", "p2"]);
    const listB = await listUserProjects(store, "user-b");
    expect(listB.map((p: any) => p.id)).toEqual(["p3"]);
  });

  it("delete removes the blob", async () => {
    await putUserProject(store, "user-a", "p1", { id: "p1" });
    await deleteUserProject(store, "user-a", "p1");
    expect(await getUserProject(store, "user-a", "p1")).toBeNull();
  });

  it("delete is idempotent — no error on missing blob", async () => {
    await expect(deleteUserProject(store, "user-a", "missing")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: Run the test — fails because blob.ts does not exist**

```bash
npx vitest run src/server/__tests__/blob.test.ts
```

Expected: FAIL — "Failed to resolve import '../blob'".

- [ ] **Step 4: Write `src/server/blob.ts`**

```ts
import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";

export interface BlobStore {
  container: ContainerClient;
}

export function createBlobStore(opts: {
  connectionString?: string;
  accountName?: string;
  container: string;
}): BlobStore {
  const service = opts.connectionString
    ? BlobServiceClient.fromConnectionString(opts.connectionString)
    : new BlobServiceClient(
        `https://${opts.accountName}.blob.core.windows.net`,
        new DefaultAzureCredential()
      );
  const container = service.getContainerClient(opts.container);
  return { container };
}

function blobName(uid: string, projectId: string): string {
  return `users/${uid}/projects/${projectId}.json`;
}

function prefix(uid: string): string {
  return `users/${uid}/projects/`;
}

export async function putUserProject(
  store: BlobStore,
  uid: string,
  projectId: string,
  project: unknown
): Promise<void> {
  const blob = store.container.getBlockBlobClient(blobName(uid, projectId));
  const body = JSON.stringify(project);
  await blob.upload(body, Buffer.byteLength(body), {
    blobHTTPHeaders: { blobContentType: "application/json" },
  });
}

export async function getUserProject(
  store: BlobStore,
  uid: string,
  projectId: string
): Promise<unknown | null> {
  const blob = store.container.getBlockBlobClient(blobName(uid, projectId));
  try {
    const buf = await blob.downloadToBuffer();
    return JSON.parse(buf.toString("utf8"));
  } catch (err: any) {
    if (err?.statusCode === 404) return null;
    throw err;
  }
}

export async function listUserProjects(store: BlobStore, uid: string): Promise<unknown[]> {
  const results: unknown[] = [];
  for await (const item of store.container.listBlobsFlat({ prefix: prefix(uid) })) {
    const buf = await store.container.getBlockBlobClient(item.name).downloadToBuffer();
    results.push(JSON.parse(buf.toString("utf8")));
  }
  return results;
}

export async function deleteUserProject(
  store: BlobStore,
  uid: string,
  projectId: string
): Promise<void> {
  const blob = store.container.getBlockBlobClient(blobName(uid, projectId));
  await blob.deleteIfExists();
}
```

- [ ] **Step 5: Run the test — should pass**

```bash
npx vitest run src/server/__tests__/blob.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/server/blob.ts src/server/__tests__/blob.test.ts
git commit -m "feat(server): blob CRUD helpers scoped by uid"
```

---

### Task 6: API routes + Hono app wiring + static serving

**Files:**
- Create: `src/server/routes.ts`
- Create: `src/server/index.ts`
- Create: `src/server/__tests__/routes.test.ts`

Routes: `GET /api/projects`, `PUT /api/projects/:id`, `DELETE /api/projects/:id`. All require a Bearer token. The app also serves the React bundle from `dist/client` at `/` in production.

- [ ] **Step 1: Write the failing integration test — `src/server/__tests__/routes.test.ts`**

```ts
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createLocalJWKSet } from "jose";
import { BlobServiceClient } from "@azure/storage-blob";
import { createApp } from "../index";
import { makeTestSigner, TestSigner } from "./fixtures";

const PROJECT_ID = "markr-test";
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;
const AZURITE_CONNECTION =
  "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;" +
  "AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;" +
  "BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;";
const CONTAINER = "markr-routes-test";

let signer: TestSigner;
let app: ReturnType<typeof createApp>;

async function resetContainer() {
  const service = BlobServiceClient.fromConnectionString(AZURITE_CONNECTION);
  const container = service.getContainerClient(CONTAINER);
  await container.deleteIfExists();
  await container.create();
}

async function tokenFor(uid: string) {
  return signer.issueToken({ sub: uid, issuer: ISSUER, audience: PROJECT_ID });
}

describe("API routes", () => {
  beforeAll(async () => {
    signer = await makeTestSigner();
    await resetContainer();
    app = createApp({
      verifier: { projectId: PROJECT_ID, jwks: createLocalJWKSet(signer.jwks) },
      blob: { connectionString: AZURITE_CONNECTION, container: CONTAINER },
      serveStatic: false,
    });
  });

  beforeEach(resetContainer);

  async function req(method: string, path: string, token?: string, body?: unknown) {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    return app.fetch(
      new Request(`http://localhost${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    );
  }

  it("401 when no token", async () => {
    const res = await req("GET", "/api/projects");
    expect(res.status).toBe(401);
  });

  it("401 when token invalid", async () => {
    const res = await req("GET", "/api/projects", "garbage");
    expect(res.status).toBe(401);
  });

  it("GET /api/projects returns empty list for new user", async () => {
    const res = await req("GET", "/api/projects", await tokenFor("u1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("PUT then GET returns the project", async () => {
    const token = await tokenFor("u1");
    const project = { id: "p1", name: "Film" };
    const put = await req("PUT", "/api/projects/p1", token, project);
    expect(put.status).toBe(204);
    const get = await req("GET", "/api/projects", token);
    expect(await get.json()).toEqual([project]);
  });

  it("DELETE removes a project", async () => {
    const token = await tokenFor("u1");
    await req("PUT", "/api/projects/p1", token, { id: "p1" });
    const del = await req("DELETE", "/api/projects/p1", token);
    expect(del.status).toBe(204);
    const list = await req("GET", "/api/projects", token);
    expect(await list.json()).toEqual([]);
  });

  it("user A cannot see user B's projects", async () => {
    const tokenA = await tokenFor("u1");
    const tokenB = await tokenFor("u2");
    await req("PUT", "/api/projects/p1", tokenA, { id: "p1", owner: "A" });
    const listB = await req("GET", "/api/projects", tokenB);
    expect(await listB.json()).toEqual([]);
  });

  it("rejects PUT with mismatched id", async () => {
    const token = await tokenFor("u1");
    const res = await req("PUT", "/api/projects/p1", token, { id: "different" });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the test — fails because index.ts and routes.ts do not exist**

```bash
npx vitest run src/server/__tests__/routes.test.ts
```

Expected: FAIL — "Failed to resolve import '../index'".

- [ ] **Step 3: Write `src/server/routes.ts`**

```ts
import { Hono, MiddlewareHandler } from "hono";
import type { Verifier } from "./auth";
import {
  BlobStore,
  deleteUserProject,
  listUserProjects,
  putUserProject,
} from "./blob";

export function authMiddleware(verifier: Verifier): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header("Authorization") ?? "";
    const match = header.match(/^Bearer (.+)$/);
    if (!match) return c.json({ error: "Missing bearer token" }, 401);
    try {
      const claims = await verifier.verify(match[1]);
      c.set("uid", claims.uid);
      await next();
    } catch (err) {
      return c.json({ error: "Invalid token" }, 401);
    }
  };
}

export function mountApiRoutes(app: Hono, verifier: Verifier, store: BlobStore): void {
  const api = new Hono();
  api.use("*", authMiddleware(verifier));

  api.get("/projects", async (c) => {
    const uid = c.get("uid") as string;
    const projects = await listUserProjects(store, uid);
    return c.json(projects);
  });

  api.put("/projects/:id", async (c) => {
    const uid = c.get("uid") as string;
    const id = c.req.param("id");
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    if (body?.id !== id) {
      return c.json({ error: "id mismatch" }, 400);
    }
    await putUserProject(store, uid, id, body);
    return c.body(null, 204);
  });

  api.delete("/projects/:id", async (c) => {
    const uid = c.get("uid") as string;
    const id = c.req.param("id");
    await deleteUserProject(store, uid, id);
    return c.body(null, 204);
  });

  app.route("/api", api);
}
```

- [ ] **Step 4: Write `src/server/index.ts`**

```ts
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import type { JWTVerifyGetKey } from "jose";
import { createVerifier, createFirebaseJwks } from "./auth";
import { createBlobStore } from "./blob";
import { loadEnv } from "./env";
import { mountApiRoutes } from "./routes";

export interface AppOptions {
  verifier: { projectId: string; jwks: JWTVerifyGetKey };
  blob: { connectionString?: string; accountName?: string; container: string };
  serveStatic?: boolean;
}

export function createApp(opts: AppOptions) {
  const app = new Hono();
  const verifier = createVerifier(opts.verifier);
  const store = createBlobStore(opts.blob);
  mountApiRoutes(app, verifier, store);

  if (opts.serveStatic) {
    app.use("/*", serveStatic({ root: "./dist/client" }));
    app.get("*", serveStatic({ path: "./dist/client/index.html" }));
  }
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = loadEnv();
  const app = createApp({
    verifier: { projectId: env.firebaseProjectId, jwks: createFirebaseJwks() },
    blob: env.azuriteConnection
      ? { connectionString: env.azuriteConnection, container: env.blobContainerName }
      : { accountName: env.storageAccountName, container: env.blobContainerName },
    serveStatic: true,
  });
  serve({ fetch: app.fetch, port: env.port });
  console.log(`Server listening on http://0.0.0.0:${env.port}`);
}
```

- [ ] **Step 5: Run the test — should pass**

```bash
npx vitest run src/server/__tests__/routes.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 6: Run all tests together**

```bash
npm test
```

Expected: all tests across `env`, `auth`, `blob`, `routes` pass. No failures.

- [ ] **Step 7: Commit**

```bash
git add src/server/routes.ts src/server/index.ts src/server/__tests__/routes.test.ts
git commit -m "feat(server): Hono app with /api/projects routes and static serve"
```

---

## Phase 3 — Frontend

### Task 7: Extract `mergeProjects` to pure util + unit test

**Files:**
- Create: `src/lib/merge.ts`
- Create: `src/lib/__tests__/merge.test.ts`
- Modify: `src/lib/firestore.ts` (temporarily re-export; removed in Task 9)

- [ ] **Step 1: Write the failing test — `src/lib/__tests__/merge.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { mergeProjects } from "../merge";
import type { Project } from "@/types";

function p(id: string, updatedAt: string, name = id): Project {
  return {
    id,
    name,
    createdAt: updatedAt,
    updatedAt,
    meta: { client: "", date: "", crew: "" },
    sections: [],
  };
}

describe("mergeProjects", () => {
  it("returns empty when both inputs are empty", () => {
    expect(mergeProjects([], [])).toEqual([]);
  });

  it("keeps newer copy when same id in both", () => {
    const older = p("a", "2026-01-01T00:00:00Z", "old name");
    const newer = p("a", "2026-02-01T00:00:00Z", "new name");
    const merged = mergeProjects([older], [newer]);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe("new name");
  });

  it("includes unique projects from both sides", () => {
    const a = p("a", "2026-01-01T00:00:00Z");
    const b = p("b", "2026-01-01T00:00:00Z");
    const merged = mergeProjects([a], [b]);
    const ids = merged.map((x) => x.id).sort();
    expect(ids).toEqual(["a", "b"]);
  });

  it("sorts result by updatedAt descending", () => {
    const old = p("a", "2026-01-01T00:00:00Z");
    const mid = p("b", "2026-02-01T00:00:00Z");
    const newest = p("c", "2026-03-01T00:00:00Z");
    expect(mergeProjects([old, newest], [mid]).map((x) => x.id)).toEqual(["c", "b", "a"]);
  });
});
```

- [ ] **Step 2: Run the test — fails because merge.ts doesn't exist**

```bash
npx vitest run src/lib/__tests__/merge.test.ts
```

Expected: FAIL — "Failed to resolve import '../merge'".

- [ ] **Step 3: Write `src/lib/merge.ts`**

```ts
import type { Project } from "@/types";

/** Merge cloud + local arrays: keep newest copy of each project by updatedAt. */
export function mergeProjects(cloud: Project[], local: Project[]): Project[] {
  const map = new Map<string, Project>();
  for (const p of [...local, ...cloud]) {
    const existing = map.get(p.id);
    if (!existing || new Date(p.updatedAt) > new Date(existing.updatedAt)) {
      map.set(p.id, p);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
```

- [ ] **Step 4: Update `src/lib/firestore.ts` to re-export from merge.ts**

Replace the inline `mergeProjects` implementation in `firestore.ts` with a re-export so callers (`projectStore.ts`) keep working unchanged until Task 9:

```ts
// At the top of src/lib/firestore.ts, add:
export { mergeProjects } from "./merge";

// Delete the local `function mergeProjects(...)` implementation from the bottom of the file.
```

The rest of `firestore.ts` stays as-is for now.

- [ ] **Step 5: Run the test — should pass**

```bash
npx vitest run src/lib/__tests__/merge.test.ts
npm run check
```

Expected: all 4 merge tests pass; typecheck has 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/merge.ts src/lib/__tests__/merge.test.ts src/lib/firestore.ts
git commit -m "refactor(lib): extract mergeProjects to pure module with unit tests"
```

---

### Task 8: Frontend API client `src/lib/api.ts`

**Files:**
- Create: `src/lib/api.ts`
- Create: `src/lib/__tests__/api.test.ts`

The new api.ts replicates the public surface of firestore.ts (`fetchCloudProjects`, `upsertCloudProject`, `deleteCloudProject`) so `projectStore.ts` can swap imports with zero structural changes.

- [ ] **Step 1: Write the failing test — `src/lib/__tests__/api.test.ts`**

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchCloudProjects, upsertCloudProject, deleteCloudProject } from "../api";
import type { Project } from "@/types";

const sample: Project = {
  id: "p1",
  name: "Film A",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  meta: { client: "", date: "", crew: "" },
  sections: [],
};

const originalFetch = globalThis.fetch;

function mockFetch(responder: (req: Request) => Response | Promise<Response>) {
  globalThis.fetch = vi.fn(async (input: any, init?: any) => {
    const req = input instanceof Request ? input : new Request(input, init);
    return responder(req);
  }) as any;
}

beforeEach(() => {
  globalThis.fetch = originalFetch;
  vi.stubGlobal("__markrGetIdToken", async () => "test-token");
});

describe("api client", () => {
  it("fetchCloudProjects sends Bearer token and parses JSON array", async () => {
    let seenAuth = "";
    mockFetch((req) => {
      seenAuth = req.headers.get("Authorization") ?? "";
      return new Response(JSON.stringify([sample]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const result = await fetchCloudProjects("ignored-user-id");
    expect(seenAuth).toBe("Bearer test-token");
    expect(result).toEqual([sample]);
  });

  it("upsertCloudProject PUTs JSON body with matching id", async () => {
    let seenMethod = "";
    let seenUrl = "";
    let seenBody = "";
    mockFetch(async (req) => {
      seenMethod = req.method;
      seenUrl = new URL(req.url).pathname;
      seenBody = await req.text();
      return new Response(null, { status: 204 });
    });
    await upsertCloudProject("ignored", sample);
    expect(seenMethod).toBe("PUT");
    expect(seenUrl).toBe("/api/projects/p1");
    expect(JSON.parse(seenBody)).toEqual(sample);
  });

  it("deleteCloudProject DELETEs the right URL", async () => {
    let seenMethod = "";
    let seenUrl = "";
    mockFetch((req) => {
      seenMethod = req.method;
      seenUrl = new URL(req.url).pathname;
      return new Response(null, { status: 204 });
    });
    await deleteCloudProject("ignored", "p1");
    expect(seenMethod).toBe("DELETE");
    expect(seenUrl).toBe("/api/projects/p1");
  });

  it("fetchCloudProjects throws on non-2xx", async () => {
    mockFetch(() => new Response("nope", { status: 500 }));
    await expect(fetchCloudProjects("ignored")).rejects.toThrow(/500/);
  });
});
```

- [ ] **Step 2: Run the test — fails because api.ts doesn't exist**

```bash
npx vitest run src/lib/__tests__/api.test.ts
```

Expected: FAIL — "Failed to resolve import '../api'".

- [ ] **Step 3: Write `src/lib/api.ts`**

```ts
import { auth } from "@/lib/firebase";
import type { Project } from "@/types";

/**
 * API base URL. For web (same-origin) this is empty string; for Tauri desktop
 * VITE_API_URL is set at build time to the deployed ACA URL.
 */
const BASE = import.meta.env.VITE_API_URL ?? "";

async function getToken(): Promise<string> {
  // Hook for tests; production uses Firebase auth.
  const override = (globalThis as any).__markrGetIdToken;
  if (typeof override === "function") return override();
  if (!auth?.currentUser) throw new Error("Not signed in");
  return auth.currentUser.getIdToken();
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} on ${path}`);
  }
  return res;
}

// Signatures match the old firestore.ts so projectStore.ts import changes in one place.
export async function fetchCloudProjects(_userId: string): Promise<Project[]> {
  const res = await request("/api/projects");
  return (await res.json()) as Project[];
}

export async function upsertCloudProject(_userId: string, project: Project): Promise<void> {
  await request(`/api/projects/${project.id}`, {
    method: "PUT",
    body: JSON.stringify(project),
  });
}

export async function deleteCloudProject(_userId: string, projectId: string): Promise<void> {
  await request(`/api/projects/${projectId}`, { method: "DELETE" });
}

export { mergeProjects } from "./merge";
```

The `_userId` arg is intentionally unused — the backend derives the user from the verified Firebase ID token. Keeping the argument preserves the call-site signature so `projectStore.ts` doesn't have to change.

- [ ] **Step 4: Run the test — should pass**

```bash
npx vitest run src/lib/__tests__/api.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts src/lib/__tests__/api.test.ts
git commit -m "feat(lib): api client replacing firestore.ts data layer"
```

---

### Task 9: Switch projectStore to api.ts, delete firestore.ts

**Files:**
- Modify: `src/store/projectStore.ts`
- Delete: `src/lib/firestore.ts`

- [ ] **Step 1: Update the import in `src/store/projectStore.ts`**

Change line 6 from:

```ts
import { upsertCloudProject, deleteCloudProject, fetchCloudProjects, mergeProjects } from "@/lib/firestore";
```

to:

```ts
import { upsertCloudProject, deleteCloudProject, fetchCloudProjects, mergeProjects } from "@/lib/api";
```

The rest of `projectStore.ts` is untouched — all call sites keep working because the function signatures are identical.

- [ ] **Step 2: Delete `src/lib/firestore.ts`**

```bash
rm src/lib/firestore.ts
```

- [ ] **Step 3: Run typecheck and tests**

```bash
npm run check
npm test
```

Expected: all typechecks pass, all tests pass. If any code still imports from `@/lib/firestore`, fix those imports — the only reference should have been `projectStore.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/store/projectStore.ts src/lib/firestore.ts
git commit -m "feat: switch projectStore to api client; remove firestore.ts"
```

---

## Phase 4 — Docker + Compose

### Task 10: `.dockerignore`, `Dockerfile.dev`, `compose.yaml`

**Files:**
- Create: `.dockerignore`
- Create: `Dockerfile.dev`
- Create: `compose.yaml`
- Modify: `.env.example`

- [ ] **Step 1: Write `.dockerignore`**

```
node_modules
dist
.git
.github
src-tauri/target
pages-repo
.env.local
*.log
```

- [ ] **Step 2: Write `Dockerfile.dev`**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
ENV NODE_ENV=development
EXPOSE 5173 8080
CMD ["npm", "run", "dev:all"]
```

- [ ] **Step 3: Write `compose.yaml`**

```yaml
services:
  azurite:
    image: mcr.microsoft.com/azure-storage/azurite
    command: ["azurite-blob", "--blobHost", "0.0.0.0", "--loose"]
    ports:
      - "10000:10000"
    volumes:
      - azurite-data:/data

  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "5173:5173"
      - "8080:8080"
    volumes:
      - .:/app
      - /app/node_modules
    env_file:
      - .env.local
    environment:
      FIREBASE_PROJECT_ID: ${VITE_FIREBASE_PROJECT_ID}
      STORAGE_ACCOUNT_NAME: devstoreaccount1
      BLOB_CONTAINER_NAME: projects
      AZURITE_CONNECTION: "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://azurite:10000/devstoreaccount1;"
      PORT: "8080"
    depends_on:
      - azurite

volumes:
  azurite-data:
```

Note: `/app/node_modules` as an anonymous volume prevents the host's `node_modules` from masking the container's.

- [ ] **Step 4: Extend `.env.example`**

Append to the existing file:

```env

# Backend (server) — used by the Hono API inside the container
# FIREBASE_PROJECT_ID is already set via VITE_FIREBASE_PROJECT_ID above;
# compose.yaml copies it into the backend env.

# Tauri desktop builds only — URL of the deployed backend
VITE_API_URL=https://ca-markr.example.azurecontainerapps.io
```

- [ ] **Step 5: Test the compose setup**

```bash
cp .env.example .env.local
# Fill in VITE_FIREBASE_* values in .env.local as usual
docker compose up --build -d
```

After containers are up:

```bash
# Azurite is reachable
curl -s http://localhost:10000/devstoreaccount1 -I | head -1

# Backend is reachable (should 401 — no token)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/projects
# Expected: 401

# Vite dev server is reachable
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173
# Expected: 200
```

Bring the stack down:

```bash
docker compose down
```

- [ ] **Step 6: Update `README.md` local-dev instructions**

Replace the `## Local development` → `### Setup` section (currently shows `npm run tauri dev` as the primary flow) with:

```markdown
### Setup

```bash
git clone https://github.com/stephanteig/shotlist-planner.git
cd shotlist-planner
npm install
cp .env.example .env.local   # fill in Firebase values
docker compose up             # runs Azurite + Vite (5173) + Hono (8080)
```

Open http://localhost:5173 and sign in with Google. Data persists in the
local Azurite container; `docker compose down -v` resets everything.

### Desktop development (Tauri)

```bash
npm run tauri:dev
```

Desktop dev requires Rust stable (`rustup update`) and Xcode Command Line
Tools on macOS. The Tauri window loads from Vite's dev server — run
`docker compose up` first so the backend is reachable, or set
`VITE_API_URL=http://localhost:8080` in `.env.local` to talk to the
locally-running Hono.
```

Other sections of the README (Stack, Features, Pages, Project structure, Releases, etc.) stay as-is.

- [ ] **Step 7: Commit**

```bash
git add .dockerignore Dockerfile.dev compose.yaml .env.example README.md
git commit -m "feat: Docker Compose with Azurite + dev container"
```

---

### Task 11: Production `Dockerfile` (multi-stage)

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Write `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
RUN npm run build
# Layout after build:
#   dist/client/   <- Vite frontend bundle
#   dist/server/   <- tsc-compiled backend

FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "dist/server/index.js"]
```

Note on `VITE_FIREBASE_*` build args: these get baked into the frontend bundle. The backend does not need them. The GitHub Actions deploy workflow passes them as `--build-arg` values from repo secrets.

- [ ] **Step 2: Verify `vite:build` output directory**

The current `vite.config.ts` builds to `dist/` by default. Change the build `outDir` to `dist/client` so it doesn't collide with the server build. Edit `vite.config.ts`:

```ts
build: {
  outDir: "dist/client",
  emptyOutDir: true,
  // ... rest unchanged
},
```

Also update `src-tauri/tauri.conf.json` — change `"frontendDist": "../dist"` to `"frontendDist": "../dist/client"`.

- [ ] **Step 3: Build the prod image locally to sanity-check**

```bash
docker build \
  --build-arg VITE_FIREBASE_API_KEY=dummy \
  --build-arg VITE_FIREBASE_PROJECT_ID=markr-dev \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN=markr-dev.firebaseapp.com \
  --build-arg VITE_FIREBASE_STORAGE_BUCKET=markr-dev.appspot.com \
  --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID=123 \
  --build-arg VITE_FIREBASE_APP_ID=1:123:web:abc \
  -t markr:local .
```

Expected: clean build, no errors, final image ~100–150 MB.

- [ ] **Step 4: Run the prod image briefly**

Dummy values — the container will fail to verify tokens against real Firebase, but it should start and respond with 401 to unauthenticated requests:

```bash
docker run --rm -p 8080:8080 \
  -e FIREBASE_PROJECT_ID=markr-dev \
  -e STORAGE_ACCOUNT_NAME=stfake \
  -e BLOB_CONTAINER_NAME=projects \
  markr:local &
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/projects
# Expected: 401 (missing token)
curl -s http://localhost:8080/ | head -5
# Expected: HTML from the React bundle
kill %1 2>/dev/null || true
```

- [ ] **Step 5: Commit**

```bash
git add Dockerfile vite.config.ts src-tauri/tauri.conf.json
git commit -m "feat: production multi-stage Dockerfile with split build output"
```

---

## Phase 5 — Azure infrastructure

### Task 12: `infra/main.bicep` + parameters

**Files:**
- Create: `infra/main.bicep`
- Create: `infra/parameters.json`

- [ ] **Step 1: Write `infra/main.bicep`**

```bicep
@description('Azure region for all resources.')
param location string = 'norwayeast'

@description('Short workload name used as the naming prefix.')
param workload string = 'markr'

@description('Container image reference (e.g. ghcr.io/owner/markr:sha).')
param imageRef string

@description('GHCR username for image pull.')
param registryUsername string = ''

@description('GHCR PAT for image pull.')
@secure()
param registryPassword string = ''

@description('Firebase project ID — used by the backend for token audience/issuer.')
param firebaseProjectId string

var suffix = uniqueString(resourceGroup().id)

// --- Storage ---
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'st${workload}${take(suffix, 4)}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource projectsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'projects'
  properties: { publicAccess: 'None' }
}

// --- Managed Identity for the Container App ---
resource appIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${workload}'
  location: location
}

// Storage Blob Data Contributor role
var blobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storage
  name: guid(storage.id, appIdentity.id, blobDataContributorRoleId)
  properties: {
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      blobDataContributorRoleId
    )
  }
}

// --- Log Analytics ---
resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${workload}'
  location: location
  properties: {
    retentionInDays: 30
    sku: { name: 'PerGB2018' }
  }
}

// --- Container Apps Environment ---
resource cae 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-${workload}'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

// --- Container App ---
resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-${workload}'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${appIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: cae.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
      }
      registries: empty(registryUsername) ? [] : [
        {
          server: 'ghcr.io'
          username: registryUsername
          passwordSecretRef: 'registry-password'
        }
      ]
      secrets: empty(registryPassword) ? [] : [
        {
          name: 'registry-password'
          value: registryPassword
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'app'
          image: imageRef
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'FIREBASE_PROJECT_ID', value: firebaseProjectId }
            { name: 'STORAGE_ACCOUNT_NAME', value: storage.name }
            { name: 'BLOB_CONTAINER_NAME', value: 'projects' }
            { name: 'PORT', value: '8080' }
            { name: 'AZURE_CLIENT_ID', value: appIdentity.properties.clientId }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 2
      }
    }
  }
}

output appUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
output storageAccountName string = storage.name
output managedIdentityClientId string = appIdentity.properties.clientId
```

Note on `AZURE_CLIENT_ID`: `DefaultAzureCredential` inside the container uses this to pick the correct user-assigned identity.

- [ ] **Step 2: Write `infra/parameters.json`**

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "location": { "value": "norwayeast" },
    "workload": { "value": "markr" },
    "imageRef": { "value": "ghcr.io/stephanteig/markr:placeholder" },
    "firebaseProjectId": { "value": "REPLACE_WITH_ACTUAL_FIREBASE_PROJECT_ID" }
  }
}
```

This is the bootstrap file. Real deploys overlay `imageRef`, `registryUsername`, `registryPassword` as inline parameters from the workflow.

- [ ] **Step 3: Validate the Bicep compiles**

```bash
az bicep build --file infra/main.bicep
```

Expected: no errors. A compiled `.json` file is generated alongside (gitignore it — see next step).

- [ ] **Step 4: Add the compiled output to `.gitignore`**

Append to `.gitignore`:

```
# Bicep compiled output (regenerated on demand)
infra/*.json.bak
infra/main.json
```

`infra/parameters.json` is NOT ignored — it's the parameter file we author.

- [ ] **Step 5: Commit**

```bash
git add infra/main.bicep infra/parameters.json .gitignore
git commit -m "feat(infra): Bicep for rg-markr resources"
```

---

### Task 13: Create resource group and do a manual first deploy

This task is **manual** — the operator runs `az` commands. No code artifacts produced, but the resources must exist before Task 15's deploy workflow.

- [ ] **Step 1: Create the resource group**

```bash
az group create --name rg-markr --location norwayeast
```

Expected: JSON with `"provisioningState": "Succeeded"`.

- [ ] **Step 2: Do a what-if on the Bicep**

Replace `YOUR-FIREBASE-PROJECT-ID` with the real project ID (from `.env.local`):

```bash
az deployment group what-if \
  --resource-group rg-markr \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters firebaseProjectId=YOUR-FIREBASE-PROJECT-ID \
  --parameters imageRef=mcr.microsoft.com/k8se/quickstart:latest
```

Expected: preview of resources to create (storage, identity, role assignment, logs, ACA env, ACA). No errors.

- [ ] **Step 3: Apply the Bicep using a quickstart image**

Using the Microsoft quickstart image lets us verify the infra boots before we have our own image in GHCR:

```bash
az deployment group create \
  --resource-group rg-markr \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters firebaseProjectId=YOUR-FIREBASE-PROJECT-ID \
  --parameters imageRef=mcr.microsoft.com/k8se/quickstart:latest
```

Expected: `"provisioningState": "Succeeded"`. The `appUrl` output shows the ACA URL.

- [ ] **Step 4: Verify the stack is healthy**

```bash
# List resources in the RG — should see 6 resources
az resource list --resource-group rg-markr --output table

# Curl the app URL — quickstart returns a "Welcome" page
APP_URL=$(az deployment group show -g rg-markr -n main --query properties.outputs.appUrl.value -o tsv)
curl -s -o /dev/null -w "%{http_code}\n" "$APP_URL"
# Expected: 200
```

- [ ] **Step 5: Record outputs for later**

Print the managed identity client ID and storage account name — Task 14 and Task 15 reference them:

```bash
az deployment group show -g rg-markr -n main --query properties.outputs -o json
```

Save the output. Paste into a note somewhere the operator can find later.

Nothing to commit. Infra exists. Proceed.

---

## Phase 6 — CI + Deploy

### Task 14: Set up GitHub → Azure OIDC federation (manual)

This task produces three values (client-id, tenant-id, subscription-id) that Task 15's workflow needs. All commands run in a terminal logged in via `az login` and `gh auth login`.

- [ ] **Step 1: Record identifiers**

```bash
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
REPO="stephanteig/shotlist-planner"  # owner/repo slug
echo "SUB=$SUBSCRIPTION_ID"
echo "TENANT=$TENANT_ID"
```

- [ ] **Step 2: Create the GitHub OIDC app registration**

```bash
az ad app create --display-name "github-markr-deploy"
APP_ID=$(az ad app list --display-name "github-markr-deploy" --query '[0].appId' -o tsv)
az ad sp create --id "$APP_ID"
SP_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv)
echo "APP_ID=$APP_ID"
echo "SP_ID=$SP_ID"
```

- [ ] **Step 3: Grant Contributor on `rg-markr` only**

```bash
az role assignment create \
  --role "Contributor" \
  --assignee "$SP_ID" \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/rg-markr"
```

- [ ] **Step 4: Add the federated credential for the `main` branch**

```bash
cat <<EOF > /tmp/fed-main.json
{
  "name": "main-branch-deploy",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:$REPO:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}
EOF
az ad app federated-credential create --id "$APP_ID" --parameters /tmp/fed-main.json
```

Also add one for PRs (so CI can do `what-if` from PR branches — no deploy):

```bash
cat <<EOF > /tmp/fed-pr.json
{
  "name": "pull-requests",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:$REPO:pull_request",
  "audiences": ["api://AzureADTokenExchange"]
}
EOF
az ad app federated-credential create --id "$APP_ID" --parameters /tmp/fed-pr.json
```

- [ ] **Step 5: Store the three identifiers as GitHub Actions repository variables**

```bash
gh variable set AZURE_CLIENT_ID --repo "$REPO" --body "$APP_ID"
gh variable set AZURE_TENANT_ID --repo "$REPO" --body "$TENANT_ID"
gh variable set AZURE_SUBSCRIPTION_ID --repo "$REPO" --body "$SUBSCRIPTION_ID"
```

These are **variables, not secrets** — the values are not sensitive; OIDC trust is established by the federated credential, not by a password.

- [ ] **Step 6: Create the GHCR pull PAT**

Manual: open https://github.com/settings/personal-access-tokens/new — create a fine-grained PAT with:
- Resource owner: `stephanteig`
- Repository access: Only `stephanteig/shotlist-planner`
- Permissions: **Packages — read**
- Expiry: 90 days

Copy the token. Store as a GitHub Actions **secret**:

```bash
gh secret set GHCR_PULL_TOKEN --repo "$REPO" --body "ghp_..."
gh variable set GHCR_USERNAME --repo "$REPO" --body "stephanteig"
```

Nothing committed to git. The three variables + one secret exist in GitHub. Proceed.

---

### Task 15: Write `.github/workflows/ci.yml`

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: CI

on:
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    services:
      azurite:
        image: mcr.microsoft.com/azure-storage/azurite
        ports:
          - 10000:10000
        options: >-
          --health-cmd "nc -z 127.0.0.1 10000 || exit 1"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run check
      - run: npm test
```

Azurite is declared as a GitHub Actions service container — CI starts it automatically and tears it down after the job. No extra scripting needed.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add PR check workflow (lint, typecheck, tests with Azurite service)"
```

- [ ] **Step 3: Push branch and open a PR to verify CI runs**

```bash
git push -u origin spec/azure-deployment
gh pr create --title "Azure migration — Phase 1-5" --body "Testing CI"
```

Watch the CI run at the PR URL. Expected: all steps succeed. Leave the PR open — later tasks add more work.

---

### Task 16: Write `.github/workflows/deploy.yml`

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: Deploy to Azure

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  id-token: write
  contents: read
  packages: write

env:
  RESOURCE_GROUP: rg-markr
  IMAGE_REPO: ghcr.io/${{ github.repository }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Log in to Azure (OIDC)
        uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ env.IMAGE_REPO }}:${{ github.sha }}
            ${{ env.IMAGE_REPO }}:latest
          build-args: |
            VITE_FIREBASE_API_KEY=${{ secrets.VITE_FIREBASE_API_KEY }}
            VITE_FIREBASE_AUTH_DOMAIN=${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
            VITE_FIREBASE_PROJECT_ID=${{ secrets.VITE_FIREBASE_PROJECT_ID }}
            VITE_FIREBASE_STORAGE_BUCKET=${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
            VITE_FIREBASE_MESSAGING_SENDER_ID=${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
            VITE_FIREBASE_APP_ID=${{ secrets.VITE_FIREBASE_APP_ID }}

      - name: Apply Bicep
        run: |
          az deployment group create \
            --resource-group $RESOURCE_GROUP \
            --template-file infra/main.bicep \
            --parameters infra/parameters.json \
            --parameters firebaseProjectId="${{ secrets.VITE_FIREBASE_PROJECT_ID }}" \
            --parameters imageRef="${{ env.IMAGE_REPO }}:${{ github.sha }}" \
            --parameters registryUsername="${{ vars.GHCR_USERNAME }}" \
            --parameters registryPassword="${{ secrets.GHCR_PULL_TOKEN }}"

      - name: Update Container App image
        run: |
          az containerapp update \
            --name ca-markr \
            --resource-group $RESOURCE_GROUP \
            --image ${{ env.IMAGE_REPO }}:${{ github.sha }}

      - name: Print app URL
        run: |
          URL=$(az containerapp show -n ca-markr -g $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv)
          echo "Deployed to https://$URL"
```

Note the permissions block: `id-token: write` is required for OIDC. `packages: write` lets us push to GHCR using the built-in `GITHUB_TOKEN` — no PAT needed for pushing.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: deploy workflow — build image, apply Bicep, update ACA"
```

- [ ] **Step 3: Merge PR and watch the deploy run**

Merge the PR manually via the GitHub UI (branch protection is not yet in place, so a single approval or admin merge works). Then watch:

```bash
gh run watch --repo "$REPO"
```

Expected: workflow succeeds, prints an ACA URL. Hit it:

```bash
APP_URL=$(az containerapp show -n ca-markr -g rg-markr --query properties.configuration.ingress.fqdn -o tsv)
curl -s "https://$APP_URL/" | head -3
# Expected: React bundle HTML
curl -s -o /dev/null -w "%{http_code}\n" "https://$APP_URL/api/projects"
# Expected: 401
```

Smoke-test manually via browser: open `https://$APP_URL`, sign in with Google, create a project, reload — project persists.

---

## Phase 7 — Cutover

### Task 17: Point Tauri at ACA, remove `deploy-pages.yml`, add branch protection

**Files:**
- Modify: `.github/workflows/build-desktop.yml`
- Delete: `.github/workflows/deploy-pages.yml`

- [ ] **Step 1: Add the new secret for desktop builds**

```bash
APP_URL=$(az containerapp show -n ca-markr -g rg-markr --query properties.configuration.ingress.fqdn -o tsv)
gh secret set VITE_API_URL --repo "$REPO" --body "https://$APP_URL"
```

- [ ] **Step 2: Modify `.github/workflows/build-desktop.yml`**

Inside the `env:` block of the `tauri-apps/tauri-action@v0` step, add one line:

```yaml
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
```

Place it next to the other `VITE_*` env vars.

- [ ] **Step 3: Delete the old pages workflow**

```bash
rm .github/workflows/deploy-pages.yml
```

Once the ACA deploy is verified healthy, the GitHub Pages deploy is dead weight — delete it. The old pages site at `stephanteig.github.io/shotlist-planner` will stop getting updates; the repo itself can remain untouched (the static copy stays until someone removes it).

- [ ] **Step 4: Set up branch protection**

Because Stephan is solo right now, require passing CI but not approving reviews. When a collaborator exists, re-run this step with `required_approving_review_count: 1`.

```bash
gh api -X PUT "repos/$REPO/branches/main/protection" \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["check"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

`enforce_admins: false` lets repo admins bypass in emergencies. The `"check"` context matches the job name in `ci.yml` — if the job is renamed, update this rule.

- [ ] **Step 5: Commit and open the final PR**

```bash
git add .github/workflows/build-desktop.yml .github/workflows/deploy-pages.yml
git commit -m "chore: cutover — Tauri uses ACA URL, retire pages workflow"
git push
gh pr create --title "Cutover: Tauri→ACA, retire pages workflow, branch protection" \
  --body "After Task 17. Verifies first ACA deploy and closes out the migration."
```

- [ ] **Step 6: Merge via the protected-branch flow**

Merge through the GitHub UI. Branch protection is now in effect — `ci.yml` must pass; force-push to main is blocked.

- [ ] **Step 7: Final verification**

```bash
# ACA deploy is healthy
curl -s "https://$APP_URL/api/projects" -H "Authorization: Bearer bad" | head -1
# Expected: JSON with "Invalid token"

# Tag a Tauri release to confirm VITE_API_URL is picked up
git tag v0.2.0-azure
git push origin v0.2.0-azure
gh run watch --repo "$REPO"
# Expected: desktop build succeeds, installers attach to the draft release
```

Install the Mac build, sign in, create a project, confirm it round-trips to ACA (check via `az storage blob list -c projects --account-name <account> --auth-mode login`).

---

## Notes for the implementer

- **Commit discipline:** every task ends with a commit. Don't batch.
- **Red/green/commit cadence:** the TDD tasks (3–8) follow the same shape — write the failing test, confirm it fails for the right reason, write minimal code, confirm it passes, commit.
- **Azurite in tests:** tests in Phase 2 require Azurite listening on `localhost:10000`. Either `docker compose up azurite` or `docker run -d -p 10000:10000 mcr.microsoft.com/azure-storage/azurite`. CI handles this automatically via service containers in `ci.yml`.
- **Typecheck drift:** run `npm run check` after every non-trivial edit. Biome auto-applies formatting; catches most style drift silently.
- **Rollback:** if Task 13 or 16 fails, `az group delete --name rg-markr --yes --no-wait` nukes everything in one command. Recreation takes ~90 seconds via the same Bicep.
- **Branch flow:** all work to this plan happens on `spec/azure-deployment`. The plan produces ~15 commits. Review the final diff before merge to `main`.
