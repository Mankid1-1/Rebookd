/**
 * Theme Integrity Checker — validates CSS variable consistency per page per theme.
 *
 * Runs after page navigation and theme changes to detect:
 *  - Missing CSS variables (theme not applied to a page)
 *  - Wrong CSS variable values (mismatch vs expected theme config)
 *  - Stale theme attribute (data-theme doesn't match localStorage)
 *  - Missing dark class when on a dark theme
 *  - Elements using hardcoded colors instead of theme variables
 *
 * Reports violations to sentinel via /api/system/client-error with [THEME_MISMATCH] prefix.
 */

type ThemeName = "abyss" | "light" | "corporate" | "pink" | "emerald";

// ── Expected primary CSS variable values per theme (oklch format) ──

const THEME_PRIMARIES: Record<ThemeName, { primary: string; background: string; isDark: boolean }> = {
  abyss:     { primary: "oklch(0.82 0.17 85)",  background: "oklch(0.16 0.03 260)", isDark: true },
  light:     { primary: "oklch(0.55 0.22 255)", background: "oklch(0.99 0 0)",      isDark: false },
  corporate: { primary: "oklch(0.55 0.22 25)",  background: "oklch(0.99 0 0)",      isDark: false },
  pink:      { primary: "oklch(0.65 0.20 340)", background: "oklch(0.96 0.02 340)", isDark: false },
  emerald:   { primary: "oklch(0.58 0.18 155)", background: "oklch(0.97 0.01 155)", isDark: false },
};

// Critical CSS variables that MUST exist for a properly themed page
const REQUIRED_CSS_VARS = [
  "--background",
  "--foreground",
  "--primary",
  "--primary-foreground",
  "--card",
  "--card-foreground",
  "--border",
  "--muted",
  "--accent",
  "--destructive",
  "--sidebar",
  "--sidebar-foreground",
];

const VALID_THEMES: ThemeName[] = ["abyss", "light", "corporate", "pink", "emerald"];

// ── State ──

let initialized = false;
let checkTimer: ReturnType<typeof setTimeout> | null = null;
let lastPage = "";
let lastTheme = "";
let reportCount = 0;
const MAX_REPORTS_PER_SESSION = 20;
const DEDUP_WINDOW_MS = 120_000; // 2 min between same report
const recentReports = new Map<string, number>();

// Suppress checks during theme transitions
let suppressUntil = 0;

export function suppressForThemeChange(): void {
  suppressUntil = Date.now() + 2_000;
}

// ── Core Check ──

function getActiveTheme(): ThemeName | null {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr && VALID_THEMES.includes(attr as ThemeName)) return attr as ThemeName;
  return null;
}

function getStoredTheme(): ThemeName | null {
  const stored = localStorage.getItem("rebooked-theme");
  if (stored && VALID_THEMES.includes(stored as ThemeName)) return stored as ThemeName;
  return null;
}

function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

interface ThemeViolation {
  type: string;
  page: string;
  theme: string;
  detail: string;
  severity: "low" | "medium" | "high" | "critical";
}

