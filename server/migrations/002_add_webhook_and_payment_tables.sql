-- 🎯 WEBHOOK AND PAYMENT EVENT MIGRATION
-- Creates tables for webhook event logging and payment tracking

-- Create webhook events table for audit logging
CREATE TABLE IF NOT EXISTS webhook_events (
  id VARCHAR(255) PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  status ENUM('processed', 'failed', 'pending') DEFAULT 'pending' NOT NULL,
  error TEXT NULL,
  payload JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  processed_at TIMESTAMP NULL,
  
  -- Indexes for performance
  INDEX idx_webhook_events_event_type (event_type),
  INDEX idx_webhook_events_event_id (event_id),
  INDEX idx_webhook_events_status (status),
  INDEX idx_webhook_events_created_at (created_at)
);

-- Create payment events table for tracking all payment activities
CREATE TABLE IF NOT EXISTS payment_events (
  id VARCHAR(255) PRIMARY KEY,
  customer_id VARCHAR(255) NOT NULL,
  subscription_id VARCHAR(255) NULL,
  amount INT NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
  status ENUM('pending', 'paid', 'failed', 'refunded', 'partially_refunded') NOT NULL,
  invoice_id VARCHAR(255) NULL,
  payment_intent_id VARCHAR(255) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  processed_at TIMESTAMP NULL,
  
  -- Indexes for performance
  INDEX idx_payment_events_customer_id (customer_id),
  INDEX idx_payment_events_subscription_id (subscription_id),
  INDEX idx_payment_events_status (status),
  INDEX idx_payment_events_created_at (created_at),
  INDEX idx_payment_events_invoice_id (invoice_id)
);

-- Add stripe_customer_id to users table if not exists
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) NULL,
ADD INDEX IF NOT EXISTS idx_users_stripe_customer_id (stripe_customer_id);

-- Create subscription usage tracking table for metered billing
CREATE TABLE IF NOT EXISTS subscription_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subscription_id VARCHAR(255) NOT NULL,
  subscription_item_id VARCHAR(255) NOT NULL,
  customer_id VARCHAR(255) NOT NULL,
  usage_amount INT NOT NULL,
  usage_type VARCHAR(50) NOT NULL DEFAULT 'recovered_revenue',
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  -- Indexes for performance
  INDEX idx_subscription_usage_subscription_id (subscription_id),
  INDEX idx_subscription_usage_customer_id (customer_id),
  INDEX idx_subscription_usage_period (period_start, period_end),
  INDEX idx_subscription_usage_created_at (created_at),
  
  -- Foreign key constraints
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

-- Create meter event history table for detailed tracking
CREATE TABLE IF NOT EXISTS meter_events (
  id VARCHAR(255) PRIMARY KEY,
  customer_id VARCHAR(255) NOT NULL,
  subscription_id VARCHAR(255) NULL,
  subscription_item_id VARCHAR(255) NULL,
  event_name VARCHAR(100) NOT NULL,
  value INT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  -- Indexes for performance
  INDEX idx_meter_events_customer_id (customer_id),
  INDEX idx_meter_events_subscription_id (subscription_id),
  INDEX idx_meter_events_event_name (event_name),
  INDEX idx_meter_events_timestamp (timestamp),
  INDEX idx_meter_events_created_at (created_at)
);

-- Add additional columns to subscriptions table for better tracking
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP NULL,
ADD COLUMN IF NOTENDED_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS latest_invoice_id VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS payment_method_id VARCHAR(255) NULL;

-- Create views for analytics and reporting

