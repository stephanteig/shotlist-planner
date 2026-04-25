import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import type { JWTVerifyGetKey } from "jose";
import { createFirebaseJwks, createVerifier } from "./auth";
import { type BlobStore, createBlobStore } from "./blob";
import { loadEnv } from "./env";
import { mountApiRoutes } from "./routes";

export interface AppOptions {
  verifier: { projectId: string; jwks: JWTVerifyGetKey };
  store: BlobStore;
  serveStatic?: boolean;
}

export function createApp(opts: AppOptions) {
  const app = new Hono();
  const verifier = createVerifier(opts.verifier);
  mountApiRoutes(app, verifier, opts.store);

  if (opts.serveStatic) {
    app.use("/*", serveStatic({ root: "./dist/client" }));
    app.get("*", serveStatic({ path: "./dist/client/index.html" }));
  }
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = loadEnv();
  const store = createBlobStore(
    env.azuriteConnection
      ? { connectionString: env.azuriteConnection, container: env.blobContainerName }
      : { accountName: env.storageAccountName, container: env.blobContainerName }
  );
  await store.container.createIfNotExists();
  const app = createApp({
    verifier: { projectId: env.firebaseProjectId, jwks: createFirebaseJwks() },
    store,
    serveStatic: true,
  });
  serve({ fetch: app.fetch, port: env.port });
  console.log(`Server listening on http://0.0.0.0:${env.port}`);
}
