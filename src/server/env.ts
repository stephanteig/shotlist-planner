export interface Config {
  firebaseProjectId: string;
  storageAccountName: string;
  blobContainerName: string;
  azuriteConnection?: string;
  port: number;
}

// `||` (not `??`) across this module: empty-string env vars are treated
// as unset. Lets `FOO=` in .env.local behave the same as FOO being absent.
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function parsePort(raw: string | undefined): number {
  if (!raw) return 8080;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0 || n > 65535) {
    throw new Error(`Invalid PORT: ${raw} (must be integer 1-65535)`);
  }
  return n;
}

export function loadEnv(): Config {
  return {
    firebaseProjectId: required("FIREBASE_PROJECT_ID"),
    storageAccountName: required("STORAGE_ACCOUNT_NAME"),
    blobContainerName: required("BLOB_CONTAINER_NAME"),
    azuriteConnection: process.env.AZURITE_CONNECTION || undefined,
    port: parsePort(process.env.PORT),
  };
}
