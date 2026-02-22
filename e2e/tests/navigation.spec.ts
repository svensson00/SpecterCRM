import { test, expect } from '../fixtures/auth';
import { SEED } from '../fixtures/test-data';

test.describe('Navigation', () => {
  test('admin nav shows all links', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    await expect(adminPage.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(adminPage.getByRole('link', { name: 'Organizations' })).toBeVisible();
    await expect(adminPage.getByRole('link', { name: 'Contacts' })).toBeVisible();
    await expect(adminPage.getByRole('link', { name: 'Deals' })).toBeVisible();
    await expect(adminPage.getByRole('link', { name: 'Pipeline' })).toBeVisible();
    await expect(adminPage.getByRole('link', { name: 'Activities' })).toBeVisible();
    await expect(adminPage.getByRole('link', { name: 'Reports' })).toBeVisible();
    await expect(adminPage.getByRole('button', { name: 'Admin' })).toBeVisible();
  });

  test('sales nav hides Admin', async ({ salesPage }) => {
    await salesPage.goto('/dashboard');
    await expect(salesPage.getByRole('button', { name: 'Admin' })).not.toBeVisible();
  });

  test('admin dropdown shows sub-links', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');

    // Hover over Admin button to reveal dropdown (CSS group-hover)
    const adminButton = adminPage.getByRole('button', { name: 'Admin' });
    await adminButton.hover();

    // Wait for dropdown to appear
    await adminPage.waitForTimeout(300);

    await expect(adminPage.getByRole('link', { name: 'Users' })).toBeVisible();
    await expect(adminPage.getByRole('link', { name: 'Settings' })).toBeVisible();
    await expect(adminPage.getByRole('link', { name: 'Deduplication' })).toBeVisible();
    await expect(adminPage.getByRole('link', { name: 'Audit Logs' })).toBeVisible();
    await expect(adminPage.getByRole('link', { name: 'Import Data' })).toBeVisible();
  });

  test('nav links navigate correctly', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');

    await adminPage.getByRole('link', { name: 'Organizations' }).click();
    await expect(adminPage).toHaveURL(/\/organizations/);

    await adminPage.getByRole('link', { name: 'Deals' }).click();
    await expect(adminPage).toHaveURL(/\/deals/);

    await adminPage.getByRole('link', { name: 'Pipeline' }).click();
    await expect(adminPage).toHaveURL(/\/pipeline/);
  });

  test('user name in top right', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    await expect(adminPage.getByRole('link', { name: SEED.ADMIN.firstName })).toBeVisible();
  });

  test('logo links to dashboard', async ({ adminPage }) => {
    await adminPage.goto('/organizations');
    await adminPage.getByRole('link', { name: 'SpecterCRM' }).click();
    await expect(adminPage).toHaveURL(/\/dashboard/);
  });
});
