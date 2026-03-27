/**
 * 🎯 ADVANCED PERSONALIZATION SYSTEM
 * AI-driven user experience personalization and adaptation
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  Brain, Target, Zap, Settings, User, Clock,
  TrendingUp, BarChart3, MessageSquare, Calendar,
  Eye, EyeOff, RefreshCw, Sparkles, Lightbulb,
  Users, DollarSign, Activity, AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProgressiveDisclosureContext } from "@/components/ui/ProgressiveDisclosure";

interface UserProfile {
  id: string;
  behavior: {
    mostActiveTime: string;
    preferredCommunication: 'sms' | 'email' | 'both';
    responsePatterns: {
      averageResponseTime: number;
      preferredDay: string;
      conversionTriggers: string[];
    };
    featureUsage: {
      dashboard: number;
      messaging: number;
      analytics: number;
      settings: number;
    };
    goals: {
      primary: string;
      secondary: string[];
      kpis: string[];
    };
  };
  preferences: {
    uiComplexity: 'simple' | 'moderate' | 'advanced';
    notificationFrequency: 'minimal' | 'normal' | 'frequent';
    dataVisualization: 'basic' | 'detailed' | 'comprehensive';
    automationLevel: 'manual' | 'semi' | 'full';
  };
  learning: {
    skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    completedTutorials: string[];
    masteredFeatures: string[];
    improvementAreas: string[];
  };
}

interface PersonalizationInsight {
  id: string;
  type: 'behavior' | 'preference' | 'performance' | 'recommendation';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  actionable: boolean;
  action?: () => void;
  confidence: number;
}

interface AdaptiveRecommendation {
  id: string;
  category: 'ui' | 'workflow' | 'automation' | 'reporting';
  title: string;
  description: string;
  benefit: string;
  implementation: 'immediate' | 'gradual' | 'manual';
  priority: number;
}

interface AdvancedPersonalizationProps {
  userId: string;
  onPersonalizationUpdate?: (profile: UserProfile) => void;
  enableAdaptation?: boolean;
}

export function AdvancedPersonalization({ 
  userId, 
  onPersonalizationUpdate,
  enableAdaptation = true 
}: AdvancedPersonalizationProps) {
  const { user } = useAuth();
  const { context } = useProgressiveDisclosureContext();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [insights, setInsights] = useState<PersonalizationInsight[]>([]);
  const [recommendations, setRecommendations] = useState<AdaptiveRecommendation[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [adaptationEnabled, setAdaptationEnabled] = useState(enableAdaptation);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Real personalization API - no simulation!
  const { data: userProfileData } = trpc.personalization.getProfile.useQuery({ userId });
  const { data: insightsData } = trpc.personalization.getInsights.useQuery({ userId });
  const { data: recommendationsData } = trpc.personalization.getRecommendations.useQuery({ userId });
  const generateProfile = trpc.personalization.generateProfile.useMutation();
  const applyRecommendation = trpc.personalization.applyRecommendation.useMutation();

  useEffect(() => {
    if (userProfileData) {
      setUserProfile(userProfileData);
    }
    if (insightsData) {
      setInsights(insightsData);
    }
    if (recommendationsData) {
      setRecommendations(recommendationsData);
    }
  }, [userProfileData, insightsData, recommendationsData]);

  const handleAnalyzeProfile = async () => {
    if (!user?.id) return;
    
    setIsAnalyzing(true);
    try {
      const result = await analyzeUserProfile.mutateAsync({ userId: user.id });
      if (result.profile) {
        setUserProfile(result.profile);
        onPersonalizationUpdate?.(result.profile);
      }
      if (result.insights) {
        setInsights(result.insights);
      }
      if (result.recommendations) {
        setRecommendations(result.recommendations);
      }
      toast.success("User profile analyzed successfully");
    } catch (error) {
      toast.error("Failed to analyze user profile");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyRecommendation = async (recommendation: AdaptiveRecommendation) => {
    if (!user?.id) return;
    
    try {
      await applyRecommendation.mutateAsync({ 
        userId: user.id, 
        recommendationId: recommendation.id 
      });
    } catch (error) {
      toast.error("Failed to apply recommendation");
    }
  };

  const getSkillLevelColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'text-green-600';
      case 'intermediate': return 'text-yellow-600';
      case 'advanced': return 'text-orange-600';
      case 'expert': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getSkillLevelBadge = (level: string) => {
    switch (level) {
      case 'beginner': return <Badge className="bg-green-100 text-green-800">Beginner</Badge>;
      case 'intermediate': return <Badge className="bg-yellow-100 text-yellow-800">Intermediate</Badge>;
      case 'advanced': return <Badge className="bg-orange-100 text-orange-800">Advanced</Badge>;
      case 'expert': return <Badge className="bg-red-100 text-red-800">Expert</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'low': return 'text-gray-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getImplementationBadge = (implementation: string) => {
    switch (implementation) {
      case 'immediate': return <Badge className="bg-green-100 text-green-800">Immediate</Badge>;
      case 'gradual': return <Badge className="bg-yellow-100 text-yellow-800">Gradual</Badge>;
      case 'manual': return <Badge className="bg-blue-100 text-blue-800">Manual</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  useEffect(() => {
    if (user?.id) {
      handleAnalyzeProfile();
    }
  }, [user?.id]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Advanced Personalization</h1>
          <p className="text-muted-foreground">
            AI-driven experience tailored to your behavior and preferences
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Switch
              id="adaptation-enabled"
              checked={adaptationEnabled}
              onCheckedChange={setAdaptationEnabled}
            />
            <label htmlFor="adaptation-enabled" className="text-sm">
              Auto-adaptation
            </label>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAnalyzeProfile}
            disabled={isAnalyzing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
            Re-analyze
          </Button>
        </div>
      </div>

      {/* Personalization Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-500" />
            Personalization Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {userProfile ? (
            <>
              {/* Skill Level */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Skill Level</div>
                  <div className="text-sm text-gray-500">
                    Based on your feature usage and learning progress
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getSkillLevelBadge(userProfile.learning.skillLevel)}
                  <span className={`text-sm font-medium ${getSkillLevelColor(userProfile.learning.skillLevel)}`}>
                    {userProfile.learning.skillLevel.charAt(0).toUpperCase() + userProfile.learning.skillLevel.slice(1)}
                  </span>
                </div>
              </div>

              {/* Adaptation Progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Adaptation Progress</div>
                  <span className="text-sm text-gray-500">78% optimized</span>
                </div>
                <Progress value={78} className="h-2" />
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {userProfile.behavior.responsePatterns.averageResponseTime.toFixed(1)}m
                  </div>
                  <div className="text-xs text-gray-500">Avg Response Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {userProfile.behavior.featureUsage.dashboard}%
                  </div>
                  <div className="text-xs text-gray-500">Dashboard Usage</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {userProfile.learning.completedTutorials.length}
                  </div>
                  <div className="text-xs text-gray-500">Completed Tutorials</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {userProfile.learning.masteredFeatures.length}
                  </div>
                  <div className="text-xs text-gray-500">Mastered Features</div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Brain className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Analyzing your user profile...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {insights.map((insight) => (
              <div key={insight.id} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{insight.title}</h4>
                      <Badge variant="outline" className="text-xs">
                        {insight.type}
                      </Badge>
                      <Badge 
                        variant={insight.impact === 'high' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {insight.impact} impact
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{insight.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Confidence: {insight.confidence}%</span>
                      {insight.actionable && (
                        <span className="text-blue-600">• Actionable</span>
                      )}
                    </div>
                  </div>
                  
                  {insight.actionable && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={insight.action}
                    >
                      Apply
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Adaptive Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-green-500" />
            Adaptive Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recommendations
              .sort((a, b) => a.priority - b.priority)
              .map((recommendation) => (
                <div key={recommendation.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{recommendation.title}</h4>
                        <Badge variant="outline" className="text-xs">
                          {recommendation.category}
                        </Badge>
                        {getImplementationBadge(recommendation.implementation)}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{recommendation.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="text-green-600">Benefit: {recommendation.benefit}</span>
                        <span>Priority: {recommendation.priority}</span>
                      </div>
                    </div>
                    
                    <Button
                      size="sm"
                      onClick={() => applyRecommendation(recommendation)}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      {showAdvanced && userProfile && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Advanced Personalization Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* UI Complexity */}
            <div>
              <label className="text-sm font-medium mb-3 block">UI Complexity</label>
              <Select value={userProfile.preferences.uiComplexity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple - Essential features only</SelectItem>
                  <SelectItem value="moderate">Moderate - Balanced experience</SelectItem>
                  <SelectItem value="advanced">Advanced - All features visible</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notification Frequency */}
            <div>
              <label className="text-sm font-medium mb-3 block">Notification Frequency</label>
              <Select value={userProfile.preferences.notificationFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minimal">Minimal - Critical updates only</SelectItem>
                  <SelectItem value="normal">Normal - Regular updates</SelectItem>
                  <SelectItem value="frequent">Frequent - All updates</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Data Visualization */}
            <div>
              <label className="text-sm font-medium mb-3 block">Data Visualization</label>
              <Select value={userProfile.preferences.dataVisualization}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic - Simple charts</SelectItem>
                  <SelectItem value="detailed">Detailed - Comprehensive charts</SelectItem>
                  <SelectItem value="comprehensive">Comprehensive - Advanced analytics</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Automation Level */}
            <div>
              <label className="text-sm font-medium mb-3 block">Automation Level</label>
              <Select value={userProfile.preferences.automationLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual - Full control</SelectItem>
                  <SelectItem value="semi">Semi - Smart suggestions</SelectItem>
                  <SelectItem value="full">Full - AI-driven automation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Personalization Hook
export function usePersonalization(userId: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const updatePreferences = useCallback((preferences: Partial<UserProfile['preferences']>) => {
    if (profile) {
      setProfile({
        ...profile,
        preferences: { ...profile.preferences, ...preferences }
      });
    }
  }, [profile]);

  const trackBehavior = useCallback((action: string, context?: any) => {
    // TODO: Send behavior data to personalization engine
    console.log('Tracking behavior:', action, context);
  }, []);

  const getPersonalizedContent = useCallback((contentType: string) => {
    // TODO: Return personalized content based on user profile
    return null;
  }, [profile]);

  return {
    profile,
    isLoading,
    updatePreferences,
    trackBehavior,
    getPersonalizedContent,
  };
}
