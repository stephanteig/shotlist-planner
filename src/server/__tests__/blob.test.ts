import { BlobServiceClient } from "@azure/storage-blob";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type BlobStore,
  createBlobStore,
  deleteUserProject,
  getUserProject,
  listUserProjects,
  putUserProject,
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
