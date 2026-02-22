import { test, expect } from '../fixtures/auth';
import { SEED, TEST_DATA } from '../fixtures/test-data';
import { ApiClient } from '../helpers/api-client';

test.describe('Contacts', () => {
  test('lists seed contacts', async ({ adminPage }) => {
    await adminPage.goto('/contacts');
    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.getByText(`${SEED.CONTACTS.john.firstName} ${SEED.CONTACTS.john.lastName}`)).toBeVisible();
    await expect(adminPage.getByText(`${SEED.CONTACTS.jane.firstName} ${SEED.CONTACTS.jane.lastName}`)).toBeVisible();
    await expect(adminPage.getByText(`${SEED.CONTACTS.bob.firstName} ${SEED.CONTACTS.bob.lastName}`)).toBeVisible();
  });

  test('search filters contacts', async ({ adminPage }) => {
    await adminPage.goto('/contacts');
    await adminPage.waitForLoadState('networkidle');
    const searchInput = adminPage.getByPlaceholder('Search contacts...');
    await searchInput.fill('Jane');
    await expect(adminPage.getByText(`${SEED.CONTACTS.jane.firstName} ${SEED.CONTACTS.jane.lastName}`)).toBeVisible();
    await expect(adminPage.getByText(`${SEED.CONTACTS.john.firstName} ${SEED.CONTACTS.john.lastName}`)).not.toBeVisible();
  });

  test('create new contact', async ({ adminPage }) => {
    let client: ApiClient | null = null;
    let createdId: string | null = null;

    try {
      await adminPage.goto('/contacts/new');

      // Forms don't use htmlFor, use name attributes
      await adminPage.locator('input[name="firstName"]').fill(TEST_DATA.CONTACT.firstName);
      await adminPage.locator('input[name="lastName"]').fill(TEST_DATA.CONTACT.lastName);
      await adminPage.locator('input[name="jobTitle"]').fill(TEST_DATA.CONTACT.jobTitle);

      // OrganizationSelect has placeholder "Select organization..."
      const orgInput = adminPage.getByPlaceholder('Select organization...');
      await orgInput.click();
      await orgInput.fill(SEED.ORGANIZATIONS.acme.name);
      await adminPage.waitForTimeout(500);
      // Dropdown buttons contain org name in <p> tag
      await adminPage.locator('button').filter({ hasText: SEED.ORGANIZATIONS.acme.name }).first().click();

      // Email input
      await adminPage.locator('input[type="email"]').fill(TEST_DATA.CONTACT.email);

      await adminPage.getByRole('button', { name: /create/i }).click();

      // Wait for redirect to contacts list (NOT detail page when no preselectedOrgId)
      await adminPage.waitForURL('/contacts');
      await adminPage.waitForLoadState('networkidle');

      // Verify it's in the list
      await expect(adminPage.getByText(`${TEST_DATA.CONTACT.firstName} ${TEST_DATA.CONTACT.lastName}`)).toBeVisible();

      // Get ID for cleanup (reuse same client)
      client = await ApiClient.login(SEED.ADMIN.email, SEED.ADMIN.password);
      const contacts = await client.getContacts();
      const created = contacts.data.find((c: any) => c.firstName === TEST_DATA.CONTACT.firstName && c.lastName === TEST_DATA.CONTACT.lastName);
      createdId = created?.id;
    } finally {
      // Cleanup - reuse client if already logged in, otherwise create new
      if (createdId) {
        try {
          if (!client) client = await ApiClient.login(SEED.ADMIN.email, SEED.ADMIN.password);
          await client.deleteContact(createdId);
        } catch (e) {
          console.warn('Cleanup failed for contact:', e);
        }
      }
    }
  });

  test('view detail page', async ({ adminPage }) => {
    await adminPage.goto('/contacts');
    await adminPage.waitForLoadState('networkidle');
    await adminPage.getByText(`${SEED.CONTACTS.john.firstName} ${SEED.CONTACTS.john.lastName}`).first().click();
    await adminPage.waitForURL(/\/contacts\/[a-z0-9-]+$/);
    await expect(adminPage.getByRole('heading', { name: `${SEED.CONTACTS.john.firstName} ${SEED.CONTACTS.john.lastName}` })).toBeVisible();
    await expect(adminPage.getByText(SEED.CONTACTS.john.jobTitle)).toBeVisible();
    await expect(adminPage.getByText(SEED.CONTACTS.john.email)).toBeVisible();
  });

  test('detail shows org link', async ({ adminPage }) => {
    await adminPage.goto('/contacts');
    await adminPage.waitForLoadState('networkidle');
    await adminPage.getByText(`${SEED.CONTACTS.john.firstName} ${SEED.CONTACTS.john.lastName}`).first().click();
    await adminPage.waitForURL(/\/contacts\/[a-z0-9-]+$/);
    await adminPage.waitForLoadState('networkidle');

    // Organization is shown as a Link in the detail section (dt/dd structure)
    // "Acme Corporation" may appear multiple times (detail + activities table), use first()
    const orgLink = adminPage.getByRole('link', { name: SEED.ORGANIZATIONS.acme.name }).first();
    await expect(orgLink).toBeVisible();
  });

  test('edit contact', async ({ adminPage }) => {
    await adminPage.goto('/contacts');
    await adminPage.waitForLoadState('networkidle');
    await adminPage.getByText(`${SEED.CONTACTS.john.firstName} ${SEED.CONTACTS.john.lastName}`).first().click();
    await adminPage.waitForURL(/\/contacts\/[a-z0-9-]+$/);

    await adminPage.getByRole('button', { name: 'Edit' }).click();

    // In edit mode, job title becomes input[name="jobTitle"]
    const jobTitleInput = adminPage.locator('input[name="jobTitle"]');
    const originalValue = await jobTitleInput.inputValue();
    await jobTitleInput.fill('Chief Executive Officer');
    await adminPage.getByRole('button', { name: 'Save' }).click();

    await adminPage.waitForLoadState('networkidle');
    await expect(adminPage.getByText('Chief Executive Officer')).toBeVisible();

    // Restore original value
    await adminPage.getByRole('button', { name: 'Edit' }).click();
    await adminPage.locator('input[name="jobTitle"]').fill(originalValue);
    await adminPage.getByRole('button', { name: 'Save' }).click();
  });

  // ContactDetail page does NOT have a notes section - only Activities
  test.skip('add note on detail page', async ({ adminPage }) => {
    // This feature doesn't exist on ContactDetail page
    // The page only shows Activities, not Notes
  });

  test('delete test contact', async ({ adminPage }) => {
    // Create a test contact first
    const client = await ApiClient.login(SEED.ADMIN.email, SEED.ADMIN.password);
    const orgs = await client.getOrganizations();
    const acmeOrg = orgs.data.find((o: any) => o.name === SEED.ORGANIZATIONS.acme.name);

    const created = await client.createContact({
      ...TEST_DATA.CONTACT,
      primaryOrganizationId: acmeOrg.id,
    });
    const contactId = created.id;

    try {
      await adminPage.goto(`/contacts/${contactId}`);

      adminPage.on('dialog', dialog => dialog.accept());
      await adminPage.getByRole('button', { name: 'Delete' }).click();

      await adminPage.waitForURL('/contacts');
      await adminPage.waitForLoadState('networkidle');
      await expect(adminPage.getByText(`${TEST_DATA.CONTACT.firstName} ${TEST_DATA.CONTACT.lastName}`)).not.toBeVisible();
    } catch (error) {
      // If test fails, clean up manually
      try {
        await client.deleteContact(contactId);
      } catch {}
      throw error;
    }
  });
});
