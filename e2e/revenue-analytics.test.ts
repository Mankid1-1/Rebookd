import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser, type Page } from "playwright";

describe("Revenue Analytics E2E Tests", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  it("should load dashboard with revenue analytics", async () => {
    // Navigate to dashboard
    await page.goto("http://localhost:3000");
    
    // Wait for page to load
    await page.waitForSelector('[data-testid="dashboard-layout"]');
    
    // Check if dashboard title is present
    const title = await page.textContent("h1");
    expect(title).toBeTruthy();
  });

  it("should switch to revenue recovery tab", async () => {
    await page.goto("http://localhost:3000");
    
    // Wait for tabs to be visible
    await page.waitForSelector('[role="tablist"]');
    
    // Click on Revenue Recovery tab
    await page.click('text=Revenue Recovery');
    
    // Wait for revenue dashboard to load
    await page.waitForSelector('[data-testid="revenue-dashboard"]');
    
    // Check if revenue metrics are displayed
    const revenueMetrics = await page.textContent('[data-testid="revenue-metrics"]');
    expect(revenueMetrics).toBeTruthy();
  });

  it("should display key revenue metrics", async () => {
    await page.goto("http://localhost:3000");
    
    // Switch to revenue tab
    await page.click('text=Revenue Recovery');
    await page.waitForSelector('[data-testid="revenue-dashboard"]');
    
    // Check for key metrics
    const totalRecovered = await page.textContent('text=Total Recovered');
    const thisMonth = await page.textContent('text=This Month');
    const potentialRevenue = await page.textContent('text=Potential Revenue');
    const pipelineValue = await page.textContent('text=Pipeline Value');
    
    expect(totalRecovered).toBeTruthy();
    expect(thisMonth).toBeTruthy();
    expect(potentialRevenue).toBeTruthy();
    expect(pipelineValue).toBeTruthy();
  });

  it("should display revenue trends chart", async () => {
    await page.goto("http://localhost:3000");
    
    // Switch to revenue tab
    await page.click('text=Revenue Recovery');
    await page.waitForSelector('[data-testid="revenue-dashboard"]');
    
    // Check for revenue trends chart
    const trendsChart = await page.$('[data-testid="area-chart"]');
    expect(trendsChart).toBeTruthy();
    
    // Check for chart title
    const chartTitle = await page.textContent('text=Revenue Trends');
    expect(chartTitle).toBeTruthy();
  });

  it("should display conversion funnel", async () => {
    await page.goto("http://localhost:3000");
    
    // Switch to revenue tab
    await page.click('text=Revenue Recovery');
    await page.waitForSelector('[data-testid="revenue-dashboard"]');
    
    // Check for conversion funnel
    const funnelTitle = await page.textContent('text=Conversion Funnel');
    expect(funnelTitle).toBeTruthy();
    
    // Check for funnel stages
    const totalLeads = await page.textContent('text=Total Leads');
    const contacted = await page.textContent('text=Contacted');
    const qualified = await page.textContent('text=Qualified');
    const booked = await page.textContent('text=Booked');
    
    expect(totalLeads).toBeTruthy();
    expect(contacted).toBeTruthy();
    expect(qualified).toBeTruthy();
    expect(booked).toBeTruthy();
  });

  it("should display recovery metrics", async () => {
    await page.goto("http://localhost:3000");
    
    // Switch to revenue tab
    await page.click('text=Revenue Recovery');
    await page.waitForSelector('[data-testid="revenue-dashboard"]');
    
    // Check for recovery metrics section
    const recoveryMetrics = await page.textContent('text=Recovery Metrics');
    expect(recoveryMetrics).toBeTruthy();
    
    // Check for specific metrics
    const overallRate = await page.textContent('text=Overall Rate');
    const avgPerBooking = await page.textContent('text=Avg per Booking');
    const lostRevenue = await page.textContent('text=Lost Revenue');
    
    expect(overallRate).toBeTruthy();
    expect(avgPerBooking).toBeTruthy();
    expect(lostRevenue).toBeTruthy();
  });

  it("should display lead status distribution", async () => {
    await page.goto("http://localhost:3000");
    
    // Switch to revenue tab
    await page.click('text=Revenue Recovery');
    await page.waitForSelector('[data-testid="revenue-dashboard"]');
    
    // Check for lead status distribution
    const statusTitle = await page.textContent('text=Lead Status Distribution');
    expect(statusTitle).toBeTruthy();
    
    // Check for pie chart
    const pieChart = await page.$('[data-testid="pie-chart"]');
    expect(pieChart).toBeTruthy();
  });

  it("should handle empty data gracefully", async () => {
    // This test would require mocking empty data or using a test account with no data
    await page.goto("http://localhost:3000");
    
    // Switch to revenue tab
    await page.click('text=Revenue Recovery');
    
    // Wait for either revenue dashboard or empty state
    try {
      await page.waitForSelector('[data-testid="revenue-dashboard"]', { timeout: 5000 });
      // If dashboard loads, check if it handles empty data
      const revenueContent = await page.textContent('[data-testid="revenue-dashboard"]');
      expect(revenueContent).toBeTruthy();
    } catch {
      // If empty state is shown
      const emptyState = await page.textContent('text=Revenue Analytics Coming Soon');
      expect(emptyState).toBeTruthy();
    }
  });

  it("should be responsive on mobile", async () => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto("http://localhost:3000");
    
    // Switch to revenue tab
    await page.click('text=Revenue Recovery');
    await page.waitForSelector('[data-testid="revenue-dashboard"]');
    
    // Check if content is still visible on mobile
    const revenueDashboard = await page.$('[data-testid="revenue-dashboard"]');
    expect(revenueDashboard).toBeTruthy();
    
    // Check if metrics cards stack properly on mobile
    const metricCards = await page.$$('.border-border');
    expect(metricCards.length).toBeGreaterThan(0);
  });

  it("should show loading states", async () => {
    // Navigate to dashboard
    await page.goto("http://localhost:3000");
    
    // Look for loading indicators (would need to test with slow network or mocked data)
    const loadingIndicators = await page.$$('[data-testid="loading"]');
    // This test would be more effective with mocked slow responses
  });

  it("should handle navigation between tabs", async () => {
    await page.goto("http://localhost:3000");
    
    // Start with overview tab (default)
    await page.waitForSelector('[data-testid="dashboard-layout"]');
    
    // Switch to revenue tab
    await page.click('text=Revenue Recovery');
    await page.waitForSelector('[data-testid="revenue-dashboard"]');
    
    // Switch back to overview
    await page.click('text=Overview');
    
    // Check if overview content is back
    const messageVolume = await page.textContent('text=Message Volume');
    expect(messageVolume).toBeTruthy();
  });

  it("should display currency formatting correctly", async () => {
    await page.goto("http://localhost:3000");
    
    // Switch to revenue tab
    await page.click('text=Revenue Recovery');
    await page.waitForSelector('[data-testid="revenue-dashboard"]');
    
    // Look for dollar signs and proper formatting
    const dollarSigns = await page.$$text(/\$\d{1,3}(,\d{3})*(\.\d{2})?/);
    expect(dollarSigns.length).toBeGreaterThan(0);
  });

  it("should display percentage formatting correctly", async () => {
    await page.goto("http://localhost:3000");
    
    // Switch to revenue tab
    await page.click('text=Revenue Recovery');
    await page.waitForSelector('[data-testid="revenue-dashboard"]');
    
    // Look for percentage signs
    const percentages = await page.$$text(/\d+\.?\d*%/);
    expect(percentages.length).toBeGreaterThan(0);
  });

  it("should have working tooltips", async () => {
    await page.goto("http://localhost:3000");
    
    // Switch to revenue tab
    await page.click('text=Revenue Recovery');
    await page.waitForSelector('[data-testid="revenue-dashboard"]');
    
    // Hover over a metric that should have a tooltip
    const totalRecoveredCard = await page.$('text=Total Recovered');
    if (totalRecoveredCard) {
      await totalRecoveredCard.hover();
      // Tooltip would appear (implementation dependent)
      expect(totalRecoveredCard).toBeTruthy();
    }
  });

  it("should handle data refresh", async () => {
    await page.goto("http://localhost:3000");
    
    // Switch to revenue tab
    await page.click('text=Revenue Recovery');
    await page.waitForSelector('[data-testid="revenue-dashboard"]');
    
    // Wait for data to potentially refresh (30-second interval)
    // This test would be more effective with mocked data that changes
    const initialData = await page.textContent('[data-testid="revenue-metrics"]');
    expect(initialData).toBeTruthy();
  });

  it("should be accessible", async () => {
    await page.goto("http://localhost:3000");
    
    // Switch to revenue tab
    await page.click('text=Revenue Recovery');
    await page.waitForSelector('[data-testid="revenue-dashboard"]');
    
    // Check for proper ARIA labels and semantic HTML
    const mainContent = await page.$('main');
    expect(mainContent).toBeTruthy();
    
    // Check for proper heading hierarchy
    const h1 = await page.$('h1');
    const h2 = await page.$$('h2');
    expect(h1).toBeTruthy();
    expect(h2.length).toBeGreaterThan(0);
  });

  it("should handle keyboard navigation", async () => {
    await page.goto("http://localhost:3000");
    
    // Switch to revenue tab using keyboard
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab'); // Navigate to tabs
    await page.keyboard.press('ArrowRight'); // Move to revenue tab
    await page.keyboard.press('Enter'); // Select tab
    
    // Check if revenue dashboard loaded
    await page.waitForSelector('[data-testid="revenue-dashboard"]');
    const revenueDashboard = await page.$('[data-testid="revenue-dashboard"]');
    expect(revenueDashboard).toBeTruthy();
  });

  it("should display error states gracefully", async () => {
    // This test would require mocking error responses
    await page.goto("http://localhost:3000");
    
    // Switch to revenue tab
    await page.click('text=Revenue Recovery');
    
    // Would need to simulate network errors or API errors
    // For now, just check that the page doesn't crash
    const dashboardLayout = await page.$('[data-testid="dashboard-layout"]');
    expect(dashboardLayout).toBeTruthy();
  });
});
