import { useEffect, useState } from "react";

export const ACCENT_PRESETS = [
  { name: "Green", value: "#168447" },
  { name: "Blue", value: "#2563eb" },
  { name: "Red", value: "#dc2626" },
  { name: "Orange", value: "#ea580c" },
  { name: "Purple", value: "#9333ea" },
  { name: "Black", value: "#171717" },
] as const;

const DEFAULT_ACCENT = ACCENT_PRESETS[0].value;

function hexToOklch(hex: string) {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return "oklch(0.55 0.16 145)";
  const channels = [0, 2, 4].map(
    (start) => Number.parseInt(normalized.slice(start, start + 2), 16) / 255,
  );
  const [r, g, b] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);
  const lightness = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
  const a = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
  const bAxis = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;
  const chroma = Math.sqrt(a * a + bAxis * bAxis);
  const hue = ((Math.atan2(bAxis, a) * 180) / Math.PI + 360) % 360;
  return `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${hue.toFixed(1)})`;
}

function applyAccent(hex: string) {
  const root = document.documentElement;
  const color = hexToOklch(hex);
  root.style.setProperty("--primary", color);
  root.style.setProperty("--ring", color);
  root.style.setProperty("--sidebar-primary", color);
  root.style.setProperty("--accent", `color-mix(in oklab, ${color} 15%, var(--background))`);
  root.style.setProperty("--accent-foreground", color);
  root.style.setProperty("--sidebar-accent", `color-mix(in oklab, ${color} 15%, var(--sidebar))`);
  root.style.setProperty("--sidebar-accent-foreground", color);
  root.style.setProperty(
    "--primary-foreground",
    hex.toLowerCase() === "#171717" ? "oklch(1 0 0)" : "oklch(1 0 0)",
  );
  root.style.setProperty("--sidebar-primary-foreground", "oklch(1 0 0)");
}

/** Dark-mode preference persisted to localStorage. */
export function useTheme() {
  const [dark, setDark] = useState(false);
  const [accent, setAccentState] = useState<string>(DEFAULT_ACCENT);

  useEffect(() => {
    const stored = localStorage.getItem("mas:theme");
    const next = stored
      ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    const storedAccent = localStorage.getItem("mas:accent") ?? DEFAULT_ACCENT;
    setAccentState(storedAccent);
    applyAccent(storedAccent);
  }, []);

  const setTheme = (next: boolean) => {
    setDark(next);
    localStorage.setItem("mas:theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  };

  const setAccent = (next: string) => {
    setAccentState(next);
    localStorage.setItem("mas:accent", next);
    applyAccent(next);
  };

  return { dark, setTheme, toggle: () => setTheme(!dark), accent, setAccent };
}
