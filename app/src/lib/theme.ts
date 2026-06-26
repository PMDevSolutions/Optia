import { useCallback, useEffect, useState } from "react";
import { getStorageItem, setStorageItem } from "./storage";

export type Theme = "light" | "dark";

const THEME_KEY = "theme";

/** Apply (or remove) the `.dark` class on the document root. */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/** Read the persisted theme (default light) and apply it. */
export async function loadTheme(): Promise<Theme> {
  const stored = await getStorageItem<Theme>(THEME_KEY);
  const theme: Theme = stored === "dark" ? "dark" : "light";
  applyTheme(theme);
  return theme;
}

/**
 * Theme hook: light-first, persisted in chrome.storage.local.
 * The visual source of truth is the `.dark` class on <html>; this hook
 * tracks it for UI state (e.g. the toggle icon).
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    loadTheme().then(setTheme);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      void setStorageItem(THEME_KEY, next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
