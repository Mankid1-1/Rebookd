import * as React from "react";
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
const getDynamicStatusConfigs = () => {
  const isDarkMode = document.documentElement.classList.contains('dark');
  
  return {
    new: {
      label: "New",
      color: isDarkMode ? "bg-blue-900 text-blue-200" : "bg-blue-100 text-blue-800",
      icon: <Users className="h-3 w-3" />,
      description: "New lead that needs attention",
      nextAction: "Send welcome message"
    },
    contacted: {
      label: "Contacted", 
      color: isDarkMode ? "bg-yellow-900 text-yellow-200" : "bg-yellow-100 text-yellow-800",
      icon: <MessageSquare className="h-3 w-3" />,
      description: "Lead has been contacted",
      nextAction: "Follow up if needed"
    },
    qualified: {
      label: "Qualified",
      color: isDarkMode ? "bg-purple-900 text-purple-200" : "bg-purple-100 text-purple-800",
      icon: <Calendar className="h-3 w-3" />,
      description: "Lead is qualified for booking",
      nextAction: "Schedule appointment"
    },
    booked: {
      label: "Booked",
      color: isDarkMode ? "bg-green-900 text-green-200" : "bg-green-100 text-green-800",
      icon: <CheckCircle2 className="h-3 w-3" />,
      description: "Appointment has been booked",
      nextAction: "Send confirmation"
    },
    lost: {
      label: "Lost",
      color: isDarkMode ? "bg-red-900 text-red-200" : "bg-red-100 text-red-800",
      icon: <XCircle className="h-3 w-3" />,
      description: "Lead was lost",
      nextAction: "Analyze reasons for loss"
    },
    unsubscribed: {
      label: "Unsubscribed",
      color: isDarkMode ? "bg-gray-800 text-gray-200" : "bg-gray-100 text-gray-800",
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
  const statusConfigs = getDynamicStatusConfigs();
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
              <p className="text-xs text-blue-600 dark:text-blue-400">
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
      color: "bg-blue-100 text-blue-800",
      label: "SMS"
    },
    email: {
      icon: <Mail className="h-3 w-3" />,
      color: "bg-purple-100 text-purple-800", 
      label: "Email"
    },
    call: {
      icon: <Phone className="h-3 w-3" />,
      color: "bg-green-100 text-green-800",
      label: "Call"
    }
  };

  const config = configs[type as keyof typeof configs] || {
    icon: <Mail className="h-3 w-3" />,
    color: "bg-gray-100 text-gray-800",
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
    ? "bg-green-100 text-green-800" 
    : "text-gray-600";
    
  if (status === "unknown") {
    statusClasses = "bg-gray-100 text-gray-800";
  } else if (status === "inactive") {
    statusClasses = "bg-gray-100 text-gray-800";
  } else if (status === "pending") {
    statusClasses = "bg-yellow-100 text-yellow-800";
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
            className={`flex items-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 rounded`}
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
              status === "unknown" || status === "inactive" ? "bg-gray-400" :
              status === "pending" ? "bg-yellow-400" :
              active ? (showPulse ? "bg-green-500 animate-pulse" : "bg-green-500") : "bg-gray-400"
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
      color: "bg-gray-500",
      icon: <Clock className="h-3 w-3" />
    },
    medium: {
      label: "Medium Priority", 
      color: "bg-yellow-500",
      icon: <AlertCircle className="h-3 w-3" />
    },
    high: {
      label: "High Priority",
      color: "bg-orange-500", 
      icon: <Zap className="h-3 w-3" />
    },
    urgent: {
      label: "Urgent",
      color: "bg-red-500",
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
