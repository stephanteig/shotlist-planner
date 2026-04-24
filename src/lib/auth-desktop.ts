import { auth } from "@/lib/firebase";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function pkce(): Promise<{ verifier: string; challenge: string }> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const verifier = b64url(raw.buffer);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = b64url(hash);
  return { verifier, challenge };
}

export async function signInWithGoogleDesktop(): Promise<void> {
  const clientId = import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_SECRET ?? "";
  if (!clientId) throw new Error("VITE_GOOGLE_DESKTOP_CLIENT_ID is not set");
  if (!auth) throw new Error("Firebase auth not initialised");

  const { verifier, challenge } = await pkce();

  // Build URL without redirect_uri — Rust appends it after binding the port
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "openid email profile",
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  const baseUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  // Rust binds the port, appends redirect_uri, opens system browser, returns port
  const port = await invoke<number>("start_oauth_listener", { url: baseUrl });
  const redirectUri = `http://127.0.0.1:${port}`;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Google sign-in timed out (2 minutes)"));
    }, 120_000);

    listen<string>("oauth::code", async (event) => {
      clearTimeout(timer);
      const code = event.payload;
      if (!code) {
        reject(new Error("Google auth cancelled or failed"));
        return;
      }
      try {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
            code_verifier: verifier,
          }),
        });

        if (!tokenRes.ok) {
          const err = await tokenRes.text();
          throw new Error(`Token exchange failed: ${err}`);
        }

        const { id_token, access_token } = await tokenRes.json();
        const credential = GoogleAuthProvider.credential(id_token, access_token);
        await signInWithCredential(auth!, credential);
        resolve();
      } catch (err) {
        reject(err);
      }
    }).then(() => {});
  });
}
