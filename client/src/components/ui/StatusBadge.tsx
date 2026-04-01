import * as React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Badge } from "./badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  XCircle, 
  Users, 
  Calendar,
  MessageSquare,
  Phone,
  Mail,
  Zap,
  RefreshCw
} from "lucide-react";

interface StatusBadgeProps {
  status: string;
  variant?: "default" | "outline" | "secondary";
  showIcon?: boolean;
  showTooltip?: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
  onClick?: () => void;
  tabIndex?: number;
}

interface StatusConfig {
  label: string;
  color: string;
  icon: React.ReactNode;
  description: string;
  nextAction?: string;
}

// Dynamic status configurations based on user preferences and theme
const getDynamicStatusConfigs = (isDarkMode: boolean) => {
  
  return {
    new: {
      label: "New",
      color: "bg-info/15 text-info",
      icon: <Users className="h-3 w-3" />,
      description: "New lead that needs attention",
      nextAction: "Send welcome message"
    },
    contacted: {
      label: "Contacted",
      color: "bg-warning/15 text-warning",
      icon: <MessageSquare className="h-3 w-3" />,
      description: "Lead has been contacted",
      nextAction: "Follow up if needed"
    },
    qualified: {
      label: "Qualified",
      color: "bg-accent text-accent-foreground",
      icon: <Calendar className="h-3 w-3" />,
      description: "Lead is qualified for booking",
      nextAction: "Schedule appointment"
    },
    booked: {
      label: "Booked",
      color: "bg-success/15 text-success",
      icon: <CheckCircle2 className="h-3 w-3" />,
      description: "Appointment has been booked",
      nextAction: "Send confirmation"
    },
    lost: {
      label: "Lost",
      color: "bg-destructive/15 text-destructive",
      icon: <XCircle className="h-3 w-3" />,
      description: "Lead was lost",
      nextAction: "Analyze reasons for loss"
    },
    unsubscribed: {
      label: "Unsubscribed",
      color: "bg-muted text-muted-foreground",
      icon: <Mail className="h-3 w-3" />,
      description: "Lead has unsubscribed",
      nextAction: "Remove from lists"
    }
  };
};

