/** True when running inside a Tauri desktop window */
export const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** True when running as a plain web page */
export const isWeb = (): boolean => !isTauri();
