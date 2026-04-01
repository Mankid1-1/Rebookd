import { useMemo } from "react";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Convert a CSS color value to hex using an offscreen canvas.
 * Works with oklch(), rgb(), hsl(), hex, named colors, etc.
 */
function cssColorToHex(color: string): string {
  if (!color || !color.trim()) return "#888888";
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return "#888888";
    ctx.fillStyle = color;
    return ctx.fillStyle; // browser normalizes to #rrggbb
  } catch {
    return "#888888";
  }
}

/**
 * Read a CSS custom property from the root element and convert to hex.
 */
function getVarHex(prop: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  return cssColorToHex(raw);
}

/**
 * Theme-aware chart colors hook.
 *
 * Returns hex color strings derived from CSS custom properties so
 * Recharts and other chart libraries can consume them. Recalculates
 * when the theme changes.
 */
export function useChartColors() {
  const { theme, isDark } = useTheme();

  return useMemo(() => {
    const chart1 = getVarHex("--chart-1");
    const chart2 = getVarHex("--chart-2");
    const chart3 = getVarHex("--chart-3");
    const chart4 = getVarHex("--chart-4");
    const chart5 = getVarHex("--chart-5");
    const primary = getVarHex("--primary");
    const destructive = getVarHex("--destructive");
    const mutedFg = getVarHex("--muted-foreground");

    return {
      // Direct chart palette
      chart1,
      chart2,
      chart3,
      chart4,
      chart5,

      // Semantic aliases
      primary,
      destructive,
      muted: mutedFg,

      // Status colors — theme-aware
      success: chart3,     // green-ish in most themes
      warning: chart4,     // amber/warm in most themes
      info: chart2,        // secondary chart color
      danger: chart5,      // red-ish in most themes

      // For isDark conditional logic in existing code
      isDark,
    };
  }, [theme, isDark]);
}
