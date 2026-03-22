-- Add revenue share column to plans table
ALTER TABLE plans ADD COLUMN revenueSharePercent INT DEFAULT 0 NOT NULL AFTER stripePriceId;

-- Update existing plans with new pricing
UPDATE plans SET 
  priceMonthly = 19900,
  revenueSharePercent = 15,
  name = 'Professional',
  slug = 'professional'
WHERE slug = 'starter' OR slug = 'growth';

UPDATE plans SET 
  priceMonthly = 0,
  revenueSharePercent = 10,
  name = 'Enterprise',
  slug = 'enterprise'
WHERE slug = 'scale';

-- Remove old starter plan if it exists
DELETE FROM plans WHERE slug = 'starter' AND name != 'Professional';

-- Update free plan to ensure it has no revenue share
UPDATE plans SET revenueSharePercent = 0 WHERE slug = 'free';
