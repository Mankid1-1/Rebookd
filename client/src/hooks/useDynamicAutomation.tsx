/**
 * 🎯 DYNAMIC AUTOMATION SYSTEM
 * 
 * Adapts automation templates, recommendations, and configurations
 * based on user's automation success rates, conversion patterns, and skill level.
 */

import React from 'react';
import { useProgressiveDisclosureContext } from '@/components/ui/ProgressiveDisclosure';
export { useProgressiveDisclosureContext };
export function trackFeatureUsage(_featureId: string) { /* stub */ }
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/hooks/useAuth';

// Dynamic automation templates based on user performance
export function useDynamicAutomationTemplates() {
  const { data: userMetrics } = trpc.analytics.userConversionMetrics.useQuery();
  const { data: automationPerformance } = trpc.analytics.automationPerformance.useQuery();
  const { data: tenantConfig } = trpc.tenant.get.useQuery();
  const { context } = useProgressiveDisclosureContext();
  
  return React.useMemo(() => {
    const baseTemplates: any[] = [
      // Core appointment automations (available to all users)
      {
        key: "appointment_reminder_24h",
        name: "24-Hour Reminder",
        category: "appointment" as const,
        icon: "Bell",
        description: "Sends an automatic reminder 24 hours before appointment",
        defaultMessage: "Hi {{name}}, just a reminder that your appointment at {{business}} is tomorrow at {{time}}.",
        configFields: [
          { key: "delayHours", label: "Send before appointment", type: "number" as const, unit: "hours", defaultValue: 24 },
          { key: "message", label: "Message", type: "textarea" as const, defaultValue: "Hi {{name}}, reminder for tomorrow at {{time}}." }
        ],
        planRequired: "starter" as const,
        recommended: true,
        requiredSkill: "beginner" as const,
        successRate: 0.85
      },
      {
        key: "appointment_confirmation",
        name: "Booking Confirmation",
        category: "appointment" as const,
        icon: "CalendarCheck",
        description: "Immediately confirms a new booking with details",
        defaultMessage: "Hi {{name}}, your appointment at {{business}} is confirmed for {{date}} at {{time}}.",
        configFields: [
          { key: "message", label: "Message", type: "textarea" as const, defaultValue: "Hi {{name}}, appointment confirmed for {{date}} at {{time}}." }
        ],
        planRequired: "starter" as const,
        recommended: true,
        requiredSkill: "beginner" as const,
        successRate: 0.90
      }
    ];
    
    // All templates available at every skill level
    baseTemplates.push(
      {
        key: "appointment_reminder_2h",
        name: "2-Hour Reminder",
        category: "appointment" as const,
        icon: "Clock",
        description: "Last-chance reminder 2 hours before appointment",
        defaultMessage: "Hey {{name}}! Your appointment at {{business}} is in 2 hours ({{time}}).",
        configFields: [
          { key: "delayHours", label: "Send before appointment", type: "number" as const, unit: "hours", defaultValue: 2 },
          { key: "message", label: "Message", type: "textarea" as const, defaultValue: "Hey {{name}}! Appointment in 2 hours at {{time}}." }
        ],
        planRequired: "starter" as const,
        recommended: (automationPerformance?.successRate || 0.5) > 0.6,
          requiredSkill: "intermediate" as const,
          successRate: 0.75
        },
        {
          key: "no_show_follow_up",
          name: "No-Show Check-In",
          category: "no_show" as const,
          icon: "UserX",
          description: "Sends caring follow-up when client misses appointment",
          defaultMessage: "Hi {{name}}, we noticed you weren't able to make your appointment today. Everything okay?",
          configFields: [
            { key: "delayMinutes", label: "Send after no-show", type: "number" as const, unit: "minutes", defaultValue: 60 },
            { key: "message", label: "Message", type: "textarea" as const, defaultValue: "Hi {{name}}, noticed you missed your appointment. Everything okay?" }
          ],
          planRequired: "starter" as const,
          recommended: userMetrics?.noShowRate > 0.1,
          requiredSkill: "intermediate" as const,
          successRate: 0.60
        },
        {
          key: "no_show_rebooking",
          name: "No-Show Rebook Offer",
          category: "no_show" as const,
          icon: "RefreshCw",
          description: "Second touchpoint 3 days after no-show with rebook offer",
          defaultMessage: "Hi {{name}}, we still have availability if you'd like to reschedule your missed appointment.",
          configFields: [
            { key: "delayDays", label: "Send after no-show", type: "number" as const, unit: "days", defaultValue: 3 },
            { key: "message", label: "Message", type: "textarea" as const, defaultValue: "Hi {{name}}, still have availability to reschedule." }
          ],
          planRequired: "growth" as const,
          recommended: userMetrics?.noShowRate > 0.15,
          requiredSkill: "advanced" as const,
          successRate: 0.45
        },
        {
          key: "cancellation_rebooking",
          name: "Cancellation Rebook Offer",
          category: "cancellation" as const,
          icon: "RotateCcw",
          description: "Offers rebooking options when client cancels",
          defaultMessage: "Hi {{name}}, we've cancelled your appointment. We'd love to find another time.",
          configFields: [
            { key: "delayHours", label: "Send after cancellation", type: "number" as const, unit: "hours", defaultValue: 1 },
            { key: "message", label: "Message", type: "textarea" as const, defaultValue: "Hi {{name}}, appointment cancelled. Let's find another time." }
          ],
          planRequired: "growth" as const,
          recommended: userMetrics?.cancellationRate > 0.05,
          requiredSkill: "advanced" as const,
          successRate: 0.55
        },
        {
          key: "ai_optimized_reminder",
          name: "AI-Optimized Reminder",
          category: "appointment" as const,
          icon: "Zap",
          description: "AI-powered reminder timing and content based on client behavior patterns",
          defaultMessage: "Hi {{name}}, {{ai_personalized_message}}",
          configFields: [
            { key: "aiOptimization", label: "AI Optimization Level", type: "select" as const, 
              options: [
                { value: "basic", label: "Basic timing optimization" },
                { value: "advanced", label: "Advanced personalization" },
                { value: "predictive", label: "Predictive scheduling" }
              ], defaultValue: "advanced" },
            { key: "message", label: "Base Message", type: "textarea" as const, defaultValue: "Hi {{name}}, {{ai_personalized_message}}" }
          ],
          planRequired: "scale" as const,
          recommended: automationPerformance?.successRate > 0.8,
          requiredSkill: "expert" as const,
          successRate: 0.95
        },
        {
          key: "predictive_no_show_prevention",
          name: "Predictive No-Show Prevention",
          category: "no_show" as const,
          icon: "AlertTriangle",
          description: "AI predicts no-show probability and sends targeted interventions",
          defaultMessage: "Hi {{name}}, {{risk_based_message}}",
          configFields: [
            { key: "riskThreshold", label: "Risk Threshold", type: "number" as const, unit: "%", defaultValue: 30 },
            { key: "interventionLevel", label: "Intervention Level", type: "select" as const,
              options: [
                { value: "gentle", label: "Gentle reminder" },
                { value: "moderate", label: "Moderate intervention" },
                { value: "strong", label: "Strong intervention" }
              ], defaultValue: "moderate" }
          ],
          planRequired: "scale" as const,
          recommended: userMetrics?.noShowRate > 0.2,
          requiredSkill: "expert" as const,
          successRate: 0.70
        }
    );

    // Adapt templates based on user's actual performance
    const adaptedTemplates = baseTemplates.map(template => {
      let adaptedTemplate = { ...template };
      
      // Adjust recommendations based on user's conversion rates
      if (userMetrics) {
        const conversionRate = userMetrics.overallConversionRate || 0.5;
        
        // Users with low conversion get more aggressive recommendations
        if (conversionRate < 0.3) {
          adaptedTemplate.recommended = adaptedTemplate.recommended || 
            (template.category === 'appointment' && template.successRate > 0.8);
        }
        
        // Users with high conversion get optimization-focused recommendations
        if (conversionRate > 0.7) {
          adaptedTemplate.recommended = adaptedTemplate.recommended && 
            (template.category === 'no_show' || template.category === 'cancellation');
        }
      }
      
      // Adjust success rate estimates based on user's automation performance
      if (automationPerformance) {
        const userSuccessRate = automationPerformance.successRate || 0.5;
        const adjustmentFactor = userSuccessRate / 0.5; // Normalize around 50%
        adaptedTemplate.successRate = Math.min(0.95, template.successRate * adjustmentFactor);
      }
      
      return adaptedTemplate;
    });
    
    // All templates available at every skill level
    return adaptedTemplates;
  }, [userMetrics, automationPerformance, tenantConfig, context.userSkill.level]);
}

