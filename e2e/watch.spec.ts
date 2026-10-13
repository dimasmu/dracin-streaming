import { test, expect, type Page } from '@playwright/test';

const SLUG = 'wah-suamiku-ternyata-bos-besar';

function trackConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

/**
 * Elements inside `main` that stick out past the viewport. Horizontal rails
 * (`.rail`) scroll on purpose and are skipped. The global header is excluded:
 * it overflows at 360-1024px on every page independently of the watch page.
 */
async function overflowingInMain(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const bad: string[] = [];
    document.querySelectorAll('main *').forEach((el) => {
      if (el.closest('.rail')) return;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > vw + 1) bad.push(`${el.tagName}.${(el as HTMLElement).className}`);
    });
    return bad;
  });
}

test.describe('watch page (merged drama details)', () => {
  test('direct episode URL renders details, player and episode list', async ({ page }) => {
    const errors = trackConsole(page);
    await page.goto(`/watch/${SLUG}/1`);
    await expect(page.locator('.watch-title')).toContainText(/suamiku/i);
    await expect(page.locator('.video-player')).toBeVisible();
    await expect(page.locator('.watch-detail .synopsis')).toBeVisible();
    await expect(page.locator('.episode-button.active')).toHaveText('1');
    await expect(page.locator('.player-demo-badge, .player-top')).not.toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('legacy /drama/:slug redirects to the first episode', async ({ page }) => {
    await page.goto(`/drama/${SLUG}`);
    await expect(page).toHaveURL(new RegExp(`/watch/${SLUG}/1$`));
    await expect(page.locator('.watch-title')).toBeVisible();
  });

  test('unknown slug shows the not-found state', async ({ page }) => {
    await page.goto('/drama/does-not-exist');
    await expect(page).toHaveURL(/\/watch\/does-not-exist\/1$/);
    await expect(page.getByText('Drama not found')).toBeVisible();
  });

  test('previous/next, boundaries and back/forward', async ({ page }) => {
    await page.goto(`/watch/${SLUG}/1`);
    const prev = page.getByLabel('Previous episode');
    const next = page.getByLabel('Next episode');
    await expect(prev).toHaveAttribute('aria-disabled', 'true');
    await next.click();
    await expect(page).toHaveURL(new RegExp(`/watch/${SLUG}/2$`));
    await expect(page.locator('.episode-button.active')).toHaveText('2');
    await expect(prev).toHaveAttribute('aria-disabled', 'false');
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/watch/${SLUG}/1$`));
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`/watch/${SLUG}/2$`));
  });

  test('episode panel updates the route; no episode or subtitle dropdowns remain', async ({
    page,
  }) => {
    await page.goto(`/watch/${SLUG}/1`);
    await expect(page.locator('main p-select')).toHaveCount(0);
    await page.locator('.episode-button', { hasText: /^5$/ }).click();
    await expect(page).toHaveURL(new RegExp(`/watch/${SLUG}/5$`));
    await expect(page.locator('.episode-button.active')).toHaveText('5');
    await expect(page.locator('.ep-indicator')).toContainText('EP 5 /');
  });

  // Each drama in the mock data offers exactly one subtitle language, so the
  // player tag shows the navbar language when offered, else what the drama has.
  test('player subtitle tag reflects the navbar language and drama availability', async ({
    page,
  }) => {
    await page.goto(`/watch/${SLUG}/1`); // EN-only drama
    const tag = page.locator('.ctl-tag');
    await expect(tag).toHaveText('SUB EN');
    await page.locator('.language-toggle button', { hasText: 'ID' }).click();
    await expect(tag).toHaveText('SUB EN'); // ID not offered, falls back to EN
    await page.goto('/watch/sulih-suara-paman-sopir-taksi-online-jagoan/1'); // ID-only drama
    await expect(tag).toHaveText('SUB ID');
  });

  test('bookmark toggles on the watch page', async ({ page }) => {
    await page.goto(`/watch/${SLUG}/1`);
    const btn = page.locator('.watch-detail .detail-actions .btn').first();
    await expect(btn).toContainText('Bookmark');
    await btn.click();
    await expect(btn).toContainText('Bookmarked');
    await btn.click();
    await expect(btn).not.toContainText('Bookmarked');
  });

  test('demo controls respond', async ({ page }) => {
    await page.goto(`/watch/${SLUG}/1`);
    const lights = page.getByRole('switch', { name: 'Lights out' });
    await lights.click();
    await expect(lights).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.watch-page')).toHaveClass(/lights-out/);
    await lights.click({ force: true });
    await expect(page.locator('.watch-page')).not.toHaveClass(/lights-out/);
    await page.locator('.play-button').click();
    await expect(page.locator('.play-button')).toHaveAttribute('aria-label', 'Pause demo');
  });
});

test.describe('card and preview navigation', () => {
  test('card opens the watch page directly', async ({ page }) => {
    await page.goto('/browse');
    await page.locator('.drama-card .card-hit').first().click();
    await expect(page).toHaveURL(/\/watch\/[^/]+\/\d+$/);
  });

  test('card has no bookmark; preview has bookmark + play buttons of equal shape', async ({
    page,
  }) => {
    await page.goto('/browse');
    await expect(page.locator('.card-bookmark')).toHaveCount(0);
    await page.locator('.drama-card').first().hover();
    const preview = page.locator('.cdk-overlay-container .drama-preview');
    await expect(preview).toBeVisible();
    const bookmark = preview.locator('.btn-icon').first();
    const play = preview.locator('a.btn-icon');
    const [a, b] = await Promise.all([bookmark.boundingBox(), play.boundingBox()]);
    expect(a!.width).toBeCloseTo(b!.width, 0);
    expect(a!.height).toBeCloseTo(b!.height, 0);
    await expect(preview.getByText('View details')).toHaveCount(0);
    await bookmark.click();
    await expect(bookmark).toHaveClass(/active/);
    await play.click();
    await expect(page).toHaveURL(/\/watch\/[^/]+\/\d+$/);
  });

  test('home hero has no Details button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero-actions a', { hasText: 'Details' })).toHaveCount(0);
  });
});

test.describe('responsive layout', () => {
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    test(`no content overflow and 16:9 player at ${width}px`, async ({ page }) => {
      const errors = trackConsole(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/watch/${SLUG}/3`);
      await expect(page.locator('.video-player')).toBeVisible();
      expect(await overflowingInMain(page)).toEqual([]);
      const box = (await page.locator('.video-player').boundingBox())!;
      expect(box.width / box.height).toBeCloseTo(16 / 9, 1);
      expect(errors).toEqual([]);
    });
  }
});
