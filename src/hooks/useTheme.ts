import { useEffect, useState } from "react";

/** Dark-mode preference persisted to localStorage. */
export function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("mas:theme");
    const next = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  }, []);

  const setTheme = (next: boolean) => {
    setDark(next);
    localStorage.setItem("mas:theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  };

  return { dark, setTheme, toggle: () => setTheme(!dark) };
}
