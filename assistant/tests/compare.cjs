const assert = require('node:assert/strict');

// Preset versions, live model comparisons with prompt presets, and prompt tests.
module.exports = async function(page) {
  const origin = new URL(page.url()).origin;
  const base = origin + '/__compare';
  const standalone = new URL(page.url()).pathname.endsWith('/synapse.html');
  const pattern = standalone ? '**/synapse.html*' : '**/js/main.js*';
  const exposure = `
    window.__compareTest = { normalizePresetRecords, normalizePromptTests, normalizeStructuredSettingValue,
      targetWithPromptRecord, promptOverrideFor, savePromptEntries, loadPromptEntries, renderPromptEntries,
      readPresetRecords, normalizeConversationRecord, get conversations() { return conversations; } };
  `;
  const instrument = async request => {
    const response = await request.fetch();
    const body = await response.text();
    await request.fulfill({ response, body: standalone
      ? body.replace('</body>', '<script>' + exposure + '</script></body>') : body + exposure });
  };
  const deferred = () => {
    let release;
    const promise = new Promise(resolve => { release = resolve; });
    return { promise, release };
  };
  const sse = (parts, usage) => parts.map(part => 'data: ' + JSON.stringify({ choices: [{ delta: { content: part } }] }) + '\n\n').join('') +
    (usage ? 'data: ' + JSON.stringify({ choices: [], usage }) + '\n\n' : '') + 'data: [DONE]\n\n';
  const systemText = body => body.messages.filter(message => message.role === 'system').map(message => message.content).join('\n');
  const requests = [];
  let handler = () => ({ sse: sse(['Unexpected request']) });
  const provider = async route => {
    const body = route.request().postDataJSON();
    requests.push(body);
    const plan = handler(body) || {};
    if (plan.gate) await plan.gate.promise;
    try {
      if (plan.status) {
        await route.fulfill({ status: plan.status, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Server busy' } }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'text/event-stream', body: plan.sse });
      }
    } catch {
      // The request was stopped while it waited.
    }
  };
  const setPrompt = content => page.evaluate(content => {
    __compareTest.savePromptEntries([{ id: 'pe_style', name: 'Style', content, enabled: true }]);
    __compareTest.renderPromptEntries();
  }, content);
  await page.route(pattern, instrument);
  await page.route(base + '/**', provider);
  try {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__compareTest && getActiveConv());
    await page.evaluate(base => {
      window.confirm = () => true;
      closeModal('setupModal', false);
      Object.entries({
        llmProvider: 'custom', llmProxyUrl: base + '/v1', llmModel: 'fixture-model', llmApiFormat: 'openai',
        llmStreaming: 'true', llmMaxTokens: '64', llmMemoryEnabled: 'false', llmWebSearch: 'false',
        llmUrlFetch: 'false', assistantSyncAutoPush: 'false', llmTemperature: '0.7'
      }).forEach(([key, value]) => localStorage.setItem(key, value));
    }, base);

    const pure = await page.evaluate(() => {
      const t = __compareTest;
      const versions = Array.from({ length: 12 }, (_, index) => ({
        savedAt: index + 1, promptEntries: [{ id: 'e', name: 'n', content: 'v' + index, enabled: true }], persona: '', temperature: 0.5, extraParams: ''
      }));
      const [preset] = t.normalizePresetRecords([{ id: 'p1', name: 'One', promptEntries: [], updatedAt: 9, versions }]);
      const tests = t.normalizePromptTests([{ id: 'a', text: 'Hi' }, { id: 'a', text: 'Again' }, { text: '  ' },
        ...Array.from({ length: 25 }, (_, index) => ({ id: 'n' + index, text: 'x' }))]);
      const target = Object.freeze({ model: 'm', temperature: 0.7, extraParams: '{"top_p":1}' });
      return {
        updatedAt: preset.updatedAt,
        versionCount: preset.versions.length,
        lastVersion: preset.versions.at(-1),
        testIds: tests.slice(0, 2).map(test => test.id),
        testCount: tests.length,
        cleared: t.targetWithPromptRecord(target, { temperature: '', extraParams: '' }),
        set: t.targetWithPromptRecord(target, { temperature: '0.2' }).temperature,
        same: t.targetWithPromptRecord(target, null) === target,
        legacy: t.promptOverrideFor({ systemPrompt: 'S', persona: 'P' }),
        stored: JSON.parse(t.normalizeStructuredSettingValue('assistantPromptTests', JSON.stringify([{ text: 'Plain' }])))
      };
    });
    assert.equal(pure.updatedAt, 9);
    assert.equal(pure.versionCount, 10, 'only the latest ten versions are kept');
    assert.equal(pure.lastVersion.savedAt, 12);
    assert.equal(pure.lastVersion.temperature, '0.5');
    assert.deepEqual(pure.testIds, ['a', 'a_'], 'duplicate example ids are separated');
    assert.equal(pure.testCount, 20, 'blank examples are dropped and the list is capped');
    assert.equal(pure.cleared.temperature, null);
    assert.equal(pure.cleared.extraParams, '');
    assert.equal(pure.cleared.model, 'm');
    assert.equal(pure.set, 0.2);
    assert.equal(pure.same, true);
    assert.deepEqual(pure.legacy.entries.map(entry => entry.content), ['S', 'P']);
    assert.equal(pure.legacy.persona, undefined, 'legacy presets keep the persona as an entry');
    assert.equal(pure.stored[0].text, 'Plain');

    // Updating a preset keeps the previous version.
    await page.evaluate(() => {
      localStorage.setItem('assistantPresets', JSON.stringify([{ id: 'preset_terse', name: 'Terse',
        promptEntries: [{ id: 'pe_style', name: 'Style', content: 'Be terse.', enabled: true }], persona: '', temperature: '0.2', extraParams: '' }]));
      openSettings();
      switchSettingsTab('prompts', document.getElementById('settingsTabButton-prompts'));
    });
    const update = page.locator('#presetUpdateBtn');
    assert.equal(await update.isDisabled(), true, 'Update preset needs a chosen preset');
    await page.locator('#setPresetSelect').selectOption('preset_terse');
    assert.equal(await update.isDisabled(), false);
    assert.match(await page.locator('#presetVersionInfo').textContent(), /No earlier versions yet/);
    await setPrompt('Be very terse.');
    await update.click();
    let presets = await page.evaluate(() => __compareTest.readPresetRecords());
    assert.equal(presets[0].promptEntries[0].content, 'Be very terse.');
    assert.equal(presets[0].versions.length, 1);
    assert.equal(presets[0].versions[0].promptEntries[0].content, 'Be terse.');
    assert.match(await page.locator('#presetVersionInfo').textContent(), /1 earlier version kept/);
    await update.click();
    presets = await page.evaluate(() => __compareTest.readPresetRecords());
    assert.equal(presets[0].versions.length, 1, 'an unchanged preset does not gain a version');
    await setPrompt('Be friendly.');

    // A comparison with the same model and two prompt setups streams both replies live.
    // Loading the preset above also loaded its temperature; put the current setup back to 0.7.
    await page.evaluate(() => { closeModal('settingsModal', false); localStorage.setItem('llmTemperature', '0.7'); createConversation(); });
    await page.fill('#chatInput', 'Say hello');
    const gateB = deferred();
    handler = body => systemText(body).includes('Be very terse.')
      ? { gate: gateB, sse: sse(['Beta ', '**bold**'], { prompt_tokens: 12, completion_tokens: 5 }) }
      : { sse: sse(['Alpha ', 'reply']) };
    const beforeCompare = requests.length;
    await page.evaluate(() => openCompareModels());
    const dialog = page.locator('form.comparison-dialog');
    await dialog.locator('select[aria-label="Comparison target B"]').selectOption('manual');
    await page.getByRole('textbox', { name: 'Model name for target B', exact: true }).fill('fixture-model');
    await dialog.evaluate(form => form.requestSubmit());
    assert.match(await dialog.textContent(), /Choose two different models, providers or prompt presets\./);
    await page.getByRole('combobox', { name: 'Prompts for target B', exact: true }).selectOption('preset:preset_terse');
    await dialog.evaluate(form => form.requestSubmit());
    const columns = page.locator('.msg-wrapper.assistant').last().locator('.comparison-live-column');
    await page.waitForFunction(() => document.querySelectorAll('.comparison-live-column .comparison-live-status')[0]?.textContent.startsWith('Finished in'));
    assert.equal(await columns.count(), 2);
    assert.equal(await columns.nth(1).locator('.comparison-live-status').textContent(), 'Waiting for the first words…');
    assert.match(await columns.nth(0).locator('.comparison-live-body').textContent(), /Alpha reply/, 'the first reply shows before the second finishes');
    gateB.release();
    const results = page.locator('.comparison-results-dialog');
    await results.waitFor();
    const compareRequests = requests.slice(beforeCompare);
    assert.equal(compareRequests.length, 2);
    assert.equal(compareRequests.every(body => body.stream === true), true, 'comparison replies stream');
    const terse = compareRequests.find(body => systemText(body).includes('Be very terse.'));
    const friendly = compareRequests.find(body => systemText(body).includes('Be friendly.'));
    assert.ok(terse && friendly, 'each side uses its own prompts');
    assert.equal(terse.temperature, 0.2, 'the preset temperature applies to its side');
    assert.equal(friendly.temperature, 0.7);
    const sections = results.locator('.comparison-result');
    assert.equal(await sections.count(), 2);
    assert.match(await sections.nth(1).locator('h4').textContent(), /Terse/);
    assert.equal(await sections.nth(1).locator('.comparison-result-body strong').textContent(), 'bold', 'replies are rendered as Markdown');
    assert.match(await sections.nth(1).locator('.comparison-result-stats').textContent(), /5 output tokens, 12 input/);
    assert.match(await sections.nth(0).locator('.comparison-result-stats').textContent(), /output tokens \(estimated\)/);
    const stored = await page.evaluate(() => {
      const message = getActiveConv().messages.at(-1);
      const normalized = __compareTest.normalizeConversationRecord(JSON.parse(JSON.stringify(getActiveConv())));
      return { message: JSON.parse(JSON.stringify(message)), normalized: normalized.messages.at(-1) };
    });
    assert.equal(stored.message.comparisonTargets[1].prompts, 'Terse');
    assert.equal(stored.message.swipeRequests[1].usage.outputTokens, 5);
    assert.equal(Number.isFinite(stored.message.swipeRequests[1].firstTextMs), true);
    assert.equal(stored.normalized.comparisonTargets[1].prompts, 'Terse', 'comparison labels survive a reload');
    assert.deepEqual(stored.normalized.swipeRequests[1].usage, { inputTokens: 12, outputTokens: 5 });
    await results.getByRole('button', { name: 'Close', exact: true }).click();
    const lastMessage = page.locator('.msg-wrapper.assistant').last();
    await lastMessage.focus();
    await lastMessage.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Compare responses', exact: true }).click();
    await results.waitFor();
    assert.equal(await results.locator('.comparison-result').count(), 2, 'a finished comparison can be reopened');
    await results.getByRole('button', { name: 'Close', exact: true }).click();

    // Prompt tests: saved examples, two setups, retry and stop.
    await page.evaluate(() => {
      openSettings();
      switchSettingsTab('prompts', document.getElementById('settingsTabButton-prompts'));
    });
    await page.getByRole('button', { name: 'Test prompts', exact: true }).click();
    const modal = page.locator('#promptTestsModal');
    await modal.waitFor({ state: 'visible' });
    assert.match(await page.locator('#promptTestList').textContent(), /No examples yet/);
    assert.equal(await page.locator('#promptTestAddSection').evaluate(details => details.open), true);
    await page.fill('#promptTestNewName', 'Greeting');
    await page.fill('#promptTestNewText', 'Hello there');
    await modal.getByRole('button', { name: 'Add example', exact: true }).click();
    await page.fill('#promptTestNewText', 'Write a haiku');
    await modal.getByRole('button', { name: 'Add example', exact: true }).click();
    assert.equal(await page.locator('#promptTestCount').textContent(), '2 of 20');
    await modal.getByRole('button', { name: 'Edit Example 2', exact: true }).click();
    const editRow = page.locator('.prompt-test-row').nth(1);
    await editRow.locator('input').fill('Haiku');
    await editRow.getByRole('button', { name: 'Save example', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('assistantPromptTests')).map(test => test.name)), ['Greeting', 'Haiku']);
    const optionLabels = await page.locator('#promptTestConfigB option').allTextContents();
    assert.ok(optionLabels.some(label => /^Terse · earlier version 1/.test(label)), 'earlier preset versions can be tested');
    await page.locator('#promptTestConfigA').selectOption('current');
    await page.locator('#promptTestConfigB').selectOption('current');
    await page.locator('#promptTestRun').click();
    assert.equal(await page.locator('#promptTestStatus').textContent(), 'Choose two different setups to compare.');
    await page.locator('#promptTestConfigB').selectOption('preset:preset_terse');

    let failedOnce = false;
    handler = body => {
      const user = body.messages.at(-1).content;
      if (systemText(body).includes('Be very terse.') && user === 'Write a haiku' && !failedOnce) {
        failedOnce = true;
        return { status: 500 };
      }
      return { sse: sse([systemText(body).includes('terse') ? 'Short.' : 'Hello, friend!'], { prompt_tokens: 3, completion_tokens: 2 }) };
    };
    const beforeTests = requests.length;
    await page.locator('#promptTestRun').click();
    await page.waitForFunction(() => /replies finished/.test(document.getElementById('promptTestStatus').textContent));
    const testRequests = requests.slice(beforeTests);
    assert.equal(testRequests.length, 4);
    assert.deepEqual(testRequests.map(body => body.messages.filter(message => message.role !== 'system').map(message => message.content)),
      [['Hello there'], ['Hello there'], ['Write a haiku'], ['Write a haiku']], 'examples run without chat history');
    assert.equal(testRequests.some(body => JSON.stringify(body).includes('Say hello')), false);
    assert.equal(await page.locator('#promptTestStatus').textContent(), '3 of 4 replies finished. Use Retry on a failed reply to send it again.');
    const resultSections = page.locator('.prompt-test-result');
    assert.equal(await resultSections.count(), 2);
    assert.match(await resultSections.nth(0).locator('.comparison-live-status').first().textContent(), /^Finished in/);
    assert.match(await resultSections.nth(1).locator('.comparison-live-status').nth(1).textContent(), /^Failed: /);
    assert.equal(await resultSections.nth(0).getByRole('button', { name: /^Retry/ }).first().isVisible(), false, 'finished replies offer no Retry');
    await modal.getByRole('button', { name: 'Retry setup B for Haiku', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('promptTestStatus').textContent === '4 of 4 replies finished.');
    assert.equal(await resultSections.nth(1).locator('.comparison-live-body').nth(1).textContent(), 'Short.');

    const stopGate = deferred();
    handler = () => ({ gate: stopGate, sse: sse(['Late']) });
    await page.locator('#promptTestRun').click();
    await page.locator('#promptTestStop').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#promptTestConfigA').isDisabled(), true, 'setups are fixed while tests run');
    await page.locator('#promptTestStop').click();
    await page.waitForFunction(() => document.getElementById('promptTestStatus').textContent.startsWith('Stopped.'));
    stopGate.release();
    assert.equal(await page.locator('#promptTestStop').isHidden(), true);
    assert.equal(await resultSections.nth(0).locator('.comparison-live-status').first().textContent(), 'Stopped');
    assert.equal(await resultSections.nth(1).locator('.comparison-live-status').first().textContent(), 'Not sent');
    assert.equal(await resultSections.nth(1).getByRole('button', { name: /^Retry/ }).first().isVisible(), true);

    // Loading a setup replaces the current prompts.
    handler = body => ({ sse: sse([systemText(body).includes('terse') ? 'Short.' : 'Hello, friend!']) });
    await page.locator('#promptTestRun').click();
    await page.waitForFunction(() => document.getElementById('promptTestStatus').textContent === '4 of 4 replies finished.');
    await modal.getByRole('button', { name: 'Load Terse into your current prompts', exact: true }).click();
    assert.equal(await page.evaluate(() => __compareTest.loadPromptEntries()[0].content), 'Be very terse.');
    assert.equal(await page.locator('#promptTestStatus').textContent(), 'Loaded Terse into your current prompts.');
    await page.locator('#promptTestConfigA').selectOption('current');
    await page.locator('#promptTestConfigB').selectOption('version:preset_terse:0');
    await page.locator('#promptTestRun').click();
    await page.waitForFunction(() => document.getElementById('promptTestStatus').textContent === '4 of 4 replies finished.');
    await modal.locator('.prompt-test-apply button').click();
    assert.equal(await page.evaluate(() => __compareTest.loadPromptEntries()[0].content), 'Be terse.', 'an earlier version can be restored');
    assert.match(await page.locator('#promptTestStatus').textContent(), /Choose Update preset/);

    // Closing the window stops a running test.
    const closeGate = deferred();
    handler = () => ({ gate: closeGate, sse: sse(['Late']) });
    await page.locator('#promptTestRun').click();
    await page.locator('#promptTestStop').waitFor({ state: 'visible' });
    await modal.getByRole('button', { name: 'Close', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('promptTestStatus').textContent.startsWith('Stopped.'));
    closeGate.release();

    // Examples are kept after a reload.
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__compareTest && getActiveConv());
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('assistantPromptTests')).length), 2);
  } finally {
    await page.unroute(base + '/**', provider);
    await page.unroute(pattern, instrument);
  }
};
