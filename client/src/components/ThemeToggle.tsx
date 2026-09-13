import { useState } from "react";
import { MoonIcon, SunIcon } from "./icons";

type Theme = "light" | "dark";

function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function setTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // localStorage unavailable (private browsing, etc.) - theme just won't persist
  }
}

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(readTheme);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  };

  return (
    <button
      type="button"
      className="rail-theme-toggle"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