function checkThemeIntegrity(): ThemeViolation[] {
  if (Date.now() < suppressUntil) return [];

  const violations: ThemeViolation[] = [];
  const page = window.location.pathname;
  const activeTheme = getActiveTheme();
  const storedTheme = getStoredTheme();
  const hasDarkClass = document.documentElement.classList.contains("dark");

  // 1. No data-theme attribute at all
  if (!activeTheme) {
    violations.push({
      type: "THEME_MISSING",
      page,
      theme: storedTheme || "unknown",
      detail: `No data-theme attribute on <html>. Expected: ${storedTheme || "corporate"}`,
      severity: "high",
    });
    return violations; // Can't check further without theme
  }

  // 2. data-theme vs localStorage mismatch
  if (storedTheme && activeTheme !== storedTheme) {
    violations.push({
      type: "THEME_STORAGE_MISMATCH",
      page,
      theme: activeTheme,
      detail: `data-theme="${activeTheme}" but localStorage has "${storedTheme}"`,
      severity: "medium",
    });
  }

  // 3. Dark class mismatch
  const expected = THEME_PRIMARIES[activeTheme];
  if (expected) {
    if (expected.isDark && !hasDarkClass) {
      violations.push({
        type: "DARK_CLASS_MISSING",
        page,
        theme: activeTheme,
        detail: `Theme "${activeTheme}" is dark but <html> missing .dark class`,
        severity: "high",
      });
    } else if (!expected.isDark && hasDarkClass) {
      violations.push({
        type: "DARK_CLASS_EXTRA",
        page,
        theme: activeTheme,
        detail: `Theme "${activeTheme}" is light but <html> has .dark class`,
        severity: "medium",
      });
    }
  }

  // 4. Required CSS variables missing
  for (const varName of REQUIRED_CSS_VARS) {
    const value = getCSSVar(varName);
    if (!value) {
      violations.push({
        type: "CSS_VAR_MISSING",
        page,
        theme: activeTheme,
        detail: `CSS variable ${varName} is empty/missing for theme "${activeTheme}"`,
        severity: "high",
      });
    }
  }

  // 5. Primary color mismatch — the most critical check
  if (expected) {
    const actualPrimary = getCSSVar("--primary");
    if (actualPrimary && !colorsMatch(actualPrimary, expected.primary)) {
      violations.push({
        type: "PRIMARY_COLOR_MISMATCH",
        page,
        theme: activeTheme,
        detail: `--primary is "${actualPrimary}" but theme "${activeTheme}" expects "${expected.primary}"`,
        severity: "critical",
      });
    }

    const actualBg = getCSSVar("--background");
    if (actualBg && !colorsMatch(actualBg, expected.background)) {
      violations.push({
        type: "BACKGROUND_COLOR_MISMATCH",
        page,
        theme: activeTheme,
        detail: `--background is "${actualBg}" but theme "${activeTheme}" expects "${expected.background}"`,
        severity: "high",
      });
    }
  }

  // 6. Check for hardcoded inline styles overriding theme on key containers
  const mainContent = document.querySelector("main") || document.querySelector("[data-main]") || document.body;
  const inlineBg = mainContent.style.backgroundColor;
  const inlineColor = mainContent.style.color;
  if (inlineBg && !inlineBg.includes("var(")) {
    violations.push({
      type: "HARDCODED_BG_COLOR",
      page,
      theme: activeTheme,
      detail: `Main content has hardcoded background-color: "${inlineBg}" bypassing theme`,
      severity: "medium",
    });
  }
  if (inlineColor && !inlineColor.includes("var(")) {
    violations.push({
      type: "HARDCODED_TEXT_COLOR",
      page,
      theme: activeTheme,
      detail: `Main content has hardcoded color: "${inlineColor}" bypassing theme`,
      severity: "low",
    });
  }

  // 7. Sidebar theme vars check (for dashboard pages)
  if (page.startsWith("/dashboard") || page.startsWith("/leads") || page.startsWith("/automations") ||
      page.startsWith("/settings") || page.startsWith("/analytics") || page.startsWith("/billing") ||
      page.startsWith("/admin") || page.startsWith("/calendar") || page.startsWith("/templates") ||
      page.startsWith("/inbox") || page.startsWith("/referral")) {
    const sidebarVars = ["--sidebar", "--sidebar-foreground", "--sidebar-primary", "--sidebar-accent"];
    for (const v of sidebarVars) {
      const val = getCSSVar(v);
      if (!val) {
        violations.push({
          type: "SIDEBAR_VAR_MISSING",
          page,
          theme: activeTheme,
          detail: `Sidebar CSS variable ${v} is missing on dashboard page`,
          severity: "medium",
        });
      }
    }
  }

  return violations;
}

// ── Color Comparison ──

