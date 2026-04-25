import type { Project } from "@/types";
import { describe, expect, it } from "vitest";
import { mergeProjects } from "../merge";

function p(id: string, updatedAt: string, name = id): Project {
  return {
    id,
    name,
    createdAt: updatedAt,
    updatedAt,
    meta: { client: "", date: "", crew: "" },
    sections: [],
  };
}

describe("mergeProjects", () => {
  it("returns empty when both inputs are empty", () => {
    expect(mergeProjects([], [])).toEqual([]);
  });

  it("keeps newer copy when same id in both", () => {
    const older = p("a", "2026-01-01T00:00:00Z", "old name");
    const newer = p("a", "2026-02-01T00:00:00Z", "new name");
    const merged = mergeProjects([older], [newer]);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe("new name");
  });

  it("includes unique projects from both sides", () => {
    const a = p("a", "2026-01-01T00:00:00Z");
    const b = p("b", "2026-01-01T00:00:00Z");
    const merged = mergeProjects([a], [b]);
    const ids = merged.map((x) => x.id).sort();
    expect(ids).toEqual(["a", "b"]);
  });

  it("sorts result by updatedAt descending", () => {
    const old = p("a", "2026-01-01T00:00:00Z");
    const mid = p("b", "2026-02-01T00:00:00Z");
    const newest = p("c", "2026-03-01T00:00:00Z");
    expect(mergeProjects([old, newest], [mid]).map((x) => x.id)).toEqual(["c", "b", "a"]);
  });
});
