import { LogOut, User, Cloud, HardDrive } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useProjectStore } from "@/store/projectStore";
import { firebaseEnabled } from "@/lib/firebase";
import { isTauri } from "@/lib/platform";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const { user, loading, signInWithGoogle, signOut } = useAuthStore();
  const { settings } = useSettingsStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!firebaseEnabled) return null;
  if (loading) return <div className="h-6 w-6 rounded-full bg-muted animate-pulse" />;

  if (!user) {
    return (
      <button
        onClick={signInWithGoogle}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border"
      >
        <User className="h-3.5 w-3.5" />
        Logg inn
      </button>
    );
  }

  const isCloud = isTauri() ? settings.storageMode === "cloud" : true;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full focus:outline-none focus:ring-1 focus:ring-ring"
        title={user.displayName ?? user.email ?? "Konto"}
      >
        {user.photoURL ? (
          <img src={user.photoURL} className="h-6 w-6 rounded-full ring-1 ring-border" alt="" />
        ) : (
          <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
            {(user.displayName ?? user.email ?? "?")[0].toUpperCase()}
          </div>
        )}
        {isCloud ? (
          <Cloud className="h-3 w-3 text-primary" />
        ) : (
          <HardDrive className="h-3 w-3 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 rounded-lg border border-border bg-card shadow-xl z-50 py-1 animate-fade-in">
          <div className="px-3 py-2 border-b border-border">
            <div className="text-sm font-medium text-foreground truncate">
              {user.displayName ?? "Bruker"}
            </div>
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
          </div>
          <div className="px-3 py-2 border-b border-border">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {isCloud ? (
                <><Cloud className="h-3.5 w-3.5 text-primary" /><span className="text-primary">Cloud sync aktiv</span></>
              ) : (
                <><HardDrive className="h-3.5 w-3.5" /><span>Lokal lagring</span></>
              )}
            </div>
          </div>
          <button
            onClick={() => { signOut(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logg ut
          </button>
        </div>
      )}
    </div>
  );
}
