import { useTheme, THEME_META, type ThemeName } from "@/contexts/ThemeContext";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Theme preview colors — must match the CSS custom properties in index.css.
 * These are static hex approximations used only for the tiny preview swatches.
 */
const THEME_PREVIEWS: Record<ThemeName, { bg: string; sidebar: string; primary: string; accent: string; fg: string }> = {
  abyss: {
    bg: "#0f1729",
    sidebar: "#0a1120",
    primary: "#d4a843",
    accent: "#d4a843",
    fg: "#e8e4d0",
  },
  light: {
    bg: "#f8f9fa",
    sidebar: "#f0f1f3",
    primary: "#3b7cf5",
    accent: "#dbe8fc",
    fg: "#1a2332",
  },
  corporate: {
    bg: "#f5f0ee",
    sidebar: "#1e2430",
    primary: "#d44030",
    accent: "#f0d0cc",
    fg: "#1e2430",
  },
  pink: {
    bg: "#f8e8f0",
    sidebar: "#f0d5e5",
    primary: "#d44090",
    accent: "#b070c0",
    fg: "#3a1830",
  },
  emerald: {
    bg: "#eef5f0",
    sidebar: "#1a3828",
    primary: "#2a9060",
    accent: "#b0a040",
    fg: "#1a3020",
  },
};

interface ThemeSelectorProps {
  compact?: boolean;
}

export function ThemeSelector({ compact = false }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={cn("grid gap-3", compact ? "grid-cols-5" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5")}>
      {(Object.keys(THEME_META) as ThemeName[]).map((key) => {
        const meta = THEME_META[key];
        const preview = THEME_PREVIEWS[key];
        const isActive = theme === key;

        return (
          <button
            key={key}
            onClick={() => setTheme(key)}
            className={cn(
              "relative flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all",
              "hover:scale-[1.02] active:scale-[0.98]",
              isActive
                ? "border-primary ring-2 ring-primary/30"
                : "border-border hover:border-primary/40",
            )}
          >
            {/* Theme preview mini card */}
            <div
              className="w-full aspect-[4/3] rounded-md overflow-hidden border border-border/50"
              style={{ backgroundColor: preview.bg }}
            >
              <div className="flex h-full">
                {/* Sidebar strip */}
                <div
                  className="w-[22%] h-full"
                  style={{ backgroundColor: preview.sidebar }}
                />
                {/* Content area */}
                <div className="flex-1 p-1.5 flex flex-col gap-1">
                  {/* Header bar */}
                  <div
                    className="h-1.5 w-3/4 rounded-full"
                    style={{ backgroundColor: preview.primary }}
                  />
                  {/* Content lines */}
                  <div
                    className="h-1 w-full rounded-full opacity-30"
                    style={{ backgroundColor: preview.fg }}
                  />
                  <div
                    className="h-1 w-2/3 rounded-full opacity-20"
                    style={{ backgroundColor: preview.fg }}
                  />
                  {/* Accent element */}
                  <div className="mt-auto flex gap-1">
                    <div
                      className="h-2 w-2 rounded-sm"
                      style={{ backgroundColor: preview.primary }}
                    />
                    <div
                      className="h-2 w-2 rounded-sm"
                      style={{ backgroundColor: preview.accent }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Label */}
            {!compact && (
              <div className="text-center">
                <div className="text-xs font-medium">{meta.label}</div>
                <div className="text-[10px] text-muted-foreground leading-tight">
                  {meta.description}
                </div>
              </div>
            )}
            {compact && (
              <div className="text-[10px] font-medium">{meta.label}</div>
            )}

            {/* Active check */}
            {isActive && (
              <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                <Check className="h-2.5 w-2.5 text-primary-foreground" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
