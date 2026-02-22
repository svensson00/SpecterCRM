import { test, expect } from '../fixtures/auth';

test.describe('Reports', () => {
  test('page loads', async ({ adminPage }) => {
    await adminPage.goto('/reports');
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.getByRole('heading', { name: /reports.*analytics/i })).toBeVisible();
  });

  test('pipeline report section renders', async ({ adminPage }) => {
    await adminPage.goto('/reports');
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.getByText('Pipeline by Stage')).toBeVisible();

    // Table headers - scope to pipeline section to avoid nav link collision
    const pipelineSection = adminPage.locator('.card', { has: adminPage.getByText('Pipeline by Stage').first() });
    await expect(pipelineSection.getByRole('columnheader', { name: 'Stage' })).toBeVisible();
    await expect(pipelineSection.getByRole('columnheader', { name: 'Count' })).toBeVisible();
    await expect(pipelineSection.getByRole('columnheader', { name: 'Total Value' })).toBeVisible();
    await expect(pipelineSection.getByRole('columnheader', { name: 'Avg Value' })).toBeVisible();
  });

  test('win rate section renders', async ({ adminPage }) => {
    await adminPage.goto('/reports');
    await adminPage.waitForLoadState('networkidle');

    // Win Rate section heading
    await expect(adminPage.getByRole('heading', { name: 'Win Rate Overview' })).toBeVisible();

    // Scope to Win Rate section for label checks
    const winRateSection = adminPage.locator('.card', { has: adminPage.getByRole('heading', { name: 'Win Rate Overview' }) });
    await expect(winRateSection.getByText('Total Deals')).toBeVisible();
    await expect(winRateSection.getByText('Won', { exact: true })).toBeVisible();
    await expect(winRateSection.getByText('Lost')).toBeVisible();
    // "Win Rate" appears as both h2 and p - use more specific selector
    await expect(winRateSection.locator('p').filter({ hasText: /^Win Rate$/ })).toBeVisible();
  });

  test('date filter works', async ({ adminPage }) => {
    await adminPage.goto('/reports');
    await adminPage.waitForLoadState('networkidle');

    // Find and use the date filter select
    const dateSelect = adminPage.locator('select').filter({ hasText: /all time|this week|this month/i }).first();
    await dateSelect.selectOption('this-month');

    // No error should occur
    await expect(adminPage.locator('.bg-red-50, .bg-red-500')).not.toBeVisible();
  });
});
