import { Outlet, useLocation } from "react-router-dom";
import { Titlebar } from "./Titlebar";
import { Sidebar } from "./Sidebar";
import { ToastContainer } from "@/components/ui/toast";
import { useToast } from "@/components/ui/toast";
import { useProjectStore } from "@/store/projectStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useEffect } from "react";

export function AppShell() {
  const { toasts, removeToast } = useToast();
  const { getActiveProject } = useProjectStore();
  const { applyToDOM } = useSettingsStore();
  const location = useLocation();
  const activeProject = getActiveProject();

  // Apply settings on mount
  useEffect(() => {
    applyToDOM();
  }, [applyToDOM]);

  const titleSuffix = location.pathname.startsWith("/project") && activeProject
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
