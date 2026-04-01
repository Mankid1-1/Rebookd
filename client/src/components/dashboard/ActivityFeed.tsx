/**
 * 📱 ACTIVITY FEED COMPONENT
 * Real-time activity feed with mobile-responsive design
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import {
  Users,
  MessageSquare,
  Phone,
  Calendar,
  DollarSign,
  Clock,
  RefreshCw,
  Filter,
  Search,
  MoreVertical,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useState } from "react";

interface ActivityItem {
  id: string;
  type: 'lead' | 'message' | 'booking' | 'payment' | 'call';
  title: string;
  description: string;
  createdAt: string;
  status?: 'success' | 'pending' | 'failed' | 'info';
  metadata?: {
    leadId?: string;
    leadName?: string;
    amount?: number;
    phoneNumber?: string;
    direction?: 'inbound' | 'outbound';
  };
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  loading?: boolean;
  onRefresh?: () => void;
  onActivityClick?: (activity: ActivityItem) => void;
}

export function ActivityFeed({ activities, loading, onRefresh, onActivityClick }: ActivityFeedProps) {
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter activities
  const filteredActivities = activities?.filter(activity => {
    const matchesFilter = filter === 'all' || activity.type === filter;
    const matchesSearch = searchTerm === '' || 
      activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  }) || [];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'lead':
        return <Users className="h-4 w-4" />;
      case 'message':
        return <MessageSquare className="h-4 w-4" />;
      case 'booking':
        return <Calendar className="h-4 w-4" />;
      case 'payment':
        return <DollarSign className="h-4 w-4" />;
      case 'call':
        return <Phone className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string, status?: string) => {
    if (status === 'success') return 'bg-success';
    if (status === 'failed') return 'bg-destructive';
    if (status === 'pending') return 'bg-warning';

    switch (type) {
      case 'lead':
        return 'bg-info';
      case 'message':
        return 'bg-accent';
      case 'booking':
        return 'bg-success';
      case 'payment':
        return 'bg-warning';
      case 'call':
        return 'bg-warning';
      default:
        return 'bg-muted-foreground';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-3 w-3 text-success" />;
      case 'failed':
        return <XCircle className="h-3 w-3 text-destructive" />;
      case 'pending':
        return <AlertCircle className="h-3 w-3 text-warning" />;
      default:
        return null;
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return format(date, 'MMM dd');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-muted rounded-full mt-2 animate-pulse"></div>
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded animate-pulse mb-2"></div>
                  <div className="h-3 bg-muted rounded animate-pulse w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Recent Activity</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredActivities.length} recent activities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Activities</option>
              <option value="lead">Leads</option>
              <option value="message">Messages</option>
              <option value="booking">Bookings</option>
              <option value="payment">Payments</option>
              <option value="call">Calls</option>
            </select>
          </div>
        </div>

        {/* Activity List */}
        {filteredActivities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p>No recent activity</p>
            <p className="text-sm mt-2">
              {searchTerm || filter !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Activities will appear here as they happen'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredActivities.map((activity, index) => (
              <div
                key={activity.id || index}
                className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => onActivityClick?.(activity)}
              >
                <div className={`w-2 h-2 rounded-full mt-2 ${getActivityColor(activity.type, activity.status)}`}></div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getActivityIcon(activity.type)}
                        <p className="text-sm font-medium text-foreground truncate">
                          {activity.title}
                        </p>
                        {getStatusIcon(activity.status)}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {activity.description}
                      </p>
                      
                      {/* Additional metadata */}
                      {activity.metadata && (
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          {activity.metadata.leadName && (
                            <span>Lead: {activity.metadata.leadName}</span>
                          )}
                          {activity.metadata.amount && (
                            <span>Amount: ${activity.metadata.amount}</span>
                          )}
                          {activity.metadata.phoneNumber && (
                            <span>Phone: {activity.metadata.phoneNumber}</span>
                          )}
                          {activity.metadata.direction && (
                            <span className="capitalize">
                              {activity.metadata.direction}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-end ml-4">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(activity.createdAt)}
                      </span>
                      <Button variant="ghost" size="sm" className="mt-1 p-1">
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Load More */}
        {filteredActivities.length > 0 && (
          <div className="text-center pt-4 border-t">
            <Button variant="outline" size="sm">
              Load More Activities
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ActivityDetailProps {
  activity: ActivityItem;
  onClose: () => void;
}

export function ActivityDetail({ activity, onClose }: ActivityDetailProps) {
  return (
    <Card className="border-l-4 border-l-info">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${getActivityColor(activity.type, activity.status)}`}></div>
          <div>
            <CardTitle className="text-lg">{activity.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {format(new Date(activity.createdAt), 'MMM dd, yyyy at h:mm a')}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          ×
        </Button>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-medium mb-2">Details</h4>
          <p className="text-sm text-muted-foreground">{activity.description}</p>
        </div>
        
        {activity.metadata && (
          <div>
            <h4 className="font-medium mb-2">Additional Information</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {activity.metadata.leadName && (
                <div>
                  <span className="font-medium">Lead:</span> {activity.metadata.leadName}
                </div>
              )}
              {activity.metadata.amount && (
                <div>
                  <span className="font-medium">Amount:</span> ${activity.metadata.amount}
                </div>
              )}
              {activity.metadata.phoneNumber && (
                <div>
                  <span className="font-medium">Phone:</span> {activity.metadata.phoneNumber}
                </div>
              )}
              {activity.metadata.direction && (
                <div>
                  <span className="font-medium">Direction:</span> {activity.metadata.direction}
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className="flex gap-2 pt-4 border-t">
          <Button size="sm">View Details</Button>
          <Button variant="outline" size="sm">Related Activities</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function getActivityColor(type: string, status?: string) {
  if (status === 'success') return 'bg-success';
  if (status === 'failed') return 'bg-destructive';
  if (status === 'pending') return 'bg-warning';

  switch (type) {
    case 'lead':
      return 'bg-info';
    case 'message':
      return 'bg-accent';
    case 'booking':
      return 'bg-success';
    case 'payment':
      return 'bg-warning';
    case 'call':
      return 'bg-warning';
    default:
      return 'bg-muted-foreground';
  }
}
