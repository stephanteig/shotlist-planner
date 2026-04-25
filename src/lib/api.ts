import { auth } from "@/lib/firebase";
import type { Project } from "@/types";

/**
 * API base URL. For web (same-origin) this is empty string; for Tauri desktop
 * VITE_API_URL is set at build time to the deployed ACA URL.
 */
const BASE = import.meta.env.VITE_API_URL ?? "";

async function getToken(): Promise<string> {
  // Hook for tests; production uses Firebase auth.
  const override = (globalThis as any).__markrGetIdToken;
  if (typeof override === "function") return override();
  if (!auth?.currentUser) throw new Error("Not signed in");
  return auth.currentUser.getIdToken();
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} on ${path}`);
  }
  return res;
}

// Signatures match the old firestore.ts so projectStore.ts import changes in one place.
export async function fetchCloudProjects(_userId: string): Promise<Project[]> {
  const res = await request("/api/projects");
  return (await res.json()) as Project[];
}

export async function upsertCloudProject(_userId: string, project: Project): Promise<void> {
  await request(`/api/projects/${project.id}`, {
    method: "PUT",
    body: JSON.stringify(project),
  });
}

export async function deleteCloudProject(_userId: string, projectId: string): Promise<void> {
  await request(`/api/projects/${projectId}`, { method: "DELETE" });
}

export { mergeProjects } from "./merge";
