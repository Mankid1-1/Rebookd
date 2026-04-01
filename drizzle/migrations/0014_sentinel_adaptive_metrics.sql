-- Sentinel Adaptive Metrics: time-series observations + learned baselines
-- Used by 6 sentinel capabilities to observe, learn, and adapt thresholds per tenant.

CREATE TABLE IF NOT EXISTS sentinel_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenantId INT NOT NULL DEFAULT 0,
  category VARCHAR(50) NOT NULL,
  metric VARCHAR(100) NOT NULL,
  value DOUBLE NOT NULL,
  detail JSON,
  measuredAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sm_tenant_cat (tenantId, category),
  INDEX idx_sm_measured (measuredAt),
  INDEX idx_sm_metric (metric, measuredAt)
);

CREATE TABLE IF NOT EXISTS sentinel_baselines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenantId INT NOT NULL DEFAULT 0,
  metric VARCHAR(100) NOT NULL,
  p50 DOUBLE NOT NULL,
  p95 DOUBLE NOT NULL,
  sampleCount INT NOT NULL DEFAULT 0,
  computedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sb_tenant_metric (tenantId, metric)
);
