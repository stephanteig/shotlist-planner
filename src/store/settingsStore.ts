import { loadSettings, saveSettings } from "@/lib/storage";
import type { AccentColor, AppSettings, FontSize, StorageMode, Theme } from "@/types";
import { DEFAULT_SETTINGS } from "@/types";
import { create } from "zustand";

interface SettingsStore {
  settings: AppSettings;
  setTheme: (theme: Theme) => void;
  setAccentColor: (color: AccentColor) => void;
  setFontSize: (size: FontSize) => void;
  setCompact: (compact: boolean) => void;
  setWindowOpacity: (opacity: number) => void;
  setStorageMode: (mode: StorageMode) => void;
  applyToDOM: () => void;
}

function applySettings(settings: AppSettings) {
  const root = document.documentElement;
  if (
    settings.theme === "dark" ||
    (settings.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.setAttribute("data-accent", settings.accentColor === "blue" ? "" : settings.accentColor);
  root.setAttribute("data-font-size", settings.fontSize);
  root.setAttribute("data-compact", String(settings.compact));
  document.body.style.opacity =
    settings.windowOpacity === 100 ? "" : String(settings.windowOpacity / 100);
}

function update(
  get: () => SettingsStore,
  set: (s: Partial<SettingsStore>) => void,
  patch: Partial<AppSettings>
) {
  const settings = { ...get().settings, ...patch };
  set({ settings });
  saveSettings(settings);
  applySettings(settings);
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: loadSettings(),
  setTheme: (theme) => update(get, set, { theme }),
  setAccentColor: (accentColor) => update(get, set, { accentColor }),
  setFontSize: (fontSize) => update(get, set, { fontSize }),
  setCompact: (compact) => update(get, set, { compact }),
  setWindowOpacity: (windowOpacity) => update(get, set, { windowOpacity }),
  setStorageMode: (storageMode) => update(get, set, { storageMode }),
  applyToDOM: () => applySettings(get().settings),
}));

export { DEFAULT_SETTINGS };
