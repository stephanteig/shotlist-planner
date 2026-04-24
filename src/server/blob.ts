import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob";

export interface BlobStore {
  container: ContainerClient;
}

export function createBlobStore(opts: {
  connectionString?: string;
  accountName?: string;
  container: string;
}): BlobStore {
  if (!opts.connectionString && !opts.accountName) {
    throw new Error("createBlobStore: provide connectionString or accountName");
  }
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
