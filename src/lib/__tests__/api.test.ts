import type { Project } from "@/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteCloudProject, fetchCloudProjects, upsertCloudProject } from "../api";

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
    // Node's Request constructor requires absolute URLs; prefix relative paths
    // with a dummy host. Tests only inspect URL.pathname so host is irrelevant.
    const url =
      input instanceof Request
        ? input.url
        : typeof input === "string" && input.startsWith("/")
          ? `http://test.local${input}`
          : input;
    const req = input instanceof Request ? input : new Request(url, init);
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
