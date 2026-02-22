import { test, expect } from '../fixtures/auth';
import { SEED, TEST_DATA } from '../fixtures/test-data';
import { ApiClient } from '../helpers/api-client';

test.describe('Activities', () => {
  test('lists seed activities', async ({ adminPage }) => {
    await adminPage.goto('/activities');
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.getByText(SEED.ACTIVITIES.discovery.subject)).toBeVisible();
    await expect(adminPage.getByText(SEED.ACTIVITIES.demo.subject)).toBeVisible();
    await expect(adminPage.getByText(SEED.ACTIVITIES.followup.subject)).toBeVisible();
  });

  test('create new activity', async ({ adminPage }) => {
    let client: ApiClient | null = null;
    let createdId: string | null = null;

    try {
      await adminPage.goto('/activities/new');

      // Type selection
      const typeSelect = adminPage.locator('select[name="type"]');
      await typeSelect.selectOption(TEST_DATA.ACTIVITY.type);

      // Forms use name attributes, not labels with htmlFor
      await adminPage.locator('input[name="subject"]').fill(TEST_DATA.ACTIVITY.subject);
      await adminPage.locator('textarea[name="description"]').fill(TEST_DATA.ACTIVITY.description);

      // OrganizationMultiSelect has placeholder "Search organizations..."
      const orgInput = adminPage.getByPlaceholder('Search organizations...');
      await orgInput.click();
      await orgInput.fill(SEED.ORGANIZATIONS.acme.name);
      await adminPage.waitForTimeout(500);
      // Dropdown items are buttons containing org name
      await adminPage.locator('button').filter({ hasText: SEED.ORGANIZATIONS.acme.name }).first().click();

      await adminPage.getByRole('button', { name: /create/i }).click();

      // Wait for redirect to activities list
      await adminPage.waitForURL('/activities');
      await adminPage.waitForLoadState('networkidle');

      // Verify it's in the list
      await expect(adminPage.getByText(TEST_DATA.ACTIVITY.subject)).toBeVisible();

      // Get ID for cleanup (reuse same client)
      client = await ApiClient.login(SEED.ADMIN.email, SEED.ADMIN.password);
      const activities = await client.getActivities();
      const actList = Array.isArray(activities) ? activities : activities.data;
      const created = actList.find((a: any) => a.subject === TEST_DATA.ACTIVITY.subject);
      createdId = created?.id;
    } finally {
      // Cleanup - reuse client if already logged in, otherwise create new
      if (createdId) {
        try {
          if (!client) client = await ApiClient.login(SEED.ADMIN.email, SEED.ADMIN.password);
          await client.deleteActivity(createdId);
        } catch (e) {
          console.warn('Cleanup failed for activity:', e);
        }
      }
    }
  });

  test('view detail page', async ({ adminPage }) => {
    await adminPage.goto('/activities');
    await adminPage.waitForLoadState('networkidle');

    // Activity subject is a link in the table
    await adminPage.getByRole('link', { name: SEED.ACTIVITIES.discovery.subject }).click();
    await adminPage.waitForURL(/\/activities\/[a-z0-9-]+$/);
    await expect(adminPage.getByRole('heading', { name: SEED.ACTIVITIES.discovery.subject })).toBeVisible();

    // Type appears in subtitle "Type: Call" and also in the detail dt/dd list
    // Use the subtitle text which is unique
    await expect(adminPage.getByText(`Type: ${SEED.ACTIVITIES.discovery.type}`)).toBeVisible();
  });

  test('toggle completion', async ({ adminPage }) => {
    await adminPage.goto('/activities');
    await adminPage.waitForLoadState('networkidle');

    // Find the Product Demo activity (not completed)
    const demoRow = adminPage.locator('tr', { has: adminPage.getByText(SEED.ACTIVITIES.demo.subject) });
    const checkbox = demoRow.locator('input[type="checkbox"]');

    const initialState = await checkbox.isChecked();
    await checkbox.click();
    await adminPage.waitForLoadState('networkidle');

    // Verify state changed
    await expect(checkbox).toBeChecked({ checked: !initialState });

    // Toggle back
    await checkbox.click();
    await adminPage.waitForLoadState('networkidle');
    await expect(checkbox).toBeChecked({ checked: initialState });
  });

  test('edit activity', async ({ adminPage }) => {
    await adminPage.goto('/activities');
    await adminPage.waitForLoadState('networkidle');
    await adminPage.getByRole('link', { name: SEED.ACTIVITIES.discovery.subject }).click();
    await adminPage.waitForURL(/\/activities\/[a-z0-9-]+$/);

    // Main "Edit" button — use exact match to avoid "Edit Organization", "Edit Deal", etc.
    await adminPage.getByRole('button', { name: 'Edit', exact: true }).click();

    // In edit mode, description becomes textarea[name="description"]
    const descriptionInput = adminPage.locator('textarea[name="description"]');
    const originalValue = await descriptionInput.inputValue();
    await descriptionInput.fill('Updated description for E2E test');
    await adminPage.getByRole('button', { name: 'Save' }).click();

    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.getByText('Updated description for E2E test')).toBeVisible();

    // Restore original value
    await adminPage.getByRole('button', { name: 'Edit', exact: true }).click();
    await adminPage.locator('textarea[name="description"]').fill(originalValue);
    await adminPage.getByRole('button', { name: 'Save' }).click();
  });

  test('filter by status', async ({ adminPage }) => {
    await adminPage.goto('/activities');
    await adminPage.waitForLoadState('networkidle');

    // Click "Completed" filter button
    await adminPage.getByRole('button', { name: 'Completed', exact: true }).click();
    await adminPage.waitForLoadState('networkidle');

    // Should show only completed activities
    await expect(adminPage.getByText(SEED.ACTIVITIES.discovery.subject)).toBeVisible();
    // Demo and Follow-up are not completed
    await expect(adminPage.getByText(SEED.ACTIVITIES.demo.subject)).not.toBeVisible();
  });

  test('delete test activity', async ({ adminPage }) => {
    // Create a test activity first
    const client = await ApiClient.login(SEED.ADMIN.email, SEED.ADMIN.password);
    const orgs = await client.getOrganizations();
    const acmeOrg = orgs.data.find((o: any) => o.name === SEED.ORGANIZATIONS.acme.name);

    const created = await client.createActivity({
      ...TEST_DATA.ACTIVITY,
      organizationIds: [acmeOrg.id],
    });
    const activityId = created.id;

    try {
      await adminPage.goto(`/activities/${activityId}`);

      adminPage.on('dialog', dialog => dialog.accept());
      await adminPage.getByRole('button', { name: 'Delete' }).click();

      await adminPage.waitForURL('/activities');
      await adminPage.waitForLoadState('networkidle');
      await expect(adminPage.getByText(TEST_DATA.ACTIVITY.subject)).not.toBeVisible();
    } catch (error) {
      // If test fails, clean up manually
      try {
        await client.deleteActivity(activityId);
      } catch {}
      throw error;
    }
  });
});
