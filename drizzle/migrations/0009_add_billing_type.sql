-- Add billingType enum to tenants table
-- Distinguishes Founder (free-forever, 20 slots), Flex (10-slot trial), Standard ($199/mo)
ALTER TABLE tenants
  ADD COLUMN billingType ENUM('founder','flex','standard') NOT NULL DEFAULT 'standard' AFTER `plan`;

CREATE INDEX tenants_billing_type_idx ON tenants(billingType);

-- Backfill from existing subscription data
UPDATE tenants t
  JOIN subscriptions s ON s.tenantId = t.id
  SET t.billingType = CASE
    WHEN s.guaranteeCohort = 'risk_free_20' THEN 'founder'
    WHEN s.guaranteeCohort = 'flex_10' THEN 'flex'
    ELSE 'standard'
  END;
