import { create } from "zustand";
import type { Project, Section, Row, RowType, ProjectMeta } from "@/types";
import { SECTION_COLORS } from "@/types";
import { loadProjects, saveProjects } from "@/lib/storage";
import { makeProject, makeSection, makeRow, uid, cycleColor } from "@/lib/utils";

interface ProjectStore {
  projects: Project[];
  activeProjectId: string | null;

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

  // Selectors
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

  function persist(projects: Project[]) {
    saveProjects(projects);
  }

  return {
    projects: initial,
    activeProjectId: initialActiveId,

    createProject: (name) => {
      const project = makeProject(name);
      const projects = [...get().projects, project];
      persist(projects);
      set({ projects, activeProjectId: project.id });
      return project;
    },

    deleteProject: (id) => {
      const projects = get().projects.filter((p) => p.id !== id);
      const activeProjectId =
        get().activeProjectId === id ? (projects[0]?.id ?? null) : get().activeProjectId;
      persist(projects);
      set({ projects, activeProjectId });
    },

    setActiveProject: (id) => set({ activeProjectId: id }),

    updateProjectMeta: (id, meta) => {
      const projects = updateProject(get().projects, id, (p) =>
        touch({ ...p, meta: { ...p.meta, ...meta } })
      );
      persist(projects);
      set({ projects });
    },

    updateProjectName: (id, name) => {
      const projects = updateProject(get().projects, id, (p) => touch({ ...p, name }));
      persist(projects);
      set({ projects });
    },

    importProject: (partial) => {
      const project: Project = {
        ...makeProject(partial.meta?.client || "Importert prosjekt"),
        meta: partial.meta ?? { client: "", date: "", crew: "" },
        sections: partial.sections ?? [],
      };
      const projects = [...get().projects, project];
      persist(projects);
      set({ projects, activeProjectId: project.id });
      return project;
    },

    addSection: (projectId, name) => {
      const color = SECTION_COLORS[0];
      const section = makeSection(name, color);
      const projects = updateProject(get().projects, projectId, (p) =>
        touch({ ...p, sections: [...p.sections, section] })
      );
      persist(projects);
      set({ projects });
    },

    deleteSection: (projectId, sectionId) => {
      const projects = updateProject(get().projects, projectId, (p) =>
        touch({ ...p, sections: p.sections.filter((s) => s.id !== sectionId) })
      );
      persist(projects);
      set({ projects });
    },

    updateSectionName: (projectId, sectionId, name) => {
      const projects = updateProject(get().projects, projectId, (p) =>
        touch({
          ...p,
          sections: p.sections.map((s) => (s.id === sectionId ? { ...s, name } : s)),
        })
      );
      persist(projects);
      set({ projects });
    },

    toggleCollapse: (projectId, sectionId) => {
      const projects = updateProject(get().projects, projectId, (p) =>
        touch({
          ...p,
          sections: p.sections.map((s) =>
            s.id === sectionId ? { ...s, collapsed: !s.collapsed } : s
          ),
        })
      );
      persist(projects);
      set({ projects });
    },

    cycleColor: (projectId, sectionId) => {
      const projects = updateProject(get().projects, projectId, (p) =>
        touch({
          ...p,
          sections: p.sections.map((s) =>
            s.id === sectionId ? { ...s, color: cycleColor(s.color, SECTION_COLORS) } : s
          ),
        })
      );
      persist(projects);
      set({ projects });
    },

    reorderSections: (projectId, sections) => {
      const projects = updateProject(get().projects, projectId, (p) => touch({ ...p, sections }));
      persist(projects);
      set({ projects });
    },

    addRow: (projectId, sectionId, type) => {
      const row = makeRow(type);
      const projects = updateProject(get().projects, projectId, (p) =>
        touch({
          ...p,
          sections: p.sections.map((s) =>
            s.id === sectionId ? { ...s, rows: [...s.rows, row] } : s
          ),
        })
      );
      persist(projects);
      set({ projects });
      return row.id;
    },

    deleteRow: (projectId, sectionId, rowId) => {
      const projects = updateProject(get().projects, projectId, (p) =>
        touch({
          ...p,
          sections: p.sections.map((s) =>
            s.id === sectionId ? { ...s, rows: s.rows.filter((r) => r.id !== rowId) } : s
          ),
        })
      );
      persist(projects);
      set({ projects });
    },

    updateRow: (projectId, sectionId, rowId, text) => {
      const projects = updateProject(get().projects, projectId, (p) =>
        touch({
          ...p,
          sections: p.sections.map((s) =>
            s.id === sectionId
              ? { ...s, rows: s.rows.map((r) => (r.id === rowId ? { ...r, text } : r)) }
              : s
          ),
        })
      );
      persist(projects);
      set({ projects });
    },

    toggleCheck: (projectId, sectionId, rowId) => {
      const projects = updateProject(get().projects, projectId, (p) =>
        touch({
          ...p,
          sections: p.sections.map((s) =>
            s.id === sectionId
              ? { ...s, rows: s.rows.map((r) => (r.id === rowId ? { ...r, checked: !r.checked } : r)) }
              : s
          ),
        })
      );
      persist(projects);
      set({ projects });
    },

    reorderRows: (projectId, sectionId, rows) => {
      const projects = updateProject(get().projects, projectId, (p) =>
        touch({
          ...p,
          sections: p.sections.map((s) => (s.id === sectionId ? { ...s, rows } : s)),
        })
      );
      persist(projects);
      set({ projects });
    },

    getActiveProject: () => {
      const { projects, activeProjectId } = get();
      return projects.find((p) => p.id === activeProjectId);
    },
  };
});
