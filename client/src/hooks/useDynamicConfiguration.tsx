/**
 * 🎯 DYNAMIC CONFIGURATION SYSTEM
 * 
 * Replaces all hardcoded data with real-time, user-adaptive configurations
 * based on actual usage patterns, permissions, and business logic.
 */

import React, { useMemo, useCallback } from 'react';
import { useProgressiveDisclosureContext } from '@/components/ui/ProgressiveDisclosure';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/hooks/useAuth';
import { Users, Phone, Calendar, MessageSquare, Mail, Zap, Clock, TrendingUp } from 'lucide-react';

// Dynamic status configuration based on real business data
export function useDynamicStatuses() {
  const { data: tenantConfig } = trpc.tenant.get.useQuery();
  const { context } = useProgressiveDisclosureContext();
  
  // Get real statuses from tenant configuration or defaults based on user skill
  return useMemo(() => {
    if (tenantConfig?.customStatuses) {
      return tenantConfig.customStatuses.map(status => ({
        value: status.id,
        label: status.name,
        color: status.color,
        order: status.order,
        enabled: status.enabled
      }));
    }
    
    // Adaptive defaults based on user skill level
    const baseStatuses = [
      { value: "new", label: "New", color: "bg-blue-500", order: 1, enabled: true },
      { value: "contacted", label: "Contacted", color: "bg-yellow-500", order: 2, enabled: true },
      { value: "qualified", label: "Qualified", color: "bg-purple-500", order: 3, enabled: true },
      { value: "booked", label: "Booked", color: "bg-green-500", order: 4, enabled: true },
      { value: "lost", label: "Lost", color: "bg-red-500", order: 5, enabled: true },
    ];
    
    // Advanced users get more status options
    if (context.currentComplexity === 'advanced' || context.currentComplexity === 'expert') {
      baseStatuses.push(
        { value: "unsubscribed", label: "Unsubscribed", color: "bg-gray-500", order: 6, enabled: true },
        { value: "followup_scheduled", label: "Follow-up Scheduled", color: "bg-orange-500", order: 7, enabled: true }
      );
    }
    
    // Experts get custom status creation capability
    if (context.currentComplexity === 'expert') {
      baseStatuses.push(
        { value: "custom", label: "Custom Status", color: "bg-indigo-500", order: 8, enabled: true }
      );
    }
    
    return baseStatuses;
  }, [tenantConfig, context.currentComplexity]);
}

// Dynamic automation node templates based on real user capabilities
export function useDynamicAutomationNodes() {
  const { data: userPermissions } = trpc.user.permissions.useQuery();
  const { data: availableIntegrations } = trpc.integrations.list.useQuery();
  const { context } = useProgressiveDisclosureContext();
  
  return useMemo(() => {
    const baseNodes = [
      // Core triggers available to all users
      {
        type: 'trigger',
        name: 'New Lead',
        description: 'Trigger when a new lead is created',
        icon: <Users className="h-4 w-4" />,
        category: 'Triggers',
        config: { source: 'all', minimumValue: 0 },
        requiredSkill: 'beginner'
      },
      {
        type: 'trigger',
        name: 'Missed Call',
        description: 'Trigger when a call is missed',
        icon: <Phone className="h-4 w-4" />,
        category: 'Triggers',
        config: { phoneNumber: '', businessHoursOnly: false },
        requiredSkill: 'intermediate'
      }
    ];
    
    // Add nodes based on user skill level
    if (context.userSkill.level !== 'beginner') {
      baseNodes.push(
        {
          type: 'trigger',
          name: 'No-Show',
          description: 'Trigger when an appointment is missed',
          icon: <Calendar className="h-4 w-4" />,
          category: 'Triggers',
          config: { gracePeriod: 15, notifyStaff: true },
          requiredSkill: 'intermediate'
        }
      );
    }
    
    // Add advanced actions for skilled users
    if (context.userSkill.level === 'advanced' || context.userSkill.level === 'expert') {
      baseNodes.push(
        {
          type: 'action',
          name: 'Create Task',
          description: 'Create follow-up task for staff',
          icon: <CheckCircle className="h-4 w-4" />,
          category: 'Actions',
          config: { assignee: '', priority: 'medium', dueInHours: 24 },
          requiredSkill: 'advanced'
        },
        {
          type: 'action',
          name: 'Update Lead',
          description: 'Update lead status or information',
          icon: <Users className="h-4 w-4" />,
          category: 'Actions',
          config: { field: '', value: '' },
          requiredSkill: 'advanced'
        }
      );
    }
    
    // Add integration nodes based on available integrations
    if (availableIntegrations?.length > 0 && context.userSkill.level === 'expert') {
      availableIntegrations.forEach(integration => {
        baseNodes.push({
          type: 'integration',
          name: integration.name,
          description: `Connect to ${integration.name}`,
          icon: <Zap className="h-4 w-4" />,
          category: 'Integrations',
          config: { integrationId: integration.id, settings: {} },
          requiredSkill: 'expert'
        });
      });
    }
    
    // Filter nodes based on user skill level
    return baseNodes.filter(node => {
      const skillLevels = ['beginner', 'intermediate', 'advanced', 'expert'];
      const userSkillIndex = skillLevels.indexOf(context.userSkill.level);
      const nodeSkillIndex = skillLevels.indexOf(node.requiredSkill);
      return userSkillIndex >= nodeSkillIndex;
    });
  }, [userPermissions, availableIntegrations, context.userSkill.level]);
}

