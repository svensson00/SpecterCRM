import { test, expect } from '../fixtures/auth';
import { SEED } from '../fixtures/test-data';

test.describe('Dashboard', () => {
  test('displays main sections', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    await expect(adminPage.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
    await expect(adminPage.getByText('Pipeline by Stage')).toBeVisible();
    await expect(adminPage.getByText('Hot Deals')).toBeVisible();
    await expect(adminPage.getByText('Activity Volume')).toBeVisible();
  });

  test('shows pipeline stages', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    await adminPage.waitForLoadState('networkidle');

    // Pipeline stages are displayed in the Pipeline by Stage section
    // All stages appear (LEAD, PROSPECT, QUOTE, WON, LOST) with counts
    // "WON" also appears in "Won/Lost Period:" label, so use exact match
    await expect(adminPage.getByText('PROSPECT', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('QUOTE', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('WON', { exact: true })).toBeVisible();
  });

  test('shows hot deals', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    await adminPage.waitForLoadState('networkidle');
    const hotDealsSection = adminPage.locator('.card', { has: adminPage.getByText('Hot Deals') });
    // Should show deals with closest expected close dates (non-WON/LOST)
    await expect(hotDealsSection.getByText(SEED.DEALS.enterprise.title)).toBeVisible();
    await expect(hotDealsSection.getByText(SEED.DEALS.startup.title)).toBeVisible();
  });

  test('shows activity volume', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    await adminPage.waitForLoadState('networkidle');

    // Activity volume table has these headers
    const activitySection = adminPage.locator('.card', { has: adminPage.getByText('Activity Volume') });

    // Check for table headers or verify section has data
    const hasData = await activitySection.getByText('Type', { exact: true }).isVisible();
    if (hasData) {
      await expect(activitySection.getByText('Total', { exact: true })).toBeVisible();
      await expect(activitySection.getByText('Completed', { exact: true })).toBeVisible();
      await expect(activitySection.getByText('Completion Rate')).toBeVisible();
    } else {
      // If no data, should show empty state message
      await expect(activitySection.getByText(/no activity data available/i)).toBeVisible();
    }
  });

  test('pipeline filter works', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    await adminPage.waitForLoadState('networkidle');
    const pipelineSelect = adminPage.locator('#pipeline-period');
    await pipelineSelect.selectOption('this-week');
    // No error should occur
    await expect(adminPage.locator('.bg-red-50, .bg-red-500')).not.toBeVisible();
  });
});
