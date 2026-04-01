import * as React from "react";
import { Info, HelpCircle, Lightbulb } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

// ─── Skill-Level Aware Tooltips ─────────────────────────────────────────────

type SkillLevel = "basic" | "intermediate" | "advanced";

interface HelpTooltipProps {
  children: React.ReactNode;
  /** Simple string OR per-level content */
  content: string | Partial<Record<SkillLevel, string>>;
  variant?: "info" | "help" | "tip";
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  /** If not provided, reads from SkillLevelContext via useSkillLevelSafe */
  level?: SkillLevel;
}

const icons = {
  info: Info,
  help: HelpCircle,
  tip: Lightbulb,
};

const colors = {
  info: "text-info",
  help: "text-accent-foreground",
  tip: "text-warning",
};

/**
 * Safe hook that reads skill level without crashing outside the provider.
 * Falls back to "basic" if context is unavailable.
 */
function useSkillLevelSafe(): SkillLevel {
  try {
    // Dynamic import to avoid circular deps — this is evaluated at runtime
    const ctx = React.useContext(
      (globalThis as any).__REBOOKED_SKILL_CTX__ as React.Context<{ skillLevel: SkillLevel }> | undefined
    );
    return ctx?.skillLevel ?? "basic";
  } catch {
    return "basic";
  }
}

/** Register the context so HelpTooltip can read it without direct import */
export function registerSkillContext(ctx: React.Context<any>) {
  (globalThis as any).__REBOOKED_SKILL_CTX__ = ctx;
}

function resolveContent(content: string | Partial<Record<SkillLevel, string>>, level: SkillLevel): string | null {
  if (typeof content === "string") return content;
  // Try exact level, then fall back through levels, then any available
  return content[level] ?? content.basic ?? content.intermediate ?? content.advanced ?? null;
}

export function HelpTooltip({
  children,
  content,
  variant = "info",
  side = "top",
  align = "center",
  level,
}: HelpTooltipProps) {
  const contextLevel = useSkillLevelSafe();
  const activeLevel = level ?? contextLevel;
  const Icon = icons[variant];
  const color = colors[variant];
  const text = resolveContent(content, activeLevel);

  if (!text) return <>{children}</>;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1">
            {children}
            <Icon className={`h-3.5 w-3.5 ${color} cursor-help flex-shrink-0`} />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          className="max-w-xs bg-background border border-border shadow-lg"
        >
          <p className="text-sm text-foreground">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Inline help icon — no children wrapper, just the icon with a tooltip.
 * Use next to labels and headings.
 */
export function HelpIcon({
  content,
  variant = "info",
  side = "top",
  level,
}: Omit<HelpTooltipProps, "children" | "align"> & { level?: SkillLevel }) {
  const contextLevel = useSkillLevelSafe();
  const activeLevel = level ?? contextLevel;
  const Icon = icons[variant];
  const color = colors[variant];
  const text = resolveContent(content, activeLevel);

  if (!text) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Icon className={`h-3.5 w-3.5 ${color} cursor-help inline-block flex-shrink-0`} />
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs bg-background border border-border shadow-lg">
          <p className="text-sm text-foreground">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
