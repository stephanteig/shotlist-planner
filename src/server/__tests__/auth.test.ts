import { createLocalJWKSet } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { createVerifier } from "../auth";
import { type TestSigner, makeTestSigner } from "./fixtures";

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
