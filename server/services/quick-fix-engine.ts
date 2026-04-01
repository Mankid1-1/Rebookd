/**
 * Quick-Fix Engine - Pattern-matched instant repairs that don't need Claude CLI.
 *
 * For common, well-understood error patterns (missing imports, null access,
 * type mismatches), this engine applies deterministic fixes directly to source
 * files — no AI roundtrip needed. Runs in <1s vs 5 min for Claude CLI.
 *
 * Each fixer:
 *   1. Matches on error message / stack trace patterns
 *   2. Reads the affected file
 *   3. Applies a minimal, safe transformation
 *   4. Returns the patch for audit trail
 *
 * If no fixer matches or the fix fails verification, returns null and
 * the sentinel falls through to the full Claude CLI repair.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";
import { logger } from "../_core/logger";
import { PROTECTED_FILES } from "./autopilot-executor";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface QuickFixResult {
  applied: boolean;
  fixType: string;
  description: string;
  filesChanged: string[];
  diffSummary: string;
}

interface QuickFixer {
  name: string;
  /** Return true if this fixer can handle the error */
  matches: (ctx: QuickFixContext) => boolean;
  /** Apply the fix. Return null if it couldn't be applied cleanly. */
  apply: (ctx: QuickFixContext) => QuickFixResult | null;
}

export interface QuickFixContext {
  errorType: string;
  errorMessage: string;
  stackTrace: string;
  affectedFile: string | null;
}

// ─── Utility ────────────────────────────────────────────────────────────────

const PROJECT_ROOT = process.cwd();

function resolveFile(filePath: string | null): string | null {
  if (!filePath) return null;
  // Handle both absolute and relative paths
  const absolute = filePath.startsWith("/") || /^[A-Z]:\\/.test(filePath)
    ? filePath
    : resolve(PROJECT_ROOT, filePath);
  // Also try relative from project root
  const candidates = [absolute, resolve(PROJECT_ROOT, filePath)];
  return candidates.find((p) => existsSync(p)) || null;
}

function isProtected(filePath: string): boolean {
  const relative = filePath.replace(PROJECT_ROOT + "/", "").replace(PROJECT_ROOT + "\\", "");
  return PROTECTED_FILES.some((p) => relative === p || filePath.endsWith(p));
}

