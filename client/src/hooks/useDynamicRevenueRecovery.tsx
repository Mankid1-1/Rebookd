/**
 * 🎯 DYNAMIC REVENUE RECOVERY SYSTEM
 * 
 * Adapts revenue recovery strategies based on real user conversion rates,
 * successful automations, and historical performance data.
 */

import { useProgressiveDisclosureContext } from '@/components/ui/ProgressiveDisclosure';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';

// Dynamic leakage detection based on user's historical conversion rates
export function useDynamicLeakageDetection() {
  const { data: userMetrics } = trpc.analytics.userConversionMetrics.useQuery();
  const { data: automationPerformance } = trpc.analytics.automationPerformance.useQuery();
  const { context } = useProgressiveDisclosureContext();
  
  return React.useMemo(() => {
    const baseLeakageTypes = [
      {
        id: 'no_show',
        type: "no_show" as const,
        baseDetectionRate: 0.15, // 15% base no-show rate
        severity: "medium" as const,
        description: "Missed appointments",
        recoveryActions: ["automated_reminder", "rescheduling_bot", "deposit_required"]
      },
      {
        id: 'cancellation',
        type: "cancellation" as const,
        baseDetectionRate: 0.08, // 8% base cancellation rate
        severity: "low" as const,
        description: "Cancelled appointments",
        recoveryActions: ["retention_offer", "reschedule_incentive", "feedback_collection"]
      },
      {
        id: 'followup_missed',
        type: "followup_missed" as const,
        baseDetectionRate: 0.25, // 25% base follow-up miss rate
        severity: "high" as const,
        description: "Missed follow-up opportunities",
        recoveryActions: ["automated_followup", "priority_queue", "staff_notification"]
      }
    ];
    
    // Adapt detection rates based on user's actual conversion performance
    const adaptedLeakageTypes = baseLeakageTypes.map(leakage => {
      let adaptedDetectionRate = leakage.baseDetectionRate;
      let adaptedSeverity = leakage.severity;
      let adaptedRecoveryActions = [...leakage.recoveryActions];
      
      // Adjust based on user's conversion rates
      if (userMetrics) {
        const conversionRate = userMetrics.overallConversionRate || 0.5;
        
        // Users with low conversion rates get more sensitive detection
        if (conversionRate < 0.3) {
          adaptedDetectionRate *= 1.5; // 50% more sensitive
          adaptedSeverity = adaptedSeverity === "low" ? "medium" : 
                          adaptedSeverity === "medium" ? "high" : "critical";
        }
        // Users with high conversion rates get less sensitive detection
        else if (conversionRate > 0.7) {
          adaptedDetectionRate *= 0.7; // 30% less sensitive
        }
      }
      
      // Adjust based on automation performance
      if (automationPerformance) {
        const automationSuccessRate = automationPerformance.successRate || 0.5;
        
        // Users with successful automations get more automated recovery actions
        if (automationSuccessRate > 0.7) {
          adaptedRecoveryActions = adaptedRecoveryActions.filter(action => 
            action.includes("automated") || action.includes("bot")
          );
        }
        // Users with poor automation performance get more manual actions
        else if (automationSuccessRate < 0.3) {
          adaptedRecoveryActions = adaptedRecoveryActions.map(action => 
            action.includes("automated") ? action.replace("automated", "manual") : action
          );
        }
      }
      
      // Adjust based on user skill level
      if (context.userSkill.level === 'expert') {
        adaptedRecoveryActions.push("advanced_analytics", "custom_workflow", "ai_optimization");
      } else if (context.userSkill.level === 'beginner') {
        adaptedRecoveryActions = adaptedRecoveryActions.filter(action => 
          !action.includes("advanced") && !action.includes("custom") && !action.includes("ai")
        );
      }
      
      return {
        ...leakage,
        detectionRate: adaptedDetectionRate,
        severity: adaptedSeverity,
        recoveryActions: adaptedRecoveryActions
      };
    });
    
    return adaptedLeakageTypes;
  }, [userMetrics, automationPerformance, context.userSkill.level]);
}

