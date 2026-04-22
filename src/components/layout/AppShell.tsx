import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Titlebar } from "./Titlebar";
import { Sidebar } from "./Sidebar";
import { ToastContainer, useToast } from "@/components/ui/toast";
import { useProjectStore } from "@/store/projectStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useAuthStore } from "@/store/authStore";
import { isTauri } from "@/lib/platform";
import type { User } from "firebase/auth";

export function AppShell() {
  const { toasts, removeToast } = useToast();
  const { getActiveProject } = useProjectStore();
  const { applyToDOM, settings } = useSettingsStore();
  const { init: initAuth, setCallbacks } = useAuthStore();
  const { enableCloudSync, disableCloudSync, setCloudMode } = useProjectStore();
  const location = useLocation();
  const activeProject = getActiveProject();

  // Apply appearance settings on mount
  useEffect(() => { applyToDOM(); }, [applyToDOM]);

  // Wire auth callbacks so login/logout triggers cloud sync
  useEffect(() => {
    const onSignIn = async (user: User) => {
      const cloudMode = isTauri() ? settings.storageMode === "cloud" : true;
      await enableCloudSync(user.uid, cloudMode);
    };
    const onSignOut = () => disableCloudSync();
    setCallbacks(onSignIn, onSignOut);
  }, [settings.storageMode, enableCloudSync, disableCloudSync, setCallbacks]);

  // Re-apply cloud mode when settings toggle changes (desktop only)
  useEffect(() => {
    if (isTauri()) {
      setCloudMode(settings.storageMode === "cloud");
    }
  }, [settings.storageMode, setCloudMode]);

  // Start Firebase auth listener
  useEffect(() => {
    const unsub = initAuth();
    return unsub;
  }, [initAuth]);

  const titleSuffix =
    location.pathname.startsWith("/project") && activeProject
      ? activeProject.meta.client || activeProject.name
      : undefined;

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-lg bg-background">
      <Titlebar title={titleSuffix} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
