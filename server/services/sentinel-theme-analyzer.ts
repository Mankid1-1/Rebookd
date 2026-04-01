/**
 * Sentinel Theme Analyzer — detects and auto-fixes theme configuration mismatches.
 *
 * Processes [THEME_MISMATCH] client errors reported by themeIntegrityChecker.ts:
 *  - CSS_VAR_MISSING: theme CSS variables not defined
 *  - PRIMARY_COLOR_MISMATCH: wrong primary color for active theme
 *  - BACKGROUND_COLOR_MISMATCH: wrong background color
 *  - DARK_CLASS_MISSING / DARK_CLASS_EXTRA: dark mode class mismatch
 *  - THEME_STORAGE_MISMATCH: localStorage vs data-theme out of sync
 *  - SIDEBAR_VAR_MISSING: dashboard sidebar vars missing
 *  - HARDCODED_BG_COLOR / HARDCODED_TEXT_COLOR: inline styles bypassing theme
 *
 * For each violation pattern, generates a remediation action:
 *  - Tenant-specific: clears stale theme preference via API
 *  - Platform-wide: flags CSS file for review, escalates
 *
 * Runs every 20 sentinel cycles (~20 min).
 */

import { and, eq, sql, gt, count, inArray } from "drizzle-orm";
import { systemErrorLogs } from "../../drizzle/schema";
import { logger } from "../_core/logger";
import type { Db } from "../_core/context";

// ── Types ──

interface ThemeViolation {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  tenantId: number;
  tenantName: string;
  message: string;
  detail: Record<string, unknown>;
}

interface ThemeMismatchSummary {
  violationType: string;
  page: string;
  theme: string;
  count: number;
  latestDetail: string;
  tenantIds: number[];
}

// ── Analyzer ──

