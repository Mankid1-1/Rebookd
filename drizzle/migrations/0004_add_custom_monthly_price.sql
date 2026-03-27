-- Add customMonthlyPrice to subscriptions (Flex plan per-tier pricing)
ALTER TABLE subscriptions ADD COLUMN customMonthlyPrice INT NULL AFTER isPromotional;
