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
    const compile = (selected, names) => page.evaluate(({ selected, names }) => compilePromptMix(selected, names), { selected, names });
    const sample = (name, content) => ({ name, content });
    const main = sample('Main', 'Before\n{{#if .friction}}Active: {{getvar::friction}}{{else}}Inactive{{/if}}\nAfter');
    const friction = sample('Friction', '{{ // Comment containing {{user}} }}{{trim}}{{setvar::friction::Respect {{user}}.}}');
    assert.equal(await compile([main]), 'Before\nInactive\nAfter');
    assert.equal(await compile([main, friction]), 'Before\nActive: Respect {{user}}.\nAfter');
    assert.equal(await compile([friction, main]), 'Before\nActive: Respect {{user}}.\nAfter');
    assert.equal(await compile([friction]), 'Respect {{user}}.');
    assert.equal(await compile([friction], { user: '$& <Alex>' }), 'Respect $& <Alex>.');
    assert.equal(await compile([sample('Names', '{{user}} / {{char}}')], { user: 'Alex', char: 'Sam' }), 'Alex / Sam');
    assert.equal(await compile([sample('Comment', '{{// Documentation {{dialoguecolors}} continues }}')]), '');
    assert.equal(await compile([sample('Tags', '<technical_directives>\n[SCENE|text]\n</technical_directives>')]), '<technical_directives>\n[SCENE|text]\n</technical_directives>');
    assert.equal(await compile([sample('Formatting', '- {{getvar::length}}\n- {{dialoguecolors}}\nKeep this.')]), 'Keep this.');
    await assert.rejects(compile([friction, sample('Other friction', '{{setvar::friction::Different.}}')]), /Choose one/);
    for (const content of ['{{pick::a::b}}', '{{getvar::unknown}}', '{{unknown}}', '{{unclosed', 'stray}}', '{{#if .length}}missing end', '{{else}}', '{{/if}}', '{{#if .length}}{{else}}{{else}}{{/if}}']) {
      await assert.rejects(compile([sample('Invalid', content)]), /Unsupported|Unclosed|Unmatched|Unexpected/);
    }
    for (const content of ['{{random::a::b}}', '{{roll:1d100}}', '{{setvar::custom::{{roll::1d100}}% chance}}', '{{setvar::narration::{{random::a::b}}}}']) {
      await assert.rejects(compile([sample('Dynamic', content)]), /per-message/);
    }
    await assert.rejects(compile([sample('Cycle', '{{setvar::length::{{getvar::length}}}}')]), /Circular/);
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
      assert.equal(await reader.locator(':scope > textarea').inputValue(), entries.find(p => p.identifier === 'main').content);
      for (let index = 0; index < expected.length; index++) {
        const prompt = expected[index];
        await choice.selectOption(String(index));
        assert.equal(await reader.locator(':scope > textarea').inputValue(), prompt.content, prompt.name);
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

      const mixer = reader.locator('.prompt-mixer');
      await mixer.locator('summary').click();
      const mixText = mixer.locator('.mix-preview');
      const mixCopy = mixer.locator('.mix-copy');
      const checkbox = prompt => mixer.locator(`input[type="checkbox"][value="${expected.indexOf(prompt)}"]`);
      assert.equal(await mixCopy.isDisabled(), true);
      let portable = 0;
      for (const prompt of expected) {
        const result = await compile([prompt]).then(text => ({ text }), error => ({ error: error.message }));
        if (result.error) assert.match(result.error, /per-message|live conversation summary|Assistant prefill/, prompt.name);
        else if (!result.text) assert.match(prompt.name, /README|Disabled/, prompt.name);
        else {
          portable++;
          assert.doesNotMatch(result.text.replace(/\{\{(?:user|char)\}\}/g, ''), /\{\{|\}\}/, prompt.name);
          if (!prompt.content.includes('{{')) assert.equal(result.text, prompt.content.trim());
        }
        assert.equal(await checkbox(prompt).isDisabled(), !result.text, prompt.name);
      }
      const selected = [
        expected.find(p => p.identifier === 'main'),
        expected.find(p => p.name === 'Formatting'),
        expected.find(p => /^Short\b/.test(p.name)),
        expected.find(p => /^(?:Don.t Write for User|User Controls User)$/.test(p.name)),
        expected.find(p => /^Voice:/.test(p.name) && !p.name.includes('Random')),
      ];
      if (tab !== 'tee-tab-prompts') selected.push(expected.find(p => p.name === 'Friction Mode'));
      assert.ok(selected.every(Boolean));
      for (const prompt of selected) await checkbox(prompt).check();
      const mixed = await mixText.inputValue();
      assert.ok(mixed.length > 100);
      assert.equal(mixed.split('End immediately after 3-5 short paragraphs.').length, 2, 'Length rule inserted exactly once');
      for (const prompt of selected.filter(p => /Friction|^Voice:/.test(p.name))) {
        const body = await compile([prompt]);
        assert.equal(mixed.split(body).length, 2, `${prompt.name} inserted once`);
      }
      assert.doesNotMatch(mixed, /\{\{(?:setvar|getvar|#if|else|\/if|trim|dialoguecolors)/);
      await mixCopy.click();
      await page.waitForFunction(tab => document.querySelector(`[data-prompt-tab="${tab}"] .mix-status`).textContent === 'Copied combined prompt.', tab);
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), mixed);
      const medium = expected.find(p => /^Medium\b/.test(p.name));
      await checkbox(medium).check();
      assert.equal(await mixCopy.isDisabled(), true);
      assert.equal(await mixText.inputValue(), '');
      assert.match(await mixer.locator('.mix-status').textContent(), /Choose one:.*Short.*Medium/);
      await checkbox(medium).uncheck();
      assert.equal(await mixText.inputValue(), mixed);
      await mixer.locator('.mix-user').fill('Alex');
      assert.doesNotMatch(await mixText.inputValue(), /\{\{user\}\}/);
      assert.match(await mixText.inputValue(), /Alex/);
      await mixer.locator('.mix-user').fill('');
      await mixer.locator('.mix-clear').click();
      assert.equal(await mixText.inputValue(), '');
      assert.equal(await mixCopy.isDisabled(), true);
      for (const prompt of [...selected].reverse()) await checkbox(prompt).check();
      assert.equal(await mixText.inputValue(), mixed, 'Click order does not change preset order');
      await mixer.locator('input:checked').first().focus();
      await page.keyboard.press('Space');
      assert.equal(await mixer.locator('input:checked').count(), selected.length - 1);
      await page.keyboard.press('Space');

      await choice.selectOption(String(expected.findIndex(p => p.identifier === 'main')));
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        const box = await reader.boundingBox();
        assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1, `${tab} fits at ${width}px`);
        for (const selector of ['select', ':scope > textarea', '.prompt-copy', '.mix-choices', '.mix-user', '.mix-char', '.mix-copy', '.mix-preview']) {
          const control = await reader.locator(selector).boundingBox();
          assert.ok(control.x >= box.x && control.x + control.width <= box.x + box.width + 1, `${selector} fits`);
        }
        if (process.env.SCREENSHOT_DIR && width !== 320) {
          await reader.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `${tab}-${width}.png`) });
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await mixer.locator('summary').click();
      console.log(`${tab}: ${expected.length} raw / ${portable} portable prompts, mixing, clipboard and layouts passed`);
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
    assert.equal(await reader.locator(':scope > textarea').evaluate(el => el.selectionEnd - el.selectionStart), (await reader.locator(':scope > textarea').inputValue()).length);
    assert.match(await reader.locator('.prompt-status').textContent(), /copy it manually/);
    await reader.locator('.prompt-mixer summary').click();
    await reader.locator('.mix-choices input:enabled').first().check();
    await reader.locator('.mix-copy').click();
    await page.waitForFunction(() => document.activeElement.classList.contains('mix-preview'));
    assert.equal(await reader.locator('.mix-preview').evaluate(el => el.selectionEnd - el.selectionStart), (await reader.locator('.mix-preview').inputValue()).length);
    assert.match(await reader.locator('.mix-status').textContent(), /copy it manually/);
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
