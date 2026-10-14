import { test, expect, type Page } from '@playwright/test';

/**
 * Terms, Privacy and DMCA are three separate pages. They share a frame
 * (header, section navigation, email block) but each renders its own content,
 * so the same checks run per page against that page's own sections.
 */
const PAGES = [
  { name: 'Terms of Service', path: '/terms', title: /Terms of Service/i, sections: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'], marker: /Intellectual Property/i, emails: 0 },
  { name: 'Privacy Policy', path: '/privacy', title: /Privacy Policy/i, sections: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'], marker: /Third-Party Sharing/i, emails: 1 },
  { name: 'DMCA', path: '/dmca', title: /Copyright Policy/i, sections: ['scope', 'notice', 'checklist', 'steps', 'counter', 'repeat', 'contact'], marker: /Counter-Notification/i, emails: 1 },
] as const;

const HEADER = 68;

async function headingBelowHeader(page: Page, id: string): Promise<{ top: number; hidden: boolean }> {
  return page.evaluate(
    ({ id, header }) => {
      const el = document.getElementById(id)!;
      const top = Math.round(el.getBoundingClientRect().top);
      return { top, hidden: top < header };
    },
    { id, header: HEADER },
  );
}

for (const p of PAGES) {
  test.describe(p.name, () => {
    test('direct access and refresh render this page, not another', async ({ page }) => {
      await page.goto(p.path);
      await expect(page.locator('h1')).toHaveText(p.title);
      await expect(page.locator('.legal-content')).toContainText(p.marker);
      await page.reload();
      await expect(page).toHaveURL(new RegExp(`${p.path}$`));
      await expect(page.locator('h1')).toHaveText(p.title);
      await expect(page.locator('.legal-section')).toHaveCount(p.name === 'DMCA' ? 5 : p.sections.length);
    });

    test('every table-of-contents link stays on this page and reveals its heading', async ({ page }) => {
      await page.goto(p.path);
      const links = page.locator('.legal-toc ol a');
      await expect(links).toHaveCount(p.sections.length);
      for (let i = 0; i < p.sections.length; i++) {
        const id = p.sections[i];
        await links.nth(i).click();
        await expect(page).toHaveURL(new RegExp(`${p.path}#${id}$`)); // not "/#id"
        await expect(page.locator('h1')).toHaveText(p.title);
        await page.waitForTimeout(500);
        const pos = await headingBelowHeader(page, id);
        expect(pos.hidden, `#${id} sits under the sticky header (top=${pos.top})`).toBe(false);
      }
    });

    test('a link with a fragment opens at the right section on a fresh load', async ({ page }) => {
      const id = p.sections[p.sections.length - 1];
      await page.goto(`${p.path}#${id}`);
      await page.waitForTimeout(700);
      const pos = await headingBelowHeader(page, id);
      expect(pos.hidden, `top=${pos.top}`).toBe(false);
      await expect(page.locator('h1')).toHaveText(p.title);
    });

    test('active section follows the scroll', async ({ page }) => {
      await page.goto(p.path);
      await expect(page.locator('.legal-toc a.active')).toHaveCount(1);
      const before = await page.locator('.legal-toc a.active').innerText();
      await page.locator(`#${p.sections[p.sections.length - 1]}`).scrollIntoViewIfNeeded();
      await page.mouse.wheel(0, 300);
      await expect(page.locator('.legal-toc a.active')).toHaveCount(1);
      await expect.poll(async () => page.locator('.legal-toc a.active').innerText()).not.toBe(before);
    });

    test('keyboard: Tab reaches the TOC and Enter jumps without leaving the page', async ({ page }) => {
      await page.goto(p.path);
      const link = page.locator('.legal-toc ol a').nth(1);
      await link.focus();
      await expect(link).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(new RegExp(`${p.path}#${p.sections[1]}$`));
      await expect(page.locator(`#${p.sections[1]} h2, #${p.sections[1]}`).first()).toBeVisible();
      await expect(page.locator(`#${p.sections[1]} h2`)).toBeFocused();
    });

    test('the Legal documents button is gone; the footer is the way across', async ({ page }) => {
      await page.goto(p.path);
      await expect(page.locator('.legal-docs')).toHaveCount(0);
      await expect(page.locator('.legal-doc-link')).toHaveCount(0);
      // still reachable: the footer links to all three
      await page.goto('/');
      for (const d of PAGES) {
        await expect(page.locator(`.footer-col a[href="${d.path}"]`)).toHaveCount(1);
      }
    });

    test('footer links open this page', async ({ page }) => {
      await page.goto('/');
      await page.locator(`.footer-col a[href="${p.path}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${p.path}$`));
      await expect(page.locator('h1')).toHaveText(p.title);
    });

    test('text is readable: 15px body and a wide, still readable column', async ({ page }) => {
      await page.goto(p.path);
      await page.waitForSelector('.legal-section p');
      const m = await page.evaluate(() => {
        const el = document.querySelector('.legal-section p') as HTMLElement;
        const cs = getComputedStyle(el);
        const probe = document.createElement('span');
        probe.style.cssText = `font:${cs.font};position:absolute;visibility:hidden;white-space:nowrap`;
        probe.textContent = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz'.slice(0, 52);
        document.body.appendChild(probe);
        const glyph = probe.getBoundingClientRect().width / 52;
        probe.remove();
        return { font: parseFloat(cs.fontSize), cpl: el.getBoundingClientRect().width / glyph };
      });
      expect(m.font).toBeGreaterThanOrEqual(15);
      expect(m.cpl).toBeLessThan(100); // 84ch column
    });

    test('mobile: collapsible navigator sits above the text and works', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 800 });
      await page.goto(p.path);
      const toggle = page.locator('.legal-toc-toggle');
      await expect(toggle).toBeVisible();
      await expect(page.locator('.legal-toc ol')).toBeHidden();
      const order = await page.evaluate(() => ({
        toc: document.querySelector('.legal-sidebar')!.getBoundingClientRect().top,
        content: document.querySelector('.legal-content')!.getBoundingClientRect().top,
      }));
      expect(order.toc).toBeLessThan(order.content);

      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('.legal-toc ol')).toBeVisible();
      const target = p.sections[1];
      await page.locator('.legal-toc ol a').nth(1).click();
      await expect(page).toHaveURL(new RegExp(`${p.path}#${target}$`));
      await expect(page.locator('.legal-toc ol')).toBeHidden(); // closes after choosing
      await page.waitForTimeout(500);
      expect((await headingBelowHeader(page, target)).hidden).toBe(false);
    });

    for (const width of [360, 390, 768, 1024, 1440]) {
      test(`no horizontal overflow at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(p.path);
        await page.waitForSelector('.legal-content');
        const over = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          return [...document.querySelectorAll('main *')]
            .filter((el) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().right > vw + 1)
            .map((el) => `${el.tagName}.${(el as HTMLElement).className}`)
            .slice(0, 5);
        });
        expect(over).toEqual([]);
      });
    }

    test('works in Indonesian too', async ({ page }) => {
      await page.goto(p.path);
      await page.locator('.language-toggle button', { hasText: 'ID' }).click();
      await expect(page.locator('.legal-toc-title')).toHaveText('Di halaman ini');
      const links = page.locator('.legal-toc ol a');
      await links.nth(1).click();
      await expect(page).toHaveURL(new RegExp(`${p.path}#${p.sections[1]}$`));
      const text = await page.locator('.legal-main').innerText();
      expect(text).not.toMatch(/\b(legalCommon|terms|privacy|dmca)\.[a-zA-Z0-9]+/);
    });
  });
}

