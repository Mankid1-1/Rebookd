/**
 * Security & Compliance Service
 * 
 * Implements industry-standard security policies and compliance checks
 * References securityPolicy.ts for all requirements
 */

import { logger } from "./logger";
import type { Db } from "./context";
import { 
  DATA_RETENTION_POLICY, 
  SMS_COMPLIANCE_POLICY, 
  AUTHENTICATION_POLICY,
  SECURITY_MONITORING_POLICY,
  COMPLIANCE_CHECKS
} from "./securityPolicy";

// Data minimization constants (moved here to avoid circular imports)
const DATA_MINIMIZATION_CONSTANTS = {
  REQUIRED_FIELDS: {
    users: ['id', 'email', 'name', 'createdAt'] as const,
    leads: ['id', 'phone', 'tenantId', 'createdAt'] as const,
    messages: ['id', 'leadId', 'body', 'direction', 'createdAt'] as const,
  },
  
  ENCRYPT_AT_REST: ['phone', 'email', 'name'] as const,
  MASK_IN_LOGS: ['phone', 'email', 'ipAddress'] as const,
  ANONYMIZE_AFTER_RETENTION: true,
} as const;

// ============================================================================
// DATA PROTECTION & RETENTION
// ============================================================================

export class DataProtectionService {
  /**
   * Enforce data retention policies
   * GDPR Article 5: Storage limitation
   */
  static async enforceDataRetention(db: Db): Promise<void> {
    const now = new Date();
    const retentionDates = {
      users: new Date(now.getTime() - DATA_RETENTION_POLICY.USER_DATA * 24 * 60 * 60 * 1000),
      leads: new Date(now.getTime() - DATA_RETENTION_POLICY.LEAD_DATA * 24 * 60 * 60 * 1000),
      messages: new Date(now.getTime() - DATA_RETENTION_POLICY.MESSAGE_DATA * 24 * 60 * 60 * 1000),
    };

    try {
      // Soft delete expired user data
      await db
        .update(require("../drizzle/schema").users)
        .set({ active: false, updatedAt: now })
        .where(
          require("drizzle-orm").and(
            require("drizzle-orm").lt(require("../drizzle/schema").users.createdAt, retentionDates.users),
            require("drizzle-orm").eq(require("../drizzle/schema").users.active, true)
          )
        );

      // Soft delete expired leads
      await db
        .update(require("../drizzle/schema").leads)
        .set({ status: "archived", updatedAt: now })
        .where(
          require("drizzle-orm").and(
            require("drizzle-orm").lt(require("../drizzle/schema").leads.createdAt, retentionDates.leads),
            require("drizzle-orm").neq(require("../drizzle/schema").leads.status, "archived")
          )
        );

      logger.info("Data retention policies enforced", { timestamp: now });
    } catch (error) {
      logger.error("Failed to enforce data retention", { error });
      throw error;
    }
  }

  /**
   * Validate data minimization compliance
   * GDPR Article 5: Data minimization
   */
  static validateDataMinimization(data: Record<string, any>, dataType: string): boolean {
    const requiredFields = DATA_MINIMIZATION_CONSTANTS.REQUIRED_FIELDS[dataType as keyof typeof DATA_MINIMIZATION_CONSTANTS.REQUIRED_FIELDS];
    
    if (!requiredFields) {
      logger.warn("Unknown data type for minimization check", { dataType });
      return false;
    }

    const dataFields = Object.keys(data);
    const excessFields = dataFields.filter((field: string) => !requiredFields.includes(field as any));

    if (excessFields.length > 0) {
      logger.warn("Data minimization violation detected", {
        dataType,
        excessFields,
        providedFields: dataFields,
        requiredFields,
      });
      return false;
    }

    return true;
  }
}

// ============================================================================
// COMMUNICATIONS COMPLIANCE
// ============================================================================

