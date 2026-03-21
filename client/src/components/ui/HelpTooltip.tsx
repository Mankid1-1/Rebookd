import * as React from "react";
import { Info, HelpCircle, Lightbulb } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

interface HelpTooltipProps {
  children: React.ReactNode;
  content: string;
  variant?: "info" | "help" | "tip";
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

const icons = {
  info: Info,
  help: HelpCircle,
  tip: Lightbulb,
};

const colors = {
  info: "text-blue-500",
  help: "text-purple-500", 
  tip: "text-yellow-500",
};

export function HelpTooltip({ 
  children, 
  content, 
  variant = "info",
  side = "top",
  align = "center" 
}: HelpTooltipProps) {
  const Icon = icons[variant];
  const color = colors[variant];

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1">
            {children}
            <Icon className={`h-3.5 w-3.5 ${color} cursor-help`} />
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side={side} 
          align={align}
          className="max-w-xs bg-background border border-border shadow-lg"
        >
          <p className="text-sm text-foreground">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
