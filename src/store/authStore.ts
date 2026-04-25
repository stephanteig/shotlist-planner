import { auth, firebaseEnabled } from "@/lib/firebase";
import { isTauri } from "@/lib/platform";
import {
  GoogleAuthProvider,
  type User,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithPopup,
} from "firebase/auth";
import { create } from "zustand";

interface AuthStore {
  user: User | null;
  loading: boolean;
  signingIn: boolean;
  signInError: string | null;
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
  signInError: null,
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
    if (!firebaseEnabled || !auth) {
      set({
        signInError: `Firebase not initialised (firebaseEnabled=${firebaseEnabled}, auth=${!!auth})`,
      });
      return;
    }
    set({ signingIn: true, signInError: null });
    try {
      if (isTauri()) {
        const { signInWithGoogleDesktop } = await import("@/lib/auth-desktop");
        await signInWithGoogleDesktop();
      } else {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      }
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user") {
        console.error("Sign-in error:", err);
        set({ signInError: err?.message ?? String(err) });
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
