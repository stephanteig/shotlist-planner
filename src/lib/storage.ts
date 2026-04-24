import type { AppSettings, Project } from "@/types";
import { DEFAULT_SETTINGS } from "@/types";

const PROJECTS_KEY = "markr-projects";
const SETTINGS_KEY = "markr-settings";
const LEGACY_KEY = "sw-shotlist-v2";

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (raw) return JSON.parse(raw) as Project[];

    // Migrate from old format
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const data = JSON.parse(legacy);
      const migrated: Project = {
        id: `${Date.now()}-migrated`,
        name: data.meta?.client || "Importert prosjekt",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        meta: {
          client: data.meta?.client ?? "",
          date: data.meta?.date ?? "",
          crew: data.meta?.crew ?? "",
        },
        sections: (data.sections ?? []).map((s: any) => ({
          ...s,
          id: String(s.id),
          rows: (s.rows ?? []).map((r: any) => ({ ...r, id: String(r.id) })),
        })),
      };
      saveProjects([migrated]);
      return [migrated];
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

export function saveProjects(projects: Project[]): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function exportProject(project: Project): void {
  const payload = {
    _app: "markr",
    _version: 2,
    exportedAt: new Date().toISOString(),
    meta: project.meta,
    sections: project.sections,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = (project.meta.client || project.name)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const date = project.meta.date || new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${slug}-${date}.swshot`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseImportFile(json: string): Partial<Project> | null {
  try {
    const data = JSON.parse(json);
    // Accept both old (sw-shotlist) and new (markr) format
    if (data._app !== "sw-shotlist" && data._app !== "markr") return null;
    return {
      meta: data.meta ?? {},
      sections: (data.sections ?? []).map((s: any) => ({
        ...s,
        id: String(s.id),
        rows: (s.rows ?? []).map((r: any) => ({ ...r, id: String(r.id) })),
      })),
    };
  } catch {
    return null;
  }
}
