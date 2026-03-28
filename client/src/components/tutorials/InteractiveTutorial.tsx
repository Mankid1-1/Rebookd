/**
 * 🎓 INTERACTIVE TUTORIALS SYSTEM
 * Contextual, step-by-step tutorials for dashboard features
 */

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  X, ArrowRight, ArrowLeft, ArrowUp, ArrowDown,
  Play, Pause, RotateCcw, Info, CheckCircle,
  MousePointer, Zap, Target, BarChart3,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProgressiveDisclosureContext } from "@/components/ui/ProgressiveDisclosure";
import { trpc } from "@/lib/trpc";

interface TutorialStep {
  id: string;
  title: string;
  content: string;
  position?: 'center' | 'left' | 'bottom' | 'right' | 'top';
  target?: string;
  action?: 'click' | 'hover' | 'focus' | 'scroll' | 'wait';
  actionTarget?: string;
  waitTime?: number;
  validation?: () => boolean;
  skipable?: boolean;
}

interface Tutorial {
  id: string;
  name: string;
  description: string;
  steps: TutorialStep[];
  category: 'dashboard' | 'leads' | 'messaging' | 'analytics' | 'settings' | 'automation';
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  estimatedTime: number; // in minutes
  icon: React.ReactNode;
}

// Dynamic tutorials based on user skill level and business type
const getDynamicTutorials = (userSkill: any, businessType?: string, userPreferences?: any) => {
  const baseTutorials = [
    {
      id: 'dashboard-overview',
      name: 'Dashboard Overview',
      description: 'Learn your way around the main dashboard',
      category: 'dashboard' as const,
      difficulty: 'beginner' as const,
      estimatedTime: 5,
      icon: <BarChart3 className="h-5 w-5" />,
      steps: [
        {
          id: 'welcome',
          title: 'Welcome to Your Dashboard!',
          content: 'This is your command center. Let\'s explore the key features.',
          position: 'center' as const,
          skipable: true,
        },
        {
          id: 'stats-cards',
          title: 'Quick Stats Cards',
          content: 'These cards show your most important metrics at a glance: total leads, revenue, messages, and conversion rate.',
          target: '[data-tutorial="stats-cards"]',
          position: 'bottom' as const,
        },
        {
          id: 'real-time-activity',
          title: 'Real-Time Activity',
          content: 'This bar shows live activity from today, including new leads and messages sent.',
          target: '[data-tutorial="real-time-stats"]',
          position: 'bottom' as const,
        },
        {
          id: 'revenue-chart',
          title: 'Revenue Trend Chart',
          content: 'Visualize your revenue over time. Click the date range selector to change the time period.',
          target: '[data-tutorial="revenue-chart"]',
          position: 'left' as const,
          action: 'click' as const,
          actionTarget: '[data-tutorial="date-selector"]',
        },
        {
          id: 'activity-feed',
          title: 'Activity Feed',
          content: 'See all recent activities including new leads, messages, and bookings. Click any item for details.',
          target: '[data-tutorial="activity-feed"]',
          position: 'left' as const,
        },
      ],
    }
  ];

  // All tutorials available at every skill level
  {
    baseTutorials.push({
      id: 'lead-management',
      name: 'Lead Management',
      description: 'Master the lead management system',
      category: 'leads' as const,
      difficulty: 'intermediate' as const,
      estimatedTime: 8,
      icon: <Target className="h-5 w-5" />,
      steps: [
        {
          id: 'lead-list',
          title: 'Lead List',
          content: 'All your leads are displayed here with their current status and contact information.',
          target: '[data-tutorial="lead-list"]',
          position: 'right' as const,
        },
        {
          id: 'lead-status',
          title: 'Lead Status',
          content: 'Each lead has a status color: blue (new), yellow (contacted), green (booked), red (lost).',
          target: '[data-tutorial="lead-status"]',
          position: 'bottom' as const,
        },
        {
          id: 'add-lead',
          title: 'Add New Lead',
          content: 'Click here to manually add a new lead to your system.',
          target: '[data-tutorial="add-lead"]',
          position: 'bottom' as const,
          action: 'click' as const,
        },
        {
          id: 'lead-details',
          title: 'Lead Details',
          content: 'Click any lead to see detailed information, conversation history, and available actions.',
          target: '[data-tutorial="lead-item"]:first-child',
          position: 'left' as const,
          action: 'click' as const,
        },
      ],
    });

    baseTutorials.push({
      id: 'advanced-automation',
      name: 'Advanced Automation',
      description: 'Create sophisticated automation workflows',
      category: 'analytics' as const,
      difficulty: 'advanced' as const,
      estimatedTime: 12,
      icon: <Zap className="h-5 w-5" />,
      steps: [
        {
          id: 'automation-builder',
          title: 'Visual Automation Builder',
          content: 'Create complex workflows using the visual builder. Drag and drop nodes to create automation sequences.',
          target: '[data-tutorial="automation-builder"]',
          position: 'center' as const,
        },
        {
          id: 'advanced-triggers',
          title: 'Advanced Triggers',
          content: 'Set up sophisticated triggers based on user behavior, time-based events, and custom conditions.',
          target: '[data-tutorial="triggers-panel"]',
          position: 'left' as const,
        },
      ],
    });
  }

  // Business-specific tutorials
  if (businessType?.includes('medical') || businessType?.includes('clinic')) {
    baseTutorials.push({
      id: 'medical-compliance',
      name: 'Medical Compliance',
      description: 'HIPAA compliance and medical best practices',
      category: 'settings' as const,
      difficulty: 'intermediate' as const,
      estimatedTime: 10,
      icon: <Info className="h-5 w-5" />,
      steps: [
        {
          id: 'hipaa-settings',
          title: 'HIPAA Compliance Settings',
          content: 'Configure HIPAA-compliant messaging and data handling for medical practices.',
          target: '[data-tutorial="hipaa-settings"]',
          position: 'right' as const,
        },
      ],
    });
  }

  return baseTutorials;
};