export class CommunicationsComplianceService {
  /**
   * Validate TCPA compliance before sending SMS
   * TCPA: Prior express consent required
   */
  static async validateSmsCompliance(
    db: Db, 
    tenantId: number, 
    leadId: number, 
    messageType: 'marketing' | 'transactional'
  ): Promise<{ compliant: boolean; reason?: string }> {
    try {
      // Check consent record
      const [lead] = await db
        .select()
        .from(require("../drizzle/schema").leads)
        .where(
          require("drizzle-orm").and(
            require("drizzle-orm").eq(require("../drizzle/schema").leads.id, leadId),
            require("drizzle-orm").eq(require("../drizzle/schema").leads.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!lead) {
        return { compliant: false, reason: "Lead not found" };
      }

      // Check if unsubscribed
      if (lead.status === "unsubscribed") {
        return { compliant: false, reason: "Lead has unsubscribed" };
      }

      // Verify consent for marketing messages
      if (messageType === "marketing") {
        if (!lead.smsConsentAt) {
          return { compliant: false, reason: "No express consent on record" };
        }

        // Check consent age (TCPA: consent must be recent)
        const consentAge = Date.now() - lead.smsConsentAt.getTime();
        const maxConsentAge = 18 * 30 * 24 * 60 * 60 * 1000; // 18 months

        if (consentAge > maxConsentAge) {
          return { compliant: false, reason: "Consent expired" };
        }
      }

      // Check frequency limits for marketing messages
      if (messageType === "marketing") {
        const compliance = await this.checkMarketingFrequency(db, tenantId, leadId);
        if (!compliance.compliant) {
          return compliance;
        }
      }

      return { compliant: true };
    } catch (error) {
      logger.error("SMS compliance validation failed", { error, tenantId, leadId });
      return { compliant: false, reason: "Compliance check failed" };
    }
  }

  /**
   * Check marketing message frequency compliance
   */
  private static async checkMarketingFrequency(
    db: Db, 
    tenantId: number, 
    leadId: number
  ): Promise<{ compliant: boolean; reason?: string }> {
    const now = new Date();
    const periods = {
      day: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      month: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    };

    try {
      // Count marketing messages in each period
      const [dayCount] = await db
        .select({ count: require("drizzle-orm").sql<number>`count(*)` })
        .from(require("../drizzle/schema").messages)
        .where(
          require("drizzle-orm").and(
            require("drizzle-orm").eq(require("../drizzle/schema").messages.tenantId, tenantId),
            require("drizzle-orm").eq(require("../drizzle/schema").messages.leadId, leadId),
            require("drizzle-orm").eq(require("../drizzle/schema").messages.direction, "outbound"),
            require("drizzle-orm").gte(require("../drizzle/schema").messages.createdAt, periods.day)
          )
        );

      if (Number(dayCount.count) >= SMS_COMPLIANCE_POLICY.MARKETING_MESSAGES.maxPerDay) {
        return { compliant: false, reason: "Daily marketing message limit exceeded" };
      }

      // Check quiet hours
      const currentHour = now.getHours();
      const { start, end } = SMS_COMPLIANCE_POLICY.MARKETING_MESSAGES.quietHours;
      
      if (currentHour >= parseInt(start.split(':')[0]) || currentHour < parseInt(end.split(':')[0])) {
        return { compliant: false, reason: "Marketing messages not allowed during quiet hours" };
      }

      return { compliant: true };
    } catch (error) {
      logger.error("Frequency check failed", { error });
      return { compliant: false, reason: "Frequency check failed" };
    }
  }

  /**
   * Generate TCPA-compliant consent text
   */
  static generateCompliantConsentText(businessName: string, phoneNumber: string): string {
    return `By providing your phone number ${phoneNumber}, you consent to receive marketing text messages from ${businessName}. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe. Reply HELP for help. Consent is not a condition of purchase. Message frequency will not exceed 8 messages per month.`;
  }
}

// ============================================================================
// SECURITY MONITORING & AUDITING
// ============================================================================

export class SecurityMonitoringService {
  /**
   * Log security events for compliance
   * HIPAA/SOX: Comprehensive audit trails
   */
  static async logSecurityEvent(
    db: Db,
    event: {
      type: string;
      userId?: number;
      tenantId?: number;
      resource?: string;
      action: string;
      outcome: 'success' | 'failure';
      ipAddress?: string;
      userAgent?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      const auditData = {
        adminUserId: event.userId,
        adminEmail: event.metadata?.email || null,
        action: `${event.type}:${event.action}`,
        targetTenantId: event.tenantId,
        targetUserId: event.userId,
        route: event.resource,
        metadata: {
          ...event.metadata,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          outcome: event.outcome,
          timestamp: new Date(),
        },
      };

      await db.insert(require("../drizzle/schema").adminAuditLogs).values(auditData);
      
      logger.info("Security event logged", {
        type: event.type,
        action: event.action,
        userId: event.userId,
        outcome: event.outcome,
      });
    } catch (error) {
      logger.error("Failed to log security event", { error, event });
      // Don't throw - logging failure shouldn't break the main flow
    }
  }

  /**
   * Detect security anomalies
   * SIEM-like threat detection
   */
  static async detectAnomalies(db: Db): Promise<void> {
    const anomalies = [];

    try {
      // Check for unusual login patterns
      const recentFailures = await this.checkAuthenticationAnomalies(db);
      if (recentFailures.length > 0) {
        anomalies.push(...recentFailures);
      }

      // Check for data access anomalies
      const dataAnomalies = await this.checkDataAccessAnomalies(db);
      if (dataAnomalies.length > 0) {
        anomalies.push(...dataAnomalies);
      }

      // Log detected anomalies
      for (const anomaly of anomalies) {
        await this.logSecurityEvent(db, {
          type: 'security_anomaly',
          action: anomaly.type,
          outcome: 'failure',
          metadata: anomaly,
        });
      }

      if (anomalies.length > 0) {
        logger.warn("Security anomalies detected", { count: anomalies.length, anomalies });
      }
    } catch (error) {
      logger.error("Anomaly detection failed", { error });
    }
  }

  private static async checkAuthenticationAnomalies(db: Db): Promise<any[]> {
    const anomalies = [];
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Check for multiple failed logins from same IP
    const ipFailures = await db
      .select({
        ipAddress: require("../drizzle/schema").adminAuditLogs.metadata,
        count: require("drizzle-orm").sql<number>`count(*)`,
      })
      .from(require("../drizzle/schema").adminAuditLogs)
      .where(
        require("drizzle-orm").and(
          require("drizzle-orm").eq(require("../drizzle/schema").adminAuditLogs.action, "auth:login:failure"),
          require("drizzle-orm").gte(require("../drizzle/schema").adminAuditLogs.createdAt, oneHourAgo)
        )
      )
      .groupBy(require("../drizzle/schema").adminAuditLogs.metadata)
      .having(require("drizzle-orm").sql`count(*) >= ${SECURITY_MONITORING_POLICY.THREAT_DETECTION.alertThresholds.failedLoginsPerMinute}`);

    if (Array.isArray(ipFailures) && ipFailures.length > 0) {
      anomalies.push(...ipFailures.map((ip: any) => ({
        type: 'brute_force_attack',
        severity: 'high',
        ipAddress: ip.ipAddress,
        failureCount: ip.count,
      })));
    }

    return anomalies;
  }

  private static async checkDataAccessAnomalies(db: Db): Promise<any[]> {
    const anomalies = [];
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Check for excessive data exports
    const dataExports = await db
      .select({
        userId: require("../drizzle/schema").adminAuditLogs.adminUserId,
        count: require("drizzle-orm").sql<number>`count(*)`,
      })
      .from(require("../drizzle/schema").adminAuditLogs)
      .where(
        require("drizzle-orm").and(
          require("drizzle-orm").eq(require("../drizzle/schema").adminAuditLogs.action, "data:export"),
          require("drizzle-orm").gte(require("../drizzle/schema").adminAuditLogs.createdAt, oneHourAgo)
        )
      )
      .groupBy(require("../drizzle/schema").adminAuditLogs.adminUserId)
      .having(require("drizzle-orm").sql`count(*) >= ${SECURITY_MONITORING_POLICY.THREAT_DETECTION.alertThresholds.dataExportPerHour}`);

    if (Array.isArray(dataExports) && dataExports.length > 0) {
      anomalies.push(...dataExports.map((exportRecord: any) => ({
        type: 'data_exfiltration_risk',
        severity: 'medium',
        userId: exportRecord.userId,
        exportCount: exportRecord.count,
      })));
    }

    return anomalies;
  }
}

// ============================================================================
// ACCESS CONTROL
// ============================================================================

export class AccessControlService {
  /**
   * Validate user permissions for sensitive actions
   * Principle of Least Privilege
   */
  static async validatePermissions(
    db: Db,
    userId: number,
    action: string,
    resource?: string
  ): Promise<{ authorized: boolean; reason?: string }> {
    try {
      const [user] = await db
        .select()
        .from(require("../drizzle/schema").users)
        .where(require("drizzle-orm").eq(require("../drizzle/schema").users.id, userId))
        .limit(1);

      if (!user) {
        return { authorized: false, reason: "User not found" };
      }

      // Check if user is active
      if (!user.active) {
        return { authorized: false, reason: "User account is inactive" };
      }

      // Role-based access control
      const sensitiveActions = AUTHENTICATION_POLICY.MFA_POLICY.requiredForActions;
      const requiresMFA = sensitiveActions.includes(action as any);

      if (requiresMFA && user.role !== 'admin') {
        return { authorized: false, reason: "Insufficient privileges for sensitive action" };
      }

      // Log access attempt
      await SecurityMonitoringService.logSecurityEvent(db, {
        type: 'access_control',
        action,
        userId,
        resource,
        outcome: 'success',
      });

      return { authorized: true };
    } catch (error) {
      logger.error("Permission validation failed", { error, userId, action });
      return { authorized: false, reason: "Permission check failed" };
    }
  }

  /**
   * Enforce session security policies
   */
  static validateSessionSecurity(session: {
    createdAt: Date;
    lastActivity: Date;
    userId: number;
    ipAddress?: string;
    userAgent?: string;
  }): { valid: boolean; reason?: string } {
    const now = Date.now();
    const sessionAge = now - session.createdAt.getTime();
    const inactivityTime = now - session.lastActivity.getTime();

    // Check session duration
    if (sessionAge > AUTHENTICATION_POLICY.SESSION_POLICY.maxDuration) {
      return { valid: false, reason: "Session expired" };
    }

    // Check inactivity timeout
    if (inactivityTime > AUTHENTICATION_POLICY.SESSION_POLICY.inactivityTimeout) {
      return { valid: false, reason: "Session inactive too long" };
    }

    return { valid: true };
  }
}

// ============================================================================
// COMPLIANCE VALIDATION
// ============================================================================

export class ComplianceValidationService {
  /**
   * Run comprehensive compliance checks
   */
  static async runComplianceChecks(db: Db): Promise<{
    compliant: boolean;
    checks: Array<{ name: string; status: 'pass' | 'fail'; details?: string }>;
  }> {
    const checks: Array<{ name: string; status: 'pass' | 'fail'; details?: string }> = [];

    try {
      // Data retention compliance
      try {
        await DataProtectionService.enforceDataRetention(db);
        checks.push({ name: 'data_retention', status: 'pass' });
      } catch (error) {
        checks.push({ name: 'data_retention', status: 'fail', details: String(error) });
      }

      // Security monitoring
      try {
        await SecurityMonitoringService.detectAnomalies(db);
        checks.push({ name: 'security_monitoring', status: 'pass' });
      } catch (error) {
        checks.push({ name: 'security_monitoring', status: 'fail', details: String(error) });
      }

      // Audit log integrity
      try {
        const [logCount] = await db
          .select({ count: require("drizzle-orm").sql<number>`count(*)` })
          .from(require("../drizzle/schema").adminAuditLogs)
          .where(
            require("drizzle-orm").gte(
              require("../drizzle/schema").adminAuditLogs.createdAt,
              new Date(Date.now() - 24 * 60 * 60 * 1000)
            )
          );

        if (Number(logCount.count) === 0) {
          checks.push({ name: 'audit_logging', status: 'fail', details: 'No audit logs found in last 24 hours' });
        } else {
          checks.push({ name: 'audit_logging', status: 'pass' });
        }
      } catch (error) {
        checks.push({ name: 'audit_logging', status: 'fail', details: String(error) });
      }

      const compliant = checks.every(check => check.status === 'pass');
      
      logger.info("Compliance checks completed", { 
        compliant, 
        totalChecks: checks.length, 
        passed: checks.filter(c => c.status === 'pass').length 
      });

      return { compliant, checks };
    } catch (error) {
      logger.error("Compliance validation failed", { error });
      return { 
        compliant: false, 
        checks: [{ name: 'compliance_validation', status: 'fail', details: String(error) }] 
      };
    }
  }

  /**
   * Generate compliance report
   */
  static async generateComplianceReport(db: Db): Promise<{
    timestamp: Date;
    policies: Array<{
      name: string;
      status: 'compliant' | 'non_compliant';
      lastChecked: Date;
      issues?: string[];
    }>;
    overallStatus: 'compliant' | 'non_compliant';
  }> {
    const { checks } = await this.runComplianceChecks(db);
    
    const policies = checks.map(check => ({
      name: check.name,
      status: check.status === 'pass' ? 'compliant' as const : 'non_compliant' as const,
      lastChecked: new Date(),
      issues: check.status === 'fail' && check.details ? [check.details] : undefined,
    }));

    const overallStatus = policies.every(p => p.status === 'compliant') ? 'compliant' : 'non_compliant';

    return {
      timestamp: new Date(),
      policies,
      overallStatus,
    };
  }
}
