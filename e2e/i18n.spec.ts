import { test, expect } from '@playwright/test';

const SLUG = 'wah-suamiku-ternyata-bos-besar';

test.describe('website language (navbar)', () => {
  test('toggle switches the UI text and <html lang>', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('.nav-links a[href="/genre"]')).toContainText('Genre');
    await expect(page.locator('.nav-links a[href="/"]')).toContainText('Home');

    await page.locator('.language-toggle button', { hasText: 'ID' }).click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'id');
    await expect(page.locator('.nav-links a[href="/"]')).toContainText('Beranda');
    await expect(page.locator('.nav-links a[href="/release-schedule"]')).toContainText('Jadwal');
    await expect(page.locator('.search')).toHaveAttribute('placeholder', 'Cari judul drama');
    await expect(page.locator('.footer-col h2').first()).toHaveText('Jelajahi');
  });

  test('the choice survives a reload', async ({ page }) => {
    await page.goto('/');
    await page.locator('.language-toggle button', { hasText: 'ID' }).click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'id');
    await expect(page.locator('.nav-links a[href="/"]')).toContainText('Beranda');
  });

  test('no raw translation keys leak into a page in either language', async ({ page }) => {
    test.setTimeout(120_000); // 24 page loads
    for (const lang of ['EN', 'ID']) {
      await page.goto('/');
      await page.locator('.language-toggle button', { hasText: lang }).click();
      for (const path of ['/', '/browse', '/genre', '/platform', '/release-schedule', '/bookmarks',
        '/faq', '/contact', '/terms', '/privacy', '/dmca', `/watch/${SLUG}/1`]) {
        await page.goto(path);
        await page.waitForSelector('main');
        const text = await page.locator('body').innerText();
        expect(text, `${lang} ${path}`).not.toMatch(/\b(common|nav|home|browse|watch|faq|contact|terms|privacy|dmca|footer|genres?|platforms?|schedule|bookmarks|card|preview|legalCommon|videoLang|status)\.[a-zA-Z0-9]+/);
      }
    }
  });

  test('toasts and FAQ follow the language', async ({ page }) => {
    await page.goto('/');
    await page.locator('.language-toggle button', { hasText: 'ID' }).click();
    await page.goto('/faq');
    await expect(page.locator('h1')).toHaveText('Ada yang bisa kami bantu?');
    await expect(page.locator('p-accordion-header').first()).toHaveText('Apa itu DRA.CIN?');
    await page.goto(`/watch/${SLUG}/1`);
    await page.locator('.watch-detail .detail-actions .btn').first().click();
    await expect(page.locator('.p-toast-message').first()).toContainText('Ditambahkan ke markah');
  });
});

test.describe('browser language detection', () => {
  test.use({ locale: 'id-ID' });
  test('first visit follows an Indonesian browser', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'id');
    await expect(page.locator('.nav-links a[href="/"]')).toContainText('Beranda');
  });
});

test.describe('video version (separate from website language)', () => {
  test('player offers ID and EN, and the choice goes in the URL', async ({ page }) => {
    await page.goto(`/watch/${SLUG}/1`);
    const select = page.locator('.video-lang-select');
    await expect(select).toContainText('English'); // website is EN, so video starts as EN
    await expect(page.locator('.ctl-tag')).toHaveText('EN');

    await select.click();
    await expect(page.getByRole('option')).toHaveText(['Indonesian', 'English']);
    await page.getByRole('option', { name: 'Indonesian' }).click();
    await expect(page).toHaveURL(new RegExp(`/watch/${SLUG}/1\\?v=id$`));
    await expect(page.locator('.ctl-tag')).toHaveText('ID');
    await expect(select).toContainText('Indonesian');
  });

  test('changing the website language does not change the video version', async ({ page }) => {
    await page.goto(`/watch/${SLUG}/1?v=en`);
    await page.locator('.language-toggle button', { hasText: 'ID' }).click();
    await expect(page.locator('.nav-links a[href="/"]')).toContainText('Beranda');
    await expect(page.locator('.ctl-tag')).toHaveText('EN');
    await expect(page).toHaveURL(/\?v=en$/);
    // the dropdown labels switch to the website language, the selected version stays
    await expect(page.locator('.video-lang-select')).toContainText('Inggris');
  });

  test('prev/next and the episode panel keep the chosen version', async ({ page }) => {
    await page.goto(`/watch/${SLUG}/1?v=id`);
    await page.getByLabel('Next episode').click();
    await expect(page).toHaveURL(new RegExp(`/watch/${SLUG}/2\\?v=id$`));
    await page.locator('.episode-button', { hasText: /^5$/ }).click();
    await expect(page).toHaveURL(new RegExp(`/watch/${SLUG}/5\\?v=id$`));
    await expect(page.locator('.ctl-tag')).toHaveText('ID');
  });

  test('the last choice is remembered on a fresh link without ?v=', async ({ page }) => {
    await page.goto(`/watch/${SLUG}/1`);
    await page.locator('.video-lang-select').click();
    await page.getByRole('option', { name: 'Indonesian' }).click();
    await page.goto(`/watch/${SLUG}/3`);
    await expect(page.locator('.ctl-tag')).toHaveText('ID');
  });

  test('Share copies a link that carries the version', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(`/watch/${SLUG}/2?v=id`);
    await page.locator('.watch-detail .detail-actions .btn').nth(1).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(new RegExp(`/watch/${SLUG}/2\\?v=id$`));
  });

  test('cards show the video versions', async ({ page }) => {
    await page.goto('/browse');
    await expect(page.locator('.card-locale').first()).toHaveText('ID · EN');
  });

  test('Browse has a Subtitle filter that narrows the list', async ({ page }) => {
    await page.goto('/browse');
    const group = page.locator('.browse-sidebar .filter-group', { hasText: 'Subtitle' });
    await expect(group).toBeVisible();
    await expect(page.locator('.browse-sidebar .filter-group')).toHaveCount(5);
    const total = Number((await page.locator('.browse-content .count, .page-head .count').first().innerText()).match(/\d+/)![0]);

    await group.locator('p-select').click();
    await expect(page.getByRole('option')).toHaveText(['Subtitle EN', 'Subtitle ID']);
    await page.getByRole('option', { name: 'Subtitle EN' }).click();
    await page.keyboard.press('Escape');

    const filtered = Number((await page.locator('.page-head .count').first().innerText()).match(/\d+/)![0]);
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(total);
  });

  test('Subtitle filter label follows the website language', async ({ page }) => {
    await page.goto('/browse');
    await page.locator('.language-toggle button', { hasText: 'ID' }).click();
    await expect(page.locator('.browse-sidebar .filter-group', { hasText: 'Semua subtitle' })).toBeVisible();
  });
});
