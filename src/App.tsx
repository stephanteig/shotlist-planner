import { Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Dashboard } from "@/pages/Dashboard";
import { ProjectView } from "@/pages/ProjectView";
import { Settings } from "@/pages/Settings";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="project" element={<ProjectView />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
