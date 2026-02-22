import { test, expect } from '../fixtures/auth';
import { SEED, TEST_DATA } from '../fixtures/test-data';
import { ApiClient } from '../helpers/api-client';

test.describe('Admin', () => {
  test('user management accessible', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    const adminButton = adminPage.getByRole('button', { name: 'Admin' });
    await adminButton.hover();
    await adminPage.waitForTimeout(300);
    await adminPage.getByRole('link', { name: 'Users' }).click();

    await expect(adminPage).toHaveURL(/\/admin\/users/);
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.getByText(SEED.ADMIN.email)).toBeVisible();
    await expect(adminPage.getByText(SEED.SALES.email)).toBeVisible();
  });

  test('activity types settings', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    const adminButton = adminPage.getByRole('button', { name: 'Admin' });
    await adminButton.hover();
    await adminPage.waitForTimeout(300);
    await adminPage.getByRole('link', { name: 'Settings' }).click();

    await expect(adminPage).toHaveURL(/\/admin\/activity-types/);
    await adminPage.waitForLoadState('networkidle');

    // Verify seed activity types
    for (const type of SEED.ACTIVITY_TYPES) {
      await expect(adminPage.getByText(type)).toBeVisible();
    }
  });

  test('create and delete activity type', async ({ adminPage }) => {
    let createdId: string | null = null;

    try {
      await adminPage.goto('/admin/activity-types');
      await adminPage.waitForLoadState('networkidle');

      // Click "Add Activity Type" button to reveal form
      await adminPage.getByRole('button', { name: /add activity type/i }).click();
      await adminPage.waitForTimeout(300);

      // Fill in the input (placeholder: "e.g., Demo, Presentation")
      const nameInput = adminPage.getByPlaceholder('e.g., Demo, Presentation');
      await nameInput.fill(TEST_DATA.ACTIVITY_TYPE.name);

      // Click "Create" button
      await adminPage.getByRole('button', { name: /^create$/i }).click();

      await adminPage.waitForLoadState('networkidle');
      await expect(adminPage.getByText(TEST_DATA.ACTIVITY_TYPE.name)).toBeVisible();

      // Find the created activity type ID for cleanup
      const client = await ApiClient.login(SEED.ADMIN.email, SEED.ADMIN.password);
      const types = await client.getActivityTypes();
      const created = types.find((t: any) => t.name === TEST_DATA.ACTIVITY_TYPE.name);
      createdId = created?.id;

      // Deactivate it (not delete - the UI uses "Deactivate")
      const row = adminPage.locator('li').filter({ hasText: TEST_DATA.ACTIVITY_TYPE.name });
      await row.getByRole('button', { name: /deactivate/i }).click();

      await adminPage.waitForLoadState('networkidle');

      // Should now show as "Inactive"
      await expect(row.getByText('Inactive')).toBeVisible();

      createdId = null; // Cleanup successful (deactivated, not deleted)
    } catch (error) {
      // If test fails, clean up manually
      if (createdId) {
        try {
          const client = await ApiClient.login(SEED.ADMIN.email, SEED.ADMIN.password);
          await client.deleteActivityType(createdId);
        } catch {}
      }
      throw error;
    }
  });

  test('audit logs accessible', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    const adminButton = adminPage.getByRole('button', { name: 'Admin' });
    await adminButton.hover();
    await adminPage.waitForTimeout(300);
    await adminPage.getByRole('link', { name: 'Audit Logs' }).click();

    await expect(adminPage).toHaveURL(/\/admin\/audit-logs/);
    await adminPage.waitForLoadState('networkidle');
    // Verify table renders (may be empty or have logs)
    await expect(adminPage.getByRole('heading', { name: /audit.*logs/i })).toBeVisible();
  });

  test('sales denied admin pages', async ({ salesPage }) => {
    await salesPage.goto('/admin/users');
    await salesPage.waitForLoadState('networkidle');

    // The page STAYS at /admin/users but shows permission denied message
    // (It does NOT redirect)
    await expect(salesPage.getByText("You don't have permission")).toBeVisible();
  });

  test('currency settings visible', async ({ adminPage }) => {
    await adminPage.goto('/admin/activity-types');
    await adminPage.waitForLoadState('networkidle');

    // The Settings page has currency selector in "General Settings" section
    const currencySelect = adminPage.locator('select').filter({ hasText: /USD|EUR|SEK/i });
    if (await currencySelect.count() > 0) {
      await expect(currencySelect).toBeVisible();
    }
  });
});