test.describe('email addresses', () => {
  for (const p of PAGES.filter((x) => x.emails)) {
    test(`${p.name}: address is a mailto link and the copy button really copies`, async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.goto(p.path);
      const link = page.locator('a.email-address');
      await expect(link).toHaveCount(1);
      const href = await link.getAttribute('href');
      expect(href).toMatch(/^mailto:[^@\s]+@[^@\s]+$/);
      await page.locator('.email-copy').click();
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      expect(copied).toBe(href!.replace('mailto:', ''));
      await expect(page.locator('.email-copy')).toContainText('Copied');
      await expect(page.locator('.p-toast-message').first()).toContainText('Email address copied');
    });
  }

  test('copy failure is reported, not faked', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: () => Promise.reject(new Error('denied')) },
        configurable: true,
      });
    });
    await page.goto('/dmca');
    await page.locator('.email-copy').click();
    await expect(page.locator('.p-toast-message').first()).toContainText('Could not copy');
    await expect(page.locator('.email-copy')).not.toContainText('Copied');
  });
});

test.describe('DMCA reporting hand-off', () => {
  test('the report button opens Contact with the DMCA category preselected', async ({ page }) => {
    await page.goto('/dmca');
    await page.locator('.dmca-report a.btn').click();
    await expect(page).toHaveURL(/\/contact\?category=copyright$/);
    await expect(page.locator('p-select')).toContainText('Copyright (DMCA)');
  });

  test('the inline contact link carries the category too', async ({ page }) => {
    await page.goto('/dmca#contact');
    await page.locator('#contact p a[href^="/contact"]').first().click();
    await expect(page).toHaveURL(/category=copyright/);
  });

  test('unknown categories are ignored', async ({ page }) => {
    await page.goto('/contact?category=<script>');
    await expect(page.locator('p-select')).not.toContainText('Copyright');
  });

  test('the contact form still validates and states it is a local simulation', async ({ page }) => {
    await page.goto('/contact?category=copyright');
    await page.getByRole('button', { name: 'Send Message' }).click();
    await expect(page.locator('.p-toast-message').first()).toContainText('Check the form');
    await page.getByLabel('Full Name *').fill('Test Owner');
    await page.getByLabel('Email Address *').fill('owner@example.com');
    await page.getByLabel('Subject *').fill('Takedown request');
    await page.getByRole('button', { name: 'Send Message' }).click();
    await expect(page.getByText('Message recorded').first()).toBeVisible();
    await expect(page.getByText(/prototype/i).first()).toBeVisible();
  });
});