// Dynamic recovery strategy recommendations based on user performance
export function useDynamicRecoveryStrategies() {
  const { data: userMetrics } = trpc.analytics.userConversionMetrics.useQuery();
  const { data: automationPerformance } = trpc.analytics.automationPerformance.useQuery();
  const { data: recoveryHistory } = trpc.analytics.recoveryHistory.useQuery();
  const { context } = useProgressiveDisclosureContext();
  
  return React.useMemo(() => {
    const strategies = [];
    
    // Base strategies for all users
    strategies.push({
      id: 'basic_reminders',
      category: "automation" as const,
      priority: "medium" as const,
      title: "Automated Appointment Reminders",
      description: "Send automated reminders 24 hours before appointments",
      expectedImpact: 15, // 15% reduction in no-shows
      implementationEffort: "low" as const,
      requiredSkill: "beginner" as const,
      successRate: 0.75
    });
    
    // Adapt strategies based on user's conversion performance
    if (userMetrics) {
      const conversionRate = userMetrics.overallConversionRate || 0.5;
      
      // Low conversion users get more aggressive strategies
      if (conversionRate < 0.3) {
        strategies.push({
          id: 'deposit_system',
          category: "process" as const,
          priority: "high" as const,
          title: "Implement Deposit System",
          description: "Require deposits for high-value appointments to reduce no-shows",
          expectedImpact: 35,
          implementationEffort: "medium" as const,
          requiredSkill: "intermediate" as const,
          successRate: 0.85
        });
        
        strategies.push({
          id: 'intensive_followup',
          category: "automation" as const,
          priority: "high" as const,
          title: "Intensive Follow-up Sequence",
          description: "Multi-channel follow-up with escalating urgency",
          expectedImpact: 25,
          implementationEffort: "medium" as const,
          requiredSkill: "intermediate" as const,
          successRate: 0.70
        });
      }
      
      // High conversion users get optimization strategies
      else if (conversionRate > 0.7) {
        strategies.push({
          id: 'upsell_automation',
          category: "automation" as const,
          priority: "low" as const,
          title: "Automated Upsell Opportunities",
          description: "Identify and automate upsell opportunities for high-conversion leads",
          expectedImpact: 20,
          implementationEffort: "medium" as const,
          requiredSkill: "advanced" as const,
          successRate: 0.60
        });
      }
    }
    
    // Adapt strategies based on automation performance
    if (automationPerformance) {
      const automationSuccessRate = automationPerformance.successRate || 0.5;
      
      // Users with good automation performance get advanced automation strategies
      if (automationSuccessRate > 0.7) {
        strategies.push({
          id: 'ai_predictive_recovery',
          category: "technology" as const,
          priority: "medium" as const,
          title: "AI-Predictive Recovery System",
          description: "Use AI to predict and prevent revenue leakage before it occurs",
          expectedImpact: 40,
          implementationEffort: "high" as const,
          requiredSkill: "expert" as const,
          successRate: 0.80
        });
      }
      
      // Users with poor automation performance get process improvement strategies
      else if (automationSuccessRate < 0.3) {
        strategies.push({
          id: 'staff_training',
          category: "staffing" as const,
          priority: "high" as const,
          title: "Staff Training Program",
          description: "Train staff on manual recovery processes before implementing automation",
          expectedImpact: 20,
          implementationEffort: "medium" as const,
          requiredSkill: "beginner" as const,
          successRate: 0.65
        });
      }
    }
    
    // Adapt strategies based on user skill level
    if (context.userSkill.level === 'expert') {
      strategies.push({
        id: 'custom_recovery_workflows',
        category: "automation" as const,
        priority: "medium" as const,
        title: "Custom Recovery Workflows",
        description: "Build custom recovery workflows for specific business scenarios",
        expectedImpact: 30,
        implementationEffort: "high" as const,
        requiredSkill: "expert" as const,
        successRate: 0.75
      });
    }
    
    // Filter strategies based on user skill level and sort by priority
    return strategies
      .filter(strategy => {
        const skillLevels = ['beginner', 'intermediate', 'advanced', 'expert'];
        const userSkillIndex = skillLevels.indexOf(context.userSkill.level);
        const requiredSkillIndex = skillLevels.indexOf(strategy.requiredSkill);
        return userSkillIndex >= requiredSkillIndex;
      })
      .sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
  }, [userMetrics, automationPerformance, context.userSkill.level]);
}

// Dynamic recovery probability calculation based on user's historical success
export function useDynamicRecoveryProbability() {
  const { data: recoveryHistory } = trpc.analytics.recoveryHistory.useQuery();
  const { data: automationPerformance } = trpc.analytics.automationPerformance.useQuery();
  const { context } = useProgressiveDisclosureContext();
  
  return React.useCallback((leakageType: string, estimatedRevenue: number) => {
    let baseProbability = 0.5; // 50% base recovery probability
    
    // Adjust based on user's historical recovery success
    if (recoveryHistory) {
      const typeHistory = recoveryHistory.byType[leakageType];
      if (typeHistory && typeHistory.attempts > 0) {
        baseProbability = typeHistory.successRate;
      }
    }
    
    // Adjust based on automation performance
    if (automationPerformance) {
      const automationSuccessRate = automationPerformance.successRate || 0.5;
      
      // Users with good automation performance get higher recovery probabilities
      if (automationSuccessRate > 0.7) {
        baseProbability *= 1.2; // 20% boost
      }
      // Users with poor automation performance get lower probabilities
      else if (automationSuccessRate < 0.3) {
        baseProbability *= 0.8; // 20% reduction
      }
    }
    
    // Adjust based on user skill level
    if (context.userSkill.level === 'expert') {
      baseProbability *= 1.15; // 15% boost for experts
    } else if (context.userSkill.level === 'beginner') {
      baseProbability *= 0.9; // 10% reduction for beginners
    }
    
    // Adjust based on revenue amount (higher value = lower probability)
    if (estimatedRevenue > 1000) {
      baseProbability *= 0.9; // 10% reduction for high-value recoveries
    } else if (estimatedRevenue < 100) {
      baseProbability *= 1.1; // 10% boost for low-value recoveries
    }
    
    return Math.min(0.95, Math.max(0.05, baseProbability)); // Clamp between 5% and 95%
  }, [recoveryHistory, automationPerformance, context.userSkill.level]);
}

