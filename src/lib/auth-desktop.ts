/**
 * Desktop (Tauri) Google sign-in via PKCE OAuth 2.0.
 *
 * Flow:
 *  1. Start ephemeral localhost server (Rust command) → get port
 *  2. Build Google auth URL with redirect_uri=http://127.0.0.1:<port>
 *  3. Open URL in system browser (tauri-plugin-opener)
 *  4. Browser completes Google auth, redirects to localhost server
 *  5. Rust server captures auth code, emits "oauth::code" event
 *  6. Exchange code for id_token + access_token via PKCE (no client secret)
 *  7. Sign into Firebase with GoogleAuthProvider.credential(idToken, accessToken)
 *
 * Required env var: VITE_GOOGLE_DESKTOP_CLIENT_ID
 * (Create a "Desktop application" OAuth client in Google Cloud Console)
 */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

// ── PKCE helpers ──────────────────────────────────────────────────────────────

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

// ── Main export ───────────────────────────────────────────────────────────────

export async function signInWithGoogleDesktop(): Promise<void> {
  const clientId = import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      "VITE_GOOGLE_DESKTOP_CLIENT_ID is not set. " +
        "Create a Desktop OAuth client in Google Cloud Console and add it to .env.local."
    );
  }
  if (!auth) throw new Error("Firebase auth not initialised");

  // 1. Start the local redirect server
  const port = await invoke<number>("start_oauth_listener");
  const redirectUri = `http://127.0.0.1:${port}`;

  // 2. Generate PKCE pair
  const { verifier, challenge } = await pkce();

  // 3. Build Google OAuth URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    code_challenge: challenge,
    code_challenge_method: "S256",
    // Hint Firebase domain so Google sets the right audience
    hd: "",
    prompt: "select_account",
  });

  // 4. Open system browser
  await openUrl(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);

  // 5. Wait for auth code from Rust listener
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
        // 6. Exchange code for tokens (PKCE — no client secret needed)
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
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

        // 7. Sign into Firebase
        const credential = GoogleAuthProvider.credential(id_token, access_token);
        await signInWithCredential(auth!, credential);

        resolve();
      } catch (err) {
        reject(err);
      }
    }).then(() => {/* listener registered */});
  });
}
