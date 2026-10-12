import { test, expect } from '@playwright/test';

const PREVIEW = '.cdk-overlay-container .drama-preview';

/**
 * Regression: the hover preview sometimes failed to fade out / lingered on
 * screen. Causes fixed in DramaPreviewService / DramaPreviewComponent:
 *  - a pending open was not cancelled on pointerleave, so the preview opened
 *    ~380 ms after the pointer had already left and then never closed;
 *  - it was not closed on navigation (origin element destroyed under it);
 *  - it used the reposition scroll strategy, so it trailed the card on scroll
 *    (scrolling moves a card out from under a stationary cursor without
 *    firing pointerleave).
 */
test.describe('drama hover preview', () => {
  test('opens on hover and closes when the pointer leaves', async ({ page }) => {
    await page.goto('/browse');
    const card = page.locator('.drama-card').first();
    await card.hover();
    await expect(page.locator(PREVIEW)).toBeVisible();
    await page.mouse.move(5, 5);
    await expect(page.locator(PREVIEW)).toBeHidden();
  });

  test('does not open when the pointer only sweeps across a card', async ({ page }) => {
    await page.goto('/browse');
    const card = page.locator('.drama-card').first();
    const box = (await card.boundingBox())!;
    // Enter and immediately exit without resting on the card.
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.move(box.x + 10, box.y + box.height - 10);
    await page.mouse.move(5, 5);
    // Wait past the open delay to be sure it never pops open.
    await page.waitForTimeout(700);
    await expect(page.locator(PREVIEW)).toBeHidden();
  });

  test('closes when the page is scrolled', async ({ page }) => {
    await page.goto('/browse');
    await page.locator('.drama-card').first().hover();
    await expect(page.locator(PREVIEW)).toBeVisible();
    await page.mouse.wheel(0, 200);
    await expect(page.locator(PREVIEW)).toBeHidden();
  });

  test('closes on navigation', async ({ page }) => {
    await page.goto('/browse');
    await page.locator('.drama-card').first().hover();
    await expect(page.locator(PREVIEW)).toBeVisible();
    await page.locator('.footer-col a[href="/genre"]').first().click();
    await expect(page.locator(PREVIEW)).toBeHidden();
  });

  test('is not clipped by the carousel overflow', async ({ page }) => {
    await page.goto('/');
    await page.locator('.carousel .drama-card').first().hover();
    await expect(page.locator(PREVIEW)).toBeVisible();
    // The panel must live in the CDK container appended to <body>, not inside
    // the overflow-scrolling carousel.
    const insideCarousel = await page
      .locator('.carousel .drama-preview')
      .count();
    expect(insideCarousel).toBe(0);
  });
});