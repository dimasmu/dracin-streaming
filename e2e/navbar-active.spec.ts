import { test, expect } from '@playwright/test';

/**
 * Regression: the purple active underline in the navbar pointed at the wrong
 * item. The header read `router.url` (a non-reactive getter) from an OnPush,
 * zoneless template, so it only refreshed when one of its own events fired.
 * Navigating from outside the header (e.g. a footer link) left the underline
 * on the previously active entry.
 */
test.describe('navbar active state', () => {
  test('marks only the current section when navigating from the footer', async ({ page }) => {
    await page.goto('/');

    const genreLink = page.locator('.nav-links a[href="/genre"]');
    const platformLink = page.locator('.nav-links a[href="/platform"]');

    // Start on Home: only Home should be marked.
    await expect(page.locator('.nav-links a[aria-current="page"]')).toHaveCount(1);
    await expect(page.locator('.nav-links a[href="/"]')).toHaveAttribute('aria-current', 'page');

    // Navigate via the FOOTER (outside the header) so the header is not
    // marked dirty by a click inside it.
    await page.locator('.footer-col a[href="/genre"]').first().click();

    await expect(genreLink).toHaveAttribute('aria-current', 'page');
    await expect(platformLink).not.toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.nav-links a[aria-current="page"]')).toHaveCount(1);
  });

  test('keeps the underline in sync when going back via browser history', async ({ page }) => {
    await page.goto('/genre');
    await expect(page.locator('.nav-links a[href="/genre"]')).toHaveAttribute(
      'aria-current',
      'page',
    );

    // Navigate to another route from a non-header link, then go back.
    await page.locator('.footer-col a[href="/platform"]').first().click();
    await expect(page.locator('.nav-links a[href="/platform"]')).toHaveAttribute(
      'aria-current',
      'page',
    );

    await page.goBack();
    await expect(page.locator('.nav-links a[href="/genre"]')).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.locator('.nav-links a[href="/platform"]')).not.toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('does not mark Home while on a nested section', async ({ page }) => {
    await page.goto('/genre');
    await expect(page.locator('.nav-links a[href="/"]')).not.toHaveAttribute('aria-current', 'page');
  });
});