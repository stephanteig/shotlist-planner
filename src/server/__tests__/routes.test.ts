import { BlobServiceClient } from "@azure/storage-blob";
import { createLocalJWKSet } from "jose";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBlobStore } from "../blob";
import { createApp } from "../index";
import { type TestSigner, makeTestSigner } from "./fixtures";

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
      store: createBlobStore({ connectionString: AZURITE_CONNECTION, container: CONTAINER }),
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

  it("400 on malformed JSON body", async () => {
    const token = await tokenFor("u1");
    const res = await app.fetch(
      new Request("http://localhost/api/projects/p1", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{not json",
      })
    );
    expect(res.status).toBe(400);
  });

  it("404 JSON on unknown api path (not SPA HTML)", async () => {
    const res = await req("GET", "/api/nope", await tokenFor("u1"));
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/json/);
  });
});
