import { test, expect } from '../fixtures/auth';
import { SEED, TEST_DATA } from '../fixtures/test-data';
import { ApiClient } from '../helpers/api-client';

test.describe('Organizations', () => {
  test('lists seed organizations', async ({ adminPage }) => {
    await adminPage.goto('/organizations');
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.getByText(SEED.ORGANIZATIONS.acme.name)).toBeVisible();
    await expect(adminPage.getByText(SEED.ORGANIZATIONS.techstart.name)).toBeVisible();
    await expect(adminPage.getByText(SEED.ORGANIZATIONS.global.name)).toBeVisible();
  });

  test('search filters list', async ({ adminPage }) => {
    await adminPage.goto('/organizations');
    await adminPage.waitForLoadState('networkidle');
    const searchInput = adminPage.getByPlaceholder('Search organizations...');
    await searchInput.fill('Acme');
    await expect(adminPage.getByText(SEED.ORGANIZATIONS.acme.name)).toBeVisible();
    await expect(adminPage.getByText(SEED.ORGANIZATIONS.techstart.name)).not.toBeVisible();
  });

  test('create new organization', async ({ adminPage }) => {
    let client: ApiClient | null = null;
    let createdId: string | null = null;

    try {
      await adminPage.goto('/organizations/new');

      // Forms don't use htmlFor, so use name attribute
      await adminPage.locator('input[name="name"]').fill(TEST_DATA.ORGANIZATION.name);
      await adminPage.locator('input[name="city"]').fill(TEST_DATA.ORGANIZATION.city);
      await adminPage.locator('input[name="country"]').fill(TEST_DATA.ORGANIZATION.country);
      await adminPage.getByRole('button', { name: /create/i }).click();

      // Wait for redirect to organizations list (NOT detail page)
      await adminPage.waitForURL('/organizations');
      await adminPage.waitForLoadState('networkidle');

      // Verify it's in the list
      await expect(adminPage.getByText(TEST_DATA.ORGANIZATION.name)).toBeVisible();

      // Get the ID for cleanup (reuse same client)
      client = await ApiClient.login(SEED.ADMIN.email, SEED.ADMIN.password);
      const orgs = await client.getOrganizations();
      const created = orgs.data.find((o: any) => o.name === TEST_DATA.ORGANIZATION.name);
      createdId = created?.id;
    } finally {
      // Cleanup - reuse client if already logged in, otherwise create new
      if (createdId) {
        try {
          if (!client) client = await ApiClient.login(SEED.ADMIN.email, SEED.ADMIN.password);
          await client.deleteOrganization(createdId);
        } catch (e) {
          console.warn('Cleanup failed for organization:', e);
        }
      }
    }
  });

  test('view detail page', async ({ adminPage }) => {
    await adminPage.goto('/organizations');
    await adminPage.waitForLoadState('networkidle');
    await adminPage.getByText(SEED.ORGANIZATIONS.acme.name).click();
    await adminPage.waitForURL(/\/organizations\/[a-z0-9-]+$/);
    await expect(adminPage.getByRole('heading', { name: SEED.ORGANIZATIONS.acme.name })).toBeVisible();
    await expect(adminPage.getByText(SEED.ORGANIZATIONS.acme.city)).toBeVisible();
    await expect(adminPage.getByText(SEED.ORGANIZATIONS.acme.country)).toBeVisible();
  });

  test('detail shows contacts', async ({ adminPage }) => {
    await adminPage.goto('/organizations');
    await adminPage.waitForLoadState('networkidle');
    await adminPage.getByText(SEED.ORGANIZATIONS.acme.name).click();
    await adminPage.waitForURL(/\/organizations\/[a-z0-9-]+$/);
    await adminPage.waitForLoadState('networkidle');
    const contactsSection = adminPage.locator('.card', { has: adminPage.getByRole('heading', { name: /contacts/i }) });
    await expect(contactsSection.getByText(`${SEED.CONTACTS.john.firstName} ${SEED.CONTACTS.john.lastName}`)).toBeVisible();
    await expect(contactsSection.getByText(`${SEED.CONTACTS.jane.firstName} ${SEED.CONTACTS.jane.lastName}`)).toBeVisible();
  });

  test('detail shows deals', async ({ adminPage }) => {
    await adminPage.goto('/organizations');
    await adminPage.waitForLoadState('networkidle');
    await adminPage.getByText(SEED.ORGANIZATIONS.acme.name).click();
    await adminPage.waitForURL(/\/organizations\/[a-z0-9-]+$/);
    await adminPage.waitForLoadState('networkidle');
    const dealsSection = adminPage.locator('.card', { has: adminPage.getByRole('heading', { name: /deals/i }) });
    await expect(dealsSection.getByText(SEED.DEALS.enterprise.title)).toBeVisible();
  });

  test('edit organization', async ({ adminPage }) => {
    await adminPage.goto('/organizations');
    await adminPage.waitForLoadState('networkidle');
    await adminPage.getByText(SEED.ORGANIZATIONS.acme.name).click();
    await adminPage.waitForURL(/\/organizations\/[a-z0-9-]+$/);

    await adminPage.getByRole('button', { name: 'Edit' }).click();

    // In edit mode, the website input has name="website" but no label
    const websiteInput = adminPage.locator('input[name="website"]');
    const originalValue = await websiteInput.inputValue();
    await websiteInput.fill('https://edited.example.com');
    await adminPage.getByRole('button', { name: 'Save' }).click();

    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.getByText('https://edited.example.com')).toBeVisible();

    // Restore original value
    await adminPage.getByRole('button', { name: 'Edit' }).click();
    await adminPage.locator('input[name="website"]').fill(originalValue);
    await adminPage.getByRole('button', { name: 'Save' }).click();
  });

  test('navigate to contact from detail', async ({ adminPage }) => {
    await adminPage.goto('/organizations');
    await adminPage.waitForLoadState('networkidle');
    await adminPage.getByText(SEED.ORGANIZATIONS.acme.name).click();
    await adminPage.waitForURL(/\/organizations\/[a-z0-9-]+$/);
    await adminPage.waitForLoadState('networkidle');

    // Contact name appears multiple times (contacts section, deals, activities)
    // Scope to the contacts section card
    const contactsSection = adminPage.locator('.card', { has: adminPage.getByRole('heading', { name: /contacts/i }) });
    const contactLink = contactsSection.getByRole('link', { name: `${SEED.CONTACTS.john.firstName} ${SEED.CONTACTS.john.lastName}` }).first();
    await contactLink.click();
    await adminPage.waitForURL(/\/contacts\/[a-z0-9-]+$/);
    await expect(adminPage.getByRole('heading', { name: `${SEED.CONTACTS.john.firstName} ${SEED.CONTACTS.john.lastName}` })).toBeVisible();
  });

  test('delete test organization', async ({ adminPage }) => {
    // Create a test org first
    const client = await ApiClient.login(SEED.ADMIN.email, SEED.ADMIN.password);
    const created = await client.createOrganization(TEST_DATA.ORGANIZATION);
    const orgId = created.id;

    try {
      await adminPage.goto(`/organizations/${orgId}`);

      adminPage.on('dialog', dialog => dialog.accept());
      await adminPage.getByRole('button', { name: 'Delete' }).click();

      await adminPage.waitForURL('/organizations');
      await adminPage.waitForLoadState('networkidle');
      await expect(adminPage.getByText(TEST_DATA.ORGANIZATION.name)).not.toBeVisible();
    } catch (error) {
      // If test fails, clean up manually
      try {
        await client.deleteOrganization(orgId);
      } catch {}
      throw error;
    }
  });
});
