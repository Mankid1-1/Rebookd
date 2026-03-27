-- 🎯 REFERRAL SYSTEM MIGRATION
-- Creates tables for the referral program with $50 per 6-month subscription incentive

-- Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  referrer_id INT NOT NULL,
  referred_user_id INT NOT NULL,
  referral_code VARCHAR(16) NOT NULL UNIQUE,
  status ENUM('pending', 'completed', 'expired', 'cancelled') DEFAULT 'pending' NOT NULL,
  subscription_id VARCHAR(255),
  reward_amount INT DEFAULT 0 NOT NULL,
  reward_currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  completed_at TIMESTAMP NULL,
  expires_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  metadata JSON NULL,
  
  -- Indexes for performance
  INDEX idx_referrals_referrer_id (referrer_id),
  INDEX idx_referrals_referred_user_id (referred_user_id),
  INDEX idx_referrals_status (status),
  INDEX idx_referrals_expires_at (expires_at),
  
  -- Foreign key constraints
  FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create referral payouts table
CREATE TABLE IF NOT EXISTS referral_payouts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount INT NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending' NOT NULL,
  method ENUM('paypal', 'stripe', 'bank_transfer') DEFAULT 'paypal' NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  processed_at TIMESTAMP NULL,
  transaction_id VARCHAR(255) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  
  -- Indexes for performance
  INDEX idx_referral_payouts_user_id (user_id),
  INDEX idx_referral_payouts_status (status),
  INDEX idx_referral_payouts_created_at (created_at),
  
  -- Foreign key constraint
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create subscriptions table for Stripe integration
CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR(255) PRIMARY KEY,
  user_id INT NOT NULL,
  tenant_id INT NOT NULL,
  customer_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  price_id VARCHAR(255) NOT NULL,
  quantity INT DEFAULT 1,
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  
  -- Indexes for performance
  INDEX idx_subscriptions_user_id (user_id),
  INDEX idx_subscriptions_tenant_id (tenant_id),
  INDEX idx_subscriptions_customer_id (customer_id),
  INDEX idx_subscriptions_status (status),
  
  -- Foreign key constraints
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert sample referral program settings (optional)
INSERT IGNORE INTO settings (key, value, description) VALUES
('referral_reward_amount', '50', 'Amount rewarded per successful referral in USD'),
('referral_minimum_months', '6', 'Minimum subscription months required for referral reward'),
('referral_expiry_days', '90', 'Number of days before referral codes expire'),
('referral_program_enabled', 'true', 'Whether the referral program is currently enabled');

-- Create view for referral statistics
CREATE OR REPLACE VIEW referral_stats_view AS
SELECT 
  u.id as user_id,
  u.name as user_name,
  u.email as user_email,
  COUNT(r.id) as total_referrals,
  COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_referrals,
  COUNT(CASE WHEN r.status = 'pending' THEN 1 END) as pending_referrals,
  SUM(CASE WHEN r.status = 'completed' THEN r.reward_amount ELSE 0 END) as total_earned,
  SUM(CASE WHEN r.status = 'completed' THEN r.reward_amount ELSE 0 END) - 
    COALESCE(SUM(rp.amount), 0) as available_for_payout
FROM users u
LEFT JOIN referrals r ON u.id = r.referrer_id
LEFT JOIN referral_payouts rp ON u.id = rp.user_id AND rp.status = 'completed'
GROUP BY u.id, u.name, u.email;

-- Create trigger to automatically update referral status when subscription meets requirements
DELIMITER //
CREATE TRIGGER IF NOT EXISTS check_subscription_requirements
AFTER INSERT ON subscriptions
FOR EACH ROW
BEGIN
  DECLARE referral_count INT;
  DECLARE subscription_months INT;
  
  -- Check if this user has any pending referrals
  SELECT COUNT(*) INTO referral_count
  FROM referrals 
  WHERE referred_user_id = NEW.user_id AND status = 'pending';
  
  -- Calculate subscription duration (simplified - in production, use actual billing cycles)
  SET subscription_months = 6; -- Default to 6 months for new subscriptions
  
  -- If user has pending referrals and meets minimum months, complete them
  IF referral_count > 0 AND subscription_months >= 6 THEN
    UPDATE referrals 
    SET status = 'completed', 
        completed_at = CURRENT_TIMESTAMP,
        subscription_id = NEW.id,
        updated_at = CURRENT_TIMESTAMP
    WHERE referred_user_id = NEW.user_id AND status = 'pending';
  END IF;
END//
DELIMITER ;

-- Add comments for documentation
ALTER TABLE referrals COMMENT 'Referral program tracking table';
ALTER TABLE referral_payouts COMMENT 'Referral payout requests and history';
ALTER TABLE subscriptions COMMENT 'Stripe subscription tracking';

-- Success message
SELECT 'Referral system migration completed successfully!' as message;