function safeReadFile(filePath: string): string | null {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function safeWriteFile(filePath: string, content: string): boolean {
  try {
    writeFileSync(filePath, content, "utf-8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Try to run `pnpm check:types` limited to a specific file for fast verification.
 * Falls back to full check if targeted check isn't available.
 */
function verifyTypeScript(): boolean {
  try {
    execSync("pnpm check:types", {
      cwd: PROJECT_ROOT,
      timeout: 60_000,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

// ─── Fixers ─────────────────────────────────────────────────────────────────

/**
 * Fix: Cannot read properties of undefined (reading 'X')
 *
 * Adds optional chaining at the crash site.
 * e.g., `obj.prop.value` → `obj?.prop?.value`
 */
const nullAccessFixer: QuickFixer = {
  name: "null-access-guard",
  matches: (ctx) =>
    /Cannot read properties of (undefined|null)/.test(ctx.errorMessage) &&
    ctx.affectedFile !== null,
  apply: (ctx) => {
    const filePath = resolveFile(ctx.affectedFile);
    if (!filePath || isProtected(filePath)) return null;

    const content = safeReadFile(filePath);
    if (!content) return null;

    // Extract the property name from "reading 'X'"
    const propMatch = ctx.errorMessage.match(/reading '(\w+)'/);
    if (!propMatch) return null;
    const prop = propMatch[1];

    // Extract line number from stack trace
    const lineMatch = ctx.stackTrace.match(
      new RegExp(`${ctx.affectedFile!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:(\\d+)`)
    );
    if (!lineMatch) return null;
    const lineNum = parseInt(lineMatch[1], 10);

    const lines = content.split("\n");
    if (lineNum < 1 || lineNum > lines.length) return null;

    const targetLine = lines[lineNum - 1];
    // Find patterns like `something.prop` and add optional chaining
    // Match the accessor chain leading to .prop
    const accessPattern = new RegExp(`(\\w+(?:\\.\\w+)*)\\.(${prop})\\b`);
    const accessMatch = targetLine.match(accessPattern);
    if (!accessMatch) return null;

    const chain = accessMatch[1];
    // Add ?. before the final property access
    const fixed = targetLine.replace(
      `${chain}.${prop}`,
      `${chain}?.${prop}`
    );

    if (fixed === targetLine) return null; // No change

    lines[lineNum - 1] = fixed;
    const backup = content;

    if (!safeWriteFile(filePath, lines.join("\n"))) return null;

    // Verify the fix doesn't break types
    if (!verifyTypeScript()) {
      // Revert
      safeWriteFile(filePath, backup);
      return null;
    }

    return {
      applied: true,
      fixType: "null-access-guard",
      description: `Added optional chaining for '${prop}' access at ${ctx.affectedFile}:${lineNum}`,
      filesChanged: [filePath],
      diffSummary: `- ${targetLine.trim()}\n+ ${fixed.trim()}`,
    };
  },
};

/**
 * Fix: Property 'X' does not exist on type 'Y'
 *
 * If the type is a narrow union or an interface missing a field,
 * adds a type assertion or optional access.
 */
const missingPropertyFixer: QuickFixer = {
  name: "missing-property-assertion",
  matches: (ctx) =>
    /Property '(\w+)' does not exist on type/.test(ctx.errorMessage) &&
    ctx.affectedFile !== null,
  apply: (ctx) => {
    const filePath = resolveFile(ctx.affectedFile);
    if (!filePath || isProtected(filePath)) return null;

    const content = safeReadFile(filePath);
    if (!content) return null;

    const propMatch = ctx.errorMessage.match(/Property '(\w+)' does not exist on type '([^']+)'/);
    if (!propMatch) return null;
    const [, prop, typeName] = propMatch;

    // Extract line number
    const lineMatch = ctx.stackTrace.match(/:(\d+):\d+/);
    if (!lineMatch) return null;
    const lineNum = parseInt(lineMatch[1], 10);

    const lines = content.split("\n");
    if (lineNum < 1 || lineNum > lines.length) return null;

    const targetLine = lines[lineNum - 1];

    // Strategy: add `as any` cast or use optional chaining with type narrowing
    // For object access patterns like `obj.missingProp`, use (obj as any).missingProp
    const accessPattern = new RegExp(`(\\w+)\\.${prop}\\b`);
    const match = targetLine.match(accessPattern);
    if (!match) return null;

    const objName = match[1];
    const fixed = targetLine.replace(
      `${objName}.${prop}`,
      `(${objName} as any).${prop}`
    );

    if (fixed === targetLine) return null;

    lines[lineNum - 1] = fixed;
    const backup = content;

    if (!safeWriteFile(filePath, lines.join("\n"))) return null;

    if (!verifyTypeScript()) {
      safeWriteFile(filePath, backup);
      return null;
    }

    return {
      applied: true,
      fixType: "missing-property-assertion",
      description: `Added type assertion for missing property '${prop}' on type '${typeName}' at line ${lineNum}`,
      filesChanged: [filePath],
      diffSummary: `- ${targetLine.trim()}\n+ ${fixed.trim()}`,
    };
  },
};

/**
 * Fix: Cannot find name 'X' — missing import
 *
 * Scans the project for exports of the missing name and adds an import.
 */
const missingImportFixer: QuickFixer = {
  name: "missing-import",
  matches: (ctx) =>
    /Cannot find (name|module) '/.test(ctx.errorMessage) &&
    ctx.affectedFile !== null,
  apply: (ctx) => {
    const filePath = resolveFile(ctx.affectedFile);
    if (!filePath || isProtected(filePath)) return null;

    const content = safeReadFile(filePath);
    if (!content) return null;

    const nameMatch = ctx.errorMessage.match(/Cannot find name '(\w+)'/);
    if (!nameMatch) return null;
    const missingName = nameMatch[1];

    // Search project for exports of this name
    let exportFile: string | null = null;
    try {
      const result = execSync(
        `grep -rl "export.*\\b${missingName}\\b" --include="*.ts" --include="*.tsx" server/ client/src/ shared/ 2>/dev/null | head -5`,
        { cwd: PROJECT_ROOT, timeout: 10_000, encoding: "utf-8" },
      );
      const candidates = result.trim().split("\n").filter(Boolean);
      // Pick the best candidate (not the same file, prefer shorter paths)
      exportFile = candidates.find((c) => resolve(PROJECT_ROOT, c) !== filePath) || null;
    } catch {
      return null;
    }

    if (!exportFile) return null;

    // Compute relative import path
    const fromDir = filePath.replace(/[/\\][^/\\]+$/, "");
    let relativePath = resolve(PROJECT_ROOT, exportFile)
      .replace(fromDir + "/", "./")
      .replace(fromDir + "\\", "./")
      .replace(/\.tsx?$/, "");

    // Ensure it starts with ./ or ../
    if (!relativePath.startsWith(".")) {
      relativePath = "./" + relativePath;
    }

    // Normalize path separators
    relativePath = relativePath.replace(/\\/g, "/");

    // Add import at the top (after existing imports)
    const lines = content.split("\n");
    let lastImportLine = 0;
    for (let i = 0; i < lines.length; i++) {
      if (/^import\s/.test(lines[i])) lastImportLine = i;
    }

    const importStatement = `import { ${missingName} } from "${relativePath}";`;

    // Check if already imported
    if (content.includes(`import`) && content.includes(missingName)) return null;

    lines.splice(lastImportLine + 1, 0, importStatement);
    const backup = content;

    if (!safeWriteFile(filePath, lines.join("\n"))) return null;

    if (!verifyTypeScript()) {
      safeWriteFile(filePath, backup);
      return null;
    }

    return {
      applied: true,
      fixType: "missing-import",
      description: `Added import for '${missingName}' from '${relativePath}'`,
      filesChanged: [filePath],
      diffSummary: `+ ${importStatement}`,
    };
  },
};

/**
 * Fix: Type 'X' is not assignable to type 'Y'
 *
 * When a string literal type is expected but a plain string is provided,
 * adds `as const` or a type assertion.
 */
const typeAssignabilityFixer: QuickFixer = {
  name: "type-assignability",
  matches: (ctx) =>
    /Type '(string|number)' is not assignable to type '/.test(ctx.errorMessage) &&
    ctx.affectedFile !== null,
  apply: (ctx) => {
    const filePath = resolveFile(ctx.affectedFile);
    if (!filePath || isProtected(filePath)) return null;

    const content = safeReadFile(filePath);
    if (!content) return null;

    // Extract the expected type
    const typeMatch = ctx.errorMessage.match(
      /Type '(string|number)' is not assignable to type '([^']+)'/
    );
    if (!typeMatch) return null;
    const [, sourceType, targetType] = typeMatch;

    // Extract line number
    const lineMatch = ctx.stackTrace.match(/:(\d+):\d+/);
    if (!lineMatch) return null;
    const lineNum = parseInt(lineMatch[1], 10);

    const lines = content.split("\n");
    if (lineNum < 1 || lineNum > lines.length) return null;

    const targetLine = lines[lineNum - 1];

    // If it's a union of string literals like "a" | "b" | "c", cast as the target type
    if (targetType.includes('"') || targetType.includes("'")) {
      // It's a string literal union — find the string value and add `as` cast
      // Look for string assignments or property values
      const stringAssign = targetLine.match(/:\s*["']([^"']+)["']/);
      const objProp = targetLine.match(/(\w+):\s*(\w+)/);

      if (stringAssign || objProp) {
        const fixed = targetLine.replace(
          /:\s*(["'][^"']+["']|[\w.]+)\s*(,|\}|;|\)|$)/,
          (match, value, trailing) => `: ${value} as ${targetType}${trailing}`
        );

        if (fixed !== targetLine) {
          lines[lineNum - 1] = fixed;
          const backup = content;
          if (!safeWriteFile(filePath, lines.join("\n"))) return null;
          if (!verifyTypeScript()) {
            safeWriteFile(filePath, backup);
            return null;
          }
          return {
            applied: true,
            fixType: "type-assignability",
            description: `Added type assertion '${sourceType}' → '${targetType}' at line ${lineNum}`,
            filesChanged: [filePath],
            diffSummary: `- ${targetLine.trim()}\n+ ${fixed.trim()}`,
          };
        }
      }
    }

    return null;
  },
};

/**
 * Fix: Duplicate identifier 'X'
 *
 * Detects duplicate imports and removes the second occurrence.
 */
const duplicateIdentifierFixer: QuickFixer = {
  name: "duplicate-identifier",
  matches: (ctx) =>
    /Duplicate identifier '(\w+)'/.test(ctx.errorMessage) &&
    ctx.affectedFile !== null,
  apply: (ctx) => {
    const filePath = resolveFile(ctx.affectedFile);
    if (!filePath || isProtected(filePath)) return null;

    const content = safeReadFile(filePath);
    if (!content) return null;

    const dupMatch = ctx.errorMessage.match(/Duplicate identifier '(\w+)'/);
    if (!dupMatch) return null;
    const dupName = dupMatch[1];

    const lines = content.split("\n");
    const importLines: number[] = [];

    // Find all import lines that import this name
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("import") && lines[i].includes(dupName)) {
        importLines.push(i);
      }
    }

    if (importLines.length < 2) return null; // Not a duplicate import issue

    // Remove the second (duplicate) import line
    const lineToRemove = importLines[1];
    const removedLine = lines[lineToRemove];
    lines.splice(lineToRemove, 1);

    const backup = content;
    if (!safeWriteFile(filePath, lines.join("\n"))) return null;

    if (!verifyTypeScript()) {
      safeWriteFile(filePath, backup);
      return null;
    }

    return {
      applied: true,
      fixType: "duplicate-identifier",
      description: `Removed duplicate import of '${dupName}' at line ${lineToRemove + 1}`,
      filesChanged: [filePath],
      diffSummary: `- ${removedLine.trim()}`,
    };
  },
};

/**
 * Fix: 'X' is declared but its value is never read
 *
 * Removes unused imports.
 */
const unusedImportFixer: QuickFixer = {
  name: "unused-import",
  matches: (ctx) =>
    /is declared but (its value is never read|never used)/.test(ctx.errorMessage) &&
    ctx.affectedFile !== null,
  apply: (ctx) => {
    const filePath = resolveFile(ctx.affectedFile);
    if (!filePath || isProtected(filePath)) return null;

    const content = safeReadFile(filePath);
    if (!content) return null;

    const nameMatch = ctx.errorMessage.match(/'(\w+)' is declared but/);
    if (!nameMatch) return null;
    const unusedName = nameMatch[1];

    const lines = content.split("\n");

    // Find the import line containing this name
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes("import") || !line.includes(unusedName)) continue;

      // Check if it's the only import from this module
      const namedImports = line.match(/\{([^}]+)\}/);
      if (namedImports) {
        const names = namedImports[1].split(",").map((n) => n.trim());
        if (names.length === 1 && names[0] === unusedName) {
          // Only import — remove entire line
          const removedLine = lines[i];
          lines.splice(i, 1);

          const backup = content;
          if (!safeWriteFile(filePath, lines.join("\n"))) return null;
          if (!verifyTypeScript()) {
            safeWriteFile(filePath, backup);
            return null;
          }
          return {
            applied: true,
            fixType: "unused-import",
            description: `Removed unused import '${unusedName}'`,
            filesChanged: [filePath],
            diffSummary: `- ${removedLine.trim()}`,
          };
        } else {
          // Multiple imports — remove just this one
          const newNames = names.filter((n) => n !== unusedName);
          const newLine = line.replace(
            /\{[^}]+\}/,
            `{ ${newNames.join(", ")} }`
          );
          const oldLine = lines[i];
          lines[i] = newLine;

          const backup = content;
          if (!safeWriteFile(filePath, lines.join("\n"))) return null;
          if (!verifyTypeScript()) {
            safeWriteFile(filePath, backup);
            return null;
          }
          return {
            applied: true,
            fixType: "unused-import",
            description: `Removed unused import '${unusedName}' from named imports`,
            filesChanged: [filePath],
            diffSummary: `- ${oldLine.trim()}\n+ ${newLine.trim()}`,
          };
        }
      }
      break;
    }

    return null;
  },
};

