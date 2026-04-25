import { type JWTVerifyGetKey, createRemoteJWKSet, jwtVerify } from "jose";

export interface TokenClaims {
  uid: string;
  email?: string;
}

export interface Verifier {
  verify(token: string): Promise<TokenClaims>;
}

export function createVerifier(opts: {
  projectId: string;
  jwks: JWTVerifyGetKey;
}): Verifier {
  const issuer = `https://securetoken.google.com/${opts.projectId}`;
  return {
    async verify(token) {
      const { payload } = await jwtVerify(token, opts.jwks, {
        issuer,
        audience: opts.projectId,
      });
      if (typeof payload.sub !== "string" || !payload.sub) {
        throw new Error("Token missing sub");
      }
      return {
        uid: payload.sub,
        email: typeof payload.email === "string" ? payload.email : undefined,
      };
    },
  };
}

export function createFirebaseJwks(): JWTVerifyGetKey {
  return createRemoteJWKSet(
    new URL(
      "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
    )
  );
}
