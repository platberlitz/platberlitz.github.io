const assert = require('node:assert/strict');

module.exports = async function(page) {
  await page.waitForFunction(() => document.getElementById('settingsModal').dataset.a11yInit === '1');
  await page.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });

  // Setup: each missing field is named and marked, and the actions stay reachable.
  if (await page.locator('#setupModal').evaluate(el => el.classList.contains('open'))) {
    await page.locator('#setupProvider').selectOption('openai');
    await page.locator('#setupKey').fill('');
    await page.getByRole('button', { name: 'Save and start', exact: true }).click();
    assert.match(await page.locator('#setupError').textContent(), /Enter your API key for OpenAI/);
    assert.equal(await page.locator('#setupKey').getAttribute('aria-invalid'), 'true');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'setupKey', 'The missing field receives focus');
    await page.evaluate(() => {
      document.getElementById('setupKey').value = 'disposable-workspace-key';
      document.getElementById('setupModelManual').value = '';
      document.getElementById('setupModelSelect').innerHTML = '<option value="">-- Fetch models first --</option>';
    });
    await page.getByRole('button', { name: 'Save and start', exact: true }).click();
    assert.match(await page.locator('#setupError').textContent(), /Choose a model/);
    assert.equal(await page.locator('#setupKey').getAttribute('aria-invalid'), null, 'Fixed fields are no longer marked');
    assert.equal(await page.locator('#setupModelSelect').getAttribute('aria-invalid'), 'true');
    assert.equal(await page.locator('#setupModal .setup-actions').evaluate(el => getComputedStyle(el).position), 'sticky');
    await page.getByRole('button', { name: 'Continue disconnected', exact: true }).click();
  }

  // The context panel starts closed until the person opens it, then stays open.
  assert.equal(await page.locator('#contextPanel').evaluate(el => el.classList.contains('collapsed')), true, 'Context panel starts closed');
  assert.equal(await page.locator('#contextToggle').innerText(), 'Context');
  assert.equal(await page.locator('#contextBtn').innerText(), 'Preview');
  assert.equal(await page.locator('#contextResizer').isVisible(), false, 'A closed panel has no resize handle');
  await page.locator('#contextToggle').click();
  assert.equal(await page.evaluate(() => localStorage.getItem('assistantContextPanelOpen')), 'true');
  assert.equal(await page.locator('#contextResizer').isVisible(), true);

  // Both side panels resize from the keyboard and remember their widths.
  const sidebarBefore = await page.locator('#sidebar').evaluate(el => el.getBoundingClientRect().width);
  await page.locator('#sidebarResizer').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  const sidebarAfter = await page.locator('#sidebar').evaluate(el => el.getBoundingClientRect().width);
  assert.equal(Math.round(sidebarAfter - sidebarBefore), 64);
  assert.equal(await page.evaluate(() => localStorage.getItem('assistantSidebarWidth')), String(Math.round(sidebarAfter)));
  await page.locator('#contextResizer').focus();
  await page.keyboard.press('End');
  assert.equal(await page.locator('#contextPanel').evaluate(el => Math.round(el.getBoundingClientRect().width)), 560);
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#contextPanel').evaluate(el => Math.round(el.getBoundingClientRect().width)), 316, 'Enter resets the width');
  assert.equal(await page.evaluate(() => localStorage.getItem('assistantContextWidth')), null);
  const box = await page.locator('#sidebarResizer').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(300, box.y + 220, { steps: 4 });
  await page.mouse.up();
  assert.equal(await page.evaluate(() => localStorage.getItem('assistantSidebarWidth')), '300', 'Dragging saves the new width');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.getActiveConv?.());
  if (await page.locator('#setupModal').evaluate(el => el.classList.contains('open'))) {
    await page.getByRole('button', { name: 'Continue disconnected', exact: true }).click();
  }
  assert.equal(await page.locator('#sidebar').evaluate(el => Math.round(el.getBoundingClientRect().width)), 300, 'Widths survive a reload');
  assert.equal(await page.locator('#contextPanel').evaluate(el => el.classList.contains('collapsed')), false, 'An opened panel reopens after reload');

  // Composer chips show what joins the next message and open its controls.
  await page.evaluate(() => openContextSection('goalSection'));
  await page.locator('#conversationGoal').fill('Plan the garden');
  await page.evaluate(() => updateTokenInfo());
  await page.waitForFunction(() => Array.from(document.querySelectorAll('#composerContext .composer-chip')).some(el => el.textContent === 'Goal'));
  await page.evaluate(() => openContextSection('toolsSection'));
  await page.locator('#chatToolWebSearch').check();
  await page.getByRole('button', { name: 'Save tools', exact: true }).click();
  await page.evaluate(() => updateTokenInfo());
  await page.waitForFunction(() => Array.from(document.querySelectorAll('#composerContext .composer-chip')).some(el => el.textContent === 'Web search'));
  await page.evaluate(() => { toggleContextPanel(false); document.getElementById('toolsSection').open = false; });
  await page.locator('#composerContext .composer-chip', { hasText: 'Web search' }).click();
  assert.equal(await page.locator('#toolsSection').evaluate(el => el.open), true, 'The tools chip opens the tools section');
  assert.equal(await page.locator('#contextPanel').evaluate(el => el.classList.contains('collapsed')), false);

  // The expanded writing area grows the composer and can be closed again.
  const collapsedHeight = await page.locator('#chatInput').evaluate(el => el.getBoundingClientRect().height);
  await page.locator('#composerExpandBtn').click();
  assert.equal(await page.locator('#composerExpandBtn').getAttribute('aria-pressed'), 'true');
  const expandedHeight = await page.locator('#chatInput').evaluate(el => el.getBoundingClientRect().height);
  assert.ok(expandedHeight > collapsedHeight + 200, 'Expanded composer is much taller');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'chatInput');
  await page.locator('#composerExpandBtn').click();
  assert.equal(await page.locator('#composerExpandBtn').getAttribute('aria-pressed'), 'false');

  // Settings search narrows the sections and highlights what matches.
  await page.evaluate(() => openSettings());
  assert.equal(await page.locator('.settings-tabs').evaluate(el => getComputedStyle(el).flexDirection), 'column', 'Wide screens use vertical navigation');
  await page.locator('#settingsSearch').fill('persona');
  assert.equal(await page.locator('#settingsTabButton-prompts').isVisible(), true);
  assert.equal(await page.locator('#settingsTabButton-sync').isVisible(), false, 'Sections without a match are hidden');
  assert.equal(await page.locator('#settingsTab-prompts').isVisible(), true, 'The first matching section opens');
  assert.ok(await page.locator('#settingsTab-prompts .settings-search-hit').count() > 0);
  assert.match(await page.locator('#settingsSearchStatus').textContent(), /matching setting/);
  await page.locator('#settingsSearch').fill('zzzz-no-such-setting');
  assert.equal(await page.locator('#settingsSearchStatus').textContent(), 'No settings match.');
  await page.locator('#settingsSearch').press('Escape');
  assert.equal(await page.locator('#settingsSearch').inputValue(), '');
  assert.equal(await page.locator('#settingsModal').evaluate(el => el.classList.contains('open')), true, 'Escape clears the search before closing Settings');
  assert.equal(await page.locator('.settings-tab:not([hidden])').count(), 7);
  await page.locator('#settingsTabButton-api').click();
  await page.locator('#settingsTabButton-api').focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'settingsTabButton-prompts', 'Arrow keys move through vertical tabs');
  await page.evaluate(() => closeSettings());

  // Narrow screens keep the drawers and drop the resize handles.
  await page.setViewportSize({ width: 700, height: 900 });
  assert.equal(await page.locator('#sidebarResizer').isVisible(), false);
  assert.equal(await page.locator('#contextResizer').isVisible(), false);
  await page.setViewportSize({ width: 1440, height: 1000 });
};
