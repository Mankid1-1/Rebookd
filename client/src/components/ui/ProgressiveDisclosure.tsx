/**
 * 🎯 PROGRESSIVE DISCLOSURE UI SYSTEM
 * Adaptive complexity system that adjusts UI based on user skill level and context
 */

import { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  Eye, EyeOff, ChevronDown, ChevronUp, ChevronRight,
  Settings, Zap, Brain, Target, TrendingUp,
  Layers, Grid, List, Sliders, Info,
  User, Clock, BarChart3, Shield,
  Lightbulb, GraduationCap, Award, Star,
  RotateCcw, AlertCircle, X,
} from "lucide-react";
import { toast } from "sonner";

// User skill levels and their characteristics
import type { UserSkillLevel } from "../../../../shared/interfaces";
export type { UserSkillLevel } from "../../../../shared/interfaces";
export interface UserSkillProfile {
  level: UserSkillLevel;
  experience: {
    totalSessions: number;
    sessionDuration: number;
    featureUsage: Record<string, number>;
    completedTutorials: string[];
    errorRate: number;
    helpSeekingFrequency: number;
  };
  preferences: {
    uiComplexity: 'minimal' | 'balanced' | 'comprehensive';
    learningMode: boolean;
    showHints: boolean;
    progressiveDisclosure: boolean;
    adaptationSpeed: 'slow' | 'moderate' | 'fast';
  };
  behavior: {
    explorationScore: number;
    efficiencyScore: number;
    confidenceLevel: number;
    adaptationWillingness: number;
  };
  goals?: {
    primary: string;
    secondary: string[];
    progress: Record<string, number>;
  };
}

// UI complexity levels
export type UIComplexity = 'essential' | 'standard' | 'advanced' | 'expert';

export interface ComplexityLevel {
  name: UIComplexity;
  displayName: string;
  description: string;
  features: {
    showAdvancedOptions: boolean;
    showExperimentalFeatures: boolean;
    showDeveloperTools: boolean;
    showDetailedMetrics: boolean;
    showCustomizationOptions: boolean;
    showShortcuts: boolean;
    showTooltips: boolean;
    showContextualHelp: boolean;
  };
  ui: {
    density: 'compact' | 'comfortable' | 'spacious';
    information: 'minimal' | 'balanced' | 'comprehensive';
    interactions: 'simple' | 'standard' | 'advanced';
    navigation: 'basic' | 'enhanced' | 'powerful';
  };
}

// Progressive disclosure component types
export interface DisclosureFeature {
  id: string;
  name: string;
  description: string;
  category: string;
  complexity: UIComplexity[];
  dependencies: string[]; // Features that must be understood first
  prerequisites: {
    skillLevel?: UserSkillLevel;
    sessionsCompleted?: number;
    featuresUsed?: string[];
  };
  content: {
    basic: React.ComponentType<any>;
    advanced?: React.ComponentType<any>;
    expert?: React.ComponentType<any>;
  };
  metadata: {
    difficulty: number; // 0-100
    timeToMaster: number; // estimated minutes
    satisfaction: number; // 0-100, user satisfaction
    usageFrequency: number; // 0-100
  };
}

export interface DisclosureContext {
  userSkill: UserSkillProfile;
  currentComplexity: UIComplexity;
  availableFeatures: DisclosureFeature[];
  disclosedFeatures: Set<string>;
  hiddenFeatures: Set<string>;
  adaptiveHints: AdaptiveHint[];
}

export interface AdaptiveHint {
  id: string;
  type: 'tip' | 'warning' | 'suggestion' | 'achievement';
  title: string;
  content: string;
  target?: string; // CSS selector or feature ID
  trigger: {
    condition: string;
    threshold?: number;
    cooldown?: number; // minutes
  };
  action?: {
    label: string;
    handler: () => void;
  };
  priority: number; // 1-10
  persistent: boolean;
}

