import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, Save, RotateCcw } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

// Dynamic badge colors based on user theme
const getDynamicBadgeColors = (enabled: boolean, isDarkMode: boolean) => {
  if (enabled) {
    return "bg-success/10 text-success";
  } else {
    return "bg-muted text-muted-foreground";
  }
};

interface FeatureConfigPageProps {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onReset: () => void;
  status?: {
    enabled: boolean;
    label: string;
  };
}

export function FeatureConfigPage({
  title,
  description,
  icon,
  children,
  isDirty,
  isSaving,
  onSave,
  onReset,
  status,
}: FeatureConfigPageProps) {
  const { isDark: isDarkMode } = useTheme();
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
              <p className="text-muted-foreground">{description}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status && (
            <Badge className={getDynamicBadgeColors(status.enabled, isDarkMode)}>
              {status.label}
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={onReset}
            disabled={!isDirty || isSaving}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            onClick={onSave}
            disabled={!isDirty || isSaving}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Unsaved Changes Warning */}
      {isDirty && (
        <div className="p-4 bg-warning/5 border border-warning/20 rounded-lg">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-warning" />
            <div>
              <p className="text-sm font-medium text-warning">You have unsaved changes</p>
              <p className="text-xs text-warning/80">Click "Save Changes" to persist your configuration</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {children}
    </div>
  );
}
