import { create } from "zustand";
import type { Project, Section, Row, RowType, ProjectMeta } from "@/types";
import { SECTION_COLORS } from "@/types";
import { loadProjects, saveProjects } from "@/lib/storage";
import { makeProject, makeSection, makeRow, cycleColor } from "@/lib/utils";
import { upsertCloudProject, deleteCloudProject, fetchCloudProjects, mergeProjects } from "@/lib/firestore";
import { firebaseEnabled } from "@/lib/firebase";

// Debounce helper — debounces per projectId
const cloudTimers = new Map<string, ReturnType<typeof setTimeout>>();
function scheduleCloudWrite(projectId: string, fn: () => void, delay = 1200) {
  const existing = cloudTimers.get(projectId);
  if (existing) clearTimeout(existing);
  cloudTimers.set(projectId, setTimeout(() => { fn(); cloudTimers.delete(projectId); }, delay));
}

interface SyncState {
  cloudEnabled: boolean;  // cloud mode is on in settings
  userId: string | null;  // set when user is signed in
}

interface ProjectStore {
  projects: Project[];
  activeProjectId: string | null;
  sync: SyncState;

  // Sync control (called by authStore / settingsStore)
  enableCloudSync: (userId: string, cloudMode: boolean) => Promise<void>;
  disableCloudSync: () => void;
  setCloudMode: (enabled: boolean) => void;

  // Project CRUD
  createProject: (name?: string) => Project;
  deleteProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  updateProjectMeta: (id: string, meta: Partial<ProjectMeta>) => void;
  updateProjectName: (id: string, name: string) => void;
  importProject: (partial: Partial<Project>) => Project;

  // Section CRUD
  addSection: (projectId: string, name?: string) => void;
  deleteSection: (projectId: string, sectionId: string) => void;
  updateSectionName: (projectId: string, sectionId: string, name: string) => void;
  toggleCollapse: (projectId: string, sectionId: string) => void;
  cycleColor: (projectId: string, sectionId: string) => void;
  reorderSections: (projectId: string, sections: Section[]) => void;

  // Row CRUD
  addRow: (projectId: string, sectionId: string, type: RowType) => string;
  deleteRow: (projectId: string, sectionId: string, rowId: string) => void;
  updateRow: (projectId: string, sectionId: string, rowId: string, text: string) => void;
  toggleCheck: (projectId: string, sectionId: string, rowId: string) => void;
  reorderRows: (projectId: string, sectionId: string, rows: Row[]) => void;

  getActiveProject: () => Project | undefined;
}

function touch(project: Project): Project {
  return { ...project, updatedAt: new Date().toISOString() };
}

function updateProject(projects: Project[], id: string, fn: (p: Project) => Project): Project[] {
  return projects.map((p) => (p.id === id ? fn(p) : p));
}