// Dynamic automation recommendations based on user performance gaps
export function useDynamicAutomationRecommendations() {
  const { data: userMetrics } = trpc.analytics.userConversionMetrics.useQuery();
  const { data: automationPerformance } = trpc.analytics.automationPerformance.useQuery();
  const { context } = useProgressiveDisclosureContext();
  
  return React.useMemo(() => {
    const recommendations = [];
    
    if (!userMetrics || !automationPerformance) return recommendations;
    
    // Analyze performance gaps and recommend specific automations
    const conversionRate = userMetrics.overallConversionRate || 0;
    const noShowRate = userMetrics.noShowRate || 0;
    const cancellationRate = userMetrics.cancellationRate || 0;
    const automationSuccessRate = automationPerformance.successRate || 0;
    
    // High no-show rate? Recommend reminder automations
    if (noShowRate > 0.15) {
      recommendations.push({
        type: "high_priority" as const,
        title: "Reduce No-Shows with Automated Reminders",
        description: `Your no-show rate is ${(noShowRate * 100).toFixed(1)}%. Automated reminders can reduce this by 40-60%.`,
        automationKeys: ["appointment_reminder_24h", "appointment_reminder_2h"],
        expectedImpact: "high" as const,
        implementationEffort: "low" as const
      });
    }
    
    // Low conversion rate? Recommend confirmation automations
    if (conversionRate < 0.4) {
      recommendations.push({
        type: "medium_priority" as const,
        title: "Improve Conversion with Confirmation Automation",
        description: `Your conversion rate is ${(conversionRate * 100).toFixed(1)}%. Instant confirmations can improve this by 15-25%.`,
        automationKeys: ["appointment_confirmation", "appointment_confirmation_chase"],
        expectedImpact: "medium" as const,
        implementationEffort: "low" as const
      });
    }
    
    // High cancellation rate? Recommend rebooking automations
    if (cancellationRate > 0.1) {
      recommendations.push({
        type: "medium_priority" as const,
        title: "Recover Cancellations with Automated Rebooking",
        description: `Your cancellation rate is ${(cancellationRate * 100).toFixed(1)}%. Automated rebooking offers can recover 30-50% of cancellations.`,
        automationKeys: ["cancellation_rebooking", "cancellation_same_day"],
        expectedImpact: "medium" as const,
        implementationEffort: "medium" as const
      });
    }
    
    // Poor automation performance? Recommend training and simpler automations
    if (automationSuccessRate < 0.5) {
      recommendations.push({
        type: "learning_priority" as const,
        title: "Improve Automation Success Rate",
        description: `Your automation success rate is ${(automationSuccessRate * 100).toFixed(1)}%. Start with simpler automations and build up complexity.`,
        automationKeys: ["appointment_reminder_24h", "appointment_confirmation"],
        expectedImpact: "high" as const,
        implementationEffort: "low" as const
      });
    }
    
    // Expert user with good performance? Recommend advanced automations
    if (context.userSkill.level === 'expert' && automationSuccessRate > 0.8) {
      recommendations.push({
        type: "optimization_priority" as const,
        title: "Optimize with AI-Powered Automations",
        description: "You're ready for advanced AI-powered automations that can predict and prevent issues before they occur.",
        automationKeys: ["ai_optimized_reminder", "predictive_no_show_prevention"],
        expectedImpact: "high" as const,
        implementationEffort: "high" as const
      });
    }
    
    return recommendations;
  }, [userMetrics, automationPerformance, context.userSkill.level]);
}

