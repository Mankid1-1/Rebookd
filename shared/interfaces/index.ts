/**
 * 🎯 UNIFIED INTERFACE REGISTRY
 * Single source of truth for all application interfaces
 * This file consolidates and exports all interfaces to prevent duplication
 */

// ============================================================================
// CORE SYSTEM INTERFACES
// ============================================================================

// Database and User Management
export type { User, InsertUser } from "../../drizzle/schema";

// Authentication and Authorization
export interface AuthUser {
  id: number;
  openId: string;
  name?: string;
  email?: string;
  role: "user" | "admin";
  tenantId: number;
  active: boolean;
  lastSignedIn: Date;
}

export interface AuthContext {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// Tenant Management
export interface Tenant {
  id: number;
  name: string;
  industry?: string;
  timezone: string;
  settings?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// BUSINESS LOGIC INTERFACES
// ============================================================================

// Lead Management
export interface Lead {
  id: number;
  name?: string;
  phone: string;
  email?: string;
  status: "new" | "contacted" | "qualified" | "booked" | "lost" | "unsubscribed";
  source?: string;
  notes?: string;
  tags?: string[];
  tenantId: number;
  createdAt: Date;
  updatedAt: Date;
  appointmentAt?: Date;
}

export interface LeadCreateInput {
  name?: string;
  phone: string;
  email?: string;
  notes?: string;
  source?: string;
  tenantId: number;
}

export interface LeadUpdateInput {
  name?: string;
  phone?: string;
  email?: string;
  notes?: string;
  source?: string;
  status?: Lead["status"];
  tags?: string[];
}

// Message and Communication
export interface Message {
  id: number;
  leadId: number;
  direction: "inbound" | "outbound";
  body: string;
  tone?: "friendly" | "professional" | "casual" | "urgent" | "empathetic";
  status: "pending" | "sent" | "delivered" | "failed";
  provider?: "telnyx" | "twilio";
  providerMessageId?: string;
  tenantId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageCreateInput {
  leadId: number;
  body: string;
  tone?: "friendly" | "professional" | "casual" | "urgent" | "empathetic";
  idempotencyKey?: string;
}

// ============================================================================
// AUTOMATION AND WORKFLOW INTERFACES
// ============================================================================

export interface Automation {
  id: number;
  key: string;
  name: string;
  category: "appointment" | "no_show" | "cancellation" | "follow_up" | "reactivation" | "welcome" | "loyalty";
  enabled: boolean;
  triggerType: string;
  triggerConfig: Record<string, any>;
  conditions: Array<Record<string, any>>;
  actions: Array<Record<string, any>>;
  runCount: number;
  errorCount: number;
  lastRunAt?: Date;
  tenantId: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface AutomationTemplate {
  key: string;
  name: string;
  category: Automation["category"];
  description: string;
  triggerType: string;
  defaultConfig: Record<string, any>;
  requiredFeatures: string[];
}

// ============================================================================
// BILLING AND SUBSCRIPTION INTERFACES
// ============================================================================

export interface Subscription {
  id: number;
  tenantId: number;
  stripeId?: string;
  planId: number;
  status: "trialing" | "active" | "past_due" | "canceled" | "unpaid";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt?: Date;
  canceledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Plan {
  id: number;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: "month" | "year";
  stripePriceId?: string;
  features: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BillingInvoice {
  id: number;
  tenantId: number;
  subscriptionId?: number;
  stripeInvoiceId?: string;
  stripeChargeId?: string;
  number?: string;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  currency: string;
  subtotal: number;
  total: number;
  amountPaid: number;
  amountRemaining: number;
  hostedInvoiceUrl?: string;
  invoicePdfUrl?: string;
  periodStart?: Date;
  periodEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// ANALYTICS AND METRICS INTERFACES
// ============================================================================

export interface AnalyticsMetrics {
  leadCount: number;
  messageCount: number;
  automationCount: number;
  bookedCount: number;
  revenueGenerated: number;
  conversionRate: number;
  responseTime: number;
}

export interface LeadCaptureMetrics {
  totalLeads: number;
  instantResponses: number;
  afterHoursLeads: number;
  averageResponseTime: number;
  revenueImpact: number;
}

export interface BookingConversionMetrics {
  totalLeads: number;
  bookingsGenerated: number;
  mobileOptimization: number;
  revenueImpact: number;
}

export interface NoShowRecoveryMetrics {
  totalAppointments: number;
  noShows: number;
  recovered: number;
  recoveryRate: number;
  revenueImpact: number;
}

export interface CancellationRecoveryMetrics {
  totalCancellations: number;
  filledSlots: number;
  fillRate: number;
  revenueImpact: number;
}

export interface RetentionEngineMetrics {
  totalClients: number;
  rebookedClients: number;
  retentionRate: number;
  ltvExpansion: number;
}

export interface AfterHoursMetrics {
  totalLeads: number;
  afterHoursLeads: number;
  capturedLeads: number;
  captureRate: number;
  processedLeads: number;
}

export interface SmartSchedulingMetrics {
  totalSlots: number;
  filledSlots: number;
  utilizationRate: number;
  optimizationImpact: number;
  revenueImpact: number;
}

export interface PaymentEnforcementMetrics {
  totalBookings: number;
  cardOnFileRate: number;
  cancellationRevenue: number;
  prepaidBookings: number;
  noShowPenalty: number;
  revenueImpact: number;
}

export interface AdminAutomationMetrics {
  totalAppointments: number;
  automatedConfirmations: number;
  selfServiceReschedules: number;
  followUpMessages: number;
  efficiencyGain: number;
}

// ============================================================================
// CONFIGURATION INTERFACES
// ============================================================================

export interface LeadCaptureConfig {
  instantResponseEnabled: boolean;
  aiChatEnabled: boolean;
  afterHoursEnabled: boolean;
  bookingLinkExpiry: number;
  responseDelay: number;
}

export interface BookingConversionConfig {
  mobileFirstEnabled: boolean;
  oneClickBooking: boolean;
  smsBookingEnabled: boolean;
  autoFillEnabled: boolean;
}

export interface NoShowRecoveryConfig {
  multiTouchReminders: boolean;
  confirmationFlow: boolean;
  autoCancel: boolean;
  reminderSchedule: number[];
}

export interface CancellationRecoveryConfig {
  instantRebooking: boolean;
  waitlistAutoFill: boolean;
  broadcastOpenSlots: boolean;
  fillRateTarget: number;
}

export interface RetentionEngineConfig {
  timeBasedRebooking: boolean;
  loyaltyProgram: boolean;
  reactivationCampaigns: boolean;
  personalizedOffers: boolean;
  rebookingSchedule: number[];
}

export interface AfterHoursConfig {
  afterHoursEnabled: boolean;
  instantResponse: boolean;
  bookingLinkExpiry: number;
  responseDelay: number;
}

export interface SmartSchedulingConfig {
  gapDetection: boolean;
  autoFillCampaigns: boolean;
  offPeakOffers: boolean;
  gapThreshold: number;
}

export interface PaymentEnforcementConfig {
  cardOnFile: boolean;
  cancellationFees: boolean;
  prepaidBookings: boolean;
  depositRequired: boolean;
  noShowPenalty: number;
}

export interface AdminAutomationConfig {
  automatedConfirmations: boolean;
  automatedFollowUps: boolean;
  selfServiceRescheduling: boolean;
  intelligentReminders: boolean;
}

export interface TenantSettings {
  leadCaptureConfig?: LeadCaptureConfig;
  bookingConversionConfig?: BookingConversionConfig;
  noShowRecoveryConfig?: NoShowRecoveryConfig;
  cancellationRecoveryConfig?: CancellationRecoveryConfig;
  retentionEngineConfig?: RetentionEngineConfig;
  afterHoursConfig?: AfterHoursConfig;
  smartSchedulingConfig?: SmartSchedulingConfig;
  paymentEnforcementConfig?: PaymentEnforcementConfig;
  adminAutomationConfig?: AdminAutomationConfig;
}

// ============================================================================
// UI AND PROGRESSIVE DISCLOSURE INTERFACES
// ============================================================================

export type UserSkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface UserSkillProfile {
  level: UserSkillLevel;
  experience: {
    totalSessions: number;
    sessionDuration: number;
    featureUsage: Record<string, number>;
  };
  preferences: {
    complexity: 'essential' | 'standard' | 'advanced' | 'expert';
    showHints: boolean;
    enableGuidance: boolean;
  };
  achievements: string[];
  lastActivity: Date;
}

export type UIComplexity = 'essential' | 'standard' | 'advanced' | 'expert';

export interface ComplexityLevel {
  name: UIComplexity;
  displayName: string;
  description: string;
  features: string[];
  requirements: string[];
}

export interface DisclosureFeature {
  id: string;
  name: string;
  description: string;
  complexity: UIComplexity;
  category: string;
  prerequisites?: string[];
  dependencies?: string[];
}

export interface DisclosureContext {
  userSkill: UserSkillProfile;
  currentComplexity: UIComplexity;
  availableFeatures: DisclosureFeature[];
  adaptiveHints: AdaptiveHint[];
}

export interface AdaptiveHint {
  id: string;
  type: 'tip' | 'warning' | 'suggestion' | 'achievement';
  title: string;
  content: string;
  priority: number;
  context?: string;
  dismissible: boolean;
}

// ============================================================================
// API AND RESPONSE INTERFACES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface SearchParams {
  query?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

// ============================================================================
// EVENT AND WEBHOOK INTERFACES
// ============================================================================

export type EventType =
  | "lead.created"
  | "message.received"
  | "message.sent"
  | "appointment.booked"
  | "appointment.no_show"
  | "appointment.cancelled"
  | "automation.triggered"
  | "user.created"
  | "subscription.created"
  | "subscription.updated";

export interface EventPayload {
  id?: string;
  type: EventType;
  tenantId: number;
  userId?: number;
  data: Record<string, any>;
  timestamp: Date;
}

export interface WebhookEvent {
  type: string;
  data: {
    object: any;
  };
  created: number;
}

// ============================================================================
// UTILITY AND HELPER INTERFACES
// ============================================================================

export interface StorageItem<T = any> {
  value: T;
  timestamp: number;
  encrypted: boolean;
}

export interface TimeSlot {
  id: string;
  start: Date;
  end: Date;
  available: boolean;
  score?: number;
  factors?: {
    leadPreference?: number;
    businessHours?: number;
    staffAvailability?: number;
    historicalConversion?: number;
    workloadBalance?: number;
  };
  conflicts?: string[];
}

export interface SchedulingOptions {
  prioritizeConversion: boolean;
  balanceWorkload: boolean;
  respectPreferences: boolean;
  allowOverbooking: boolean;
  bufferTime: number;
  maxDailyAppointments: number;
}

// ============================================================================
// DEPRECATED INTERFACES (for migration purposes)
// ============================================================================

/**
 * @deprecated Use User interface from drizzle schema instead
 */
export interface LegacyUser {
  id: number;
  name?: string;
  email?: string;
  role: string;
  tenantId: number;
}

/**
 * @deprecated Use TenantSettings instead
 */
export interface LegacyTenantConfig {
  id: number;
  settings: Record<string, any>;
}

// ============================================================================
// RE-EXPORTS FOR BACKWARD COMPATIBILITY
// ============================================================================

// Re-export from schema for convenience
export type * from "../../drizzle/schema";

// Event types are already defined above, no need to re-export
