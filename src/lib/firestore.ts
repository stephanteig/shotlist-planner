import { db } from "@/lib/firebase";
import type { Project } from "@/types";
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";

function projectsRef(userId: string) {
  if (!db) throw new Error("Firestore not initialised");
  return collection(db, "users", userId, "projects");
}

export async function fetchCloudProjects(userId: string): Promise<Project[]> {
  const snap = await getDocs(projectsRef(userId));
  return snap.docs.map((d) => d.data() as Project);
}

export async function upsertCloudProject(userId: string, project: Project): Promise<void> {
  const ref = doc(db!, "users", userId, "projects", project.id);
  await setDoc(ref, { ...project, _syncedAt: serverTimestamp() }, { merge: true });
}

export async function deleteCloudProject(userId: string, projectId: string): Promise<void> {
  const ref = doc(db!, "users", userId, "projects", projectId);
  await deleteDoc(ref);
}

/** Upload all local projects to Firestore (merge — keeps newest by updatedAt) */
export async function pushLocalToCloud(userId: string, local: Project[]): Promise<void> {
  await Promise.all(local.map((p) => upsertCloudProject(userId, p)));
}

/** Merge cloud + local arrays: keep newest copy of each project by updatedAt */
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
