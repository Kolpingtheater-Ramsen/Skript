import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Skript/);
  });

  test('should show loading state initially', async ({ page }) => {
    await page.goto('/');
    // The app should show some content or loading state
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have navigation elements', async ({ page }) => {
    await page.goto('/');
    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check for LMF logo or branding
    const logo = page.locator('svg').first();
    await expect(logo).toBeVisible();
  });
});
