import * as React from "react";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";
import { Badge } from "./badge";
import { ArrowRight, Sparkles, Users, MessageSquare, BarChart3, Zap } from "lucide-react";
import { getItem, setItem } from "@/utils/storage";
import { useAuth } from "@/hooks/useAuth";
import { useProgressiveDisclosureContext } from "./ProgressiveDisclosure";

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: string;
  tips?: string[];
}

// Dynamic tour steps based on user skill level and business type
const getDynamicTourSteps = (userSkill: any, businessType?: string) => {
  const isDarkMode = document.documentElement.classList.contains('dark');
  
  const baseSteps = [
    {
      id: "welcome",
      title: "Welcome to Rebooked! 🎉",
      description: "Let's get you started with a quick tour of your new lead management system.",
      icon: <Sparkles className={`h-6 w-6 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-500'}`} />,
      tips: [
        "This tour will take about 2 minutes",
        "You can skip any step if you're already familiar",
        "All features are designed to be intuitive and easy to use"
      ]
    },
    {
      id: "dashboard",
      title: "Your Dashboard",
      description: "Get a bird's-eye view of your business performance at a glance.",
      icon: <BarChart3 className={`h-6 w-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`} />,
      action: "View key metrics like total leads, conversion rates, and revenue",
      tips: [
        "Check your dashboard daily for important updates",
        "Click on any metric to see detailed information",
        "The dashboard updates in real-time"
      ]
    },
    {
      id: "leads",
      title: "Manage Your Leads",
      description: "This is where you'll manage all your potential customers.",
      icon: <Users className={`h-6 w-6 ${isDarkMode ? 'text-green-400' : 'text-green-500'}`} />,
      action: "Add, view, and manage your leads from the Leads page",
      tips: [
        "Click 'Add Lead' to manually add new customers",
        "Use the search bar to find specific leads quickly",
      "Filter leads by status to focus on what matters most"
    ]
  },
  {
    id: "messaging",
    title: "Send Messages",
    description: "Communicate with your leads via SMS and email.",
    icon: <MessageSquare className="h-6 w-6 text-purple-500" />,
    action: "Send personalized messages to convert leads into customers",
    tips: [
      "Messages are automatically tracked and organized",
      "Use templates to save time on common communications",
      "All messages comply with TCPA and other regulations"
    ]
  },
  {
    id: "automation",
    title: "Smart Automation",
    description: "Let Rebooked work for you with powerful automation features.",
    icon: <Zap className="h-6 w-6 text-orange-500" />,
    action: "Set up automated follow-ups and lead nurturing",
    tips: [
      "Welcome messages are sent automatically to new leads",
      "Follow-up sequences keep leads engaged",
      "Appointment reminders reduce no-shows"
    ]
  }
];

// Return the dynamic tour steps
return baseSteps;
};

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export function OnboardingTour({ isOpen, onClose, onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [isCompleted, setIsCompleted] = React.useState(false);

  // Get dynamic tour steps
  const tourSteps = getDynamicTourSteps(null, null);
  const currentStepData = tourSteps[currentStep];
  const isLastStep = currentStep === tourSteps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      setIsCompleted(true);
      onComplete?.();
      setTimeout(() => onClose(), 2000);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  if (isCompleted) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className="text-xl font-semibold mb-2">
              You're all set! 🎉
            </DialogTitle>
            <p className="text-muted-foreground mb-6">
              Congratulations! You've completed the onboarding tour. Rebooked is now ready to help you grow your business.
            </p>
            <div className="space-y-2 text-left bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  Quick Start
                </Badge>
                <span className="text-sm">Add your first lead to get started</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-accent text-accent-foreground">
                  Pro Tip
                </Badge>
                <span className="text-sm">Check out the automation features</span>
              </div>
            </div>
            <Button onClick={onClose} className="w-full mt-6">
              Start Using Rebooked
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {currentStepData.icon}
              <div>
                <DialogTitle className="text-xl font-semibold">
                  {currentStepData.title}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Step {currentStep + 1} of {tourSteps.length}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Skip Tour
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div 
              className="bg-primary h-full rounded-full transition-all duration-300 ease-out"
              style={{ 
                width: `${((currentStep + 1) / tourSteps.length) * 100}%`,
                minWidth: '0.5rem'
              }}
            />
          </div>

          {/* Content */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <p className="text-foreground leading-relaxed">
                  {currentStepData.description}
                </p>
                
                {currentStepData.action && (
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      💡 {currentStepData.action}
                    </p>
                  </div>
                )}

                {currentStepData.tips && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Quick Tips:</p>
                    <ul className="space-y-1">
                      {currentStepData.tips.map((tip, index) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              Previous
            </Button>
            
            <div className="flex gap-1">
              {tourSteps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    index === currentStep
                      ? "bg-primary"
                      : index < currentStep
                      ? "bg-primary/50"
                      : "bg-muted"
                  }`}
                />
              ))}
            </div>

            <Button onClick={handleNext}>
              {isLastStep ? "Complete Tour" : "Next"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook to manage onboarding state
export function useOnboardingTour() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [hasSeenTour, setHasSeenTour] = React.useState(() => {
    return getItem("hasSeenOnboarding") === "true";
  });

  const startTour = () => setIsOpen(true);
  const closeTour = () => setIsOpen(false);
  const completeTour = () => {
    setHasSeenTour(true);
    setItem("hasSeenOnboarding", "true");
  };

  return {
    isOpen,
    hasSeenTour,
    startTour,
    closeTour,
    completeTour,
  };
}
