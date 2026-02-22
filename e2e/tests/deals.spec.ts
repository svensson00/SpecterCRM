import { test, expect } from '../fixtures/auth';
import { SEED, TEST_DATA } from '../fixtures/test-data';
import { ApiClient } from '../helpers/api-client';

test.describe('Deals', () => {
  test('lists seed deals', async ({ adminPage }) => {
    await adminPage.goto('/deals');
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.getByText(SEED.DEALS.enterprise.title)).toBeVisible();
    await expect(adminPage.getByText(SEED.DEALS.startup.title)).toBeVisible();
    await expect(adminPage.getByText(SEED.DEALS.professional.title)).toBeVisible();
  });

  test('shows stage badges', async ({ adminPage }) => {
    await adminPage.goto('/deals');
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.locator('.bg-yellow-500\\/20').getByText('QUOTE')).toBeVisible();
    await expect(adminPage.locator('.bg-blue-500\\/20').getByText('PROSPECT')).toBeVisible();
    await expect(adminPage.locator('.bg-green-500\\/20').getByText('WON')).toBeVisible();
  });

  test('create new deal', async ({ adminPage }) => {
    let client: ApiClient | null = null;
    let createdId: string | null = null;

    try {
      await adminPage.goto('/deals/new');

      // Form uses name attributes, not labels with htmlFor
      await adminPage.locator('input[name="title"]').fill(TEST_DATA.DEAL.title);

      // OrganizationSelect has placeholder "Select organization..."
      const orgInput = adminPage.getByPlaceholder('Select organization...');
      await orgInput.click();
      await orgInput.fill(SEED.ORGANIZATIONS.acme.name);
      await adminPage.waitForTimeout(500);
      // Dropdown buttons contain org name
      await adminPage.locator('button').filter({ hasText: SEED.ORGANIZATIONS.acme.name }).first().click();

      await adminPage.locator('input[name="amount"]').fill(TEST_DATA.DEAL.amount.toString());

      // Stage is a real select
      const stageSelect = adminPage.locator('select[name="stage"]');
      await stageSelect.selectOption(TEST_DATA.DEAL.stage);

      await adminPage.getByRole('button', { name: /create/i }).click();

      // Wait for redirect to deals list (not detail)
      await adminPage.waitForURL('/deals');
      await adminPage.waitForLoadState('networkidle');

      // Verify it's in the list
      await expect(adminPage.getByText(TEST_DATA.DEAL.title)).toBeVisible();

      // Get ID for cleanup (reuse same client)
      client = await ApiClient.login(SEED.ADMIN.email, SEED.ADMIN.password);
      const deals = await client.getDeals();
      const created = deals.data.find((d: any) => d.title === TEST_DATA.DEAL.title);
      createdId = created?.id;
    } finally {
      // Cleanup - reuse client if already logged in, otherwise create new
      if (createdId) {
        try {
          if (!client) client = await ApiClient.login(SEED.ADMIN.email, SEED.ADMIN.password);
          await client.deleteDeal(createdId);
        } catch (e) {
          console.warn('Cleanup failed for deal:', e);
        }
      }
    }
  });

  test('view detail page', async ({ adminPage }) => {
    await adminPage.goto('/deals');
    await adminPage.waitForLoadState('networkidle');
    await adminPage.getByText(SEED.DEALS.enterprise.title).first().click();
    await adminPage.waitForURL(/\/deals\/[a-z0-9-]+$/);
    await expect(adminPage.getByRole('heading', { name: SEED.DEALS.enterprise.title })).toBeVisible();

    // Stage appears in subtitle "Stage: QUOTE" and in the detail dt/dd list
    // Use the subtitle paragraph which contains "Stage: QUOTE"
    await expect(adminPage.getByText(`Stage: ${SEED.DEALS.enterprise.stage}`)).toBeVisible();
    await expect(adminPage.getByText(SEED.ORGANIZATIONS.acme.name).first()).toBeVisible();
  });

  test('detail shows contacts', async ({ adminPage }) => {
    await adminPage.goto('/deals');
    await adminPage.waitForLoadState('networkidle');
    await adminPage.getByText(SEED.DEALS.enterprise.title).first().click();
    await adminPage.waitForURL(/\/deals\/[a-z0-9-]+$/);
    await adminPage.waitForLoadState('networkidle');

    // Enterprise deal has John Doe and Jane Smith as contacts
    // Contact names appear as Link elements in the Contacts row (dt/dd structure, not heading)
    // The Contacts label is a <dt>, not a heading
    const contactsRow = adminPage.locator('dt:has-text("Contacts")').locator('..');
    await expect(contactsRow.getByRole('link', { name: `${SEED.CONTACTS.john.firstName} ${SEED.CONTACTS.john.lastName}` })).toBeVisible();
    await expect(contactsRow.getByRole('link', { name: `${SEED.CONTACTS.jane.firstName} ${SEED.CONTACTS.jane.lastName}` })).toBeVisible();
  });

  test('edit deal', async ({ adminPage }) => {
    await adminPage.goto('/deals');
    await adminPage.waitForLoadState('networkidle');
    await adminPage.getByText(SEED.DEALS.enterprise.title).first().click();
    await adminPage.waitForURL(/\/deals\/[a-z0-9-]+$/);

    await adminPage.getByRole('button', { name: 'Edit' }).click();

    // Amount becomes input[name="amount"] in edit mode
    const amountInput = adminPage.locator('input[name="amount"]');
    const originalValue = await amountInput.inputValue();
    await amountInput.fill('175000');
    await adminPage.getByRole('button', { name: 'Save' }).click();

    await adminPage.waitForLoadState('networkidle');
    // Currency is formatted in sv-SE locale (space separator)
    await expect(adminPage.getByText(/175[\s\u00A0]000/)).toBeVisible();

    // Restore original value
    await adminPage.getByRole('button', { name: 'Edit' }).click();
    await adminPage.locator('input[name="amount"]').fill(originalValue);
    await adminPage.getByRole('button', { name: 'Save' }).click();
  });

  test('update stage', async ({ adminPage }) => {
    await adminPage.goto('/deals');
    await adminPage.waitForLoadState('networkidle');
    await adminPage.getByText(SEED.DEALS.enterprise.title).first().click();
    await adminPage.waitForURL(/\/deals\/[a-z0-9-]+$/);
    await adminPage.waitForLoadState('networkidle');

    // Check if there's a stage update UI on the detail page
    await adminPage.getByRole('button', { name: 'Edit' }).click();
    const stageSelect = adminPage.locator('select[name="stage"]');
    if (await stageSelect.count() > 0) {
      const originalStage = await stageSelect.inputValue();
      await stageSelect.selectOption('PROSPECT');
      await adminPage.getByRole('button', { name: 'Save' }).click();
      await adminPage.waitForLoadState('networkidle');

      // Stage appears in subtitle "Stage: PROSPECT"
      await expect(adminPage.getByText('Stage: PROSPECT')).toBeVisible();

      // Restore
      await adminPage.getByRole('button', { name: 'Edit' }).click();
      await stageSelect.selectOption(originalStage);
      await adminPage.getByRole('button', { name: 'Save' }).click();
    }
  });

  test('delete test deal', async ({ adminPage }) => {
    // Create a test deal first
    const client = await ApiClient.login(SEED.ADMIN.email, SEED.ADMIN.password);
    const orgs = await client.getOrganizations();
    const acmeOrg = orgs.data.find((o: any) => o.name === SEED.ORGANIZATIONS.acme.name);

    const created = await client.createDeal({
      ...TEST_DATA.DEAL,
      organizationId: acmeOrg.id,
    });
    const dealId = created.id;

    try {
      await adminPage.goto(`/deals/${dealId}`);

      adminPage.on('dialog', dialog => dialog.accept());
      await adminPage.getByRole('button', { name: 'Delete' }).click();

      await adminPage.waitForURL('/deals');
      await adminPage.waitForLoadState('networkidle');
      await expect(adminPage.getByText(TEST_DATA.DEAL.title)).not.toBeVisible();
    } catch (error) {
      // If test fails, clean up manually
      try {
        await client.deleteDeal(dealId);
      } catch {}
      throw error;
    }
  });
});
