// Run with node tests/preset-prompts.cjs; uses the same Playwright dependency as assistant/tests.
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

(async () => {
  const root = path.resolve(__dirname, '..');
  const origin = 'https://preset.test';
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    let failure = null;
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/') {
        return route.fulfill({ contentType: 'text/html', body: await readFile(path.join(root, 'index.html')) });
      }
      if (url.pathname.startsWith('/preset/') && url.pathname.endsWith('.json')) {
        requests.push(url.pathname);
        if (failure === 'http') return route.fulfill({ status: 503, body: 'Unavailable' });
        if (failure === 'empty') return route.fulfill({ json: { prompts: [] } });
        if (failure === 'invalid') return route.fulfill({ contentType: 'application/json', body: '{' });
        return route.fulfill({ contentType: 'application/json', body: await readFile(path.join(root, decodeURIComponent(url.pathname))) });
      }
      return route.abort();
    });

    await page.goto(origin, { waitUntil: 'networkidle' });
    assert.equal(requests.length, 0, 'Prompt downloads are lazy');
    for (const [tab, platform, sourceClass] of [
      ['tab-prompts', 'platform-view-st', 'dl-st'],
      ['sb-tab-prompts', 'platform-view-sb', 'dl-sb'],
      ['tee-tab-prompts', 'preset-view-tee', 'dl-st'],
    ]) {
      await page.locator(`label[for="${platform}"]`).click();
      await page.locator(`label[for="${tab}"]`).click();
      const reader = page.locator(`[data-prompt-tab="${tab}"]`);
      const choice = reader.locator('select');
      await reader.locator('.prompt-copy:enabled').waitFor();
      const href = await reader.evaluate((el, cls) => el.closest('.platform-panel').querySelector(`.downloads-primary .${cls}`).href, sourceClass);
      const preset = JSON.parse(await readFile(path.join(root, decodeURIComponent(new URL(href).pathname)), 'utf8'));
      const entries = preset.prompts.filter(p => !p.marker && typeof p.content === 'string' && p.content.trim());
      const order = preset.prompt_order.find(entry => entry.character_id === 100001).order;
      const ids = order.map(p => p.identifier);
      const expected = [
        ...ids.map(id => entries.find(p => p.identifier === id)).filter(Boolean),
        ...entries.filter(p => !ids.includes(p.identifier)),
      ];
      assert.deepEqual(await choice.locator('option').allTextContents(), expected.map(p => p.name));
      assert.equal(await reader.locator('textarea').inputValue(), entries.find(p => p.identifier === 'main').content);
      for (let index = 0; index < expected.length; index++) {
        const prompt = expected[index];
        await choice.selectOption(String(index));
        assert.equal(await reader.locator('textarea').inputValue(), prompt.content, prompt.name);
        if (prompt.identifier === 'main' || prompt.name === 'Friction Mode') {
          await reader.locator('.prompt-copy').click();
          await page.waitForFunction(() => [...document.querySelectorAll('.prompt-status')].some(el => el.textContent.startsWith('Copied ')));
          assert.equal(await page.evaluate(() => navigator.clipboard.readText()), prompt.content);
        }
      }
      const count = requests.length;
      await page.locator(`label[for="${tab === 'sb-tab-prompts' ? 'sb-tab-overview' : tab === 'tee-tab-prompts' ? 'tee-tab-preset' : 'tab-preset'}"]`).click();
      await page.locator(`label[for="${tab}"]`).click();
      assert.equal(requests.length, count, 'Reopening does not refetch');

      await choice.selectOption(String(expected.findIndex(p => p.identifier === 'main')));
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        const box = await reader.boundingBox();
        assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1, `${tab} fits at ${width}px`);
        for (const selector of ['select', 'textarea', '.prompt-copy']) {
          const control = await reader.locator(selector).boundingBox();
          assert.ok(control.x >= box.x && control.x + control.width <= box.x + box.width + 1, `${selector} fits`);
        }
        if (process.env.SCREENSHOT_DIR && width !== 320) {
          await reader.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `${tab}-${width}.png`) });
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      console.log(`${tab}: ${expected.length} exact prompt texts, clipboard and layouts passed`);
    }

    for (failure of ['http', 'invalid', 'empty']) {
      await page.goto(origin, { waitUntil: 'networkidle' });
      await page.locator('label[for="tab-prompts"]').click();
      const reader = page.locator('[data-prompt-tab="tab-prompts"]');
      await reader.locator('.prompt-retry:visible').waitFor();
      assert.equal(await reader.locator('.prompt-copy').isDisabled(), true);
      failure = null;
      await reader.locator('.prompt-retry').click();
      await reader.locator('.prompt-copy:enabled').waitFor();
    }

    const reader = page.locator('[data-prompt-tab="tab-prompts"]');
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('Permission denied')) },
    }));
    await reader.locator('.prompt-copy').click();
    await page.waitForFunction(() => document.activeElement.tagName === 'TEXTAREA');
    assert.equal(await reader.locator('textarea').evaluate(el => el.selectionEnd - el.selectionStart), (await reader.locator('textarea').inputValue()).length);
    assert.match(await reader.locator('.prompt-status').textContent(), /copy it manually/);
    await reader.locator('select').focus();
    assert.equal(await reader.locator('select').evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
    await page.locator('#tab-prompts').focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.locator('#tab-options').isChecked(), true);
    await page.keyboard.press('ArrowRight');
    assert.equal(await reader.isVisible(), true);
    assert.deepEqual(errors, []);
    console.log('Fetch failures, retry, manual copy and keyboard navigation passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
