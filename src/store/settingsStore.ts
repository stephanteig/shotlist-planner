import { create } from "zustand";
import type { AppSettings, AccentColor, FontSize, Theme } from "@/types";
import { DEFAULT_SETTINGS } from "@/types";
import { loadSettings, saveSettings } from "@/lib/storage";

interface SettingsStore {
  settings: AppSettings;
  setTheme: (theme: Theme) => void;
  setAccentColor: (color: AccentColor) => void;
  setFontSize: (size: FontSize) => void;
  setCompact: (compact: boolean) => void;
  setWindowOpacity: (opacity: number) => void;
  applyToDOM: () => void;
}

function applySettings(settings: AppSettings) {
  const root = document.documentElement;
  // Theme
  if (settings.theme === "dark" || (settings.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  // Accent color
  root.setAttribute("data-accent", settings.accentColor === "blue" ? "" : settings.accentColor);
  // Font size
  root.setAttribute("data-font-size", settings.fontSize);
  // Compact
  root.setAttribute("data-compact", String(settings.compact));
  // Window opacity — apply via CSS on body
  document.body.style.opacity = settings.windowOpacity === 100 ? "" : String(settings.windowOpacity / 100);
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: loadSettings(),

  setTheme: (theme) => {
    const settings = { ...get().settings, theme };
    set({ settings });
    saveSettings(settings);
    applySettings(settings);
  },

  setAccentColor: (accentColor) => {
    const settings = { ...get().settings, accentColor };
    set({ settings });
    saveSettings(settings);
    applySettings(settings);
  },

  setFontSize: (fontSize) => {
    const settings = { ...get().settings, fontSize };
    set({ settings });
    saveSettings(settings);
    applySettings(settings);
  },

  setCompact: (compact) => {
    const settings = { ...get().settings, compact };
    set({ settings });
    saveSettings(settings);
    applySettings(settings);
  },

  setWindowOpacity: (windowOpacity) => {
    const settings = { ...get().settings, windowOpacity };
    set({ settings });
    saveSettings(settings);
    applySettings(settings);
  },

  applyToDOM: () => {
    applySettings(get().settings);
  },
}));

export { DEFAULT_SETTINGS };
