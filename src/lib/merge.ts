import type { Project } from "../types";

/** Merge cloud + local arrays: keep newest copy of each project by updatedAt. */
export function mergeProjects(cloud: Project[], local: Project[]): Project[] {
  const map = new Map<string, Project>();
  for (const p of [...local, ...cloud]) {
    const existing = map.get(p.id);
    if (!existing || new Date(p.updatedAt) > new Date(existing.updatedAt)) {
      map.set(p.id, p);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
