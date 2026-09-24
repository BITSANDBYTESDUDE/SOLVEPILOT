/**
 * Theme handling.
 *
 * The interface supports `light`, `dark` and `system` (persisted with user
 * preferences in a later phase). The inline script below runs before paint so
 * the correct theme is applied without a flash of the wrong colours.
 */

export const THEME_STORAGE_KEY = "solvepilot-theme";

export type ResolvedTheme = "light" | "dark";

/**
 * No-flash theme bootstrap. Kept dependency-free and CSP-friendly (no eval).
 */
export const themeInitScript = `(function(){try{var key=${JSON.stringify(THEME_STORAGE_KEY)};var stored=localStorage.getItem(key);var prefersDark=window.matchMedia("(prefers-color-scheme: dark)").matches;var theme=stored==="light"||stored==="dark"?stored:(stored==="system"||!stored?(prefersDark?"dark":"light"):"light");var root=document.documentElement;root.classList.toggle("dark",theme==="dark");root.style.colorScheme=theme;}catch(e){}})();`;

export type ThemePreference = "light" | "dark" | "system";

/**
 * Apply a preference immediately and remember it (client only).
 *
 * Writing `localStorage` is what keeps the no-flash script above correct on the
 * next navigation and the next visit, so the server preference and the painted
 * theme can never drift apart.
 */
export function applyThemePreference(theme: ThemePreference): void {
  if (typeof document === "undefined") return;

  const resolved: ResolvedTheme =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private browsing can block storage; the theme still applies for this view.
  }
}
