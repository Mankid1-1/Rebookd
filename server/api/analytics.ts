/**
 * 📊 ANALYTICS API
 * Real-time dashboard analytics and metrics
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { Db } from '../_core/context';

// Schema definitions
const getDashboardStatsSchema = z.object({
  tenantId: z.number(),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
});

const getRevenueAnalyticsSchema = z.object({
  tenantId: z.number(),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
});

const getLeadAnalyticsSchema = z.object({
  tenantId: z.number(),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
});

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(db: Db, input: z.infer<typeof getDashboardStatsSchema>) {
  try {
    const { tenantId, dateRange } = input;
    
    // Date filtering
    const dateFilter = dateRange ? 
      `AND DATE(created_at) BETWEEN '${dateRange.start}' AND '${dateRange.end}'` : 
      `AND DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;

    // Get leads statistics
    const leadsStats = await (db as any).select({
      total: 'COUNT(*)',
      booked: 'SUM(CASE WHEN status = "booked" THEN 1 ELSE 0 END)',
      contacted: 'SUM(CASE WHEN status = "contacted" THEN 1 ELSE 0 END)',
      pending: 'SUM(CASE WHEN status = "pending" THEN 1 ELSE 0 END)',
    })
      .from('leads')
      .where('tenant_id', '=', tenantId)
      .whereRaw(`1=1 ${dateFilter}`);

    // Get messages statistics
    const messagesStats = await (db as any).select({
      total: 'COUNT(*)',
      sent: 'SUM(CASE WHEN direction = "outbound" THEN 1 ELSE 0 END)',
      received: 'SUM(CASE WHEN direction = "inbound" THEN 1 ELSE 0 END)',
      delivered: 'SUM(CASE WHEN delivery_status = "delivered" THEN 1 ELSE 0 END)',
    })
      .from('messages')
      .where('tenant_id', '=', tenantId)
      .whereRaw(`1=1 ${dateFilter}`);

    // Get revenue statistics
    const revenueStats = await (db as any).select({
      totalRevenue: 'SUM(CASE WHEN revenue > 0 THEN revenue ELSE 0 END)',
      averageRevenue: 'AVG(CASE WHEN revenue > 0 THEN revenue ELSE NULL END)',
      recoveredRevenue: 'SUM(CASE WHEN status = "booked" AND revenue > 0 THEN revenue ELSE 0 END)',
    })
      .from('leads')
      .where('tenant_id', '=', tenantId)
      .whereRaw(`1=1 ${dateFilter}`);

    // Get conversion rates
    const totalLeads = Number(leadsStats[0]?.total || 0);
    const bookedLeads = Number(leadsStats[0]?.booked || 0);
    const conversionRate = totalLeads > 0 ? (bookedLeads / totalLeads) * 100 : 0;

    // Get today's stats
    const todayStats = await (db as any).select({
      leadsToday: 'COUNT(*)',
      messagesToday: '(SELECT COUNT(*) FROM messages WHERE tenant_id = ? AND DATE(created_at) = CURDATE())',
    })
      .from('leads')
      .where('tenant_id', '=', tenantId)
      .where('DATE(created_at)', '=', 'CURDATE()');

    return {
      overview: {
        totalLeads: Number(leadsStats[0]?.total || 0),
        bookedLeads: Number(leadsStats[0]?.booked || 0),
        contactedLeads: Number(leadsStats[0]?.contacted || 0),
        pendingLeads: Number(leadsStats[0]?.pending || 0),
        conversionRate: Math.round(conversionRate * 100) / 100,
      },
      messaging: {
        totalMessages: Number(messagesStats[0]?.total || 0),
        messagesSent: Number(messagesStats[0]?.sent || 0),
        messagesReceived: Number(messagesStats[0]?.received || 0),
        messagesDelivered: Number(messagesStats[0]?.delivered || 0),
      },
      revenue: {
        totalRevenue: Number(revenueStats[0]?.totalRevenue || 0),
        averageRevenue: Number(revenueStats[0]?.averageRevenue || 0),
        recoveredRevenue: Number(revenueStats[0]?.recoveredRevenue || 0),
      },
      today: {
        leadsToday: Number(todayStats[0]?.leadsToday || 0),
        messagesToday: Number(todayStats[0]?.messagesToday || 0),
      },
    };
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get dashboard statistics',
    });
  }
}

/**
 * Get revenue analytics with time series data
 */
