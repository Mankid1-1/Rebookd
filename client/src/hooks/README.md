# Feature Configuration Pattern

This directory contains reusable components and hooks for feature configuration pages to eliminate code duplication across the application.

## Problem Solved

Previously, each feature page (AfterHours, CancellationRecovery, NoShowRecovery, etc.) had ~90% duplicated code:
- Same settings sync pattern with `useEffect`
- Same loading and error handling
- Same unsaved changes tracking
- Same UI structure (metrics cards, config tabs, status cards)

## Solution

### `useFeatureConfig` Hook

A custom hook that handles the common pattern:
```typescript
const {
  config,
  updateConfig,
  saveConfig,
  resetConfig,
  isDirty,
  isLoading,
  isSaving,
} = useFeatureConfig<AfterHoursConfig>({
  configKey: 'afterHoursConfig',
  updateMutation: updateAfterHoursConfig,
  defaultConfig: DEFAULT_CONFIG,
});
```

### `FeatureConfigPage` Component

A wrapper component that provides consistent UI:
- Header with title, description, and status badge
- Unsaved changes warning
- Save/Reset buttons with proper loading states
- Consistent layout structure

## Usage Example

```typescript
export default function AfterHours() {
  const featureConfig = useFeatureConfig<AfterHoursConfig>({
    configKey: 'afterHoursConfig',
    updateMutation: trpc.tenant.updateAfterHoursConfig.useMutation(),
    defaultConfig: DEFAULT_CONFIG,
  });

  return (
    <DashboardLayout>
      <FeatureConfigPage
        title="After Hours"
        description="Capture leads 24/7 with instant responses"
        icon={<Clock className="h-8 w-8" />}
        isDirty={featureConfig.isDirty}
        isSaving={featureConfig.isSaving}
        onSave={featureConfig.saveConfig}
        onReset={featureConfig.resetConfig}
        status={{
          enabled: featureConfig.config.afterHoursEnabled,
          label: featureConfig.config.afterHoursEnabled ? "Active" : "Inactive",
        }}
      >
        {/* Your feature-specific content */}
      </FeatureConfigPage>
    </DashboardLayout>
  );
}
```

## Migration Guide

1. Import the hook and component
2. Replace local state with `useFeatureConfig`
3. Wrap content in `FeatureConfigPage`
4. Remove duplicated useEffect sync logic
5. Remove manual dirty state tracking

## Benefits

- **90% code reduction** in feature pages
- **Consistent UX** across all configuration pages
- **Centralized logic** easier to maintain
- **Type safety** with generic TypeScript
- **Automatic dirty tracking** and validation
