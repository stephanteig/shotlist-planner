import type { Project, Row, Section } from "@/types";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function makeRow(type: Row["type"] = "shot", text = ""): Row {
  return { id: uid(), type, text, checked: false };
}

export function makeSection(name = "Ny scene", color = "#7c6af7"): Section {
  return { id: uid(), name, color, collapsed: false, rows: [] };
}

export function makeProject(name = "Nytt prosjekt"): Project {
  return {
    id: uid(),
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    meta: { client: "", date: "", crew: "" },
    sections: [],
  };
}

export function countShots(sections: Section[]) {
  let total = 0;
  let done = 0;
  for (const sec of sections) {
    for (const row of sec.rows) {
      if (row.type === "shot") {
        total++;
        if (row.checked) done++;
      }
    }
  }
  return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

export function formatDateNO(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  const days = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "mai",
    "jun",
    "jul",
    "aug",
    "sep",
    "okt",
    "nov",
    "des",
  ];
  return `${days[d.getDay()]} ${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatProjectPreview(project: Project): string {
  const { meta, sections } = project;
  const dateStr = meta.date ? formatDateNO(meta.date) : "";
  const lines: string[] = [];
  lines.push(`Shotlist${dateStr ? " " + dateStr : ""}${meta.client ? " — " + meta.client : ""}`);
  if (meta.crew) lines.push(`Fotograf: ${meta.crew}`);
  lines.push("");

  let shotNum = 1;
  for (const sec of sections) {
    lines.push(sec.name.toUpperCase());
    for (const row of sec.rows) {
      if (row.type === "shot") lines.push(`${row.checked ? "✓" : "☐"} ${shotNum++}. ${row.text}`);
      else if (row.type === "quote") lines.push(`"${row.text}"`);
      else lines.push(`   ${row.text}`);
    }
    lines.push("");
  }

  const total = shotNum - 1;
  lines.push(`── ${total} shots totalt`);
  return lines.join("\n");
}

export function cycleColor(current: string, colors: readonly string[]): string {
  const idx = colors.indexOf(current);
  return colors[(idx + 1) % colors.length];
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