// Default tutorials for different user levels
export const defaultTutorials: Tutorial[] = [
  {
    id: 'beginner-welcome',
    name: 'Getting Started',
    description: 'Learn the basics of lead management',
    category: 'dashboard',
    difficulty: 'beginner',
    estimatedTime: 5,
    icon: <BarChart3 className="h-5 w-5" />,
    steps: [
      {
        id: 'welcome',
        title: 'Welcome to Rebooked!',
        content: 'Let\'s get you started with a quick tour of your new lead management system.',
        target: '[data-tutorial="dashboard"]',
        position: 'bottom',
        skipable: true,
      },
      {
        id: 'message-compose',
        title: 'Compose Message',
        content: 'Click here to compose and send a new message to your leads.',
        target: '[data-tutorial="compose-message"]',
        position: 'bottom',
        action: 'click',
        skipable: true,
      },
      {
        id: 'message-templates',
        title: 'Message Templates',
        content: 'Use pre-written templates for common messages to save time.',
        target: '[data-tutorial="message-templates"]',
        position: 'right',
        skipable: true,
      },
      {
        id: 'message-history',
        title: 'Conversation History',
        content: 'View the complete conversation history with each lead.',
        target: '[data-tutorial="conversation-history"]',
        position: 'left',
        skipable: true,
      },
    ],
  },
];

interface InteractiveTutorialProps {
  tutorial: Tutorial;
  onComplete?: () => void;
  onSkip?: () => void;
}

