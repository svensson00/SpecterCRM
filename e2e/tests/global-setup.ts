import { test as setup } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';
import { resetDatabase } from '../helpers/db-reset';
import { SEED } from '../fixtures/test-data';

/**
 * Global setup as a Playwright setup project:
 * 1. Reset database (truncate CRM data)
 * 2. Run seed script to establish baseline
 * 3. Login as admin and sales users, save storageState
 */

setup('reset database and seed', async () => {
  setup.setTimeout(60000);

  console.log('\n=== E2E Global Setup ===\n');

  // Step 1: Reset database
  console.log('1. Resetting database...');
  await resetDatabase();

  // Step 2: Run seed script
  console.log('\n2. Running seed script...');
  const backendDir = path.resolve(__dirname, '../../backend');
  try {
    execSync('npm run db:seed', {
      cwd: backendDir,
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('Seed script failed:', error);
    throw error;
  }

  console.log('\n=== Database Setup Complete ===\n');
});

setup('authenticate as admin', async ({ page }) => {
  setup.setTimeout(30000);

  console.log('Logging in as admin...');
  await page.goto('/login');
  await page.getByLabel('Email address').fill(SEED.ADMIN.email);
  await page.getByLabel('Password').fill(SEED.ADMIN.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/dashboard');

  await page.context().storageState({ path: '.auth/admin.json' });
  console.log('Admin auth saved to .auth/admin.json');
});

setup('authenticate as sales', async ({ page }) => {
  setup.setTimeout(30000);

  console.log('Logging in as sales...');
  await page.goto('/login');
  await page.getByLabel('Email address').fill(SEED.SALES.email);
  await page.getByLabel('Password').fill(SEED.SALES.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/dashboard');

  await page.context().storageState({ path: '.auth/sales.json' });
  console.log('Sales auth saved to .auth/sales.json');
});