// Dynamic automation configuration based on user behavior
export function useDynamicAutomationConfig() {
  const { data: userBehavior } = trpc.analytics.userBehaviorPatterns.useQuery();
  const { data: automationPerformance } = trpc.analytics.automationPerformance.useQuery();
  const { context } = useProgressiveDisclosureContext();
  
  return React.useCallback((automationKey: string) => {
    const baseConfig = {
      enabled: true,
      retryAttempts: 3,
      retryDelay: 300, // 5 minutes
      timeout: 3600, // 1 hour
      priority: "normal"
    };
    
    // Adapt configuration based on user behavior patterns
    if (userBehavior) {
      const { peakHours, responsePatterns } = userBehavior;
      const errorPatterns = (userBehavior as any).errorPatterns;

      // Adjust timing based on user's peak hours
      if (peakHours && automationKey.includes('reminder')) {
        baseConfig.priority = peakHours.includes(new Date().getHours()) ? "high" : "normal";
      }

      // Adjust retry attempts based on user's response patterns
      if (responsePatterns) {
        const avgResponseTime = responsePatterns.avgResponseTimeMinutes * 60 || 300; // convert minutes to seconds
        baseConfig.retryDelay = Math.max(60, avgResponseTime / 2); // Half of average response time
      }

      // Adjust timeout based on error patterns
      if (errorPatterns && errorPatterns.timeoutRate > 0.2) {
        baseConfig.timeout = baseConfig.timeout * 1.5; // Increase timeout for users with many timeouts
      }
    }
    
    // Adapt configuration based on automation performance
    if (automationPerformance) {
      const successRate = automationPerformance.successRate || 0.5;
      
      // Users with high success get more aggressive configurations
      if (successRate > 0.8) {
        baseConfig.retryAttempts = 5;
        baseConfig.priority = "high";
      }
      // Users with low success get more conservative configurations
      else if (successRate < 0.3) {
        baseConfig.retryAttempts = 2;
        baseConfig.priority = "low";
        baseConfig.timeout = baseConfig.timeout * 0.8; // Shorter timeout to avoid issues
      }
    }
    
    // Adapt configuration based on user skill level
    if (context.userSkill.level === 'expert') {
      baseConfig.retryAttempts = Math.max(baseConfig.retryAttempts, 5);
      baseConfig.priority = "high";
    } else if (context.userSkill.level === 'beginner') {
      baseConfig.retryAttempts = Math.min(baseConfig.retryAttempts, 2);
      baseConfig.priority = "normal";
    }
    
    return baseConfig;
  }, [userBehavior, automationPerformance, context.userSkill.level]);
}

