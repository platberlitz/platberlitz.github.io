const assert = require('node:assert/strict');

// Editable outputs: opening code from a reply, versions, comparison, preview and targeted revisions.
module.exports = async function(page) {
  const origin = new URL(page.url()).origin;
  const base = origin + '/__outputs';
  const standalone = new URL(page.url()).pathname.endsWith('/synapse.html');
  const pattern = standalone ? '**/synapse.html*' : '**/js/main.js*';
  const exposure = `
    window.__outputsTest = { normalizeOutputRecord, diffOutputLines, cleanOutputRevision, suggestOutputTitle,
      buildSharePayload, saveConversationImmediately, get conversations() { return conversations; } };
  `;
  const instrument = async request => {
    const response = await request.fetch();
    const body = await response.text();
    await request.fulfill({ response, body: standalone
      ? body.replace('</body>', '<script>' + exposure + '</script></body>') : body + exposure });
  };
  const requests = [];
  const replies = [];
  const provider = async route => {
    requests.push(route.request().postDataJSON());
    const text = replies.shift() ?? 'Unexpected request';
    await route.fulfill({ contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: text }, finish_reason: 'stop' }] }) });
  };
  await page.route(pattern, instrument);
  await page.route(base + '/**', provider);
  try {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__outputsTest && getActiveConv());
    await page.evaluate(base => {
      window.confirm = () => true;
      closeModal('setupModal', false);
      Object.entries({
        llmProvider: 'custom', llmProxyUrl: base + '/v1', llmModel: 'fixture-model', llmApiFormat: 'openai',
        llmStreaming: 'false', llmMaxTokens: '64', llmMemoryEnabled: 'false', llmWebSearch: 'false',
        llmUrlFetch: 'false', assistantSyncAutoPush: 'false'
      }).forEach(([key, value]) => localStorage.setItem(key, value));
    }, base);

    const pure = await page.evaluate(() => {
      const t = __outputsTest;
      const record = t.normalizeOutputRecord({
        id: 'out_a', title: '  ', language: 'HTML', createdAt: 5, updatedAt: 9, draft: 'same',
        versions: [{ id: 'v1', number: 1, content: 'same', savedAt: 5 }, { content: 42 }, null]
      });
      return {
        record,
        rejected: t.normalizeOutputRecord({ id: '<bad>', versions: [] }),
        diff: t.diffOutputLines('a\nb\nc', 'a\nB\nc\nd'),
        cleaned: t.cleanOutputRevision('```html\n<b>New</b>\n```', '  <b>Old</b>\n'),
        titled: t.suggestOutputTitle('<html><title>Report card</title></html>', 'html', 0),
        heading: t.suggestOutputTitle('# Field notes\nText', 'markdown', 0),
        fallback: t.suggestOutputTitle('plain words', '', 2)
      };
    });
    assert.equal(pure.record.title, 'Untitled output');
    assert.equal(pure.record.language, 'html');
    assert.equal(pure.record.versions.length, 1, 'invalid versions are dropped');
    assert.equal(pure.record.draft, undefined, 'a draft equal to the saved version is not kept');
    assert.equal(pure.rejected, null);
    assert.deepEqual(pure.diff.map(row => row.type + ':' + row.text),
      ['same:a', 'remove:b', 'add:B', 'same:c', 'add:d']);
    assert.equal(pure.cleaned, '  <b>New</b>\n', 'fences are removed and the original spacing is kept');
    assert.equal(pure.titled, 'Report card');
    assert.equal(pure.heading, 'Field notes');
    assert.match(pure.fallback, /output 3$/);

    await page.evaluate(() => {
      createConversation();
      const conv = getActiveConv();
      conv.title = 'Outputs chat';
      conv.messages.push(
        { role: 'user', content: 'Make a page' },
        { role: 'assistant', content: 'Here it is:\n\n```html\n<h1>Hello</h1>\n<p>One</p>\n```\n\nAnd a script:\n\n```js\nconsole.log(1);\n```' }
      );
      renderMessages();
    });
    const editButtons = page.locator('.code-output-btn');
    assert.equal(await editButtons.count(), 2, 'every code block offers Edit');
    assert.equal(await editButtons.first().getAttribute('aria-label'), 'Edit this code in the outputs workspace');
    await editButtons.first().click();
    await page.waitForFunction(() => document.activeElement?.id === 'outputEditor');
    assert.equal(await page.locator('#contextPanel').evaluate(el => el.classList.contains('collapsed')), false, 'the context panel opens');
    assert.equal(await page.locator('#outputWorkspace').isVisible(), true);
    assert.equal(await page.locator('#contextPanel .context-panel-body').isVisible(), false, 'the workspace replaces the section list');
    assert.equal(await page.locator('#outputEditor').inputValue(), '<h1>Hello</h1>\n<p>One</p>');
    assert.equal(await page.locator('#outputLanguage').inputValue(), 'html');
    assert.match(await page.locator('#outputStatus').textContent(), /Version 1 saved/);
    assert.equal(await page.locator('#outputSaveBtn').isDisabled(), true);
    const stored = await page.evaluate(() => getActiveConv().outputs.map(output => ({ index: output.sourceMessageIndex, label: output.versions[0].label })));
    assert.deepEqual(stored, [{ index: 1, label: 'From the conversation' }]);

    await editButtons.first().click();
    assert.equal(await page.evaluate(() => getActiveConv().outputs.length), 1, 'editing the same code reopens its output');

    await page.locator('#outputEditor').fill('<h1>Hello</h1>\n<p>Two</p>');
    assert.equal(await page.locator('#outputStatus').textContent(), 'Unsaved changes');
    assert.equal(await page.locator('#outputDiscardBtn').isVisible(), true);
    await page.locator('#outputSaveBtn').click();
    await page.waitForFunction(() => /Version 2 saved/.test(document.getElementById('outputStatus').textContent));
    assert.equal(await page.evaluate(() => getActiveConv().outputs[0].versions.length), 2);
    assert.equal(await page.locator('#outputVersionCount').textContent(), '2');

    await page.locator('#outputWorkspace .output-section summary', { hasText: 'Versions' }).click();
    await page.getByRole('button', { name: 'Compare version 1 with the editor' }).click();
    const comparison = page.locator('#outputComparison');
    assert.equal(await comparison.isVisible(), true);
    assert.match(await comparison.textContent(), /Changes from version 1 to the editor/);
    assert.equal(await comparison.locator('.output-diff-summary').textContent(), '1 line added, 1 removed.');
    assert.equal(await comparison.locator('.output-diff-remove').textContent(), '- <p>One</p>');
    await page.locator('#outputEditor').fill('<h1>Hello</h1>\n<p>Two</p>\n<p>Three</p>');
    assert.equal(await comparison.locator('.output-diff-add').count(), 2, 'the comparison follows the editor');
    await page.locator('#outputDiscardBtn').click();
    await page.waitForFunction(() => document.getElementById('outputEditor').value === '<h1>Hello</h1>\n<p>Two</p>');

    await page.getByRole('button', { name: 'Restore version 1' }).click();
    await page.waitForFunction(() => /Version 3 saved/.test(document.getElementById('outputStatus').textContent));
    assert.equal(await page.locator('#outputEditor').inputValue(), '<h1>Hello</h1>\n<p>One</p>');
    assert.equal(await page.evaluate(() => getActiveConv().outputs[0].versions.at(-1).label), 'Restored version 1');

    await page.locator('#outputPreviewBtn').click();
    const frame = page.locator('#outputPreview iframe');
    await frame.waitFor();
    assert.equal(await frame.getAttribute('sandbox'), 'allow-scripts', 'previews stay isolated from the app');
    assert.equal(await page.locator('#outputPreviewBtn').textContent(), 'Hide preview');

    await page.locator('#outputTitle').fill('Greeting page');
    await page.locator('#outputTitle').press('Tab');
    await page.waitForFunction(() => getActiveConv().outputs[0].title === 'Greeting page');

    // A targeted revision only rewrites the selected text.
    await page.locator('#outputEditor').evaluate(editor => {
      const start = editor.value.indexOf('One');
      editor.focus();
      editor.setSelectionRange(start, start + 3);
      editor.dispatchEvent(new Event('select'));
    });
    assert.equal(await page.locator('#outputSelectionInfo').textContent(), '3 characters selected.');
    await page.locator('#outputRevisionInstruction').fill('Make it louder');
    replies.push('```\nONE!\n```');
    await page.locator('#outputReviseBtn').click();
    await page.getByRole('button', { name: 'Apply change' }).waitFor();
    const sent = requests.at(-1);
    const prompt = sent.messages.map(message => message.content).join('\n');
    assert.match(prompt, /<selection>\nOne\n<\/selection>/);
    assert.match(prompt, /Make it louder/);
    assert.match(await page.locator('#outputRevisionResult').textContent(), /Proposed change/);
    await page.getByRole('button', { name: 'Apply change' }).click();
    await page.waitForFunction(() => /Version 4 saved/.test(document.getElementById('outputStatus').textContent));
    assert.equal(await page.locator('#outputEditor').inputValue(), '<h1>Hello</h1>\n<p>ONE!</p>');
    assert.equal(await page.evaluate(() => getActiveConv().outputs[0].versions.at(-1).label), 'Revised: Make it louder');

    await page.locator('#outputEditor').evaluate(editor => editor.setSelectionRange(0, 0));
    await page.locator('#outputReviseBtn').click();
    assert.match(await page.locator('#outputRevisionResult').textContent(), /Select the text to revise in the editor first/);
    assert.equal(requests.length, 1, 'no request is sent without a selection');

    // Unsaved drafts survive a reload; outputs stay out of share links.
    await page.locator('#outputEditor').fill('<h1>Draft only</h1>');
    const convId = await page.evaluate(async () => {
      __outputsTest.saveConversationImmediately();
      await new Promise(resolve => setTimeout(resolve, 300));
      return getActiveConv().id;
    });
    const share = await page.evaluate(() => JSON.stringify(__outputsTest.buildSharePayload(getActiveConv())));
    assert.doesNotMatch(share, /Draft only|Greeting page/, 'share links never include outputs');

    await page.getByRole('button', { name: 'Back to context' }).click();
    assert.equal(await page.locator('#outputWorkspace').isVisible(), false);
    assert.match(await page.locator('#contextOutputsBody').textContent(), /Greeting page.*Unsaved changes/);

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__outputsTest && getActiveConv());
    const reloaded = await page.evaluate(id => {
      closeModal('setupModal', false);
      const conv = __outputsTest.conversations.find(item => item.id === id);
      return conv && { title: conv.outputs?.[0]?.title, versions: conv.outputs?.[0]?.versions.length, draft: conv.outputs?.[0]?.draft };
    }, convId);
    assert.deepEqual(reloaded, { title: 'Greeting page', versions: 4, draft: '<h1>Draft only</h1>' });

    // Forks keep outputs created up to the fork point; blank outputs can be created and deleted.
    const forked = await page.evaluate(async id => {
      window.confirm = () => true;
      await switchConversation(id);
      const conv = getActiveConv();
      conv.messages.push({ role: 'user', content: 'More' }, { role: 'assistant', content: 'Later reply' });
      conv.outputs.push({ ...conv.outputs[0], id: 'out_later', sourceMessageIndex: 3, title: 'Later' });
      renderMessages();
      forkBranch(1);
      await new Promise(resolve => setTimeout(resolve, 100));
      return getActiveConv().outputs.map(output => output.title);
    }, convId);
    assert.deepEqual(forked, ['Greeting page']);

    await page.evaluate(() => toggleContextPanel(true));
    await page.locator('#outputsSection summary').click();
    await page.getByRole('button', { name: 'New output' }).click();
    await page.waitForFunction(() => getActiveConv().outputs.length === 2);
    assert.equal(await page.locator('#outputEditor').inputValue(), '');
    await page.getByRole('button', { name: 'Delete output' }).click();
    await page.locator('#outputWorkspace').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => getActiveConv().outputs.length), 1);
    assert.equal(await page.evaluate(() => document.activeElement?.closest('#outputsSection') != null), true, 'focus returns to the outputs list');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => toggleContextPanel(false));
    const mobileButton = await page.locator('.code-output-btn').first().boundingBox();
    assert.ok(mobileButton && mobileButton.height >= 44 && mobileButton.width >= 44, 'Edit has a touch-sized target');
    await page.setViewportSize({ width: 1440, height: 1000 });
  } finally {
    await page.unroute(base + '/**', provider);
    await page.unroute(pattern, instrument);
  }
};
