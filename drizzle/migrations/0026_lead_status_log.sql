-- Lead status change audit log
-- Tracks every status transition (auto and manual) for full lifecycle visibility
CREATE TABLE IF NOT EXISTS lead_status_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenantId INT NOT NULL,
  leadId INT NOT NULL,
  fromStatus VARCHAR(20) NOT NULL,
  toStatus VARCHAR(20) NOT NULL,
  `trigger` VARCHAR(100) NOT NULL,
  triggeredBy VARCHAR(50) NOT NULL,
  metadata JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX idx_lsl_tenant_lead (tenantId, leadId),
  INDEX idx_lsl_tenant_created (tenantId, createdAt),
  FOREIGN KEY (tenantId) REFERENCES tenants(id),
  FOREIGN KEY (leadId) REFERENCES leads(id)
);
