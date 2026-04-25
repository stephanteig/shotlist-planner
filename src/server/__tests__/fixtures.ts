import { SignJWT, exportJWK, generateKeyPair } from "jose";
import type { JWK } from "jose";

export interface TestSigner {
  jwks: { keys: JWK[] };
  issueToken(opts: {
    sub: string;
    email?: string;
    issuer: string;
    audience: string;
    expiresIn?: string;
  }): Promise<string>;
}

export async function makeTestSigner(): Promise<TestSigner> {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "test-key-1";
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";

  return {
    jwks: { keys: [publicJwk] },
    async issueToken({ sub, email, issuer, audience, expiresIn = "1h" }) {
      const jwt = new SignJWT({ email })
        .setProtectedHeader({ alg: "RS256", kid: "test-key-1" })
        .setSubject(sub)
        .setIssuer(issuer)
        .setAudience(audience)
        .setIssuedAt()
        .setExpirationTime(expiresIn);
      return jwt.sign(privateKey);
    },
  };
}