export const useProjectStore = create<ProjectStore>((set, get) => {
  const initial = loadProjects();
  const initialActiveId = initial.length > 0 ? initial[0].id : null;

  function persistLocal(projects: Project[]) {
    saveProjects(projects);
  }

  function persistCloud(project: Project) {
    const { sync } = get();
    if (!firebaseEnabled || !sync.cloudEnabled || !sync.userId) return;
    scheduleCloudWrite(project.id, () => {
      upsertCloudProject(sync.userId!, project).catch(console.error);
    });
  }

  function persist(projects: Project[], changedId?: string) {
    persistLocal(projects);
    if (changedId) {
      const changed = projects.find((p) => p.id === changedId);
      if (changed) persistCloud(changed);
    }
  }

  return {
    projects: initial,
    activeProjectId: initialActiveId,
    sync: { cloudEnabled: false, userId: null },

    enableCloudSync: async (userId, cloudMode) => {
      set({ sync: { cloudEnabled: cloudMode, userId } });
      if (!cloudMode || !firebaseEnabled) return;

      // Merge cloud + local projects
      const cloud = await fetchCloudProjects(userId).catch(() => [] as Project[]);
      const local = get().projects;
      const merged = mergeProjects(cloud, local);

      persistLocal(merged);
      set({ projects: merged, activeProjectId: get().activeProjectId ?? merged[0]?.id ?? null });
    },

    disableCloudSync: () => {
      set({ sync: { cloudEnabled: false, userId: null } });
    },

    setCloudMode: (enabled) => {
      const { userId } = get().sync;
      set({ sync: { cloudEnabled: enabled, userId } });
      // If enabling cloud and already signed in, push local data up
      if (enabled && userId && firebaseEnabled) {
        get().projects.forEach((p) => upsertCloudProject(userId, p).catch(console.error));
      }
    },

    createProject: (name) => {
      const project = makeProject(name);
      const projects = [...get().projects, project];
      persist(projects, project.id);
      set({ projects, activeProjectId: project.id });
      return project;
    },

    deleteProject: (id) => {
      const projects = get().projects.filter((p) => p.id !== id);
      const { sync } = get();
      if (firebaseEnabled && sync.cloudEnabled && sync.userId) {
        deleteCloudProject(sync.userId, id).catch(console.error);
      }
      const activeProjectId = get().activeProjectId === id ? (projects[0]?.id ?? null) : get().activeProjectId;
      persistLocal(projects);
      set({ projects, activeProjectId });
    },

    setActiveProject: (id) => set({ activeProjectId: id }),

    updateProjectMeta: (id, meta) => {
      const projects = updateProject(get().projects, id, (p) => touch({ ...p, meta: { ...p.meta, ...meta } }));
      persist(projects, id);
      set({ projects });
    },

    updateProjectName: (id, name) => {
      const projects = updateProject(get().projects, id, (p) => touch({ ...p, name }));
      persist(projects, id);
      set({ projects });
    },

    importProject: (partial) => {
      const project: Project = {
        ...makeProject(partial.meta?.client || "Importert prosjekt"),
        meta: partial.meta ?? { client: "", date: "", crew: "" },
        sections: partial.sections ?? [],
      };
      const projects = [...get().projects, project];
      persist(projects, project.id);
      set({ projects, activeProjectId: project.id });
      return project;
    },

    addSection: (projectId, name) => {
      const section = makeSection(name, SECTION_COLORS[0]);
      const projects = updateProject(get().projects, projectId, (p) => touch({ ...p, sections: [...p.sections, section] }));
      persist(projects, projectId);
      set({ projects });
    },

    deleteSection: (projectId, sectionId) => {
      const projects = updateProject(get().projects, projectId, (p) => touch({ ...p, sections: p.sections.filter((s) => s.id !== sectionId) }));
      persist(projects, projectId);
      set({ projects });
    },

    updateSectionName: (projectId, sectionId, name) => {
      const projects = updateProject(get().projects, projectId, (p) => touch({ ...p, sections: p.sections.map((s) => s.id === sectionId ? { ...s, name } : s) }));
      persist(projects, projectId);
      set({ projects });
    },

    toggleCollapse: (projectId, sectionId) => {
      const projects = updateProject(get().projects, projectId, (p) => touch({ ...p, sections: p.sections.map((s) => s.id === sectionId ? { ...s, collapsed: !s.collapsed } : s) }));
      persist(projects, projectId);
      set({ projects });
    },

    cycleColor: (projectId, sectionId) => {
      const projects = updateProject(get().projects, projectId, (p) => touch({ ...p, sections: p.sections.map((s) => s.id === sectionId ? { ...s, color: cycleColor(s.color, SECTION_COLORS) } : s) }));
      persist(projects, projectId);
      set({ projects });
    },

    reorderSections: (projectId, sections) => {
      const projects = updateProject(get().projects, projectId, (p) => touch({ ...p, sections }));
      persist(projects, projectId);
      set({ projects });
    },

    addRow: (projectId, sectionId, type) => {
      const row = makeRow(type);
      const projects = updateProject(get().projects, projectId, (p) => touch({ ...p, sections: p.sections.map((s) => s.id === sectionId ? { ...s, rows: [...s.rows, row] } : s) }));
      persist(projects, projectId);
      set({ projects });
      return row.id;
    },

    deleteRow: (projectId, sectionId, rowId) => {
      const projects = updateProject(get().projects, projectId, (p) => touch({ ...p, sections: p.sections.map((s) => s.id === sectionId ? { ...s, rows: s.rows.filter((r) => r.id !== rowId) } : s) }));
      persist(projects, projectId);
      set({ projects });
    },

    updateRow: (projectId, sectionId, rowId, text) => {
      const projects = updateProject(get().projects, projectId, (p) => touch({ ...p, sections: p.sections.map((s) => s.id === sectionId ? { ...s, rows: s.rows.map((r) => r.id === rowId ? { ...r, text } : r) } : s) }));
      persist(projects, projectId);
      set({ projects });
    },

    toggleCheck: (projectId, sectionId, rowId) => {
      const projects = updateProject(get().projects, projectId, (p) => touch({ ...p, sections: p.sections.map((s) => s.id === sectionId ? { ...s, rows: s.rows.map((r) => r.id === rowId ? { ...r, checked: !r.checked } : r) } : s) }));
      persist(projects, projectId);
      set({ projects });
    },

    reorderRows: (projectId, sectionId, rows) => {
      const projects = updateProject(get().projects, projectId, (p) => touch({ ...p, sections: p.sections.map((s) => s.id === sectionId ? { ...s, rows } : s) }));
      persist(projects, projectId);
      set({ projects });
    },

    getActiveProject: () => {
      const { projects, activeProjectId } = get();
      return projects.find((p) => p.id === activeProjectId);
    },
  };
});
