import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface FeatureConfigOptions {
  configKey: string;
  updateMutation: any;
  defaultConfig?: Record<string, any>;
}

export function useFeatureConfig<T extends Record<string, any>>({
  configKey,
  updateMutation,
  defaultConfig = {} as T,
}: FeatureConfigOptions) {
  const { data: settings, isLoading } = trpc.tenant.settings.useQuery();
  const [config, setConfig] = useState<T>(defaultConfig);
  const [isDirty, setIsDirty] = useState(false);

  // Sync config with backend settings
  useEffect(() => {
    if (settings?.[configKey]) {
      setConfig(settings[configKey] as T);
      setIsDirty(false);
    }
  }, [settings, configKey]);

  const updateConfig = (newConfig: Partial<T>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    setIsDirty(true);
  };

  const saveConfig = () => {
    if (!isDirty) return;
    
    updateMutation.mutate(
      { [configKey]: config },
      {
        onSuccess: () => {
          setIsDirty(false);
          toast.success("Configuration saved successfully");
        },
        onError: (error: any) => {
          toast.error(`Failed to save configuration: ${error.message}`);
        },
      }
    );
  };

  const resetConfig = () => {
    setConfig(settings?.[configKey] as T || defaultConfig);
    setIsDirty(false);
  };

  return {
    config,
    updateConfig,
    saveConfig,
    resetConfig,
    isDirty,
    isLoading,
    isSaving: updateMutation.isPending,
  };
}
