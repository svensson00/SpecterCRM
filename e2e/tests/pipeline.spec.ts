import { test, expect } from '../fixtures/auth';
import { SEED } from '../fixtures/test-data';

test.describe('Pipeline', () => {
  test('shows stage columns', async ({ adminPage }) => {
    await adminPage.goto('/pipeline');
    await adminPage.waitForLoadState('networkidle');

    // Pipeline board only has 3 columns: Lead, Prospect, Quote (NOT WON or LOST)
    // Column headers are h2 elements (not semantic headings with role="heading")
    await expect(adminPage.locator('h2').filter({ hasText: 'Lead' })).toBeVisible();
    await expect(adminPage.locator('h2').filter({ hasText: 'Prospect' })).toBeVisible();
    await expect(adminPage.locator('h2').filter({ hasText: 'Quote' })).toBeVisible();
  });

  test('deals in correct columns', async ({ adminPage }) => {
    await adminPage.goto('/pipeline');
    await adminPage.waitForLoadState('networkidle');

    // Enterprise Platform License should be in Quote column
    const quoteColumn = adminPage.locator('div').filter({ hasText: 'Quote' }).first();
    await expect(quoteColumn.locator('..').getByText(SEED.DEALS.enterprise.title)).toBeVisible();

    // Startup Package should be in Prospect column
    const prospectColumn = adminPage.locator('div').filter({ hasText: 'Prospect' }).first();
    await expect(prospectColumn.locator('..').getByText(SEED.DEALS.startup.title)).toBeVisible();
  });

  test('cards show org and amount', async ({ adminPage }) => {
    await adminPage.goto('/pipeline');
    await adminPage.waitForLoadState('networkidle');

    // Find a deal card and verify it shows organization and amount
    const enterpriseCard = adminPage.locator('.card').filter({ hasText: SEED.DEALS.enterprise.title }).first();
    await expect(enterpriseCard.getByText(SEED.ORGANIZATIONS.acme.name)).toBeVisible();
    // Amount should be formatted with currency (sv-SE format with space)
    await expect(enterpriseCard.locator('text=/150[\\s\u00A0]000|\\$150,?000/')).toBeVisible();
  });

  test('card click navigates to detail', async ({ adminPage }) => {
    await adminPage.goto('/pipeline');
    await adminPage.waitForLoadState('networkidle');

    // Click on the 3-dot menu button, then "View Details"
    const enterpriseCard = adminPage.locator('.card').filter({ hasText: SEED.DEALS.enterprise.title }).first();

    // Click the 3-dot button
    await enterpriseCard.locator('button[title="Options"]').click();

    // Click "View Details" from dropdown - use exact match to avoid matching other buttons
    await adminPage.getByRole('button', { name: 'View Details', exact: true }).click();

    await adminPage.waitForURL(/\/deals\/[a-z0-9-]+$/);
    await expect(adminPage.getByRole('heading', { name: SEED.DEALS.enterprise.title })).toBeVisible();
  });
});