// Complexity level definitions
const COMPLEXITY_LEVELS: Record<UIComplexity, ComplexityLevel> = {
  essential: {
    name: 'essential',
    displayName: 'Essential',
    description: 'Simplified view — all features available with guided help',
    features: {
      showAdvancedOptions: true,
      showExperimentalFeatures: true,
      showDeveloperTools: true,
      showDetailedMetrics: true,
      showCustomizationOptions: true,
      showShortcuts: true,
      showTooltips: true,
      showContextualHelp: true,
    },
    ui: {
      density: 'spacious',
      information: 'minimal',
      interactions: 'simple',
      navigation: 'basic',
    },
  },
  standard: {
    name: 'standard',
    displayName: 'Standard',
    description: 'Balanced view with all features accessible',
    features: {
      showAdvancedOptions: true,
      showExperimentalFeatures: true,
      showDeveloperTools: true,
      showDetailedMetrics: true,
      showCustomizationOptions: true,
      showShortcuts: true,
      showTooltips: true,
      showContextualHelp: true,
    },
    ui: {
      density: 'comfortable',
      information: 'balanced',
      interactions: 'standard',
      navigation: 'enhanced',
    },
  },
  advanced: {
    name: 'advanced',
    displayName: 'Advanced',
    description: 'Full features with streamlined presentation',
    features: {
      showAdvancedOptions: true,
      showExperimentalFeatures: true,
      showDeveloperTools: true,
      showDetailedMetrics: true,
      showCustomizationOptions: true,
      showShortcuts: true,
      showTooltips: false,
      showContextualHelp: false,
    },
    ui: {
      density: 'comfortable',
      information: 'comprehensive',
      interactions: 'advanced',
      navigation: 'enhanced',
    },
  },
  expert: {
    name: 'expert',
    displayName: 'Expert',
    description: 'All features with compact, power-user layout',
    features: {
      showAdvancedOptions: true,
      showExperimentalFeatures: true,
      showDeveloperTools: true,
      showDetailedMetrics: true,
      showCustomizationOptions: true,
      showShortcuts: true,
      showTooltips: false,
      showContextualHelp: false,
    },
    ui: {
      density: 'compact',
      information: 'comprehensive',
      interactions: 'advanced',
      navigation: 'powerful',
    },
  },
};

// Progressive Disclosure Context
const ProgressiveDisclosureContext = createContext<ReturnType<typeof useProgressiveDisclosure> | null>(null);

// Global flag to prevent multiple analysis intervals
let isAnalysisIntervalRunning = false;

// Provider component to share state across components
export function ProgressiveDisclosureProvider({ children, userId = 'current-user' }: { 
  children: React.ReactNode; 
  userId?: string;
}) {
  const progressiveDisclosure = useProgressiveDisclosure(userId);
  
  return (
    <ProgressiveDisclosureContext.Provider value={progressiveDisclosure}>
      {children}
    </ProgressiveDisclosureContext.Provider>
  );
}

// Safe default when used outside a provider
const SAFE_DEFAULT_CONTEXT = {
  context: {
    userSkill: null,
    currentComplexity: 'standard' as UIComplexity,
    disclosedFeatures: new Set<string>(),
    hiddenFeatures: new Set<string>(),
    adaptiveHints: [] as AdaptiveHint[],
  },
  isAnalyzing: false,
  analyzeUserBehavior: async () => {},
  trackFeatureUsage: (_featureId: string) => {},
  trackSessionStart: () => {},
  trackSessionEnd: () => {},
  trackError: (_errorType: string) => {},
  trackHelpSeeking: () => {},
  completeTutorial: (_tutorialId: string) => {},
  adjustComplexity: (_complexity: UIComplexity) => {},
  toggleFeature: (_featureId: string, _visible: boolean) => {},
  dismissHint: (_hintId: string) => {},
  onDisclose: (_featureId: string) => {},
  onConceal: (_featureId: string) => {},
};

// Hook to use the shared context — returns safe defaults if no provider
export function useProgressiveDisclosureContext() {
  const context = useContext(ProgressiveDisclosureContext);
  if (!context) {
    return SAFE_DEFAULT_CONTEXT;
  }
  return context;
}

