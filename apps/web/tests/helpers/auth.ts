import { Page } from '@playwright/test';

/**
 * Login helper for test setup
 * Logs in with default admin credentials and stores auth state
 */
export async function login(page: Page) {
  await page.goto('/login');

  // Fill in login credentials (adjust based on your actual login form)
  await page.getByLabel('Email Address').fill('admin@zenon.com');
  await page.getByLabel('Password').fill('admin123');

  // Click login button
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for navigation to complete (usually redirects to dashboard)
  await page.waitForURL('/', { timeout: 10000 });
}

/**
 * Check if user is logged in
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    // Check if token exists in localStorage
    const token = await page.evaluate(() => localStorage.getItem('token'));
    return !!token;
  } catch {
    return false;
  }
}