export async function getRevenueAnalytics(db: Db, input: z.infer<typeof getRevenueAnalyticsSchema>) {
  try {
    const { tenantId, dateRange } = input;
    
    // Date filtering
    const dateFilter = dateRange ? 
      `AND DATE(created_at) BETWEEN '${dateRange.start}' AND '${dateRange.end}'` : 
      `AND DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;

    // Get daily revenue data
    const dailyRevenue = await (db as any).select({
      date: 'DATE(created_at)',
      revenue: 'SUM(CASE WHEN revenue > 0 THEN revenue ELSE 0 END)',
      bookings: 'SUM(CASE WHEN status = "booked" THEN 1 ELSE 0 END)',
    })
      .from('leads')
      .where('tenant_id', '=', tenantId)
      .whereRaw(`1=1 ${dateFilter}`)
      .groupBy('DATE(created_at)')
      .orderBy('DATE(created_at)', 'asc');

    // Get revenue by source
    const revenueBySource = await (db as any).select({
      source: 'COALESCE(source, "unknown")',
      revenue: 'SUM(CASE WHEN revenue > 0 THEN revenue ELSE 0 END)',
      count: 'COUNT(*)',
    })
      .from('leads')
      .where('tenant_id', '=', tenantId)
      .whereRaw(`1=1 ${dateFilter}`)
      .where('revenue', '>', 0)
      .groupBy('source')
      .orderBy('revenue', 'desc');

    return {
      dailyData: dailyRevenue.map(item => ({
        date: item.date,
        revenue: Number(item.revenue || 0),
        bookings: Number(item.bookings || 0),
      })),
      bySource: revenueBySource.map(item => ({
        source: item.source,
        revenue: Number(item.revenue || 0),
        count: Number(item.count || 0),
      })),
    };
  } catch (error) {
    console.error('Error getting revenue analytics:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get revenue analytics',
    });
  }
}

/**
 * Get lead analytics with conversion funnel
 */
export async function getLeadAnalytics(db: Db, input: z.infer<typeof getLeadAnalyticsSchema>) {
  try {
    const { tenantId, dateRange } = input;
    
    // Date filtering
    const dateFilter = dateRange ? 
      `AND DATE(created_at) BETWEEN '${dateRange.start}' AND '${dateRange.end}'` : 
      `AND DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;

    // Get lead status distribution
    const statusDistribution = await (db as any).select({
      status: 'status',
      count: 'COUNT(*)',
    })
      .from('leads')
      .where('tenant_id', '=', tenantId)
      .whereRaw(`1=1 ${dateFilter}`)
      .groupBy('status')
      .orderBy('count', 'desc');

    // Get daily lead creation data
    const dailyLeads = await (db as any).select({
      date: 'DATE(created_at)',
      total: 'COUNT(*)',
      booked: 'SUM(CASE WHEN status = "booked" THEN 1 ELSE 0 END)',
      contacted: 'SUM(CASE WHEN status = "contacted" THEN 1 ELSE 0 END)',
    })
      .from('leads')
      .where('tenant_id', '=', tenantId)
      .whereRaw(`1=1 ${dateFilter}`)
      .groupBy('DATE(created_at)')
      .orderBy('DATE(created_at)', 'asc');

    // Get conversion funnel
    const funnelData = await (db as any).select({
      stage: 'status',
      count: 'COUNT(*)',
      conversionRate: '(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM leads WHERE tenant_id = ? AND DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)))',
    })
      .from('leads')
      .where('tenant_id', '=', tenantId)
      .whereRaw(`1=1 ${dateFilter}`)
      .groupBy('status')
      .orderBy('count', 'desc');

    return {
      statusDistribution: statusDistribution.map(item => ({
        status: item.status,
        count: Number(item.count || 0),
      })),
      dailyData: dailyLeads.map(item => ({
        date: item.date,
        total: Number(item.total || 0),
        booked: Number(item.booked || 0),
        contacted: Number(item.contacted || 0),
      })),
      funnel: funnelData.map(item => ({
        stage: item.stage,
        count: Number(item.count || 0),
        conversionRate: Number(item.conversionRate || 0),
      })),
    };
  } catch (error) {
    console.error('Error getting lead analytics:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get lead analytics',
    });
  }
}

/**
 * Get real-time activity feed
 */
export async function getActivityFeed(db: Db, tenantId: number, limit: number = 20) {
  try {
    // Get recent leads
    const recentLeads = await (db as any).select({
      id: 'id',
      name: 'name',
      phone: 'phone',
      status: 'status',
      revenue: 'revenue',
      createdAt: 'created_at',
      type: 'lead',
    })
      .from('leads')
      .where('tenant_id', '=', tenantId)
      .orderBy('created_at', 'desc')
      .limit(limit);

    // Get recent messages
    const recentMessages = await (db as any).select({
      id: 'id',
      leadId: 'lead_id',
      content: 'body',
      direction: 'direction',
      deliveryStatus: 'delivery_status',
      createdAt: 'created_at',
      type: 'message',
    })
      .from('messages')
      .where('tenant_id', '=', tenantId)
      .orderBy('created_at', 'desc')
      .limit(limit);

    // Combine and sort by date
    const combined = [
      ...recentLeads.map(lead => ({
        ...lead,
        title: `New Lead: ${lead.name}`,
        description: `Status: ${lead.status} ${lead.revenue ? `• $${lead.revenue}` : ''}`,
      })),
      ...recentMessages.map(message => ({
        ...message,
        title: `${message.direction === 'outbound' ? 'Sent' : 'Received'} Message`,
        description: message.content?.substring(0, 100) || 'No content',
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

    return combined;
  } catch (error) {
    console.error('Error getting activity feed:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get activity feed',
    });
  }
}