// Dynamic quick actions based on real user behavior and permissions
export function useDynamicQuickActions() {
  const { data: userPermissions } = trpc.user.permissions.useQuery();
  const { data: unreadCounts } = trpc.notifications.unreadCounts.useQuery();
  const { context } = useProgressiveDisclosureContext();
  
  return useCallback((onAction: (action: string) => void) => {
    const actions = [];
    
    // Base actions available to all users
    actions.push({
      id: "view-leads",
      title: "View All Leads",
      description: "See and manage your complete lead list",
      icon: <Users className="h-5 w-5" />,
      action: () => onAction("view-leads"),
      badge: context.userSkill.experience.featureUsage['dashboard'] > 50 ? "Popular" : undefined
    });
    
    // Messaging action with real unread count
    if (userPermissions?.canMessage) {
      actions.push({
        id: "new-messages",
        title: "New Messages",
        description: "Check unread messages from leads",
        icon: <MessageSquare className="h-5 w-5" />,
        action: () => onAction("new-messages"),
        badge: unreadCounts?.messages && unreadCounts.messages > 0 ? `${unreadCounts.messages} New` : undefined
      });
    }
    
    // Tasks action based on real task count
    if (userPermissions?.canViewTasks) {
      actions.push({
        id: "today-tasks",
        title: "Today's Tasks",
        description: "View and complete today's follow-ups",
        icon: <Zap className="h-5 w-5" />,
        action: () => onAction("today-tasks"),
        badge: unreadCounts?.tasks && unreadCounts.tasks > 0 ? `${unreadCounts.tasks} Tasks` : undefined
      });
    }
    
    // Campaign actions for advanced users
    if (context.userSkill.level !== 'beginner' && userPermissions?.canCreateCampaigns) {
      actions.push({
        id: "send-campaign",
        title: "Send Campaign",
        description: "Launch SMS/email marketing campaign",
        icon: <Mail className="h-5 w-5" />,
        action: () => onAction("send-campaign"),
        shortcut: "E"
      });
    }
    
    // Analytics for users who have explored it
    if (context.userSkill.experience.featureUsage['analytics'] > 0) {
      actions.push({
        id: "view-analytics",
        title: "Analytics",
        description: "View performance metrics and insights",
        icon: <BarChart3 className="h-5 w-5" />,
        action: () => onAction("view-analytics")
      });
    }
    
    // Automation for expert users
    if (context.userSkill.level === 'expert' && userPermissions?.canCreateAutomations) {
      actions.push({
        id: "create-automation",
        title: "Create Automation",
        description: "Build custom workflow automations",
        icon: <Bot className="h-5 w-5" />,
        action: () => onAction("create-automation"),
        shortcut: "A"
      });
    }
    
    return actions;
  }, [userPermissions, unreadCounts, context]);
}

