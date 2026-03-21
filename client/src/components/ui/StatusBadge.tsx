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
  Zap
} from "lucide-react";

interface StatusBadgeProps {
  status: string;
  variant?: "default" | "outline" | "secondary";
  showIcon?: boolean;
  showTooltip?: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
}

interface StatusConfig {
  label: string;
  color: string;
  icon: React.ReactNode;
  description: string;
  nextAction?: string;
}

const statusConfigs: Record<string, StatusConfig> = {
  new: {
    label: "New",
    color: "bg-blue-500",
    icon: <Users className="h-3 w-3" />,
    description: "New lead that needs attention",
    nextAction: "Send welcome message"
  },
  contacted: {
    label: "Contacted", 
    color: "bg-yellow-500",
    icon: <MessageSquare className="h-3 w-3" />,
    description: "Lead has been contacted",
    nextAction: "Follow up if needed"
  },
  qualified: {
    label: "Qualified",
    color: "bg-purple-500", 
    icon: <CheckCircle2 className="h-3 w-3" />,
    description: "Lead is qualified for sales",
    nextAction: "Schedule appointment"
  },
  booked: {
    label: "Booked",
    color: "bg-green-500",
    icon: <Calendar className="h-3 w-3" />,
    description: "Appointment is scheduled",
    nextAction: "Prepare for meeting"
  },
  lost: {
    label: "Lost",
    color: "bg-red-500",
    icon: <XCircle className="h-3 w-3" />,
    description: "Lead was not converted",
    nextAction: "Review what went wrong"
  },
  unsubscribed: {
    label: "Unsubscribed",
    color: "bg-gray-500",
    icon: <AlertCircle className="h-3 w-3" />,
    description: "Lead opted out of communications",
    nextAction: "Respect their preference"
  },
  pending: {
    label: "Pending",
    color: "bg-orange-500",
    icon: <Clock className="h-3 w-3" />,
    description: "Waiting for response",
    nextAction: "Send follow-up reminder"
  }
};

const sizeClasses = {
  sm: "text-xs px-2 py-1",
  default: "text-xs px-2.5 py-1.5", 
  lg: "text-sm px-3 py-2"
};

export function StatusBadge({ 
  status, 
  variant = "default",
  showIcon = true,
  showTooltip = true,
  size = "default",
  className = ""
}: StatusBadgeProps) {
  const config = statusConfigs[status.toLowerCase()] || statusConfigs.new;
  const sizeClass = sizeClasses[size];

  const badgeContent = (
    <Badge 
      variant={variant}
      className={`${sizeClass} ${config.color} text-white border-0 flex items-center gap-1 ${className}`}
    >
      {showIcon && config.icon}
      <span>{config.label}</span>
    </Badge>
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
  lastSent 
}: { 
  type: "sms" | "email" | "call"; 
  count?: number; 
  lastSent?: Date | string;
}) {
  const configs = {
    sms: {
      icon: <Phone className="h-3 w-3" />,
      color: "bg-green-500",
      label: "SMS"
    },
    email: {
      icon: <Mail className="h-3 w-3" />,
      color: "bg-blue-500", 
      label: "Email"
    },
    call: {
      icon: <Phone className="h-3 w-3" />,
      color: "bg-purple-500",
      label: "Call"
    }
  };

  const config = configs[type];

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
            {count && <span className="bg-white/20 px-1 rounded text-xs">{count}</span>}
          </Badge>
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
  isActive, 
  lastSeen 
}: { 
  isActive: boolean; 
  lastSeen?: Date | string;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              isActive ? "bg-green-500 animate-pulse" : "bg-gray-400"
            }`} />
            <span className="text-xs text-muted-foreground">
              {isActive ? "Active now" : "Offline"}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">
              {isActive ? "Currently Active" : "Inactive"}
            </p>
            {lastSeen && !isActive && (
              <p className="text-xs text-muted-foreground">
                Last seen: {new Date(lastSeen).toLocaleString()}
              </p>
            )}
            {isActive && (
              <p className="text-xs text-green-600">
                ✓ User is currently online
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
