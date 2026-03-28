/**
 * DEPRECATED: Use shared/interfaces/index.ts for type imports.
 *
 * This file is kept only to avoid breaking any transitive imports.
 * No consumers currently import from this module.
 */

// Re-export the canonical interface registry
export type {
  AuthUser,
  AuthContext,
  LeadCreateInput,
  LeadUpdateInput,
  MessageCreateInput,
  AutomationTemplate,
  AnalyticsMetrics,
  ApiResponse,
  PaginatedResponse,
  SearchParams,
  WebhookEvent,
  TenantSettings,
} from "./interfaces";

// Error utilities
export * from "./_core/errors";
