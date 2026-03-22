-- Add promotional pricing columns to plans table
ALTER TABLE plans ADD COLUMN promotionalSlots INT DEFAULT 0 AFTER revenueSharePercent;
ALTER TABLE plans ADD COLUMN promotionalPriceCap INT DEFAULT 0 AFTER promotionalSlots;
ALTER TABLE plans ADD COLUMN hasPromotion BOOLEAN DEFAULT FALSE AFTER promotionalPriceCap;

-- Add promotional tracking to subscriptions table
ALTER TABLE subscriptions ADD COLUMN isPromotional BOOLEAN DEFAULT FALSE AFTER status;
ALTER TABLE subscriptions ADD COLUMN promotionalExpiresAt TIMESTAMP NULL AFTER isPromotional;

-- Update Professional plan with first 50 clients promotion
UPDATE plans SET 
  promotionalSlots = 50,
  promotionalPriceCap = 19900, -- $199 in cents
  hasPromotion = TRUE
WHERE slug = 'professional';

-- Create index for promotional slot tracking
CREATE INDEX idx_plans_promotional ON plans(hasPromotion, promotionalSlots);
CREATE INDEX idx_subscriptions_promotional ON subscriptions(isPromotional, promotionalExpiresAt);
