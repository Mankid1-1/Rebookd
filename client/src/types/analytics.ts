// Analytics and Metrics Types
// This file centralizes all analytics-related types to ensure consistency across the application

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
}

export interface SmartSchedulingMetrics {
  totalSlots: number;
  filledSlots: number;
  utilizationRate: number;
  gapsFilled: number;
  revenueImpact: number;
}

export interface PaymentEnforcementMetrics {
  totalBookings: number;
  cardOnFileRate: number;
  cancellationRevenue: number;
  noShowsReduced: number;
  revenueImpact: number;
}

export interface AdminAutomationMetrics {
  totalAppointments: number;
  automatedConfirmations: number;
  selfServiceReschedules: number;
  timeSaved: number;
  revenueImpact: number;
}

// Configuration Types
export interface LeadCaptureConfig {
  instantResponseEnabled: boolean;
  aiChatEnabled: boolean;
  afterHoursEnabled: boolean;
  responseTimeLimit: number;
  bookingLinkExpiry: number;
}

export interface BookingConversionConfig {
  mobileFirstEnabled: boolean;
  oneClickBooking: boolean;
  smsBookingEnabled: boolean;
  frictionlessFlow: boolean;
  autoFillEnabled: boolean;
}

export interface NoShowRecoveryConfig {
  multiTouchReminders: boolean;
  confirmationFlow: boolean;
  autoCancel: boolean;
  waitlistFill: boolean;
  reminderSchedule: number[];
}

export interface CancellationRecoveryConfig {
  instantRebooking: boolean;
  waitlistAutoFill: boolean;
  broadcastOpenSlots: boolean;
  urgencyMessaging: boolean;
  fillRateTarget: number;
}

export interface RetentionEngineConfig {
  timeBasedRebooking: boolean;
  loyaltyProgram: boolean;
  reactivationCampaigns: boolean;
  rebookingIntervals: number[];
  loyaltyTiers: Array<{
    visits: number;
    reward: string;
    message: string;
  }>;
}

export interface AfterHoursConfig {
  afterHoursEnabled: boolean;
  instantResponse: boolean;
  bookingLinkExpiry: number;
  businessHours: {
    start: string;
    end: string;
    timezone: string;
  };
  responseDelay: number;
}

export interface SmartSchedulingConfig {
  gapDetection: boolean;
  autoFillCampaigns: boolean;
  offPeakOffers: boolean;
  utilizationTarget: number;
  gapThreshold: number;
}

export interface PaymentEnforcementConfig {
  cardOnFile: boolean;
  cancellationFees: boolean;
  prepaidBookings: boolean;
  noShowPenalties: boolean;
  depositAmount: number;
  cancellationFee: number;
  noShowPenalty: number;
}

export interface AdminAutomationConfig {
  automatedConfirmations: boolean;
  automatedFollowUps: boolean;
  selfServiceRescheduling: boolean;
  confirmationWindow: number;
  followUpSchedule: number[];
  reschedulingWindow: number;
}

// Tenant Settings with all configurations
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