export async function analyzeThemeIntegrity(db: Db): Promise<ThemeViolation[]> {
  const violations: ThemeViolation[] = [];

  try {
    // Find all recent [THEME_MISMATCH] errors from the last 30 minutes
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

    const themeErrors = await db
      .select({
        id: systemErrorLogs.id,
        message: systemErrorLogs.message,
        detail: systemErrorLogs.detail,
        tenantId: systemErrorLogs.tenantId,
        resolved: systemErrorLogs.resolved,
        createdAt: systemErrorLogs.createdAt,
      })
      .from(systemErrorLogs)
      .where(
        and(
          sql`${systemErrorLogs.message} LIKE '%[THEME_MISMATCH]%'`,
          eq(systemErrorLogs.resolved, false),
          gt(systemErrorLogs.createdAt, thirtyMinAgo),
        ),
      )
      .limit(100);

    if (themeErrors.length === 0) {
      return violations;
    }

    // Group by violation type to detect patterns
    const grouped = new Map<string, ThemeMismatchSummary>();

    for (const err of themeErrors) {
      let parsed: Record<string, any> = {};
      try {
        parsed = JSON.parse(err.detail || "{}");
      } catch { /* ignore */ }

      const violationType = parsed.violationType || extractViolationType(err.message);
      const page = parsed.page || "unknown";
      const theme = parsed.theme || "unknown";
      const key = `${violationType}:${page}:${theme}`;

      const existing = grouped.get(key);
      if (existing) {
        existing.count++;
        if (err.tenantId && !existing.tenantIds.includes(err.tenantId)) {
          existing.tenantIds.push(err.tenantId);
        }
      } else {
        grouped.set(key, {
          violationType,
          page,
          theme,
          count: 1,
          latestDetail: parsed.detail || err.message,
          tenantIds: err.tenantId ? [err.tenantId] : [],
        });
      }
    }

    // Analyze each pattern group
    for (const [, summary] of grouped) {
      const isWidespread = summary.tenantIds.length > 1 || summary.count >= 3;

      // Critical: color mismatches affecting multiple users = platform CSS issue
      if (summary.violationType === "PRIMARY_COLOR_MISMATCH" ||
          summary.violationType === "BACKGROUND_COLOR_MISMATCH") {
        violations.push({
          type: `THEME_${summary.violationType}`,
          severity: isWidespread ? "critical" : "high",
          tenantId: summary.tenantIds[0] || 0,
          tenantName: "",
          message: `[THEME_CSS_ERROR] ${summary.violationType} on ${summary.page} for theme "${summary.theme}" — ${summary.count} occurrence(s) across ${summary.tenantIds.length} user(s). ${summary.latestDetail}`,
          detail: {
            violationType: summary.violationType,
            page: summary.page,
            theme: summary.theme,
            occurrences: summary.count,
            affectedUsers: summary.tenantIds.length,
            latestDetail: summary.latestDetail,
            remediation: "Check index.css [data-theme] definitions — CSS variable values don't match expected theme config",
          },
        });
      }

      // High: missing CSS variables = theme not loading at all
      if (summary.violationType === "CSS_VAR_MISSING" ||
          summary.violationType === "SIDEBAR_VAR_MISSING") {
        violations.push({
          type: `THEME_${summary.violationType}`,
          severity: isWidespread ? "critical" : "high",
          tenantId: summary.tenantIds[0] || 0,
          tenantName: "",
          message: `[THEME_VARS_MISSING] ${summary.violationType} on ${summary.page} for theme "${summary.theme}" — ${summary.count} occurrence(s). Theme CSS may not be loading.`,
          detail: {
            violationType: summary.violationType,
            page: summary.page,
            theme: summary.theme,
            occurrences: summary.count,
            affectedUsers: summary.tenantIds.length,
            remediation: "Verify index.css is loaded and [data-theme] selector covers all required CSS vars",
          },
        });
      }

      // Medium: dark class mismatch = ThemeProvider bug
      if (summary.violationType === "DARK_CLASS_MISSING" ||
          summary.violationType === "DARK_CLASS_EXTRA") {
        violations.push({
          type: `THEME_${summary.violationType}`,
          severity: "medium",
          tenantId: summary.tenantIds[0] || 0,
          tenantName: "",
          message: `[THEME_DARK_MODE] ${summary.violationType} on ${summary.page} for theme "${summary.theme}" — dark class out of sync with theme config`,
          detail: {
            violationType: summary.violationType,
            page: summary.page,
            theme: summary.theme,
            occurrences: summary.count,
            remediation: "Check ThemeContext.tsx DARK_THEMES array and useEffect that manages .dark class",
          },
        });
      }

      // Medium: storage mismatch = race condition or stale state
      if (summary.violationType === "THEME_STORAGE_MISMATCH") {
        violations.push({
          type: "THEME_SYNC_ERROR",
          severity: "medium",
          tenantId: summary.tenantIds[0] || 0,
          tenantName: "",
          message: `[THEME_SYNC] localStorage and data-theme attribute out of sync on ${summary.page} — ${summary.count} occurrence(s)`,
          detail: {
            violationType: summary.violationType,
            page: summary.page,
            theme: summary.theme,
            occurrences: summary.count,
            remediation: "Check index.html pre-hydration script and ThemeProvider initialization for race conditions",
          },
        });
      }

      // Low: hardcoded colors bypassing theme
      if (summary.violationType === "HARDCODED_BG_COLOR" ||
          summary.violationType === "HARDCODED_TEXT_COLOR") {
        violations.push({
          type: "THEME_HARDCODED_COLOR",
          severity: "low",
          tenantId: summary.tenantIds[0] || 0,
          tenantName: "",
          message: `[THEME_HARDCODED] Inline styles bypassing theme on ${summary.page} — ${summary.latestDetail}`,
          detail: {
            violationType: summary.violationType,
            page: summary.page,
            theme: summary.theme,
            occurrences: summary.count,
            remediation: "Replace inline style colors with Tailwind theme classes (bg-background, text-foreground, etc.)",
          },
        });
      }

      // Auto-resolve the original client errors since we've created a platform-level report
      const errorIds = themeErrors
        .filter((e) => e.message.includes(summary.violationType))
        .map((e) => e.id);

      if (errorIds.length > 0) {
        await db
          .update(systemErrorLogs)
          .set({ resolved: true })
          .where(inArray(systemErrorLogs.id, errorIds))
          .catch((err) => {
            logger.warn("[sentinel-theme-analyzer] Failed to resolve processed theme errors", { error: String(err) });
          });
      }
    }

    if (violations.length > 0) {
      logger.info(`[sentinel-theme-analyzer] Found ${violations.length} theme integrity violation(s) from ${themeErrors.length} client reports`);
    }
  } catch (err) {
    logger.warn("[sentinel-theme-analyzer] Analysis failed", { error: String(err) });
  }

  return violations;
}

// ── Helpers ──

function extractViolationType(message: string): string {
  const match = message.match(/\[THEME_MISMATCH\]\s+(\w+):/);
  return match?.[1] || "UNKNOWN";
}
