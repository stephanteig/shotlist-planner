import { Hono, type MiddlewareHandler } from "hono";
import type { Verifier } from "./auth";
import { type BlobStore, deleteUserProject, listUserProjects, putUserProject } from "./blob";

export type AppEnv = { Variables: { uid: string } };

export function authMiddleware(verifier: Verifier): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const header = c.req.header("Authorization") ?? "";
    const match = header.match(/^Bearer (.+)$/);
    if (!match) return c.json({ error: "Missing bearer token" }, 401);
    try {
      const claims = await verifier.verify(match[1]);
      c.set("uid", claims.uid);
      await next();
    } catch (_err) {
      return c.json({ error: "Invalid token" }, 401);
    }
  };
}

export function mountApiRoutes(app: Hono, verifier: Verifier, store: BlobStore): void {
  const api = new Hono<AppEnv>();
  api.use("*", authMiddleware(verifier));

  api.get("/projects", async (c) => {
    const uid = c.get("uid");
    const projects = await listUserProjects(store, uid);
    return c.json(projects);
  });

  api.put("/projects/:id", async (c) => {
    const uid = c.get("uid");
    const id = c.req.param("id");
    let body: { id?: string };
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
    const uid = c.get("uid");
    const id = c.req.param("id");
    await deleteUserProject(store, uid, id);
    return c.body(null, 204);
  });

  app.route("/api", api);
}