test.describe('Privacy and Terms list what is really stored locally', () => {
  test('keys used by the app match what the texts say', async ({ page }) => {
    // Exercise every feature that writes to localStorage, then compare with the text.
    await page.goto('/watch/wah-suamiku-ternyata-bos-besar/1');
    await page.locator('.language-toggle button', { hasText: 'ID' }).click(); // site language
    await page.locator('.language-toggle button', { hasText: 'EN' }).click();
    await page.locator('.theme-toggle').click(); // theme
    await page.locator('.video-lang-select').click(); // video language
    await page.getByRole('option', { name: 'Indonesian' }).click();
    await page.locator('.watch-detail .detail-actions .btn').first().click(); // bookmark
    const keys = await page.evaluate(() => Object.keys(localStorage).sort());
    expect(keys).toEqual(['dracin-bookmarks', 'dracin-lang', 'dracin-theme', 'dracin-video-lang']);

    for (const path of ['/privacy', '/terms']) {
      await page.goto(path);
      await page.waitForSelector('.legal-content');
      const text = (await page.locator('.legal-content').innerText()).toLowerCase();
      for (const word of ['website language', 'video language', 'theme', 'bookmarks']) {
        expect(text, `${path} mentions ${word}`).toContain(word);
      }
    }
  });});

test.describe('revamped layout', () => {
  for (const p of PAGES) {
    test(`${p.name}: text column is wider than before (84ch)`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(p.path);
      await page.waitForSelector('.legal-content');
      const w = await page.evaluate(() => {
        const c = document.querySelector('.legal-content') as HTMLElement;
        const probe = document.createElement('span');
        probe.style.cssText = `font:${getComputedStyle(c).font};position:absolute;visibility:hidden;white-space:nowrap`;
        probe.textContent = '0'.repeat(100);
        c.appendChild(probe);
        const ch = probe.getBoundingClientRect().width / 100;
        probe.remove();
        return { px: Math.round(c.getBoundingClientRect().width), ch: Math.round(c.getBoundingClientRect().width / ch) };
      });
      // 74ch was the old cap; it must now be clearly wider and no wider than ~84ch.
      expect(w.ch).toBeGreaterThan(78);
      expect(w.ch).toBeLessThanOrEqual(86);
    });

    test(`${p.name}: headings and the table of contents carry matching numbers`, async ({ page }) => {
      await page.goto(p.path);
      await page.waitForSelector('.legal-content');
      const tocNums = await page.locator('.legal-toc .toc-num').allInnerTexts();
      const headingNums = await page.locator('.legal-content .sec-num').allInnerTexts();
      expect(tocNums.length).toBeGreaterThan(0);
      expect(headingNums.map((s) => s.trim())).toEqual(tocNums.map((s) => s.trim()));
      expect(tocNums[0]).toBe('01');
    });

    test(`${p.name}: callouts are labelled with an icon`, async ({ page }) => {
      await page.goto(p.path);
      await page.waitForSelector('.legal-callout');
      const ok = await page.evaluate(() =>
        [...document.querySelectorAll('.legal-callout')].every((c) => {
          const s = getComputedStyle(c, '::before');
          return s.content !== 'none' && parseFloat(s.width) >= 20;
        }),
      );
      expect(ok).toBe(true);
    });

    test(`${p.name}: legible in light theme and Indonesian, no overflow`, async ({ page }) => {
      await page.goto(p.path);
      await page.locator('.theme-toggle').click();
      await page.locator('.language-toggle button', { hasText: 'ID' }).click();
      await page.waitForSelector('.legal-content');
      const r = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const over = [...document.querySelectorAll('.legal-main *')].filter((e) => e.getBoundingClientRect().right > vw + 1).length;
        // The design tokens are oklch, which getComputedStyle returns verbatim.
        // Use the L channel (cubed) as a relative-luminance proxy for both oklch and rgb.
        const lum = (color: string): number => {
          if (color.startsWith('oklch')) {
            const l = parseFloat(color.match(/[\d.]+/g)![0]) / (color.includes('%') ? 100 : 1);
            return l ** 3;
          }
          const [r, g, b] = color.match(/[\d.]+/g)!.map(Number).slice(0, 3).map((v) => {
            const c = v / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const contrast = (el: Element) => {
          let node: Element | null = el;
          let bgc = 'rgba(0, 0, 0, 0)';
          while (node && /rgba\(0, 0, 0, 0\)|transparent/.test(bgc)) {
            bgc = getComputedStyle(node).backgroundColor;
            node = node.parentElement;
          }
          const a = lum(getComputedStyle(el).color);
          const b = lum(bgc);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        };
        const body = document.querySelector('.legal-section p')!;
        const callout = document.querySelector('.legal-callout p')!;
        return { over, bodyContrast: contrast(body), calloutContrast: contrast(callout) };
      });
      expect(r.over).toBe(0);
      expect(r.bodyContrast).toBeGreaterThan(4.5);
      expect(r.calloutContrast).toBeGreaterThan(4.5);
    });
  }
});