-- Customer subscription summary view
CREATE OR REPLACE VIEW customer_subscription_summary AS
SELECT 
  u.id as user_id,
  u.email as customer_email,
  u.stripe_customer_id,
  s.id as subscription_id,
  s.status as subscription_status,
  s.current_period_start,
  s.current_period_end,
  s.cancel_at_period_end,
  s.created_at as subscription_created_at,
  CASE 
    WHEN s.status = 'active' AND s.cancel_at_period_end = false THEN 'active'
    WHEN s.status = 'active' AND s.cancel_at_period_end = true THEN 'canceling'
    WHEN s.status = 'past_due' THEN 'past_due'
    WHEN s.status = 'canceled' THEN 'canceled'
    WHEN s.status = 'trialing' THEN 'trial'
    ELSE s.status
  END as subscription_health,
  -- Calculate MRR (Monthly Recurring Revenue)
  COALESCE(
    (SELECT SUM(amount / 100) FROM payment_events 
     WHERE subscription_id = s.id AND status = 'paid' 
     AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)), 0
  ) as mrr,
  -- Calculate total revenue from this customer
  COALESCE(
    (SELECT SUM(amount / 100) FROM payment_events 
     WHERE customer_id = u.stripe_customer_id AND status = 'paid'), 0
  ) as total_revenue
FROM users u
LEFT JOIN subscriptions s ON u.stripe_customer_id = s.customer_id
WHERE u.stripe_customer_id IS NOT NULL;

-- Monthly revenue summary view
CREATE OR REPLACE VIEW monthly_revenue_summary AS
SELECT 
  DATE_FORMAT(created_at, '%Y-%m') as month,
  COUNT(DISTINCT customer_id) as paying_customers,
  SUM(CASE WHEN status = 'paid' THEN amount / 100 ELSE 0 END) as total_revenue,
  SUM(CASE WHEN status = 'paid' AND amount > 0 THEN 1 ELSE 0 END) as successful_payments,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_payments,
  AVG(CASE WHEN status = 'paid' THEN amount / 100 ELSE NULL END) as average_payment_amount
FROM payment_events
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
GROUP BY DATE_FORMAT(created_at, '%Y-%m')
ORDER BY month DESC;

-- Subscription churn analysis view
CREATE OR REPLACE VIEW subscription_churn_analysis AS
SELECT 
  DATE_FORMAT(canceled_at, '%Y-%m') as month,
  COUNT(*) as canceled_subscriptions,
  COUNT(DISTINCT customer_id) as unique_customers_lost,
  AVG(DATEDIFF(canceled_at, created_at)) as avg_subscription_lifetime_days,
  SUM(CASE 
    WHEN (SELECT SUM(amount / 100) FROM payment_events 
         WHERE customer_id = s.customer_id AND status = 'paid') > 0 
    THEN 1 ELSE 0 
  END) as paying_customers_lost
FROM subscriptions s
WHERE s.canceled_at IS NOT NULL
  AND s.canceled_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
GROUP BY DATE_FORMAT(canceled_at, '%Y-%m')
ORDER BY month DESC;

-- Usage metrics view for metered billing
CREATE OR REPLACE VIEW usage_metrics_summary AS
SELECT 
  DATE_FORMAT(created_at, '%Y-%m') as month,
  event_name,
  COUNT(*) as total_events,
  SUM(value) as total_usage,
  AVG(value) as average_usage,
  COUNT(DISTINCT customer_id) as unique_customers
FROM meter_events
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
GROUP BY DATE_FORMAT(created_at, '%Y-%m'), event_name
ORDER BY month DESC, total_usage DESC;

-- Create triggers for automatic data maintenance

-- Trigger to log subscription status changes
DELIMITER //
CREATE TRIGGER IF NOT EXISTS log_subscription_status_change
AFTER UPDATE ON subscriptions
FOR EACH ROW
BEGIN
  IF OLD.status != NEW.status THEN
    INSERT INTO webhook_events (id, event_type, event_id, status, payload, created_at)
    VALUES (
      UUID(),
      CONCAT('customer.subscription.', NEW.status),
      NEW.id,
      'processed',
      JSON_OBJECT(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'subscription_id', NEW.id,
        'customer_id', NEW.customer_id,
        'timestamp', NOW()
      ),
      NOW()
    );
  END IF;