export function InteractiveTutorial({ tutorial, onComplete, onSkip }: InteractiveTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [highlightedElement, setHighlightedElement] = useState<Element | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [isWaiting, setIsWaiting] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentStepData = tutorial.steps[currentStep];
  const progress = ((currentStep + 1) / tutorial.steps.length) * 100;

  useEffect(() => {
    if (isPlaying && currentStepData.target) {
      highlightElement(currentStepData.target);
      positionTooltip(currentStepData.target, currentStepData.position);
    } else {
      clearHighlight();
    }
  }, [currentStep, isPlaying, currentStepData]);

  const highlightElement = (selector: string) => {
    const element = document.querySelector(selector);
    if (element) {
      setHighlightedElement(element);
      element.classList.add('tutorial-highlight');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const clearHighlight = () => {
    if (highlightedElement) {
      highlightedElement.classList.remove('tutorial-highlight');
      setHighlightedElement(null);
    }
  };

  const positionTooltip = (selector: string, position?: string) => {
    const element = document.querySelector(selector);
    if (element && tooltipRef.current) {
      const rect = element.getBoundingClientRect();
      const tooltip = tooltipRef.current;
      const tooltipRect = tooltip.getBoundingClientRect();
      
      let top = 0;
      let left = 0;

      switch (position) {
        case 'top':
          top = rect.top - tooltipRect.height - 10;
          left = rect.left + rect.width / 2 - tooltipRect.width / 2;
          break;
        case 'bottom':
          top = rect.bottom + 10;
          left = rect.left + rect.width / 2 - tooltipRect.width / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipRect.height / 2;
          left = rect.left - tooltipRect.width - 10;
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tooltipRect.height / 2;
          left = rect.right + 10;
          break;
        case 'center':
          top = window.innerHeight / 2 - tooltipRect.height / 2;
          left = window.innerWidth / 2 - tooltipRect.width / 2;
          break;
        default:
          top = rect.bottom + 10;
          left = rect.left + rect.width / 2 - tooltipRect.width / 2;
      }

      // Ensure tooltip stays within viewport
      if (left < 10) left = 10;
      if (left + tooltipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - tooltipRect.width - 10;
      }
      if (top < 10) top = 10;
      if (top + tooltipRect.height > window.innerHeight - 10) {
        top = window.innerHeight - tooltipRect.height - 10;
      }

      setTooltipPosition({ top, left });
    }
  };

  const handleNext = async () => {
    if (currentStepData.action && currentStepData.actionTarget) {
      await executeAction();
    }

    if (currentStep < tutorial.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const executeAction = async () => {
    if (!currentStepData.actionTarget) return;

    setIsWaiting(true);
    const element = document.querySelector(currentStepData.actionTarget);

    switch (currentStepData.action) {
      case 'click':
        if (element) {
          (element as HTMLElement).click();
        }
        break;
      case 'hover':
        if (element) {
          element.dispatchEvent(new Event('mouseenter'));
        }
        break;
      case 'scroll':
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
        break;
      case 'wait':
        await new Promise(resolve => setTimeout(resolve, currentStepData.waitTime || 2000));
        break;
    }

    // Wait for action to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsWaiting(false);
  };

  const handleComplete = () => {
    clearHighlight();
    onComplete?.();
  };

  const handleSkip = () => {
    clearHighlight();
    onSkip?.();
  };

  const handleStart = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleRestart = () => {
    setCurrentStep(0);
    setIsPlaying(true);
  };

  if (!isPlaying) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6 text-center">
          <div className="mb-4">
            <div className="p-3 bg-blue-100 rounded-full w-12 h-12 mx-auto flex items-center justify-center mb-4">
              {tutorial.icon}
            </div>
            <h3 className="text-lg font-semibold">{tutorial.name}</h3>
            <p className="text-sm text-gray-600 mt-1">{tutorial.description}</p>
          </div>
          
          <div className="flex items-center justify-center gap-4 text-sm text-gray-500 mb-6">
            <Badge variant="outline">{tutorial.category}</Badge>
            <span>•</span>
            <span>{tutorial.estimatedTime} min</span>
            <span>•</span>
            <Badge variant={tutorial.difficulty === 'beginner' ? 'default' : 'secondary'}>
              {tutorial.difficulty}
            </Badge>
          </div>
          
          <div className="space-y-3">
            <Button onClick={handleStart} className="w-full">
              <Play className="h-4 w-4 mr-2" />
              Start Tutorial
            </Button>
            <Button variant="outline" onClick={handleSkip} className="w-full">
              Skip Tutorial
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return createPortal(
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" />
      
      {/* Highlight overlay */}
      {highlightedElement && (
        <div
          className="absolute border-4 border-blue-500 rounded-lg pointer-events-none z-40"
          style={{
            top: highlightedElement.getBoundingClientRect().top - 4,
            left: highlightedElement.getBoundingClientRect().left - 4,
            width: highlightedElement.getBoundingClientRect().width + 8,
            height: highlightedElement.getBoundingClientRect().height + 8,
          }}
        />
      )}
      
      {/* Tutorial Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-50 w-80 bg-white rounded-lg shadow-xl border"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold">{currentStepData.title}</h4>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handlePause}>
                <Pause className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Progress */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Step {currentStep + 1} of {tutorial.steps.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1">
              <div
                className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          
          {/* Content */}
          <p className="text-sm text-gray-700 mb-4">{currentStepData.content}</p>
          
          {/* Navigation */}
          <div className="flex justify-between items-center">
            <div>
              {currentStep > 0 && (
                <Button variant="outline" size="sm" onClick={handlePrevious}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleRestart}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              
              <Button 
                size="sm" 
                onClick={handleNext}
                disabled={isWaiting}
              >
                {isWaiting ? (
                  'Waiting...'
                ) : currentStep === tutorial.steps.length - 1 ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Complete
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {/* Skip option */}
          {currentStepData.skipable && (
            <div className="mt-3 pt-3 border-t">
              <Button variant="ghost" size="sm" onClick={handleSkip} className="w-full">
                Skip this step
              </Button>
            </div>
          )}
        </div>
        
        {/* Arrow pointer */}
        {currentStepData.target && currentStepData.position !== 'center' && (
          <div
            className="absolute w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-white transform -translate-x-1/2"
            style={{
              top: currentStepData.position === 'bottom' ? '-8px' : 'auto',
              bottom: currentStepData.position === 'top' ? '-8px' : 'auto',
              left: '50%',
              transform: currentStepData.position === 'bottom' 
                ? 'translateX(-50%) rotate(180deg)'
                : currentStepData.position === 'top'
                ? 'translateX(-50%)'
                : currentStepData.position === 'left'
                ? 'rotate(90deg) translateY(-50%)'
                : currentStepData.position === 'right'
                ? 'rotate(-90deg) translateY(-50%)'
                : 'translateX(-50%)',
            }}
          />
        )}
      </div>
    </>,
    document.body
  );
}

// Tutorial Launcher Component
export function TutorialLauncher() {
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);

  const handleTutorialComplete = (tutorialId: string) => {
    // TODO: Mark tutorial as completed in backend
    console.log(`Tutorial ${tutorialId} completed`);
    setSelectedTutorial(null);
  };

  const handleTutorialSkip = (tutorialId: string) => {
    // TODO: Track tutorial skip in analytics
    console.log(`Tutorial ${tutorialId} skipped`);
    setSelectedTutorial(null);
  };

  if (selectedTutorial) {
    return (
      <InteractiveTutorial
        tutorial={selectedTutorial}
        onComplete={() => handleTutorialComplete(selectedTutorial.id)}
        onSkip={() => handleTutorialSkip(selectedTutorial.id)}
      />
    );
  }

  return (
    <>
      {/* Floating Tutorial Button */}
      <Button
        className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg z-30"
        onClick={() => setShowLibrary(!showLibrary)}
      >
        <Zap className="h-6 w-6" />
      </Button>

      {/* Tutorial Library */}
      {showLibrary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold">Interactive Tutorials</h3>
                  <p className="text-sm text-gray-600 mt-1">Learn how to use Rebooked effectively</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowLibrary(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="grid gap-4">
                {tutorials.map((tutorial) => (
                  <Card key={tutorial.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          {tutorial.icon}
                        </div>
                        <div>
                          <h4 className="font-medium">{tutorial.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{tutorial.description}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <Badge variant="outline">{tutorial.category}</Badge>
                            <span className="text-xs text-gray-500">{tutorial.estimatedTime} min</span>
                            <Badge variant={tutorial.difficulty === 'beginner' ? 'default' : 'secondary'}>
                              {tutorial.difficulty}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setSelectedTutorial(tutorial)}
                      >
                        Start
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