// Dynamic dashboard metrics based on real user role and permissions
export function useDynamicDashboardMetrics() {
  const authState = useAuth();
  const user = authState.user;
  const { data: tenantConfig } = trpc.tenant.get.useQuery();
  const { context } = useProgressiveDisclosureContext();
  
  return useMemo(() => {
    const metrics = [];
    
    // Base metrics for all users
    metrics.push(
      { id: 'totalLeads', title: 'Total Leads', icon: <Users />, enabled: true },
      { id: 'activeConversations', title: 'Active Conversations', icon: <MessageSquare />, enabled: true }
    );
    
    // Revenue metrics for users with permission
    if (user?.role === 'admin' || user?.role === 'manager') {
      metrics.push(
        { id: 'revenue', title: 'Revenue', icon: <DollarSign />, enabled: true },
        { id: 'bookingRate', title: 'Booking Rate', icon: <Target />, enabled: true }
      );
    }
    
    // Advanced metrics for experienced users
    if (context.userSkill.experience.totalSessions > 10) {
      metrics.push(
        { id: 'responseTime', title: 'Avg Response Time', icon: <Clock />, enabled: true },
        { id: 'conversionRate', title: 'Conversion Rate', icon: <TrendingUp />, enabled: true }
      );
    }
    
    // Expert metrics
    if (context.userSkill.level === 'expert') {
      metrics.push(
        { id: 'customerLifetimeValue', title: 'Customer LTV', icon: <DollarSign />, enabled: true },
        { id: 'campaignROI', title: 'Campaign ROI', icon: <BarChart3 />, enabled: true }
      );
    }
    
    return metrics.filter(metric => metric.enabled);
  }, [user, tenantConfig, context]);
}

// Dynamic UI preferences based on real user behavior
export function useDynamicUIPreferences() {
  const { context } = useProgressiveDisclosureContext();
  
  return useMemo(() => {
    const preferences = {
      // Density based on user efficiency
      density: context.userSkill.behavior.efficiencyScore > 70 ? 'compact' : 
              context.userSkill.behavior.efficiencyScore < 40 ? 'comfortable' : 'normal',
      
      // Information level based on confidence
      informationLevel: context.userSkill.behavior.confidenceLevel > 70 ? 'detailed' :
                      context.userSkill.behavior.confidenceLevel < 40 ? 'minimal' : 'balanced',
      
      // Navigation based on exploration
      navigationStyle: context.userSkill.behavior.explorationScore > 60 ? 'advanced' : 'basic',
      
      // Help based on help-seeking frequency
      showHelp: context.userSkill.experience.helpSeekingFrequency > 0.3,
      
      // Shortcuts based on experience
      showShortcuts: context.userSkill.experience.totalSessions > 5,
      
      // Animations based on user preference (learned from behavior)
      enableAnimations: context.userSkill.behavior.adaptationWillingness > 50
    };
    
    return preferences;
  }, [context]);
}

// Dynamic feature availability based on real user skill and business rules
export function useDynamicFeatureAvailability() {
  const { data: featureFlags } = trpc.featureFlags.useQuery();
  const { data: userPermissions } = trpc.user.permissions.useQuery();
  const { context } = useProgressiveDisclosureContext();
  
  return useMemo(() => {
    const features = {
      // Core features always available
      dashboard: true,
      messaging: userPermissions?.canMessage || false,
      leads: userPermissions?.canViewLeads || false,
      
      // Progressive features based on skill
      analytics: context.userSkill.experience.featureUsage['dashboard'] > 10,
      campaigns: context.userSkill.level !== 'beginner' && userPermissions?.canCreateCampaigns,
      automation: context.userSkill.level === 'expert' && userPermissions?.canCreateAutomations,
      
      // Business rule features
      revenue: user?.role === 'admin' || user?.role === 'manager',
      userManagement: user?.role === 'admin',
      
      // Feature flag controlled features
      betaFeatures: featureFlags?.enableBetaFeatures && context.userSkill.level === 'expert',
      advancedReporting: featureFlags?.enableAdvancedReporting && context.userSkill.behavior.efficiencyScore > 60
    };
    
    return features;
  }, [featureFlags, userPermissions, context]);
}

/**
 * USAGE EXAMPLES:
 * Replace all hardcoded arrays with dynamic hooks based on real user behavior.
 * 
 * Example transformations:
 * - Hardcoded statuses -> Dynamic statuses based on tenant config and user skill
 * - Hardcoded automation nodes -> Dynamic nodes based on permissions and skill level
 * - Hardcoded quick actions -> Dynamic actions based on real usage patterns
 */