END//
DELIMITER ;

-- Trigger to log payment events
DELIMITER //
CREATE TRIGGER IF NOT EXISTS log_payment_event
AFTER INSERT ON payment_events
FOR EACH ROW
BEGIN
  INSERT INTO webhook_events (id, event_type, event_id, status, payload, created_at)
  VALUES (
    UUID(),
    CONCAT('invoice.', NEW.status),
    NEW.id,
    'processed',
    JSON_OBJECT(
      'payment_event_id', NEW.id,
      'customer_id', NEW.customer_id,
      'subscription_id', NEW.subscription_id,
      'amount', NEW.amount,
      'currency', NEW.currency,
      'status', NEW.status,
      'timestamp', NOW()
    ),
    NOW()
  );
END//
DELIMITER ;

-- Insert sample configuration settings
INSERT IGNORE INTO settings (key, value, description) VALUES
('webhook_secret', '', 'Stripe webhook secret for event verification'),
('webhook_tolerance', '300', 'Webhook event tolerance in seconds'),
('payment_retry_attempts', '3', 'Number of payment retry attempts'),
('usage_reporting_enabled', 'true', 'Whether usage reporting is enabled'),
('customer_portal_enabled', 'true', 'Whether customer portal is enabled');

-- Create stored procedures for common operations

-- Procedure to calculate customer lifetime value
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS CalculateCustomerLifetimeValue(IN customer_uuid VARCHAR(255))
BEGIN
  SELECT 
    customer_uuid,
    COUNT(*) as total_payments,
    SUM(CASE WHEN status = 'paid' THEN amount / 100 ELSE 0 END) as total_revenue,
    AVG(CASE WHEN status = 'paid' THEN amount / 100 ELSE NULL END) as average_payment,
    MIN(created_at) as first_payment_date,
    MAX(created_at) as last_payment_date,
    DATEDIFF(MAX(created_at), MIN(created_at)) as customer_lifetime_days
  FROM payment_events
  WHERE customer_id = customer_uuid AND status = 'paid'
  GROUP BY customer_uuid;
END//
DELIMITER ;

-- Procedure to get subscription health metrics
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS GetSubscriptionHealthMetrics()
BEGIN
  SELECT 
    COUNT(*) as total_subscriptions,
    SUM(CASE WHEN status = 'active' AND cancel_at_period_end = false THEN 1 ELSE 0 END) as active_subscriptions,
    SUM(CASE WHEN status = 'active' AND cancel_at_period_end = true THEN 1 ELSE 0 END) as canceling_subscriptions,
    SUM(CASE WHEN status = 'past_due' THEN 1 ELSE 0 END) as past_due_subscriptions,
    SUM(CASE WHEN status = 'trialing' THEN 1 ELSE 0 END) as trial_subscriptions,
    SUM(CASE WHEN status = 'canceled' THEN 1 ELSE 0 END) as canceled_subscriptions,
    ROUND(
      (SUM(CASE WHEN status = 'active' AND cancel_at_period_end = false THEN 1 ELSE 0 END) / 
       NULLIF(COUNT(*), 0)) * 100, 2
    ) as active_percentage,
    ROUND(
      (SUM(CASE WHEN status = 'canceled' THEN 1 ELSE 0 END) / 
       NULLIF(COUNT(*), 0)) * 100, 2
    ) as churn_rate
  FROM subscriptions;
END//
DELIMITER ;

-- Add comments for documentation
ALTER TABLE webhook_events COMMENT 'Audit log for all Stripe webhook events';
ALTER TABLE payment_events COMMENT 'Payment transaction history and tracking';
ALTER TABLE subscription_usage COMMENT 'Usage tracking for metered billing subscriptions';
ALTER TABLE meter_events COMMENT 'Detailed meter event history for usage-based billing';

-- Success message
SELECT 'Webhook and payment event tables migration completed successfully!' as message;
