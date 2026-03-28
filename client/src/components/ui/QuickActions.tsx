import * as React from "react";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Badge } from "./badge";
import { 
  Plus, 
  MessageSquare, 
  Phone, 
  Mail, 
  Calendar,
  Zap,
  Users,
  Search,
  Filter,
  Download
} from "lucide-react";
import { useProgressiveDisclosureContext } from "./ProgressiveDisclosure";

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  variant?: "default" | "outline" | "secondary" | "ghost";
  badge?: string;
  shortcut?: string;
}

interface QuickActionsProps {
  actions: QuickAction[];
  className?: string;
  showShortcuts?: boolean;
}

export function QuickActions({ 
  actions, 
  className = "", 
  showShortcuts = true 
}: QuickActionsProps) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {actions.map((action) => (
        <Card key={action.id} className="group hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4">
            <Button
              variant={action.variant || "outline"}
              className="w-full h-auto p-4 justify-start"
              onClick={action.action}
            >
              <div className="flex items-center gap-3 w-full">
                <div className="flex-shrink-0">
                  {action.icon}
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{action.title}</h4>
                    {action.badge && (
                      <Badge variant="secondary" className="text-xs">
                        {action.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {action.description}
                  </p>
                </div>
                {showShortcuts && action.shortcut && (
                  <kbd className="hidden lg:flex items-center gap-1 px-2 py-1 text-xs bg-muted rounded">
                    {action.shortcut}
                  </kbd>
                )}
              </div>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Dynamic quick actions based on user skill and business type
export const getLeadsQuickActions = (
  onAction: (action: string) => void,
  userSkill?: any,
  businessType?: string
): QuickAction[] => {
  const baseActions = [
    {
      id: "add-lead",
      title: "Add New Lead",
      description: "Manually add a new potential customer",
      icon: <Plus className="h-5 w-5" />,
      action: () => onAction("add-lead"),
      badge: "Quick",
      shortcut: "N"
    },
    {
      id: "send-message",
      title: "Send Message",
      description: "Send SMS or email to selected leads",
      icon: <MessageSquare className="h-5 w-5" />,
      action: () => onAction("send-message"),
      shortcut: "M"
    },
    {
      id: "search-leads",
      title: "Advanced Search",
      description: "Find leads with advanced filters",
      icon: <Search className="h-5 w-5" />,
      action: () => onAction("search-leads"),
      shortcut: "S"
    }
  ];

  // All actions available at every skill level
  baseActions.push(
    {
      id: "schedule-appointment",
      title: "Schedule Appointment",
      description: "Book appointment with lead",
      icon: <Calendar className="h-5 w-5" />,
      action: () => onAction("schedule-appointment"),
      shortcut: "A"
    },
    {
      id: "make-call",
      title: "Make Call",
      description: "Initiate phone call to lead",
      icon: <Phone className="h-5 w-5" />,
      action: () => onAction("make-call"),
      shortcut: "C"
    },
    {
      id: "import-leads",
      title: "Import Leads",
      description: "Bulk import leads from CSV file",
      icon: <Download className="h-5 w-5" />,
      action: () => onAction("import-leads"),
      badge: "Bulk",
      shortcut: "I"
    }
  );

  // Business-specific actions
  if (businessType?.includes('medical') || businessType?.includes('clinic')) {
    baseActions.push({
      id: "send-reminders",
      title: "Send Reminders",
      description: "Send appointment reminders to patients",
      icon: <Mail className="h-5 w-5" />,
      action: () => onAction("send-reminders"),
      badge: "Medical",
      shortcut: "R"
    });
  }

  return baseActions;
};

export const getDashboardQuickActions = (
  onAction: (action: string) => void,
  counts?: { messages?: number; tasks?: number },
  userPreferences?: { mostUsedActions?: string[] },
  userSkill?: any,
  businessType?: string
): QuickAction[] => {
  const mostUsed = userPreferences?.mostUsedActions || [];
  const isDarkMode = document.documentElement.classList.contains('dark');
  
  const baseActions: QuickAction[] = [
    {
      id: "view-leads",
      title: "View All Leads",
      description: "See and manage your complete lead list",
      icon: <Users className="h-5 w-5" />,
      action: () => onAction("view-leads"),
      badge: mostUsed.includes("view-leads") ? "Most Used" : undefined
    },
    {
      id: "new-messages",
      title: "New Messages",
      description: "Check unread messages from leads",
      icon: <MessageSquare className="h-5 w-5" />,
      action: () => onAction("new-messages"),
      badge: counts?.messages && counts.messages > 0 ? `${counts.messages} New` : undefined
    }
  ];

  // All actions available at every skill level
  baseActions.push(
    {
      id: "today-tasks",
      title: "Today's Tasks",
      description: "View and complete today's follow-ups",
      icon: <Zap className="h-5 w-5" />,
      action: () => onAction("today-tasks"),
      badge: counts?.tasks && counts.tasks > 0 ? `${counts.tasks} Tasks` : undefined
    },
    {
      id: "add-lead",
      title: "Add Lead",
      description: "Add a new lead to your system",
      icon: <Plus className="h-5 w-5" />,
      action: () => onAction("add-lead"),
      badge: mostUsed.includes("add-lead") ? "Frequent" : undefined
    }
  );

  // Business-specific actions
  if (businessType?.includes('medical') || businessType?.includes('clinic')) {
    baseActions.push({
      id: "patient-reminders",
      title: "Patient Reminders",
      description: "Send appointment reminders to patients",
      icon: <Mail className="h-5 w-5" />,
      action: () => onAction("patient-reminders"),
      badge: "Medical",
      shortcut: "P"
    });
  }

  baseActions.push(
    {
      id: "search-leads",
      title: "Advanced Search",
      description: "Find leads with advanced filters",
      icon: <Search className="h-5 w-5" />,
      action: () => onAction("search-leads"),
      shortcut: "S"
    },
    {
      id: "send-campaign",
      title: "Send Campaign",
      description: "Launch SMS/email marketing campaign",
      icon: <Mail className="h-5 w-5" />,
      action: () => onAction("send-campaign"),
      shortcut: "E"
    },
    {
      id: "run-automation",
      title: "Run Automation",
      description: "Trigger automated follow-up sequence",
      icon: <Zap className="h-5 w-5" />,
      action: () => onAction("run-automation"),
      badge: mostUsed.includes("run-automation") ? "Smart" : undefined
    },
    {
      id: "view-analytics",
      title: "View Analytics",
      description: "Check performance metrics and reports",
      icon: <Filter className="h-5 w-5" />,
      action: () => onAction("view-analytics"),
      shortcut: "R"
    }
  );

  return baseActions;
};

// Floating action button for mobile
export function FloatingActionButton({ actions }: { actions: QuickAction[] }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const primaryAction = actions[0];

  return (
    <div className="fixed bottom-6 right-6 z-50 lg:hidden">
      {isOpen && (
        <div className="absolute bottom-16 right-0 space-y-2">
          {actions.slice(1).map((action) => (
            <Button
              key={action.id}
              variant="outline"
              size="sm"
              className="w-full justify-start bg-background shadow-lg"
              onClick={action.action}
            >
              {action.icon}
              <span className="ml-2">{action.title}</span>
            </Button>
          ))}
        </div>
      )}
      
      <Button
        size="lg"
        className="w-14 h-14 rounded-full shadow-lg"
        onClick={primaryAction.action}
      >
        {primaryAction.icon}
      </Button>
    </div>
  );
}

// Keyboard shortcuts helper
export function useKeyboardShortcuts(shortcuts: Record<string, () => void>) {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore when typing in inputs or contenteditable elements
      const target = event.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]') ||
        target.closest('input, textarea, select')
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;

      // Only handle shortcuts with modifier keys to prevent accidental triggers
      if (shortcuts[key] && modifier) {
        event.preventDefault();
        shortcuts[key]();
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}

export default QuickActions;
