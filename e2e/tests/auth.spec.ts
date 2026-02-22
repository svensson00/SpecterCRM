import { test, expect } from '@playwright/test';
import { SEED } from '../fixtures/test-data';

test.describe('Authentication', () => {
  test('redirects to /login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows login form fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('logs in with admin credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email address').fill(SEED.ADMIN.email);
    await page.getByLabel('Password').fill(SEED.ADMIN.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('logs in with sales credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email address').fill(SEED.SALES.email);
    await page.getByLabel('Password').fill(SEED.SALES.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.getByLabel('Email address').fill(SEED.ADMIN.email);
    await page.getByLabel('Password').fill('WrongPassword123!');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Backend returns "Invalid email or password" for bad credentials
    // The error is displayed in a red-styled div on the login form
    await expect(page.getByText(/invalid|login failed/i)).toBeVisible({ timeout: 10000 });
  });

  test('logs out and redirects', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.getByLabel('Email address').fill(SEED.ADMIN.email);
    await page.getByLabel('Password').fill(SEED.ADMIN.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Logout
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login/);

    // Verify redirect to login when accessing protected route
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows demo credentials in dev mode', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Demo Credentials:')).toBeVisible();
  });
});
