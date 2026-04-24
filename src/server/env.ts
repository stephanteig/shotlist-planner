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
    azuriteConnection: process.env.AZURITE_CONNECTION || undefined,
    port: Number(process.env.PORT || "8080"),
  };
}
