/**
 * Industry Standard Security & Compliance Policy
 * 
 * This file defines security policies, compliance requirements, and industry standards
 * that the application must adhere to. All implementations should reference these policies.
 */

// ============================================================================
// DATA PROTECTION & PRIVACY STANDARDS
// ============================================================================

export const DATA_RETENTION_POLICY = {
  // Personal data retention periods (days)
  USER_DATA: 2555, // 7 years - GDPR recommendation for legal compliance
  LEAD_DATA: 1825, // 5 years - business records retention
  MESSAGE_DATA: 1095, // 3 years - communication records
  AUDIT_LOGS: 2555, // 7 years - compliance audit trails
  CONSENT_RECORDS: 2555, // 7 years - TCPA/GDPR consent records
  
  // Automatic cleanup schedules
  CLEANUP_INTERVAL: '0 2 * * *', // Daily at 2 AM
  SOFT_DELETE_GRACE: 30, // 30 days before permanent deletion
} as const;

export const DATA_MINIMIZATION_PRINCIPLES = {
  // Only collect necessary data
  REQUIRED_FIELDS: {
    users: ['id', 'email', 'name', 'createdAt'],
    leads: ['id', 'phone', 'tenantId', 'createdAt'],
    messages: ['id', 'leadId', 'body', 'direction', 'createdAt'],
  },
  
  // Sensitive data handling
  ENCRYPT_AT_REST: ['phone', 'email', 'name'],
  MASK_IN_LOGS: ['phone', 'email', 'ipAddress'],
  ANONYMIZE_AFTER_RETENTION: true,
} as const;

// ============================================================================
// COMMUNICATIONS COMPLIANCE (TCPA, CAN-SPAM, GDPR)
// ============================================================================

export const SMS_COMPLIANCE_POLICY = {
  // TCPA Consent Requirements
  EXPRESS_CONSENT_REQUIRED: true,
  CONSENT_RECORDING: {
    timestamp: true,
    source: ['web_form', 'manual_entry', 'import', 'verbal'],
    language: true,
    evidence: true,
  },
  
  // Message Content Standards
  MANDATORY_STOP_LANGUAGE: {
    keywords: ['STOP', 'QUIT', 'CANCEL', 'UNSUBSCRIBE', 'END'],
    response: "You have been unsubscribed. Reply START to receive messages again.",
    responseTime: '5 minutes',
  },
  
  HELP_RESPONSE: {
    keywords: ['HELP', 'INFO'],
    response: "For help reply HELP. To stop messages reply STOP.",
    responseTime: '5 minutes',
  },
  
  // Frequency Limits
  MARKETING_MESSAGES: {
    maxPerDay: 1,
    maxPerWeek: 3,
    maxPerMonth: 8,
    quietHours: { start: '21:00', end: '09:00' },
  },
  
  // Transactional Messages (exempt from marketing limits)
  TRANSACTIONAL_TYPES: [
    'appointment_confirmation',
    'appointment_reminder',
    'password_reset',
    'account_verification',
    'service_update',
  ],
} as const;

export const EMAIL_COMPLIANCE_POLICY = {
  // CAN-SPAM Requirements
  UNSUBSCRIBE_LINK: {
    required: true,
    processingTime: '10 business days',
    method: 'one_click',
  },
  
  PHYSICAL_ADDRESS: {
    required: true,
    displayLocation: 'footer',
  },
  
  SUBJECT_LINE_RULES: {
    noMisleading: true,
    noDeceptive: true,
    maxLength: 78, // RFC standard
  },
  
  // Frequency Limits
  MARKETING_EMAILS: {
    maxPerDay: 1,
    maxPerWeek: 3,
    consentRequired: true,
  },
} as const;

// ============================================================================
// ACCESS CONTROL & AUTHENTICATION
// ============================================================================

export const AUTHENTICATION_POLICY = {
  // Password Requirements (NIST 800-63B)
  PASSWORD_STRENGTH: {
    minLength: 12,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    forbiddenPatterns: ['common_passwords', 'repeated_chars', 'sequential_chars'],
  },
  
  // Session Management
  SESSION_POLICY: {
    maxDuration: 8 * 60 * 60 * 1000, // 8 hours
    inactivityTimeout: 30 * 60 * 1000, // 30 minutes
    secureCookies: true,
    httpOnlyCookies: true,
    sameSitePolicy: 'strict',
  },
  
  // Multi-Factor Authentication
  MFA_POLICY: {
    requiredForRoles: ['admin'],
    requiredForActions: [
      'billing_changes',
      'user_deletion',
      'data_export',
      'system_configuration',
    ],
    methods: ['totp', 'sms', 'email'],
    backupCodes: true,
  },
  
  // Rate Limiting
  RATE_LIMITING: {
    authentication: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15 minutes
    },
    passwordReset: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxAttempts: 3,
      lockoutDuration: 60 * 60 * 1000, // 1 hour
    },
    apiCalls: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 1000,
    },
  },
} as const;