export function StatusBadge({ 
  status, 
  variant = "default", 
  showIcon = true, 
  showTooltip = false, 
  size = "default", 
  className = "", 
  onClick,
  tabIndex = 0 
}: StatusBadgeProps) {
  const { isDark: isDarkMode } = useTheme();
  const statusConfigs = getDynamicStatusConfigs(isDarkMode);
  const config = statusConfigs[status] || statusConfigs.new;

  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    default: "text-sm px-2.5 py-1.5", 
    lg: "text-base px-3 py-2"
  };

  const badgeContent = (
    <div 
      className={`border-0 flex items-center gap-1 inline-flex items-center justify-center rounded-md border px-2 py-0.5 font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden ${sizeClasses[size]} ${config.color} ${className}`}
      onClick={onClick}
      tabIndex={tabIndex || (onClick ? 0 : undefined)}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      aria-label={`Status: ${config.label}${config.nextAction ? `. Next action: ${config.nextAction}` : ''}`}
    >
      {showIcon && config.icon}
      {config.label}
    </div>
  );

  if (!showTooltip) {
    return badgeContent;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeContent}
        </TooltipTrigger>
        <TooltipContent side="top" align="center" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-medium">{config.label}</p>
            <p className="text-sm text-muted-foreground">{config.description}</p>
            {config.nextAction && (
              <p className="text-xs text-info">
                💡 {config.nextAction}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Communication status badges
export function CommunicationBadge({ 
  type, 
  count, 
  lastSent,
  size = "default",
  className = ""
}: { 
  type: "sms" | "email" | "call" | string; 
  count?: number; 
  lastSent?: Date | string;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const configs = {
    sms: {
      icon: <Phone className="h-3 w-3" />,
      color: "bg-info/15 text-info",
      label: "SMS"
    },
    email: {
      icon: <Mail className="h-3 w-3" />,
      color: "bg-accent text-accent-foreground",
      label: "Email"
    },
    call: {
      icon: <Phone className="h-3 w-3" />,
      color: "bg-success/15 text-success",
      label: "Call"
    }
  };

  const config = configs[type as keyof typeof configs] || {
    icon: <Mail className="h-3 w-3" />,
    color: "bg-muted text-muted-foreground",
    label: "Unknown"
  };
  
  // Size classes
  const sizeClasses = {
    sm: "text-xs",
    default: "text-xs", 
    lg: "text-base"
  };
  
  const textSizeClass = sizeClasses[size] || sizeClasses.default;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={`${config.color} border-0 flex items-center gap-1 inline-flex items-center justify-center rounded-md border px-2 py-0.5 font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden`}
          >
            {config.icon}
            <span className={`${textSizeClass} ${config.color}`}>{config.label}</span>
            {count && <span className="bg-white/20 px-1 rounded text-xs">{count}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">{config.label} Communications</p>
            {count && <p className="text-sm">{count} messages sent</p>}
            {lastSent && (
              <p className="text-xs text-muted-foreground">
                Last: {new Date(lastSent).toLocaleDateString()}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Activity badge for real-time status
export function ActivityBadge({ 
  status, 
  isActive,
  lastSeen,
  lastActivity,
  showPulse = true,
  onClick,
  className = "",
  size = "default",
  ...props 
}: { 
  status?: "active" | "inactive" | "pending" | string;
  isActive?: boolean; 
  lastSeen?: Date | string;
  lastActivity?: string;
  showPulse?: boolean;
  onClick?: () => void;
  className?: string;
  size?: "sm" | "default" | "lg";
  [key: string]: any;
}) {
  // Handle both status prop and isActive prop for backward compatibility
  let active = isActive !== undefined ? isActive : (status === "active");
  let displayText = status === "unknown" ? "Unknown" : (active ? "Active" : "Offline");
  
  // Handle specific status values
  if (status === "inactive") {
    displayText = "Inactive";
    active = false;
  } else if (status === "pending") {
    displayText = "Pending";
    active = false;
  }
  
  // Use StatusBadge sizeClasses for ActivityBadge too  
  const textSizeClass = {
    sm: "text-xs",
    default: "text-xs", 
    lg: "text-base"
  }[size] || "text-xs";
  
  // Determine status styling
  let statusClasses = active
    ? "bg-success/15 text-success"
    : "text-muted-foreground";

  if (status === "unknown") {
    statusClasses = "bg-muted text-muted-foreground";
  } else if (status === "inactive") {
    statusClasses = "bg-muted text-muted-foreground";
  } else if (status === "pending") {
    statusClasses = "bg-warning/15 text-warning";
  }
  
  // Add pulse animation to text if active and showPulse is true
  if (active && showPulse) {
    statusClasses += " animate-pulse";
  }
  
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={`flex items-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring rounded`}
            onClick={onClick}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }}
            {...props}
          >
            <div className={`w-2 h-2 rounded-full ${
              status === "unknown" || status === "inactive" ? "bg-muted-foreground" :
              status === "pending" ? "bg-warning" :
              active ? (showPulse ? "bg-success animate-pulse" : "bg-success") : "bg-muted-foreground"
            }`} />
            <span className={`${statusClasses} ${textSizeClass} ${className}`}>{displayText}</span>
            {lastActivity && (
              <span className="text-xs text-muted-foreground">
                {lastActivity}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">Activity Status</p>
            <p className="text-sm">{displayText}</p>
            {lastSeen && (
              <p className="text-xs text-muted-foreground">
                Last seen: {new Date(lastSeen).toLocaleDateString()}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Priority badge
export function PriorityBadge({ priority }: { priority: "low" | "medium" | "high" | "urgent" }) {
  const configs = {
    low: {
      label: "Low Priority",
      color: "bg-muted-foreground",
      icon: <Clock className="h-3 w-3" />
    },
    medium: {
      label: "Medium Priority",
      color: "bg-warning",
      icon: <AlertCircle className="h-3 w-3" />
    },
    high: {
      label: "High Priority",
      color: "bg-warning",
      icon: <Zap className="h-3 w-3" />
    },
    urgent: {
      label: "Urgent",
      color: "bg-destructive",
      icon: <AlertCircle className="h-3 w-3 animate-pulse" />
    }
  };

  const config = configs[priority];

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`${config.color} text-white border-0 flex items-center gap-1`}
          >
            {config.icon}
            <span>{config.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{config.label}</p>
          <p className="text-sm text-muted-foreground">
            {priority === "urgent" && "Requires immediate attention"}
            {priority === "high" && "Should be addressed today"}
            {priority === "medium" && "Can be addressed this week"}
            {priority === "low" && "Can be addressed when convenient"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
