import { test as base } from '@playwright/test';

/**
 * Extended Playwright test with pre-authenticated fixtures for admin and sales users
 */

type AuthFixtures = {
  adminPage: any;
  salesPage: any;
};

export const test = base.extend<AuthFixtures>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: '.auth/admin.json',
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  salesPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: '.auth/sales.json',
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