// Main Progressive Disclosure Hook
export function useProgressiveDisclosure(userId: string) {
  const [userSkill, setUserSkill] = useState<UserSkillProfile | null>(null);
  const [currentComplexity, setCurrentComplexity] = useState<UIComplexity>('standard');
  const [disclosedFeatures, setDisclosedFeatures] = useState<Set<string>>(new Set());
  const [hiddenFeatures, setHiddenFeatures] = useState<Set<string>>(new Set());
  const [adaptiveHints, setAdaptiveHints] = useState<AdaptiveHint[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const analysisInterval = useRef<NodeJS.Timeout | null>(null);

  // Analyze real user behavior and update skill profile
  const analyzeUserBehavior = useCallback(async () => {
    if (!userSkill) return;
    
    setIsAnalyzing(true);
    
    try {
      const updatedProfile = { ...userSkill };
      
      // Calculate REAL metrics from actual usage data
      const totalUsage = Object.values(userSkill.experience.featureUsage).reduce((a, b) => a + b, 0);
      const avgSessionDuration = userSkill.experience.sessionDuration;
      const errorRate = userSkill.experience.errorRate;
      const helpSeekingFreq = userSkill.experience.helpSeekingFrequency;
      
      // Calculate feature diversity (how many different features used)
      const featuresUsed = Object.keys(userSkill.experience.featureUsage).filter(f => userSkill.experience.featureUsage[f] > 0).length;
      const totalFeatures = Object.keys(userSkill.experience.featureUsage).length;
      const featureDiversity = (featuresUsed / totalFeatures) * 100;
      
      // Calculate session consistency (how consistent session durations are)
      const sessionConsistency = avgSessionDuration > 15 ? 80 : avgSessionDuration > 5 ? 60 : 40;
      
      // Update skill level based on REAL usage patterns
      if (totalUsage > 500 && avgSessionDuration > 20 && errorRate < 0.15 && featuresUsed >= 4) {
        updatedProfile.level = 'expert';
      } else if (totalUsage > 200 && avgSessionDuration > 15 && errorRate < 0.25 && featuresUsed >= 3) {
        updatedProfile.level = 'advanced';
      } else if (totalUsage > 50 && avgSessionDuration > 10 && errorRate < 0.35 && featuresUsed >= 2) {
        updatedProfile.level = 'intermediate';
      } else {
        updatedProfile.level = 'beginner';
      }
      
      // Update behavior scores based on REAL data
      updatedProfile.behavior.explorationScore = Math.min(100, featureDiversity);
      updatedProfile.behavior.efficiencyScore = Math.max(0, 100 - (errorRate * 100) - (helpSeekingFreq * 50));
      updatedProfile.behavior.confidenceLevel = Math.min(100, sessionConsistency + (totalUsage / 10));
      updatedProfile.behavior.adaptationWillingness = userSkill.preferences.progressiveDisclosure ? 
        Math.min(100, 50 + featureDiversity / 2) : Math.max(0, 50 - featureDiversity / 2);
      
      setUserSkill(updatedProfile);
      
      // Adjust complexity based on REAL skill assessment
      const targetComplexity = getRecommendedComplexity(updatedProfile);
      if (targetComplexity !== currentComplexity) {
        setCurrentComplexity(targetComplexity);
        toast.info(`UI complexity adjusted to ${COMPLEXITY_LEVELS[targetComplexity].displayName}`);
      }
      
      // Generate adaptive hints based on REAL behavior
      generateAdaptiveHints(updatedProfile);
    } catch (error) {
      console.error('Failed to analyze user behavior:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [userSkill, currentComplexity]);

  // Get recommended complexity based on user profile
  const getRecommendedComplexity = useCallback((profile: UserSkillProfile): UIComplexity => {
    if (!profile.preferences.progressiveDisclosure) {
      return profile.preferences.uiComplexity === 'minimal' ? 'essential' : 
             profile.preferences.uiComplexity === 'comprehensive' ? 'expert' : 'standard';
    }
    
    switch (profile.level) {
      case 'beginner':
        return profile.behavior.confidenceLevel > 60 ? 'standard' : 'essential';
      case 'intermediate':
        return profile.behavior.explorationScore > 70 ? 'advanced' : 'standard';
      case 'advanced':
        return profile.behavior.adaptationWillingness > 80 ? 'expert' : 'advanced';
      case 'expert':
        return 'expert';
      default:
        return 'standard';
    }
  }, []);

  // Generate adaptive hints based on REAL user behavior
  const generateAdaptiveHints = useCallback((profile: UserSkillProfile) => {
    const hints: AdaptiveHint[] = [];
    
    // Learning hints for beginners with REAL confidence assessment
    if (profile.level === 'beginner' && profile.behavior.confidenceLevel < 50) {
      hints.push({
        id: 'beginner_tip',
        type: 'tip',
        title: 'Pro Tip',
        content: 'Try using the keyboard shortcuts to navigate faster. Press Ctrl+K to see all available shortcuts.',
        trigger: { condition: 'low_confidence', threshold: 50 },
        priority: 7,
        persistent: false,
      });
    }
    
    // Help-seeking hints for users who frequently need help
    if (profile.experience.helpSeekingFrequency > 0.4) {
      hints.push({
        id: 'help_seeking_tip',
        type: 'suggestion',
        title: 'Build Confidence',
        content: 'You\'ve been seeking help frequently. Try the interactive tutorial to build your confidence.',
        trigger: { condition: 'high_help_seeking', threshold: 0.4 },
        priority: 6,
        persistent: false,
      });
    }
    
    // Feature discovery hints based on REAL usage patterns
    const unusedFeatures = Object.keys(profile.experience.featureUsage).filter(
      f => profile.experience.featureUsage[f] === 0
    );
    
    if (unusedFeatures.length > 0 && profile.behavior.explorationScore > 30) {
      const nextFeature = unusedFeatures[0];
      const featureNames: Record<string, string> = {
        automation: 'Automation',
        analytics: 'Analytics Dashboard',
        settings: 'Advanced Settings',
        messaging: 'Bulk Messaging'
      };
      
      hints.push({
        id: `feature_discovery_${nextFeature}`,
        type: 'tip',
        title: `Try ${featureNames[nextFeature] || nextFeature}`,
        content: `You haven\'t explored ${featureNames[nextFeature] || nextFeature} yet. It might help you work more efficiently!`,
        trigger: { condition: 'unused_feature', threshold: 1 },
        priority: 5,
        persistent: false,
      });
    }
    
    // Efficiency hints for users with REAL low efficiency scores
    if (profile.behavior.efficiencyScore < 60 && profile.experience.totalSessions > 10) {
      hints.push({
        id: 'efficiency_tip',
        type: 'suggestion',
        title: 'Work More Efficiently',
        content: 'Based on your usage patterns, consider using templates for repetitive tasks to save time.',
        trigger: { condition: 'low_efficiency', threshold: 60 },
        priority: 6,
        persistent: false,
      });
    }
    
    // Achievement notifications based on REAL milestones
    const totalUsage = Object.values(profile.experience.featureUsage).reduce((a, b) => a + b, 0);
    if (totalUsage > 100 && profile.behavior.explorationScore > 70 && profile.level !== 'expert') {
      hints.push({
        id: 'explorer_achievement',
        type: 'achievement',
        title: 'Explorer Achievement!',
        content: `You\'ve used the app ${totalUsage} times and explored many features! Consider trying advanced features.`,
        trigger: { condition: 'high_exploration', threshold: 70 },
        priority: 9,
        persistent: true,
      });
    }
    
    // Session duration encouragement
    if (profile.experience.sessionDuration < 5 && profile.experience.totalSessions > 5) {
      hints.push({
        id: 'session_duration_tip',
        type: 'tip',
        title: 'Take Your Time',
        content: 'Your sessions tend to be quite short. Consider spending a bit more time to explore all features.',
        trigger: { condition: 'short_sessions', threshold: 5 },
        priority: 4,
        persistent: false,
      });
    }
    
    setAdaptiveHints(hints);
  }, []);

  // Initialize user skill profile
  useEffect(() => {
    const initializeProfile = async () => {
      // Load or create user profile based on actual usage data
      const storedProfile = localStorage.getItem('userSkillProfile');
      let profile: UserSkillProfile;

      if (storedProfile) {
        profile = JSON.parse(storedProfile);
      } else {
        // Create initial profile based on first-time user behavior
        profile = {
          level: 'beginner',
          experience: {
            totalSessions: 1,
            sessionDuration: 5, // Start low, will grow with real usage
            featureUsage: {
              dashboard: 1,
              messaging: 0,
              analytics: 0,
              settings: 0,
              automation: 0,
            },
            completedTutorials: [],
            errorRate: 0.0,
            helpSeekingFrequency: 0.0,
          },
          preferences: {
            uiComplexity: 'minimal',
            learningMode: true,
            showHints: true,
            progressiveDisclosure: true,
            adaptationSpeed: 'moderate',
          },
          behavior: {
            explorationScore: 0.1, // Will increase with real exploration
            efficiencyScore: 0.5,
            confidenceLevel: 0.3,
            adaptationWillingness: 0.3,
          },
          goals: {
            primary: 'lead_management',
            secondary: ['communication'],
            progress: {
              leadsAdded: 0,
              messagesSent: 0,
              campaignsCreated: 0,
              automationsBuilt: 0,
            },
          },
        };
      }

      setUserSkill(profile);
      setCurrentComplexity(getRecommendedComplexity(profile));
    };
    
    initializeProfile();
  }, [getRecommendedComplexity]);

  // Set up periodic analysis (only run once globally)
  useEffect(() => {
    if (userSkill && userSkill.preferences.progressiveDisclosure && !isAnalysisIntervalRunning) {
      isAnalysisIntervalRunning = true;
      analysisInterval.current = setInterval(analyzeUserBehavior, 30000); // Analyze every 30 seconds
    }
    
    return () => {
      if (analysisInterval.current) {
        clearInterval(analysisInterval.current);
        isAnalysisIntervalRunning = false;
      }
    };
  }, [userSkill, analyzeUserBehavior]);

  // Track feature usage
  const trackFeatureUsage = useCallback((featureId: string, duration?: number) => {
    if (!userSkill) return;
    
    const updatedProfile = { ...userSkill };
    updatedProfile.experience.featureUsage[featureId] = 
      (updatedProfile.experience.featureUsage[featureId] || 0) + (duration || 1);
    
    setUserSkill(updatedProfile);
    // Save to localStorage for persistence
    localStorage.setItem('userSkillProfile', JSON.stringify(updatedProfile));
  }, [userSkill]);

  // Track session start/end
  const trackSessionStart = useCallback(() => {
    if (!userSkill) return;
    
    const updatedProfile = { ...userSkill };
    updatedProfile.experience.totalSessions += 1;
    
    setUserSkill(updatedProfile);
    localStorage.setItem('userSkillProfile', JSON.stringify(updatedProfile));
  }, [userSkill]);

  const trackSessionEnd = useCallback((sessionDuration: number) => {
    if (!userSkill) return;
    
    const updatedProfile = { ...userSkill };
    // Update average session duration
    const totalDuration = updatedProfile.experience.sessionDuration * (updatedProfile.experience.totalSessions - 1) + sessionDuration;
    updatedProfile.experience.sessionDuration = totalDuration / updatedProfile.experience.totalSessions;
    
    setUserSkill(updatedProfile);
    localStorage.setItem('userSkillProfile', JSON.stringify(updatedProfile));
  }, [userSkill]);

  // Track errors and help seeking
  const trackError = useCallback(() => {
    if (!userSkill) return;
    
    const updatedProfile = { ...userSkill };
    const totalActions = Object.values(updatedProfile.experience.featureUsage).reduce((a, b) => a + b, 0);
    updatedProfile.experience.errorRate = Math.min(1.0, (updatedProfile.experience.errorRate * totalActions + 1) / (totalActions + 1));
    
    setUserSkill(updatedProfile);
    localStorage.setItem('userSkillProfile', JSON.stringify(updatedProfile));
  }, [userSkill]);

  const trackHelpSeeking = useCallback(() => {
    if (!userSkill) return;
    
    const updatedProfile = { ...userSkill };
    const totalActions = Object.values(updatedProfile.experience.featureUsage).reduce((a, b) => a + b, 0);
    updatedProfile.experience.helpSeekingFrequency = Math.min(1.0, (updatedProfile.experience.helpSeekingFrequency * totalActions + 1) / (totalActions + 1));
    
    setUserSkill(updatedProfile);
    localStorage.setItem('userSkillProfile', JSON.stringify(updatedProfile));
  }, [userSkill]);

  // Mark tutorial as completed
  const completeTutorial = useCallback((tutorialId: string) => {
    if (!userSkill) return;
    
    const updatedProfile = { ...userSkill };
    if (!updatedProfile.experience.completedTutorials.includes(tutorialId)) {
      updatedProfile.experience.completedTutorials.push(tutorialId);
      
      // Completing tutorials should increase confidence
      updatedProfile.behavior.confidenceLevel = Math.min(100, updatedProfile.behavior.confidenceLevel + 10);
    }
    
    setUserSkill(updatedProfile);
    localStorage.setItem('userSkillProfile', JSON.stringify(updatedProfile));
  }, [userSkill]);

  // Save profile to localStorage whenever it changes
  useEffect(() => {
    if (userSkill) {
      localStorage.setItem('userSkillProfile', JSON.stringify(userSkill));
    }
  }, [userSkill]);

  // Manually adjust complexity
  const adjustComplexity = useCallback((complexity: UIComplexity) => {
    if (!COMPLEXITY_LEVELS[complexity]) {
      toast.error(`Invalid complexity level: ${complexity}`);
      return;
    }
    setCurrentComplexity(complexity);
    toast.info(`UI complexity set to ${COMPLEXITY_LEVELS[complexity].displayName}`);
  }, []);

  // Toggle feature disclosure
  const toggleFeature = useCallback((featureId: string, disclose: boolean) => {
    if (disclose) {
      setDisclosedFeatures(prev => new Set([...prev, featureId]));
      setHiddenFeatures(prev => {
        const newSet = new Set(prev);
        newSet.delete(featureId);
        return newSet;
      });
    } else {
      setHiddenFeatures(prev => new Set([...prev, featureId]));
      setDisclosedFeatures(prev => {
        const newSet = new Set(prev);
        newSet.delete(featureId);
        return newSet;
      });
    }
  }, []);

  // Dismiss hint
  const dismissHint = useCallback((hintId: string) => {
    setAdaptiveHints(prev => prev.filter(hint => hint.id !== hintId));
  }, []);

  const context: DisclosureContext = useMemo(() => ({
    userSkill: userSkill!,
    currentComplexity,
    availableFeatures: [], // Would be populated with actual features
    disclosedFeatures,
    hiddenFeatures,
    adaptiveHints,
  }), [userSkill, currentComplexity, disclosedFeatures, hiddenFeatures, adaptiveHints]);

  return {
    context,
    isAnalyzing,
    analyzeUserBehavior,
    trackFeatureUsage,
    trackSessionStart,
    trackSessionEnd,
    trackError,
    trackHelpSeeking,
    completeTutorial,
    adjustComplexity,
    toggleFeature,
    dismissHint,
    onDisclose: (featureId: string) => toggleFeature(featureId, true),
    onConceal: (featureId: string) => toggleFeature(featureId, false),
  };
}

// Progressive Disclosure Wrapper Component
interface ProgressiveDisclosureProps {
  children: React.ReactNode;
  featureId: string;
  complexity: UIComplexity[];
  title?: string;
  description?: string;
  fallback?: React.ReactNode;
  onDisclose?: () => void;
  onConceal?: () => void;
}

export function ProgressiveDisclosure({
  children,
  featureId,
  complexity,
  title,
  description,
  fallback,
  onDisclose,
  onConceal,
}: ProgressiveDisclosureProps) {
  const { context, toggleFeature } = useProgressiveDisclosureContext();
  const [isExpanded, setIsExpanded] = useState(false);

  const isFeatureVisible = complexity.includes(context.currentComplexity) || 
                          context.disclosedFeatures.has(featureId);
  const isFeatureHidden = context.hiddenFeatures.has(featureId);

  const handleToggle = () => {
    if (isExpanded) {
      setIsExpanded(false);
      toggleFeature(featureId, false);
      onConceal?.();
    } else {
      setIsExpanded(true);
      toggleFeature(featureId, true);
      onDisclose?.();
    }
  };

  if (isFeatureHidden && !isExpanded) {
    return fallback || (
      <div className="p-4 border border-dashed border-border rounded-lg text-center">
        <EyeOff className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-2">Advanced feature</p>
        <Button variant="outline" size="sm" onClick={handleToggle}>
          <Eye className="h-4 w-4 mr-2" />
          Reveal Feature
        </Button>
      </div>
    );
  }

  if (!isFeatureVisible && !isExpanded) {
    return null;
  }

  return (
    <div className="relative">
      {isExpanded && (
        <div className="absolute -top-2 -right-2 z-10">
          <Badge variant="secondary" className="text-xs">
            Advanced
          </Badge>
        </div>
      )}
      {children}
      {isExpanded && (
        <div className="mt-2 pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={handleToggle}>
            <EyeOff className="h-4 w-4 mr-2" />
            Hide Advanced Options
          </Button>
        </div>
      )}
    </div>
  );
}

// Adaptive UI Controller Component
export function AdaptiveUIController() {
  const { context, adjustComplexity, isAnalyzing, analyzeUserBehavior } = useProgressiveDisclosureContext();

  if (!context.userSkill) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground">
            Loading user profile...
          </div>
        </CardContent>
      </Card>
    );
  }

  const complexityLevel = COMPLEXITY_LEVELS[context.currentComplexity];

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-info" />
          Adaptive UI Controller
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* User Skill Level */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Your Skill Level</span>
            <Badge variant={context.userSkill.level === 'expert' ? 'default' : 'secondary'}>
              {context.userSkill.level.charAt(0).toUpperCase() + context.userSkill.level.slice(1)}
            </Badge>
          </div>
          <Progress 
            value={
              context.userSkill.level === 'beginner' ? 25 :
              context.userSkill.level === 'intermediate' ? 50 :
              context.userSkill.level === 'advanced' ? 75 : 100
            } 
            className="h-2"
          />
        </div>

        {/* Current Complexity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">UI Complexity</span>
            <span className="text-xs text-muted-foreground">{complexityLevel.displayName}</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{complexityLevel.description}</p>
          
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(COMPLEXITY_LEVELS) as UIComplexity[]).map(level => (
              <Button
                key={level}
                variant={context.currentComplexity === level ? 'default' : 'outline'}
                size="sm"
                onClick={() => adjustComplexity(level)}
                className="text-xs"
              >
                {COMPLEXITY_LEVELS[level].displayName}
              </Button>
            ))}
          </div>
        </div>

        {/* Behavior Metrics */}
        <div>
          <h4 className="text-sm font-medium mb-3">Behavior Analysis</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Exploration</span>
              <span>{context.userSkill.behavior.explorationScore.toFixed(0)}%</span>
            </div>
            <Progress value={context.userSkill.behavior.explorationScore} className="h-1" />
            
            <div className="flex justify-between text-xs">
              <span>Efficiency</span>
              <span>{context.userSkill.behavior.efficiencyScore.toFixed(0)}%</span>
            </div>
            <Progress value={context.userSkill.behavior.efficiencyScore} className="h-1" />
            
            <div className="flex justify-between text-xs">
              <span>Confidence</span>
              <span>{context.userSkill.behavior.confidenceLevel.toFixed(0)}%</span>
            </div>
            <Progress value={context.userSkill.behavior.confidenceLevel} className="h-1" />
          </div>
        </div>

        {/* Analysis Status */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Auto-adaptation</span>
          <div className="flex items-center gap-2">
            {isAnalyzing && (
              <div className="w-2 h-2 bg-info rounded-full animate-pulse" />
            )}
            <Button variant="outline" size="sm" onClick={analyzeUserBehavior} disabled={isAnalyzing}>
              <RotateCcw className={`h-3 w-3 mr-1 ${isAnalyzing ? 'animate-spin' : ''}`} />
              Analyze
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Adaptive Hints Display Component
export function AdaptiveHintsDisplay() {
  const { context, dismissHint } = useProgressiveDisclosureContext();

  if (context.adaptiveHints.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50 max-w-sm">
      {context.adaptiveHints
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 3) // Show top 3 hints
        .map(hint => (
          <Card key={hint.id} className="p-3 shadow-lg">
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0">
                {hint.type === 'achievement' && <Award className="h-4 w-4 text-warning" />}
                {hint.type === 'tip' && <Lightbulb className="h-4 w-4 text-info" />}
                {hint.type === 'suggestion' && <Target className="h-4 w-4 text-success" />}
                {hint.type === 'warning' && <AlertCircle className="h-4 w-4 text-warning" />}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium">{hint.title}</h4>
                <p className="text-xs text-muted-foreground mt-1">{hint.content}</p>
                {hint.action && (
                  <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={hint.action.handler}>
                    {hint.action.label}
                  </Button>
                )}
              </div>
              {!hint.persistent && (
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => dismissHint(hint.id)}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </Card>
        ))}
    </div>
  );
}

// Feature Discovery Component
export function FeatureDiscovery() {
  const { context, toggleFeature } = useProgressiveDisclosureContext();

  const hiddenFeatures = [
    { id: 'automation', name: 'Visual Automation Builder', description: 'Create custom workflows' },
    { id: 'advanced_analytics', name: 'Advanced Analytics', description: 'Deep insights and reporting' },
    { id: 'api_access', name: 'API Access', description: 'Integrate with external systems' },
    { id: 'custom_themes', name: 'Custom Themes', description: 'Personalize your interface' },
  ].filter(feature => context.hiddenFeatures.has(feature.id));

  if (hiddenFeatures.length === 0) return null;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-accent-foreground" />
          Discover More Features
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {hiddenFeatures.map(feature => (
            <div key={feature.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <h4 className="font-medium text-sm">{feature.name}</h4>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => toggleFeature(feature.id, true)}>
                <Eye className="h-4 w-4 mr-2" />
                Try
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
