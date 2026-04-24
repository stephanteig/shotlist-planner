import { AppShell } from "@/components/layout/AppShell";
import { Dashboard } from "@/pages/Dashboard";
import { ProjectView } from "@/pages/ProjectView";
import { Settings } from "@/pages/Settings";
import { Route, Routes } from "react-router-dom";

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
