import { create } from "zustand";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth, firebaseEnabled } from "@/lib/firebase";
import { isTauri } from "@/lib/platform";

interface AuthStore {
  user: User | null;
  loading: boolean;
  signingIn: boolean;
  firebaseEnabled: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  _onSignIn: ((user: User) => Promise<void>) | null;
  _onSignOut: (() => void) | null;
  setCallbacks: (onSignIn: (user: User) => Promise<void>, onSignOut: () => void) => void;
  init: () => () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  loading: firebaseEnabled,
  signingIn: false,
  firebaseEnabled,
  _onSignIn: null,
  _onSignOut: null,

  setCallbacks: (onSignIn, onSignOut) => set({ _onSignIn: onSignIn, _onSignOut: onSignOut }),

  init: () => {
    if (!firebaseEnabled || !auth) {
      set({ loading: false });
      return () => {};
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      set({ user, loading: false });
      if (user) {
        await get()._onSignIn?.(user);
      } else {
        get()._onSignOut?.();
      }
    });
    return unsub;
  },

  signInWithGoogle: async () => {
    if (!firebaseEnabled || !auth) return;
    set({ signingIn: true });
    try {
      if (isTauri()) {
        // Desktop: system browser + PKCE flow (avoids tauri:// origin issue)
        const { signInWithGoogleDesktop } = await import("@/lib/auth-desktop");
        await signInWithGoogleDesktop();
      } else {
        // Web: standard popup flow
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      }
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user") {
        console.error("Sign-in error:", err);
        throw err;
      }
    } finally {
      set({ signingIn: false });
    }
  },

  signOut: async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
  },
}));
