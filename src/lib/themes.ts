// App-wide color themes. Tokens live in globals.css as :root[data-theme=...]
// blocks; switching themes is just stamping data-theme on <html>. The default
// (Night Shift) is the bare :root block, so no attribute means Night Shift.
export const THEME_STORAGE_KEY = "dtc-theme";

export interface Theme {
  id: string;
  name: string;
  blurb: string;
  // Swatch preview colors for the picker (mirror globals.css by hand).
  swatch: { bg: string; card: string; accent: string; text: string };
}

export const THEMES: Theme[] = [
  { id: "redline", name: "Redline", blurb: "Near-black and warning red. The default.",
    swatch: { bg: "#120F10", card: "#1C1719", accent: "#E23D3D", text: "#F2EDEE" } },
  { id: "night-shift", name: "Night Shift", blurb: "Black and orange. The original.",
    swatch: { bg: "#0f0f0f", card: "#1a1a1a", accent: "#E85D24", text: "#f0f0f0" } },
  { id: "blueprint", name: "Blueprint", blurb: "Bench blue and soapstone, everywhere.",
    swatch: { bg: "#0C2740", card: "#10314F", accent: "#DE7048", text: "#E9EEF2" } },
  { id: "day-shift", name: "Day Shift", blurb: "Shop white. For people with windows.",
    swatch: { bg: "#F2F0EB", card: "#FFFFFF", accent: "#D14E14", text: "#23201C" } },
  { id: "hi-vis", name: "Hi-Vis", blurb: "Graphite and safety yellow.",
    swatch: { bg: "#121307", card: "#1B1D0E", accent: "#D6E23D", text: "#F1F2E8" } },
];

export const DEFAULT_THEME_ID = "redline";

export function isThemeId(id: string | null | undefined): boolean {
  return !!id && THEMES.some(t => t.id === id);
}

export function getStoredThemeId(): string {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeId(stored) ? (stored as string) : DEFAULT_THEME_ID;
}

export function applyTheme(id: string): void {
  if (typeof document === "undefined") return;
  const valid = isThemeId(id) ? id : DEFAULT_THEME_ID;
  // Every theme has an explicit :root[data-theme=...] block (the bare :root
  // mirrors the default), so we can always stamp the attribute.
  document.documentElement.dataset.theme = valid;
  try { window.localStorage.setItem(THEME_STORAGE_KEY, valid); } catch { /* private mode */ }
}
