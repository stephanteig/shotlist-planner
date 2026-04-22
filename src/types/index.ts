export type RowType = "shot" | "note" | "quote";

export interface Row {
  id: string;
  type: RowType;
  text: string;
  checked: boolean;
}

export interface Section {
  id: string;
  name: string;
  color: string;
  collapsed: boolean;
  rows: Row[];
}

export interface ProjectMeta {
  client: string;
  date: string;
  crew: string;
  location?: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  meta: ProjectMeta;
  sections: Section[];
}

export type AccentColor = "blue" | "purple" | "teal" | "orange" | "rose";
export type FontSize = "small" | "medium" | "large";
export type Theme = "dark" | "light" | "system";
export type StorageMode = "local" | "cloud";

export interface AppSettings {
  theme: Theme;
  accentColor: AccentColor;
  fontSize: FontSize;
  compact: boolean;
  windowOpacity: number;
  /** Desktop only — whether to sync projects to Firestore */
  storageMode: StorageMode;
}

export const SECTION_COLORS = [
  "#7c6af7",
  "#34d399",
  "#60a5fa",
  "#fbbf24",
  "#f87171",
  "#f472b6",
  "#2dd4bf",
  "#a78bfa",
] as const;

export const ACCENT_COLORS: Record<AccentColor, { label: string; hex: string }> = {
  blue:   { label: "Blue",   hex: "#3b82f6" },
  purple: { label: "Purple", hex: "#8b5cf6" },
  teal:   { label: "Teal",   hex: "#14b8a6" },
  orange: { label: "Orange", hex: "#f97316" },
  rose:   { label: "Rose",   hex: "#f43f5e" },
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  accentColor: "blue",
  fontSize: "medium",
  compact: false,
  windowOpacity: 100,
  storageMode: "local",
};
