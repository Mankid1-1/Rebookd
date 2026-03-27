import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, Save, RotateCcw } from "lucide-react";

// Dynamic badge colors based on user theme
const getDynamicBadgeColors = (enabled: boolean) => {
  const isDarkMode = document.documentElement.classList.contains('dark');
  if (enabled) {
    return isDarkMode ? "bg-green-900 text-green-200" : "bg-green-100 text-green-800";
  } else {
    return isDarkMode ? "bg-gray-800 text-gray-200" : "bg-gray-100 text-gray-800";
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
            <Badge className={getDynamicBadgeColors(status.enabled)}>
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
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="text-sm font-medium text-yellow-300">You have unsaved changes</p>
              <p className="text-xs text-yellow-600">Click "Save Changes" to persist your configuration</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {children}
    </div>
  );
}
