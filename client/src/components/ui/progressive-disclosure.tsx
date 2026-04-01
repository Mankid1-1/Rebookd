/**
 * 🎯 PROGRESSIVE DISCLOSURE UI
 * Smart UI that reveals complexity gradually based on user expertise
 */

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  ChevronDown, ChevronUp, ChevronRight, Settings,
  Info, HelpCircle, Zap, Eye, EyeOff, Layers,
  ArrowRight, ArrowLeft, Sparkles, Target,
  BarChart3, Users, MessageSquare, DollarSign, CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressiveLevel {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  complexity: 'basic' | 'intermediate' | 'advanced' | 'expert';
  features: string[];
  prerequisites?: string[];
}

interface ProgressiveDisclosureProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  levels: ProgressiveLevel[];
  defaultLevel?: string;
  onLevelChange?: (level: string) => void;
  showProgress?: boolean;
  allowManualOverride?: boolean;
}

export function ProgressiveDisclosure({
  children,
  title,
  description,
  levels,
  defaultLevel = 'basic',
  onLevelChange,
  showProgress = true,
  allowManualOverride = true,
}: ProgressiveDisclosureProps) {
  const [currentLevel, setCurrentLevel] = useState(defaultLevel);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [userProgress, setUserProgress] = useState<Record<string, boolean>>({});
  const [isTransitioning, setIsTransitioning] = useState(false);

  const currentLevelData = levels.find(level => level.id === currentLevel);
  const currentLevelIndex = levels.findIndex(level => level.id === currentLevel);
  const nextLevel = levels[currentLevelIndex + 1];
  const previousLevel = levels[currentLevelIndex - 1];

  const handleLevelUp = () => {
    if (nextLevel && canProgressToLevel(nextLevel.id)) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentLevel(nextLevel.id);
        onLevelChange?.(nextLevel.id);
        setIsTransitioning(false);
      }, 300);
    }
  };

  const handleLevelDown = () => {
    if (previousLevel) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentLevel(previousLevel.id);
        onLevelChange?.(previousLevel.id);
        setIsTransitioning(false);
      }, 300);
    }
  };

  const canProgressToLevel = (levelId: string): boolean => {
    const level = levels.find(l => l.id === levelId);
    if (!level || !level.prerequisites) return true;
    
    return level.prerequisites.every(prereq => userProgress[prereq]);
  };

  const markFeatureComplete = (featureId: string) => {
    setUserProgress(prev => ({ ...prev, [featureId]: true }));
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'basic': return 'text-success';
      case 'intermediate': return 'text-warning';
      case 'advanced': return 'text-warning';
      case 'expert': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getComplexityBadge = (complexity: string) => {
    switch (complexity) {
      case 'basic': return <Badge className="bg-success/10 text-success">Basic</Badge>;
      case 'intermediate': return <Badge className="bg-warning/10 text-warning">Intermediate</Badge>;
      case 'advanced': return <Badge className="bg-warning/10 text-warning">Advanced</Badge>;
      case 'expert': return <Badge className="bg-destructive/10 text-destructive">Expert</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          {description && (
            <p className="text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        
        {allowManualOverride && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings className="h-4 w-4 mr-2" />
              {showAdvanced ? 'Simple View' : 'Advanced View'}
            </Button>
          </div>
        )}
      </div>

      {/* Progress Indicator */}
      {showProgress && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {currentLevelData?.icon}
                <span className="font-medium">{currentLevelData?.name}</span>
                {currentLevelData && getComplexityBadge(currentLevelData.complexity)}
              </div>
              <span className="text-sm text-muted-foreground">
                Level {currentLevelIndex + 1} of {levels.length}
              </span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-500"
                style={{ width: `${((currentLevelIndex + 1) / levels.length) * 100}%` }}
              />
            </div>
            
            {/* Level Navigation */}
            <div className="flex items-center justify-between mt-4">
              <div>
                {previousLevel && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLevelDown}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {previousLevel.name}
                  </Button>
                )}
              </div>
              
              <div>
                {nextLevel && canProgressToLevel(nextLevel.id) && (
                  <Button
                    size="sm"
                    onClick={handleLevelUp}
                  >
                    {nextLevel.name}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className={cn(
        "transition-all duration-300",
        isTransitioning && "opacity-50"
      )}>
        {children}
      </div>

      {/* Advanced Settings Panel */}
      {showAdvanced && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Advanced Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Level Selection */}
            <div>
              <label className="text-sm font-medium mb-3 block">Select Experience Level</label>
              <div className="grid gap-3">
                {levels.map((level) => (
                  <div
                    key={level.id}
                    className={cn(
                      "p-3 border rounded-lg cursor-pointer transition-colors",
                      currentLevel === level.id
                        ? 'bg-info/5 border-info'
                        : 'hover:bg-muted/50'
                    )}
                    onClick={() => {
                      if (canProgressToLevel(level.id) || level.id === currentLevel) {
                        setCurrentLevel(level.id);
                        onLevelChange?.(level.id);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          currentLevel === level.id ? 'bg-info/10' : 'bg-muted'
                        )}>
                          {level.icon}
                        </div>
                        <div>
                          <div className="font-medium">{level.name}</div>
                          <div className="text-sm text-muted-foreground">{level.description}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getComplexityBadge(level.complexity)}
                        {!canProgressToLevel(level.id) && level.id !== currentLevel && (
                          <Badge variant="outline" className="text-xs">
                            <HelpCircle className="h-3 w-3 mr-1" />
                            Locked
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Prerequisites */}
                    {level.prerequisites && level.prerequisites.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="text-xs text-muted-foreground mb-2">Prerequisites:</div>
                        <div className="flex flex-wrap gap-1">
                          {level.prerequisites.map((prereq) => (
                            <Badge
                              key={prereq}
                              variant={userProgress[prereq] ? 'default' : 'outline'}
                              className="text-xs"
                            >
                              {prereq}
                              {userProgress[prereq] && <CheckCircle className="h-3 w-3 ml-1" />}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Features */}
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-xs text-muted-foreground mb-2">Features:</div>
                      <div className="space-y-1">
                        {level.features.map((feature) => (
                          <div key={feature} className="flex items-center gap-2 text-sm">
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Progressive Disclosure Hook
export function useProgressiveDisclosure(
  initialLevel: string = 'basic',
  levels: ProgressiveLevel[] = []
) {
  const [currentLevel, setCurrentLevel] = useState(initialLevel);
  const [completedFeatures, setCompletedFeatures] = useState<Set<string>>(new Set());
  const [userPreferences, setUserPreferences] = useState({
    showHints: true,
    autoProgress: false,
    skipTutorials: false,
  });

  const canAccessLevel = (levelId: string): boolean => {
    const level = levels.find(l => l.id === levelId);
    if (!level || !level.prerequisites) return true;
    
    return level.prerequisites.every(prereq => completedFeatures.has(prereq));
  };

  const completeFeature = (featureId: string) => {
    setCompletedFeatures(prev => new Set([...prev, featureId]));
  };

  const progressToNextLevel = (): boolean => {
    const currentIndex = levels.findIndex(l => l.id === currentLevel);
    const nextLevel = levels[currentIndex + 1];
    
    if (nextLevel && canAccessLevel(nextLevel.id)) {
      setCurrentLevel(nextLevel.id);
      return true;
    }
    
    return false;
  };

  const getAvailableFeatures = (): string[] => {
    const level = levels.find(l => l.id === currentLevel);
    return level?.features || [];
  };

  const isFeatureAvailable = (featureId: string): boolean => {
    return getAvailableFeatures().includes(featureId);
  };

  return {
    currentLevel,
    setCurrentLevel,
    completedFeatures,
    completeFeature,
    canAccessLevel,
    progressToNextLevel,
    getAvailableFeatures,
    isFeatureAvailable,
    userPreferences,
    setUserPreferences,
  };
}

// Progressive Content Component
interface ProgressiveContentProps {
  featureId: string;
  requiredLevel?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showLockedMessage?: boolean;
}

export function ProgressiveContent({
  featureId,
  requiredLevel,
  children,
  fallback,
  showLockedMessage = true,
}: ProgressiveContentProps) {
  const { isFeatureAvailable, currentLevel } = useProgressiveDisclosure();

  const isAvailable = requiredLevel ? currentLevel === requiredLevel : isFeatureAvailable(featureId);

  if (isAvailable) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showLockedMessage) {
    return (
      <Card className="border-dashed">
        <CardContent className="text-center py-8">
          <EyeOff className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="font-medium text-foreground mb-2">Feature Locked</h3>
          <p className="text-sm text-muted-foreground mb-4">
            This feature is available at a higher experience level.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="text-xs">
              <Zap className="h-3 w-3 mr-1" />
              Unlock by progressing
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

// Progressive Field Component
interface ProgressiveFieldProps {
  label: string;
  description?: string;
  featureId: string;
  requiredLevel?: string;
  children: React.ReactNode;
  hint?: string;
}

export function ProgressiveField({
  label,
  description,
  featureId,
  requiredLevel,
  children,
  hint,
}: ProgressiveFieldProps) {
  const { isFeatureAvailable, userPreferences, currentLevel } = useProgressiveDisclosure();
  const [showHint, setShowHint] = useState(false);

  const isAvailable = requiredLevel ? currentLevel === requiredLevel : isFeatureAvailable(featureId);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">{label}</label>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        
        {hint && userPreferences.showHints && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHint(!showHint)}
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      {showHint && hint && (
        <div className="bg-info/5 p-3 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-info mt-0.5" />
            <p className="text-sm text-info-foreground">{hint}</p>
          </div>
        </div>
      )}
      
      <div className={cn(
        "transition-opacity duration-200",
        !isAvailable && "opacity-50 pointer-events-none"
      )}>
        {children}
      </div>
      
      {!isAvailable && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <EyeOff className="h-3 w-3" />
          <span>Advanced feature - unlock by progressing</span>
        </div>
      )}
    </div>
  );
}

// Progressive Settings Component
export function ProgressiveSettings() {
  const { userPreferences, setUserPreferences } = useProgressiveDisclosure();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Progressive Disclosure Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Show Hints</div>
            <div className="text-sm text-muted-foreground">Display helpful hints and tips</div>
          </div>
          <Switch
            checked={userPreferences.showHints}
            onCheckedChange={(checked) =>
              setUserPreferences(prev => ({ ...prev, showHints: checked }))
            }
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Auto Progress</div>
            <div className="text-sm text-muted-foreground">Automatically advance to next level</div>
          </div>
          <Switch
            checked={userPreferences.autoProgress}
            onCheckedChange={(checked) =>
              setUserPreferences(prev => ({ ...prev, autoProgress: checked }))
            }
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Skip Tutorials</div>
            <div className="text-sm text-muted-foreground">Skip interactive tutorials</div>
          </div>
          <Switch
            checked={userPreferences.skipTutorials}
            onCheckedChange={(checked) =>
              setUserPreferences(prev => ({ ...prev, skipTutorials: checked }))
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
