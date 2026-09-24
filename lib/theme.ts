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
