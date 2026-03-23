/**
 * 🧪 E2E TESTS
 * End-to-end tests for complete user workflows
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// Test data
const testUser = {
  email: 'test@example.com',
  password: 'testpassword123',
  name: 'Test User',
};

const testWorkflow = {
  name: 'Test Missed Call Workflow',
  description: 'Automatically respond to missed calls',
};

class AutomationPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/automation');
    await this.page.waitForLoadState('networkidle');
  }

  async createWorkflow(name: string, description: string) {
    // Click create workflow button
    await this.page.click('[data-testid="create-workflow"]');
    
    // Fill in workflow details
    await this.page.fill('[data-testid="workflow-name"]', name);
    await this.page.fill('[data-testid="workflow-description"]', description);
    
    // Save workflow
    await this.page.click('[data-testid="save-workflow"]');
    
    // Wait for success message
    await this.page.waitForSelector('[data-testid="success-message"]');
  }

  async addNodeToCanvas(nodeType: string) {
    // Find node in palette
    const nodeElement = this.page.locator(`[data-testid="node-${nodeType}"]`);
    await nodeElement.click();
    
    // Wait for node to appear on canvas
    await this.page.waitForSelector(`[data-testid="canvas-node-${nodeType}"]`);
  }

  async connectNodes(sourceNode: string, targetNode: string) {
    // Get source node output port
    const sourcePort = this.page.locator(`[data-testid="node-${sourceNode}-output"]`);
    const targetPort = this.page.locator(`[data-testid="node-${targetNode}-input"]`);
    
    // Drag from source to target
    await sourcePort.dragTo(targetPort);
    
    // Wait for connection to be created
    await this.page.waitForSelector('[data-testid="connection-created"]');
  }

  async executeWorkflow() {
    // Click execute button
    await this.page.click('[data-testid="execute-workflow"]');
    
    // Wait for execution to complete
    await this.page.waitForSelector('[data-testid="execution-complete"]');
  }

  async verifyWorkflowExists(name: string) {
    const workflowElement = this.page.locator(`[data-testid="workflow-${name}"]`);
    await expect(workflowElement).toBeVisible();
  }

  async verifyNodeOnCanvas(nodeType: string) {
    const nodeElement = this.page.locator(`[data-testid="canvas-node-${nodeType}"]`);
    await expect(nodeElement).toBeVisible();
  }

  async verifyConnectionExists() {
    const connectionElement = this.page.locator('[data-testid="workflow-connection"]');
    await expect(connectionElement).toBeVisible();
  }
}

class ProgressiveDisclosurePage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  async getCurrentComplexity() {
    const complexityElement = this.page.locator('[data-testid="current-complexity"]');
    return await complexityElement.textContent();
  }

  async getCurrentSkillLevel() {
    const skillElement = this.page.locator('[data-testid="current-skill"]');
    return await skillElement.textContent();
  }

  async adjustComplexity(level: string) {
    await this.page.click(`[data-testid="complexity-${level}"]`);
    await this.page.waitForSelector('[data-testid="complexity-updated"]');
  }

  async verifyFeatureVisible(featureId: string) {
    const featureElement = this.page.locator(`[data-testid="feature-${featureId}"]`);
    await expect(featureElement).toBeVisible();
  }

  async verifyFeatureHidden(featureId: string) {
    const featureElement = this.page.locator(`[data-testid="feature-${featureId}"]`);
    await expect(featureElement).not.toBeVisible();
  }

  async trackFeatureUsage(featureName: string) {
    await this.page.click(`[data-testid="track-${featureName}"]`);
    await this.page.waitForSelector('[data-testid="feature-tracked"]');
  }

  async verifyAdaptiveHintVisible(hintText: string) {
    const hintElement = this.page.locator(`[data-testid="hint"]:has-text("${hintText}")`);
    await expect(hintElement).toBeVisible();
  }

  async dismissHint(hintText: string) {
    const hintElement = this.page.locator(`[data-testid="hint"]:has-text("${hintText}")`);
    await hintElement.click('[data-testid="dismiss-hint"]');
    await expect(hintElement).not.toBeVisible();
  }
}

// E2E Test Suite
test.describe('Complete User Workflows', () => {
  let page: Page;
  let automationPage: AutomationPage;
  let disclosurePage: ProgressiveDisclosurePage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    automationPage = new AutomationPage(page);
    disclosurePage = new ProgressiveDisclosurePage(page);

    // Login
    await page.goto('/login');
    await page.fill('[data-testid="email"]', testUser.email);
    await page.fill('[data-testid="password"]', testUser.password);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('Beginner User Journey', () => {
    test('beginner user sees simplified interface', async () => {
      await disclosurePage.goto();
      
      // Should start with essential complexity
      const complexity = await disclosurePage.getCurrentComplexity();
      expect(complexity).toBe('Essential');
      
      const skillLevel = await disclosurePage.getCurrentSkillLevel();
      expect(skillLevel).toBe('Beginner');
      
      // Advanced features should be hidden
      await disclosurePage.verifyFeatureHidden('advanced-automation');
      await disclosurePage.verifyFeatureHidden('developer-tools');
      
      // Basic features should be visible
      await disclosurePage.verifyFeatureVisible('basic-dashboard');
      await disclosurePage.verifyFeatureVisible('simple-analytics');
    });

    test('beginner creates first simple workflow', async () => {
      await automationPage.goto();
      
      // Create simple missed call workflow
      await automationPage.createWorkflow(
        testWorkflow.name,
        testWorkflow.description
      );
      
      // Add basic trigger node
      await automationPage.addNodeToCanvas('missed-call');
      await automationPage.verifyNodeOnCanvas('missed-call');
      
      // Add basic action node
      await automationPage.addNodeToCanvas('send-sms');
      await automationPage.verifyNodeOnCanvas('send-sms');
      
      // Connect nodes
      await automationPage.connectNodes('missed-call', 'send-sms');
      await automationPage.verifyConnectionExists();
      
      // Save and execute
      await page.click('[data-testid="save-workflow"]');
      await page.waitForSelector('[data-testid="workflow-saved"]');
      
      await automationPage.executeWorkflow();
      await page.waitForSelector('[data-testid="execution-success"]');
    });

    test('beginner receives contextual hints', async () => {
      await disclosurePage.goto();
      
      // Should see beginner hints
      await disclosurePage.verifyAdaptiveHintVisible('Welcome to automation');
      await disclosurePage.verifyAdaptiveHintVisible('Try your first workflow');
      
      // Can dismiss hints
      await disclosurePage.dismissHint('Welcome to automation');
      await page.locator('[data-testid="hint"]:has-text("Welcome to automation")').waitFor({ state: 'hidden' });
    });
  });

  test.describe('Intermediate User Journey', () => {
    test.beforeEach(async () => {
      // Simulate user progression to intermediate
      await disclosurePage.goto();
      await disclosurePage.adjustComplexity('standard');
      
      // Track some feature usage to progress skill level
      await disclosurePage.trackFeatureUsage('dashboard');
      await disclosurePage.trackFeatureUsage('analytics');
      await disclosurePage.trackFeatureUsage('basic-automation');
    });

    test('intermediate user sees enhanced features', async () => {
      await disclosurePage.goto();
      
      const complexity = await disclosurePage.getCurrentComplexity();
      expect(complexity).toBe('Standard');
      
      // Should see more features
      await disclosurePage.verifyFeatureVisible('advanced-automation');
      await disclosurePage.verifyFeatureVisible('detailed-analytics');
      await disclosurePage.verifyFeatureVisible('custom-reports');
      
      // Developer tools still hidden
      await disclosurePage.verifyFeatureHidden('developer-tools');
    });

    test('intermediate creates complex workflow', async () => {
      await automationPage.goto();
      
      // Create multi-step workflow
      await automationPage.createWorkflow(
        'Advanced Lead Recovery',
        'Complex workflow with conditions and branches'
      );
      
      // Add trigger
      await automationPage.addNodeToCanvas('missed-call');
      
      // Add condition
      await automationPage.addNodeToCanvas('check-business-hours');
      
      // Add multiple actions
      await automationPage.addNodeToCanvas('send-sms');
      await automationPage.addNodeToCanvas('create-task');
      await automationPage.addNodeToCanvas('update-lead');
      
      // Create complex connections
      await automationPage.connectNodes('missed-call', 'check-business-hours');
      await automationPage.connectNodes('check-business-hours', 'send-sms');
      await automationPage.connectNodes('send-sms', 'create-task');
      await automationPage.connectNodes('create-task', 'update-lead');
      
      // Configure nodes
      await page.click('[data-testid="canvas-node-check-business-hours"]');
      await page.fill('[data-testid="config-timezone"]', 'America/New_York');
      await page.click('[data-testid="save-node-config"]');
      
      // Save and test
      await page.click('[data-testid="save-workflow"]');
      await page.waitForSelector('[data-testid="workflow-saved"]');
      
      await automationPage.executeWorkflow();
      await page.waitForSelector('[data-testid="execution-complete"]');
    });

    test('intermediate receives efficiency suggestions', async () => {
      await disclosurePage.goto();
      
      // Should see efficiency hints
      await disclosurePage.verifyAdaptiveHintVisible('Use templates to save time');
      await disclosurePage.verifyAdaptiveHintVisible('Consider automation rules');
    });
  });

  test.describe('Expert User Journey', () => {
    test.beforeEach(async () => {
      // Progress to expert level
      await disclosurePage.goto();
      await disclosurePage.adjustComplexity('expert');
      
      // Track extensive usage
      for (let i = 0; i < 10; i++) {
        await disclosurePage.trackFeatureUsage('advanced-automation');
        await disclosurePage.trackFeatureUsage('developer-tools');
      }
    });

    test('expert sees full feature set', async () => {
      await disclosurePage.goto();
      
      const complexity = await disclosurePage.getCurrentComplexity();
      expect(complexity).toBe('Expert');
      
      // All features should be visible
      await disclosurePage.verifyFeatureVisible('advanced-automation');
      await disclosurePage.verifyFeatureVisible('developer-tools');
      await disclosurePage.verifyFeatureVisible('api-access');
      await disclosurePage.verifyFeatureVisible('custom-scripts');
    });

    test('expert uses developer tools', async () => {
      await automationPage.goto();
      
      // Access developer tools
      await page.click('[data-testid="developer-tools"]');
      await page.waitForSelector('[data-testid="api-endpoints"]');
      
      // Test API endpoint
      await page.click('[data-testid="api-endpoints"]');
      await page.waitForSelector('[data-testid="endpoint-list"]');
      
      // Test debug tools
      await page.click('[data-testid="debug-tools"]');
      await page.waitForSelector('[data-testid="debug-console"]');
      
      // Should see advanced debugging options
      await expect(page.locator('[data-testid="workflow-tracing"]')).toBeVisible();
      await expect(page.locator('[data-testid="performance-metrics"]')).toBeVisible();
    });

    test('expert creates enterprise workflow', async () => {
      await automationPage.goto();
      
      // Create enterprise-level workflow
      await automationPage.createWorkflow(
        'Enterprise Multi-Location Automation',
        'Complex workflow with API integrations and custom logic'
      );
      
      // Add advanced nodes
      await automationPage.addNodeToCanvas('missed-call');
      await automationPage.addNodeToCanvas('webhook-integration');
      await automationPage.addNodeToCanvas('custom-logic');
      await automationPage.addNodeToCanvas('multi-branch');
      await automationPage.addNodeToCanvas('api-call');
      await automationPage.addNodeToCanvas('database-update');
      
      // Configure webhook integration
      await page.click('[data-testid="canvas-node-webhook-integration"]');
      await page.fill('[data-testid="config-webhook-url"]', 'https://api.example.com/webhook');
      await page.selectOption('[data-testid="config-method"]', 'POST');
      await page.click('[data-testid="save-node-config"]');
      
      // Configure custom logic
      await page.click('[data-testid="canvas-node-custom-logic"]');
      await page.fill('[data-testid="config-script"]', `
        function processLead(lead) {
          if (lead.value > 1000) {
            return 'high-priority';
          }
          return 'normal-priority';
        }
      `);
      await page.click('[data-testid="save-node-config"]');
      
      // Create complex branching logic
      await automationPage.connectNodes('missed-call', 'webhook-integration');
      await automationPage.connectNodes('webhook-integration', 'custom-logic');
      await automationPage.connectNodes('custom-logic', 'multi-branch');
      await automationPage.connectNodes('multi-branch', 'api-call');
      await automationPage.connectNodes('api-call', 'database-update');
      
      // Test workflow
      await page.click('[data-testid="test-workflow"]');
      await page.waitForSelector('[data-testid="test-results"]');
      
      // Should pass all tests
      await expect(page.locator('[data-testid="test-status"]')).toHaveText('PASSED');
    });
  });

  test.describe('Cross-System Integration', () => {
    test('progressive disclosure influences automation complexity', async () => {
      // Start as beginner
      await disclosurePage.goto();
      await disclosurePage.adjustComplexity('essential');
      
      await automationPage.goto();
      
      // Should see simplified automation interface
      await expect(page.locator('[data-testid="simple-node-palette"]')).toBeVisible();
      await expect(page.locator('[data-testid="advanced-node-palette"]')).not.toBeVisible();
      
      // Progress to expert
      await disclosurePage.goto();
      await disclosurePage.adjustComplexity('expert');
      
      await automationPage.goto();
      
      // Should see full automation interface
      await expect(page.locator('[data-testid="advanced-node-palette"]')).toBeVisible();
      await expect(page.locator('[data-testid="developer-tools"]')).toBeVisible();
    });

    test('automation usage influences skill progression', async () => {
      await automationPage.goto();
      
      // Use automation features extensively
      for (let i = 0; i < 5; i++) {
        await automationPage.createWorkflow(`Test Workflow ${i}`, `Description ${i}`);
        await automationPage.addNodeToCanvas('missed-call');
        await automationPage.addNodeToCanvas('send-sms');
        await automationPage.connectNodes('missed-call', 'send-sms');
        await page.click('[data-testid="save-workflow"]');
        await page.waitForSelector('[data-testid="workflow-saved"]');
      }
      
      await disclosurePage.goto();
      
      // Skill level should have progressed
      const skillLevel = await disclosurePage.getCurrentSkillLevel();
      expect(skillLevel).toBe('Intermediate');
      
      // Should receive achievement notification
      await disclosurePage.verifyAdaptiveHintVisible('Automation Master Achievement');
    });

    test('system maintains state consistency', async () => {
      // Set complexity in one system
      await disclosurePage.goto();
      await disclosurePage.adjustComplexity('advanced');
      
      // Verify consistency in automation system
      await automationPage.goto();
      await expect(page.locator('[data-testid="current-complexity"]')).toHaveText('Advanced');
      
      // Change complexity in automation system
      await page.click('[data-testid="complexity-expert"]');
      await page.waitForSelector('[data-testid="complexity-updated"]');
      
      // Verify consistency in disclosure system
      await disclosurePage.goto();
      const complexity = await disclosurePage.getCurrentComplexity();
      expect(complexity).toBe('Expert');
    });
  });

  test.describe('Performance and Reliability', () => {
    test('handles large workflows efficiently', async () => {
      await automationPage.goto();
      
      // Create workflow with many nodes
      await automationPage.createWorkflow('Large Workflow', 'Performance test workflow');
      
      // Add 50 nodes
      for (let i = 0; i < 50; i++) {
        await automationPage.addNodeToCanvas('send-sms');
      }
      
      // Performance should remain acceptable
      const startTime = Date.now();
      await page.click('[data-testid="save-workflow"]');
      await page.waitForSelector('[data-testid="workflow-saved"]');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should save within 5 seconds
    });

    test('recovers from errors gracefully', async () => {
      await automationPage.goto();
      
      // Simulate network error
      await page.route('/api/workflows', route => route.abort());
      
      // Attempt to save workflow
      await automationPage.createWorkflow('Error Test', 'Test error handling');
      await page.click('[data-testid="save-workflow"]');
      
      // Should show error message
      await page.waitForSelector('[data-testid="error-message"]');
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Failed to save');
      
      // System should remain functional
      await page.unroute('/api/workflows');
      await page.click('[data-testid="retry-save"]');
      await page.waitForSelector('[data-testid="workflow-saved"]');
    });

    test('maintains responsiveness under load', async () => {
      await disclosurePage.goto();
      
      // Simulate rapid complexity changes
      for (let i = 0; i < 20; i++) {
        await disclosurePage.adjustComplexity(i % 2 === 0 ? 'expert' : 'essential');
        await page.waitForTimeout(100);
      }
      
      // UI should remain responsive
      await expect(page.locator('[data-testid="current-complexity"]')).toBeVisible();
      await expect(page.locator('[data-testid="current-skill"]')).toBeVisible();
    });
  });
});