// ─── Registry ───────────────────────────────────────────────────────────────

const FIXERS: QuickFixer[] = [
  nullAccessFixer,
  missingImportFixer,
  duplicateIdentifierFixer,
  unusedImportFixer,
  missingPropertyFixer,
  typeAssignabilityFixer,
];

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Attempt to apply a quick fix for the given error context.
 * Returns a QuickFixResult if a fix was applied, or null if no fixer matched.
 *
 * Quick fixes are always verified via `pnpm check:types` before being accepted.
 * If verification fails, the file is reverted and null is returned.
 */
export function attemptQuickFix(ctx: QuickFixContext): QuickFixResult | null {
  // Pre-flight: need source files
  if (!existsSync(resolve(PROJECT_ROOT, "tsconfig.json"))) {
    logger.debug("[quick-fix] No tsconfig.json found — skipping quick fixes");
    return null;
  }

  for (const fixer of FIXERS) {
    if (!fixer.matches(ctx)) continue;

    logger.info(`[quick-fix] Trying fixer '${fixer.name}' for: ${ctx.errorMessage.slice(0, 100)}`);
    try {
      const result = fixer.apply(ctx);
      if (result?.applied) {
        logger.info(`[quick-fix] '${fixer.name}' succeeded: ${result.description}`);
        return result;
      }
      logger.debug(`[quick-fix] '${fixer.name}' matched but could not apply`);
    } catch (err) {
      logger.warn(`[quick-fix] '${fixer.name}' threw: ${String(err)}`);
    }
  }

  return null;
}

/**
 * Check if any quick fixer could potentially handle this error (without applying).
 * Useful for logging/metrics.
 */
export function hasQuickFixCandidate(ctx: QuickFixContext): boolean {
  return FIXERS.some((f) => f.matches(ctx));
}