// Dynamic automation success prediction
export function useDynamicAutomationSuccessPrediction() {
  const { data: userMetrics } = trpc.analytics.userConversionMetrics.useQuery();
  const { data: automationPerformance } = trpc.analytics.automationPerformance.useQuery();
  const { data: historicalPerformance } = trpc.analytics.automationHistoricalPerformance.useQuery();
  const { context } = useProgressiveDisclosureContext();
  
  return React.useCallback((automationKey: string, targetAudience?: string) => {
    let baseProbability = 0.7; // 70% base success probability
    
    // Adjust based on user's overall automation performance
    if (automationPerformance) {
      const userSuccessRate = automationPerformance.successRate || 0.5;
      baseProbability = baseProbability * (userSuccessRate / 0.5); // Scale around 50%
    }
    
    // Adjust based on historical performance of this specific automation
    if (historicalPerformance && historicalPerformance[automationKey]) {
      const historicalSuccessRate = historicalPerformance[automationKey].successRate;
      baseProbability = baseProbability * (historicalSuccessRate / 0.5);
    }
    
    // Adjust based on user's conversion metrics
    if (userMetrics) {
      const conversionRate = userMetrics.overallConversionRate || 0.5;
      
      // High-conversion users get better success predictions
      if (conversionRate > 0.7) {
        baseProbability *= 1.2;
      }
      // Low-conversion users get more conservative predictions
      else if (conversionRate < 0.3) {
        baseProbability *= 0.8;
      }
    }
    
    // Adjust based on user skill level
    if (context.userSkill.level === 'expert') {
      baseProbability *= 1.15;
    } else if (context.userSkill.level === 'beginner') {
      baseProbability *= 0.9;
    }
    
    // Adjust based on target audience
    if (targetAudience === 'vip') {
      baseProbability *= 1.1; // VIP clients typically respond better
    } else if (targetAudience === 'new') {
      baseProbability *= 0.9; // New clients may be less responsive
    }
    
    return Math.min(0.95, Math.max(0.05, baseProbability)); // Clamp between 5% and 95%
  }, [userMetrics, automationPerformance, historicalPerformance, context.userSkill.level]);
}

/**
 * USAGE EXAMPLES:
 * 
 * Replace all static automation catalogues with dynamic user-adaptive systems:
 * 
 * BEFORE (static):
 * const CATALOGUE: AutomationTemplate[] = [hardcoded templates];
 * 
 * AFTER (dynamic):
 * const templates = useDynamicAutomationTemplates();
 * const recommendations = useDynamicAutomationRecommendations();
 * const getConfig = useDynamicAutomationConfig();
 * const predictSuccess = useDynamicAutomationSuccessPrediction();
 * 
 * Dynamic template selection based on user skill and performance
 * const userTemplates = templates.filter(t => 
 *   t.requiredSkill <= userSkill.level && 
 *   t.successRate > 0.6
 * );
 * 
 * Personalized recommendations based on performance gaps
 * const personalizedRecommendations = recommendations.filter(r => 
 *   r.type === 'high_priority' && userSkill.level !== 'beginner'
 * );
 */

// Re-export progressive disclosure context for convenience
export { useProgressiveDisclosureContext } from '@/components/ui/ProgressiveDisclosure';

// Feature usage tracking utility
export function trackFeatureUsage(feature: string, action: string, metadata?: any) {
  // Track feature usage for analytics and progressive disclosure
  console.log('Feature usage:', { feature, action, metadata });
  
  // In a real implementation, this would send to analytics service
  // Example: trpc.analytics.trackFeatureUsage.mutate({ feature, action, metadata });
}
