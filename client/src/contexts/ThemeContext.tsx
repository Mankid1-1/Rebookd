import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeName = "abyss" | "light" | "corporate" | "pink" | "emerald";

const DARK_THEMES: ThemeName[] = ["abyss"];
const VALID_THEMES: ThemeName[] = ["abyss", "light", "corporate", "pink", "emerald"];
const STORAGE_KEY = "rebooked-theme";

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeName;
}

function isValidTheme(value: unknown): value is ThemeName {
  return typeof value === "string" && VALID_THEMES.includes(value as ThemeName);
}

export function ThemeProvider({
  children,
  defaultTheme = "corporate",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (typeof window === "undefined") return defaultTheme;
    const stored = localStorage.getItem(STORAGE_KEY);
    return isValidTheme(stored) ? stored : defaultTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);

    if (DARK_THEMES.includes(theme)) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (next: ThemeName) => {
    if (isValidTheme(next)) {
      // Suppress visual anomaly detector and theme integrity checker during theme transition
      try {
        import("@/lib/visualAnomalyDetector").then((m) => m.suppressForThemeChange()).catch(() => {});
        import("@/lib/themeIntegrityChecker").then((m) => m.suppressForThemeChange()).catch(() => {});
      } catch { /* noop */ }
      setThemeState(next);
    }
  };

  const isDark = DARK_THEMES.includes(theme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

export const THEME_META: Record<ThemeName, { label: string; description: string }> = {
  abyss: { label: "Abyss", description: "Deep navy with gold accents" },
  light: { label: "Light", description: "Clean white with blue accents" },
  corporate: { label: "Corporate", description: "Professional white and red" },
  pink: { label: "Pink", description: "Soft blush and rose tones" },
  emerald: { label: "Emerald", description: "Forest greens and earth tones" },
};
