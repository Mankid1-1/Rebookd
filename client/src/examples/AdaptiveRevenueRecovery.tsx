/**
 * 🎯 DYNAMIC REVENUE RECOVERY INTEGRATION EXAMPLE
 * 
 * Demonstrates how the revenue recovery system adapts to each user's
 * conversion rates, automation success, and skill level.
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  useDynamicLeakageDetection, 
  useDynamicRecoveryStrategies,
  useDynamicRecoveryProbability,
  useDynamicActionPrioritization,
  useDynamicRevenueImpact,
  useProgressiveDisclosureContext,
  trackFeatureUsage,
  trackSessionStart,
  trackSessionEnd
} from '@/hooks/useDynamicRevenueRecovery';
import { trpc } from '@/lib/trpc';
import { TrendingUp, Users, Target, Zap, AlertTriangle, CheckCircle } from 'lucide-react';

export function AdaptiveRevenueRecovery() {
  const sessionStartTime = React.useRef(Date.now());
  
  // Dynamic hooks for user-adaptive revenue recovery
  const dynamicLeakageTypes = useDynamicLeakageDetection();
  const dynamicStrategies = useDynamicRecoveryStrategies();
  const getRecoveryProbability = useDynamicRecoveryProbability();
  const prioritizeActions = useDynamicActionPrioritization();
  const getRevenueImpact = useDynamicRevenueImpact();
  const { context, trackFeatureUsage: trackFeature } = useProgressiveDisclosureContext();
  
  // User performance data
  const { data: userMetrics } = trpc.analytics.userConversionMetrics.useQuery();
  const { data: automationPerformance } = trpc.analytics.automationPerformance.useQuery();
  const { data: recoveryHistory } = trpc.analytics.recoveryHistory.useQuery();
  
  // Track session and feature usage
  useEffect(() => {
    trackSessionStart();
    trackFeature('revenue_recovery_dashboard');
    
    return () => {
      const sessionDuration = (Date.now() - sessionStartTime.current) / 1000 / 60;
      trackSessionEnd(sessionDuration);
    };
  }, []);

  // Simulated recovery action with real tracking
  const handleRecoveryAction = async (actionType: string, leadIds: number[]) => {
    try {
      // Track the recovery action
      trackFeature(`recovery_action_${actionType}`);
      
      // Execute the recovery action
      const result = await trpc.analytics.executeRecoveryAction.mutateAsync({
        leadId: leadIds[0] ?? 0,
        action: actionType,
      });
      
      // Track success/failure
      if (result.success) {
        trackFeature(`recovery_success_${actionType}`);
      } else {
        trackFeature(`recovery_failure_${actionType}`);
      }
      
      return result;
    } catch (error) {
      trackFeature('recovery_error');
      throw error;
    }
  };

  // Calculate user performance tier
  const getUserPerformanceTier = () => {
    if (!userMetrics) return 'beginner';
    
    const conversionRate = userMetrics.overallConversionRate || 0;
    const automationSuccess = automationPerformance?.successRate || 0;
    
    if (conversionRate > 0.7 && automationSuccess > 0.8) return 'expert';
    if (conversionRate > 0.5 && automationSuccess > 0.6) return 'advanced';
    if (conversionRate > 0.3 && automationSuccess > 0.4) return 'intermediate';
    return 'beginner';
  };

  const performanceTier = getUserPerformanceTier();

  return (
    <div className="space-y-6">
      {/* User Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Your Revenue Recovery Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {userMetrics?.overallConversionRate ? 
                  `${(userMetrics.overallConversionRate * 100).toFixed(1)}%` : 'N/A'
                }
              </div>
              <div className="text-sm text-muted-foreground">Conversion Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {automationPerformance?.successRate ? 
                  `${(automationPerformance.successRate * 100).toFixed(1)}%` : 'N/A'
                }
              </div>
              <div className="text-sm text-muted-foreground">Automation Success</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {recoveryHistory?.overallRecoveryRate ? 
                  `${(recoveryHistory.overallRecoveryRate * 100).toFixed(1)}%` : 'N/A'
                }
              </div>
              <div className="text-sm text-muted-foreground">Recovery Success</div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Performance Tier</span>
            <Badge variant={performanceTier === 'expert' ? 'default' : 'secondary'}>
              {performanceTier.charAt(0).toUpperCase() + performanceTier.slice(1)}
            </Badge>
          </div>
          
          <Progress 
            value={performanceTier === 'expert' ? 100 : 
                   performanceTier === 'advanced' ? 75 :
                   performanceTier === 'intermediate' ? 50 : 25} 
            className="h-2"
          />
        </CardContent>
      </Card>

      {/* Adaptive Leakage Detection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Adaptive Leakage Detection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Detection sensitivity adapts to your conversion rate. 
              {performanceTier === 'beginner' && 
                " Higher sensitivity to catch more opportunities for improvement."}
              {performanceTier === 'expert' && 
                " Optimized sensitivity to focus on high-impact recoveries."}
            </AlertDescription>
          </Alert>
          
          <div className="space-y-3">
            {dynamicLeakageTypes.map(leakage => (
              <div key={leakage.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{leakage.description}</div>
                  <div className="text-sm text-muted-foreground">
                    Detection Rate: {(leakage.detectionRate * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={leakage.severity === 'critical' ? 'destructive' : 'secondary'}>
                    {leakage.severity}
                  </Badge>
                  <div className="text-sm">
                    {prioritizeActions(leakage.recoveryActions, leakage.type).slice(0, 2).join(', ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Personalized Recovery Strategies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Your Personalized Recovery Strategies
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Strategies are personalized based on your performance history and skill level.
              {performanceTier === 'beginner' && 
                " Focusing on foundational recovery techniques."}
              {performanceTier === 'expert' && 
                " Advanced strategies including AI-powered optimization."}
            </AlertDescription>
          </Alert>
          
          <div className="space-y-3">
            {dynamicStrategies.slice(0, 5).map(strategy => (
              <div key={strategy.id} className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{strategy.title}</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant={strategy.priority === 'critical' ? 'destructive' : 'secondary'}>
                      {strategy.priority}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {getRevenueImpact(strategy.expectedImpact, strategy.category)}% impact
                    </span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{strategy.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Effort: {strategy.implementationEffort}
                  </span>
                  <Button 
                    size="sm" 
                    onClick={() => handleRecoveryAction(strategy.id, [])}
                    className="text-xs"
                  >
                    Implement
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Real-time Recovery Probability */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Real-time Recovery Probability
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Recovery probabilities are calculated based on your historical success rates
              and current performance patterns.
            </AlertDescription>
          </Alert>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dynamicLeakageTypes.map(leakage => {
              const probability = getRecoveryProbability(leakage.type, 1000);
              return (
                <div key={leakage.id} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{leakage.description}</span>
                    <span className="text-sm font-bold">
                      {(probability * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={probability * 100} className="h-2" />
                  <div className="text-xs text-muted-foreground">
                    Based on your {performanceTier} performance tier
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Skill Progression Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Your Revenue Recovery Journey
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Current Skill Level</span>
              <Badge>{context.userSkill.level}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Features Explored</span>
              <span>{Object.keys(context.userSkill.experience.featureUsage).length}/6</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Recovery Actions Taken</span>
              <span>{context.userSkill.experience.featureUsage['recovery_actions'] || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Success Rate Trend</span>
              <Badge variant={performanceTier === 'expert' ? 'default' : 'secondary'}>
                {performanceTier === 'expert' ? 'Improving' : 'Developing'}
              </Badge>
            </div>
          </div>
          
          {context.userSkill.level !== 'expert' && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Keep using recovery features to unlock advanced strategies and AI-powered optimizations!
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * USAGE EXAMPLES:
 * 
 * This component demonstrates how the revenue recovery system becomes fully adaptive:
 * 
 * 1. BEGINNER USER (Low conversion, poor automation):
 *    - Higher leakage detection sensitivity
 *    - Basic recovery strategies (reminders, manual follow-up)
 *    - Lower recovery probability estimates
 *    - Focus on foundational improvements
 * 
 * 2. INTERMEDIATE USER (Moderate conversion, decent automation):
 *    - Balanced detection sensitivity
 *    - Mixed manual and automated strategies
 *    - Moderate recovery probabilities
 *    - Introduction to process improvements
 * 
 * 3. EXPERT USER (High conversion, excellent automation):
 *    - Optimized detection sensitivity
 *    - Advanced AI-powered strategies
 *    - High recovery probabilities
 *    - Custom workflow and optimization options
 * 
 * Every aspect adapts to real user performance data, creating a truly personalized experience.
 */