function colorsMatch(actual: string, expected: string): boolean {
  // Normalize both to comparable format
  const normA = normalizeOklch(actual);
  const normE = normalizeOklch(expected);
  if (normA && normE) {
    // Allow small floating-point tolerance
    return Math.abs(normA.l - normE.l) < 0.02 &&
           Math.abs(normA.c - normE.c) < 0.02 &&
           Math.abs(normA.h - normE.h) < 2;
  }
  // Fallback: string equality after whitespace normalization
  return actual.replace(/\s+/g, " ").trim() === expected.replace(/\s+/g, " ").trim();
}

function normalizeOklch(color: string): { l: number; c: number; h: number } | null {
  const match = color.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/);
  if (!match) return null;
  return {
    l: parseFloat(match[1]),
    c: parseFloat(match[2]),
    h: parseFloat(match[3]),
  };
}

// ── Reporting ──

function reportViolations(violations: ThemeViolation[]): void {
  if (violations.length === 0) return;

  for (const v of violations) {
    if (reportCount >= MAX_REPORTS_PER_SESSION) return;

    const key = `${v.type}:${v.page}:${v.theme}`;
    const lastReport = recentReports.get(key);
    if (lastReport && Date.now() - lastReport < DEDUP_WINDOW_MS) continue;

    recentReports.set(key, Date.now());
    reportCount++;

    fetch("/api/system/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        message: `[THEME_MISMATCH] ${v.type}: ${v.detail}`,
        errorCategory: "rendering",
        pageUrl: v.page,
        stack: JSON.stringify({
          violationType: v.type,
          page: v.page,
          theme: v.theme,
          detail: v.detail,
          severity: v.severity,
          timestamp: new Date().toISOString(),
          storedTheme: localStorage.getItem("rebooked-theme"),
          activeTheme: document.documentElement.getAttribute("data-theme"),
          hasDarkClass: document.documentElement.classList.contains("dark"),
          userAgent: navigator.userAgent,
        }, null, 2),
        url: window.location.href,
        userAgent: navigator.userAgent,
      }),
    }).catch(() => {}); // fire-and-forget
  }
}

// ── Scheduler ──

function scheduleCheck() {
  if (checkTimer) clearTimeout(checkTimer);

  // Check after a short delay (let page render settle)
  checkTimer = setTimeout(() => {
    const currentPage = window.location.pathname;
    const currentTheme = getActiveTheme() || "";

    // Only run if page or theme changed since last check
    if (currentPage !== lastPage || currentTheme !== lastTheme) {
      lastPage = currentPage;
      lastTheme = currentTheme;

      const violations = checkThemeIntegrity();
      if (violations.length > 0) {
        reportViolations(violations);
      }
    }
  }, 1500);
}

// ── Public API ──

export function initThemeIntegrityChecker(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  // Initial check after page loads
  setTimeout(() => {
    const violations = checkThemeIntegrity();
    reportViolations(violations);
    lastPage = window.location.pathname;
    lastTheme = getActiveTheme() || "";
  }, 3000);

  // Listen for navigation (popstate + pushState interception for SPA)
  window.addEventListener("popstate", () => scheduleCheck());
  window.addEventListener("hashchange", () => scheduleCheck());

  // Intercept pushState/replaceState for SPA router navigation detection
  const origPush = history.pushState.bind(history);
  const origReplace = history.replaceState.bind(history);
  history.pushState = function (...args) {
    origPush(...args);
    scheduleCheck();
  };
  history.replaceState = function (...args) {
    origReplace(...args);
    scheduleCheck();
  };

  // MutationObserver on data-theme attribute changes
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "attributes" && m.attributeName === "data-theme") {
        // Delay check to let CSS cascade settle
        setTimeout(() => scheduleCheck(), 500);
      }
    }
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // Periodic check every 60s to catch runtime theme drift
  setInterval(() => {
    const violations = checkThemeIntegrity();
    reportViolations(violations);
  }, 60_000);
}
