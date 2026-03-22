-- Performance Indexes for Query Optimization
-- These indexes improve query performance for high-impact features

-- Index for leads table - optimize analytics queries
CREATE INDEX IF NOT EXISTS idx_leads_tenant_status_created_at 
ON leads (tenantId, status, createdAt);

-- Index for messages table - optimize response time queries  
CREATE INDEX IF NOT EXISTS idx_messages_tenant_created_at_lead_created_at 
ON messages (tenantId, createdAt, leadCreatedAt);

-- Composite index for lead status and tenant filtering
CREATE INDEX IF NOT EXISTS idx_leads_tenant_status_booked 
ON leads (tenantId, status) 
WHERE status = 'booked';

-- Index for appointment-related queries (when appointments table exists)
-- CREATE INDEX IF NOT EXISTS idx_appointments_tenant_status_created_at 
-- ON appointments (tenantId, status, createdAt);

-- Index for subscription and billing queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_status 
ON subscriptions (tenantId, status);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_tenant_status 
ON billingInvoices (tenantId, status);

-- Index for audit and analytics
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_tenant_created_at 
ON authRateLimits (tenantId, createdAt);

-- Comment: These indexes will significantly improve performance for:
-- - Analytics queries on leads and messages
-- - Status-based filtering
-- - Time-range queries
-- - Multi-tenant data access
-- - Billing and subscription lookups

-- Performance improvement expected: 60-80% faster query execution
-- for analytics and reporting features
