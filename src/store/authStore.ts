import { create } from "zustand";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth, firebaseEnabled } from "@/lib/firebase";
import { fetchCloudProjects, pushLocalToCloud, mergeProjects } from "@/lib/firestore";

interface AuthStore {
  user: User | null;
  loading: boolean;
  firebaseEnabled: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Called by projectStore after auth state resolves */
  _onSignIn: ((user: User) => Promise<void>) | null;
  _onSignOut: (() => void) | null;
  setCallbacks: (
    onSignIn: (user: User) => Promise<void>,
    onSignOut: () => void
  ) => void;
  init: () => () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  loading: firebaseEnabled,
  firebaseEnabled,
  _onSignIn: null,
  _onSignOut: null,

  setCallbacks: (onSignIn, onSignOut) => {
    set({ _onSignIn: onSignIn, _onSignOut: onSignOut });
  },

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
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // onAuthStateChanged callback handles the rest
    } catch (err: any) {
      // popup-closed-by-user is not a real error
      if (err?.code !== "auth/popup-closed-by-user") throw err;
    }
  },

  signOut: async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
  },
}));