// ============================================================================
// PAYMENT & FINANCIAL COMPLIANCE (PCI DSS)
// ============================================================================

export const PAYMENT_SECURITY_POLICY = {
  // PCI DSS Requirements
  CARD_DATA_HANDLING: {
    neverStoreCardData: true,
    tokenizeImmediately: true,
    usePCICompliantProcessor: true,
    encryptTransit: true,
  },
  
  // Billing Security
  BILLING_CONTROLS: {
    requireAdminApproval: {
      refunds: true,
      credits: true,
      planChanges: true,
    },
    auditTrail: 'all_billing_actions',
    retentionPeriod: 2555, // 7 years
  },
  
  // Subscription Management
  SUBSCRIPTION_POLICY: {
    trialPeriod: {
      maxDays: 30,
      autoConvertWarning: '3_days',
      cancellationGrace: 3,
    },
    cancellation: {
      immediateEffect: true,
      prorateRefund: true,
      confirmationRequired: true,
    },
  },
} as const;

// ============================================================================
// INCIDENT RESPONSE & MONITORING
// ============================================================================

export const SECURITY_MONITORING_POLICY = {
  // Logging Requirements
  AUDIT_LOGGING: {
    events: [
      'authentication_success',
      'authentication_failure',
      'data_access',
      'data_modification',
      'admin_actions',
      'payment_transactions',
      'consent_changes',
    ],
    retentionPeriod: 2555, // 7 years
    logFormat: 'JSON',
    includeFields: [
      'timestamp',
      'userId',
      'action',
      'resource',
      'ipAddress',
      'userAgent',
      'outcome',
    ],
  },
  
  // Security Monitoring
  THREAT_DETECTION: {
    anomalies: [
      'unusual_login_patterns',
      'privilege_escalation',
      'data_exfiltration',
      'api_abuse',
      'failed_authentication_spikes',
    ],
    alertThresholds: {
      failedLoginsPerMinute: 10,
      dataExportPerHour: 1000,
      apiCallsPerMinute: 500,
    },
    responseTime: '5_minutes',
  },
  
  // Incident Response
  INCIDENT_RESPONSE: {
    severityLevels: ['low', 'medium', 'high', 'critical'],
    responseTimes: {
      critical: '15_minutes',
      high: '1_hour',
      medium: '4_hours',
      low: '24_hours',
    },
    requiredActions: [
      'containment',
      'investigation',
      'notification',
      'remediation',
      'post_mortem',
    ],
  },
} as const;

// ============================================================================
// INDUSTRY-SPECIFIC COMPLIANCE
// ============================================================================

export const HEALTHCARE_COMPLIANCE = {
  // HIPAA Requirements (if applicable)
  HIPAA_POLICY: {
    phiEncryption: true,
    accessLogging: true,
    minimumNecessary: true,
    businessAssociateAgreements: true,
    breachNotification: '72_hours',
  },
  
  // Healthcare Marketing
  HEALTHCARE_MARKETING: {
    patientConsentRequired: true,
    noMarketingToMinors: true,
    protectedHealthInfo: ['medical_condition', 'treatment', 'medication'],
  },
} as const;

export const FINANCIAL_SERVICES_COMPLIANCE = {
  // FINRA/SEC Requirements (if applicable)
  FINANCIAL_POLICY: {
    recordKeeping: 6 * 365, // 6 years
    suitabilityAnalysis: true,
    communicationsArchival: true,
    supervisionRequired: true,
  },
} as const;

// ============================================================================
// THIRD-PARTY INTEGRATIONS
// ============================================================================

export const VENDOR_SECURITY_POLICY = {
  // Security Requirements
  VENDOR_DUE_DILIGENCE: {
    securityAssessment: true,
    complianceCertifications: ['SOC2', 'ISO27001'],
    dataProcessingAgreement: true,
    breachNotification: '72_hours',
  },
  
  // API Security
  API_SECURITY: {
    authentication: 'oauth2_bearer',
    rateLimiting: true,
    requestSigning: true,
    tlsRequired: true,
    auditLogging: true,
  },
} as const;

// ============================================================================
// COMPLIANCE VALIDATION
// ============================================================================

export const COMPLIANCE_CHECKS = {
  // Automated Compliance Validation
  AUTOMATED_CHECKS: {
    dataEncryption: true,
    accessControls: true,
    auditLogging: true,
    consentManagement: true,
    rateLimiting: true,
    securityHeaders: true,
  },
  
  // Manual Review Requirements
  MANUAL_REVIEWS: {
    frequency: 'quarterly',
    scope: [
      'access_logs',
      'consent_records',
      'security_incidents',
      'vendor_assessments',
      'policy_updates',
    ],
    documentation: true,
  },
  
  // Compliance Reporting
  REPORTING: {
    internalReports: 'monthly',
    externalAudits: 'annually',
    boardReports: 'quarterly',
    regulatoryFilings: 'as_required',
  },
} as const;
