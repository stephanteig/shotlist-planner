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