// Dynamic recovery action prioritization based on user's success patterns
export function useDynamicActionPrioritization() {
  const { data: actionPerformance } = trpc.analytics.actionPerformance.useQuery();
  const { context } = useProgressiveDisclosureContext();
  
  return React.useCallback((recoveryActions: string[], leakageType: string) => {
    // Base action priorities
    const actionPriorities: Record<string, number> = {
      'automated_reminder': 8,
      'rescheduling_bot': 7,
      'deposit_required': 6,
      'retention_offer': 5,
      'reschedule_incentive': 4,
      'automated_followup': 9,
      'priority_queue': 6,
      'staff_notification': 5,
      'advanced_analytics': 3,
      'custom_workflow': 2,
      'ai_optimization': 1
    };
    
    // Adjust priorities based on user's action performance
    if (actionPerformance) {
      Object.keys(actionPerformance).forEach(action => {
        const performance = actionPerformance[action];
        if (performance.successRate > 0.7) {
          actionPriorities[action] = Math.min(10, actionPriorities[action] + 2); // Boost successful actions
        } else if (performance.successRate < 0.3) {
          actionPriorities[action] = Math.max(1, actionPriorities[action] - 2); // Reduce unsuccessful actions
        }
      });
    }
    
    // Adjust based on user skill level
    if (context.userSkill.level === 'expert') {
      actionPriorities['advanced_analytics'] = 8;
      actionPriorities['custom_workflow'] = 7;
      actionPriorities['ai_optimization'] = 9;
    } else if (context.userSkill.level === 'beginner') {
      actionPriorities['advanced_analytics'] = 1;
      actionPriorities['custom_workflow'] = 1;
      actionPriorities['ai_optimization'] = 1;
    }
    
    // Sort actions by adjusted priority
    return recoveryActions
      .map(action => ({ action, priority: actionPriorities[action] || 5 }))
      .sort((a, b) => b.priority - a.priority)
      .map(item => item.action);
  }, [actionPerformance, context.userSkill.level]);
}

// Dynamic revenue impact calculation based on user's conversion patterns
export function useDynamicRevenueImpact() {
  const { data: userMetrics } = trpc.analytics.userConversionMetrics.useQuery();
  const { data: marketData } = trpc.analytics.marketData.useQuery();
  
  return React.useCallback((baseImpact: number, actionType: string) => {
    let adjustedImpact = baseImpact;
    
    // Adjust based on user's conversion rate
    if (userMetrics) {
      const conversionRate = userMetrics.overallConversionRate || 0.5;
      
      // High-conversion users get higher impact from recovery actions
      if (conversionRate > 0.7) {
        adjustedImpact *= 1.3; // 30% boost
      }
      // Low-conversion users get lower impact
      else if (conversionRate < 0.3) {
        adjustedImpact *= 0.7; // 30% reduction
      }
    }
    
    // Adjust based on market conditions
    if (marketData) {
      const marketDemand = marketData.demandIndex || 1.0;
      adjustedImpact *= marketDemand; // Scale by market demand
    }
    
    // Action-specific adjustments
    const actionMultipliers: Record<string, number> = {
      'automated_reminder': 1.2,
      'deposit_required': 1.5,
      'ai_optimization': 1.8,
      'staff_training': 0.8,
      'custom_workflow': 1.4
    };
    
    if (actionMultipliers[actionType]) {
      adjustedImpact *= actionMultipliers[actionType];
    }
    
    return Math.round(adjustedImpact);
  }, [userMetrics, marketData]);
}

/**
 * USAGE EXAMPLES:
 * 
 * Replace all static revenue recovery logic with dynamic user-adaptive systems:
 * 
 * // BEFORE (static):
 * const recoveryProbability = 0.5; // Fixed 50% for all users
 * 
 * // AFTER (dynamic):
 * const getRecoveryProbability = useDynamicRecoveryProbability();
 * const recoveryProbability = getRecoveryProbability(leakageType, revenue);
 * 
 * // BEFORE (static):
 * const strategies = HARDCODED_STRATEGIES;
 * 
 * // AFTER (dynamic):
 * const strategies = useDynamicRecoveryStrategies();
 * 
 * // BEFORE (static):
 * const actions = ["automated_reminder", "staff_notification"];
 * 
 * // AFTER (dynamic):
 * const prioritizeActions = useDynamicActionPrioritization();
 * const actions = prioritizeActions(baseActions, leakageType);
 */
