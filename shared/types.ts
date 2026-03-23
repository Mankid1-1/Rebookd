/**
 * 🎯 UNIFIED TYPE EXPORTS
 * Single entry point for all shared types
 * DEPRECATED: Use shared/interfaces/index.ts instead
 */

// Re-export specific types from unified interface registry to avoid conflicts
export type {
  AuthUser,
  AuthContext,
  LeadCreateInput,
  LeadUpdateInput,
  MessageCreateInput,
  AutomationTemplate,
  AnalyticsMetrics,
  LeadCaptureMetrics,
  BookingConversionMetrics,
  NoShowRecoveryMetrics,
  CancellationRecoveryMetrics,
  RetentionEngineMetrics,
  AfterHoursMetrics,
  SmartSchedulingMetrics,
  PaymentEnforcementMetrics,
  AdminAutomationMetrics,
  LeadCaptureConfig,
  BookingConversionConfig,
  NoShowRecoveryConfig,
  CancellationRecoveryConfig,
  RetentionEngineConfig,
  AfterHoursConfig,
  SmartSchedulingConfig,
  PaymentEnforcementConfig,
  AdminAutomationConfig,
  TenantSettings,
  UserSkillLevel,
  UserSkillProfile,
  UIComplexity,
  ComplexityLevel,
  DisclosureFeature,
  DisclosureContext,
  AdaptiveHint,
  ApiResponse,
  PaginatedResponse,
  SearchParams,
  WebhookEvent,
  StorageItem,
  TimeSlot,
  SchedulingOptions,
  LegacyUser,
  LegacyTenantConfig
} from "./interfaces";

// Legacy exports for backward compatibility
export type * from "../drizzle/schema";
export * from "./_core/errors";
