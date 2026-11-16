const assert = require('node:assert/strict');

// Branch tree, message bookmarks, and keyword lorebooks.
module.exports = async function(page) {
  const origin = new URL(page.url()).origin;
  const base = origin + '/__branches';
  const standalone = new URL(page.url()).pathname.endsWith('/synapse.html');
  const pattern = standalone ? '**/synapse.html*' : '**/js/main.js*';
  const exposure = `
    window.__branchTest = { normalizeLorebook, lorebookFromImport, selectLoreEntries, loreKeyMatches, loreScanText,
      normalizeConversationRecord, saveConversationImmediately, get conversations() { return conversations; } };
  `;
  const instrument = async request => {
    const response = await request.fetch();
    const body = await response.text();
    await request.fulfill({ response, body: standalone
      ? body.replace('</body>', '<script>' + exposure + '</script></body>') : body + exposure });
  };
  const requests = [];
  const provider = async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'The keeper waves.' } }] }) });
  };
  const systemText = body => body.messages.filter(message => message.role === 'system').map(message => message.content).join('\n');
  const panelSection = id => page.locator('#' + id);
  const openSection = id => page.evaluate(id => {
    toggleContextPanel(true);
    document.getElementById(id).open = true;
  }, id);
  await page.route(pattern, instrument);
  await page.route(base + '/**', provider);
  try {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__branchTest && getActiveConv());
    await page.evaluate(base => {
      window.confirm = () => true;
      closeModal('setupModal', false);
      Object.entries({
        llmProvider: 'custom', llmProxyUrl: base + '/v1', llmModel: 'fixture-model', llmApiFormat: 'openai',
        llmStreaming: 'false', llmMaxTokens: '64', llmMemoryEnabled: 'false', llmWebSearch: 'false',
        llmUrlFetch: 'false', assistantSyncAutoPush: 'false', llmAutoTitle: 'false'
      }).forEach(([key, value]) => localStorage.setItem(key, value));
    }, base);

    // Pure helpers: normalising, importing other formats, matching and the allowance.
    const pure = await page.evaluate(() => {
      const t = __branchTest;
      const book = t.normalizeLorebook({ name: ' Coast ', scanDepth: 99, budget: 10, entries: [
        { id: 'a', keys: 'Mira, mira, Lighthouse', content: 'Mira keeps the light.' },
        { id: 'a', keys: [], content: 'Same id', constant: true },
        { id: 'b', keys: ['x'], content: '   ' }
      ] });
      const card = t.lorebookFromImport({ spec: 'chara_card_v2', data: { name: 'Mira', character_book: {
        name: 'Book', scan_depth: 2, token_budget: 300, entries: [
          { keys: ['dragon'], content: 'Dragons hoard bells.', insertion_order: 5, enabled: true },
          { keys: ['off'], content: 'Hidden', enabled: false },
          { keys: [], content: 'Always there', constant: true, case_sensitive: true }
        ] } } }, 'Fallback');
      const world = t.lorebookFromImport({ entries: { 0: { key: ['elf'], comment: 'Elves', content: 'Elves are tall.', order: 10, disable: true } } }, 'World');
      const selectionBook = t.normalizeLorebook({ budget: 500, entries: [
        { id: 'low', keys: ['dragon'], content: 'L'.repeat(300), priority: 1 },
        { id: 'high', keys: ['dragon'], content: 'H'.repeat(300), priority: 9 },
        { id: 'always', keys: [], content: 'A'.repeat(100), constant: true },
        { id: 'off', keys: ['dragon'], content: 'Off', enabled: false },
        { id: 'miss', keys: ['griffin'], content: 'Griffins' }
      ] });
      const selection = t.selectLoreEntries(selectionBook, 'A dragon sleeps.');
      const scanBook = t.normalizeLorebook({ scanDepth: 1, entries: [{ keys: ['old'], content: 'Old' }] });
      const scanned = t.loreScanText(scanBook, [{ role: 'user', content: 'old news' }, { role: 'assistant', content: 'fresh news' }]);
      const conv = t.normalizeConversationRecord({ id: 'conv_norm', title: 'N', createdAt: 1, updatedAt: 1, messages: [
        { role: 'user', content: 'a', bookmark: { label: '  Turning point  ', createdAt: 5 } },
        { role: 'user', content: 'b', bookmark: {} },
        { role: 'user', content: 'c', bookmark: 'nope' }
      ], lorebook: 'broken' });
      return {
        book: { name: book.name, scanDepth: book.scanDepth, budget: book.budget, count: book.entries.length,
          keys: book.entries[0].keys, ids: book.entries.map(entry => entry.id) },
        empty: t.normalizeLorebook('x'),
        card: { name: card.name, scanDepth: card.scanDepth, budget: card.budget,
          entries: card.entries.map(entry => [entry.priority, entry.enabled !== false, entry.constant === true, entry.caseSensitive === true]) },
        world: { name: world.entries[0].name, enabled: world.entries[0].enabled, priority: world.entries[0].priority },
        none: t.lorebookFromImport({ name: 'Nothing' }, 'x'),
        matches: [t.loreKeyMatches('cat', 'concatenate'), t.loreKeyMatches('cat', 'A cat sat.'),
          t.loreKeyMatches('Cat', 'a cat', true), t.loreKeyMatches('猫', '我的猫很可爱'), t.loreKeyMatches('the light', 'Into THE LIGHT!')],
        included: selection.included.map(item => [item.entry.id, item.reason]),
        omitted: selection.omitted.map(item => item.entry.id),
        scanned,
        bookmarks: conv.messages.map(message => message.bookmark ? message.bookmark.label + ':' + message.bookmark.createdAt : null),
        hasBadLorebook: 'lorebook' in conv
      };
    });
    assert.deepEqual(pure.book.keys, ['Mira', 'Lighthouse'], 'keywords are trimmed and deduplicated');
    assert.equal(pure.book.name, 'Coast');
    assert.equal(pure.book.scanDepth, 50);
    assert.equal(pure.book.budget, 500);
    assert.equal(pure.book.count, 2, 'entries without content are dropped');
    assert.notEqual(pure.book.ids[0], pure.book.ids[1], 'duplicate entry ids are replaced');
    assert.equal(pure.empty, null);
    assert.deepEqual(pure.card, { name: 'Book', scanDepth: 2, budget: 1200,
      entries: [[5, true, false, false], [0, false, false, false], [0, true, true, true]] });
    assert.deepEqual(pure.world, { name: 'Elves', enabled: false, priority: 10 }, 'SillyTavern world info imports');
    assert.equal(pure.none, null);
    assert.deepEqual(pure.matches, [false, true, false, true, true]);
    assert.deepEqual(pure.included, [['always', 'Always on'], ['high', 'Matched \u201cdragon\u201d']],
      'always-on entries come first, then higher priority, within the allowance');
    assert.deepEqual(pure.omitted, ['low'], 'a matched entry that does not fit is reported as left out');
    assert.equal(pure.scanned.includes('old'), false, 'only the last scanned messages are searched');
    assert.equal(pure.scanned.includes('fresh'), true);
    assert.deepEqual(pure.bookmarks, ['Turning point:5', 'Bookmark:' + pure.bookmarks[1].split(':')[1], null]);
    assert.equal(pure.hasBadLorebook, false);

    // A chat to work in.
    await page.evaluate(async () => {
      createConversation();
      const conv = getActiveConv();
      conv.title = 'Harbour';
      conv.messages.push(
        { role: 'user', content: 'Tell me about the harbour.' },
        { role: 'assistant', content: 'Boats bob in the harbour.', swipes: ['Boats bob in the harbour.'], swipeIndex: 0 },
        { role: 'user', content: 'Who lives in the lighthouse?' },
        { role: 'assistant', content: 'A keeper, I think.', swipes: ['A keeper, I think.'], swipeIndex: 0 }
      );
      await __branchTest.saveConversationImmediately(conv);
      renderMessages();
      renderContextPanel();
    });

    // Lorebook manager.
    await openSection('lorebookSection');
    await panelSection('lorebookSection').getByRole('button', { name: 'Create lorebook', exact: true }).click();
    const modal = page.locator('#lorebookModal');
    await modal.waitFor({ state: 'visible' });
    assert.match(await page.locator('#lorebookSummary').textContent(), /No entries yet/);
    assert.equal(await page.locator('#lorebookAddSection').evaluate(node => node.open), true, 'the add form starts open when empty');
    const addForm = page.locator('#lorebookAddForm');
    await addForm.getByRole('button', { name: 'Add entry', exact: true }).click();
    assert.equal(await addForm.getByRole('alert').textContent(), 'Write what the entry should tell the model.');
    await addForm.getByLabel('Content').fill('Mira keeps the lighthouse lamp burning.');
    await addForm.getByRole('button', { name: 'Add entry', exact: true }).click();
    assert.equal(await addForm.getByRole('alert').textContent(), 'Add at least one keyword, or turn on Always on.');
    assert.equal(await addForm.getByLabel('Keywords, separated by commas').getAttribute('aria-invalid'), 'true');
    await addForm.getByLabel('Name').fill('Mira');
    await addForm.getByLabel('Keywords, separated by commas').fill('lighthouse, Mira');
    await addForm.getByLabel('Priority').fill('5');
    await addForm.getByRole('button', { name: 'Add entry', exact: true }).click();
    await page.locator('#lorebookList .lore-row').first().waitFor();
    assert.equal(await addForm.getByLabel('Content').inputValue(), '', 'the add form clears after adding');

    await addForm.getByLabel('Name').fill('Weather');
    await addForm.getByLabel('Content').fill('Fog rolls in every evening.');
    await addForm.getByLabel('Always on: send with every message').check();
    await addForm.getByRole('button', { name: 'Add entry', exact: true }).click();
    await addForm.getByLabel('Name').fill('Dragons');
    await addForm.getByLabel('Keywords, separated by commas').fill('dragon');
    await addForm.getByLabel('Content').fill('Dragons nest in the cliffs.');
    await addForm.getByRole('button', { name: 'Add entry', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('#lorebookList .lore-row').length === 3);
    assert.equal(await page.locator('#lorebookSummary').textContent(), '2 of 3 entries apply to the next message.');
    const miraRow = page.locator('#lorebookList .lore-row', { hasText: 'Mira' });
    assert.match(await miraRow.textContent(), /Keywords: lighthouse, Mira · Priority 5 · Sent next: Matched “lighthouse”/);
    assert.match(await page.locator('#lorebookList .lore-row', { hasText: 'Dragons' }).textContent(), /Not sent next/);

    await miraRow.getByRole('button', { name: 'Edit Mira', exact: true }).click();
    const editForm = page.locator('#lorebookList .lore-entry-form');
    await editForm.getByLabel('Content').fill('Mira, the keeper, never leaves the lighthouse.');
    await editForm.getByRole('button', { name: 'Save entry', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#lorebookList .lore-entry-form'));
    assert.match(await miraRow.textContent(), /never leaves/);

    const weatherRow = page.locator('#lorebookList .lore-row', { hasText: 'Weather' });
    await weatherRow.getByRole('button', { name: 'Turn off Weather', exact: true }).click();
    await page.waitForFunction(() => /1 of 3 entries/.test(document.getElementById('lorebookSummary').textContent));
    assert.match(await weatherRow.textContent(), /Turned off/);
    await weatherRow.getByRole('button', { name: 'Turn on Weather', exact: true }).click();
    await page.waitForFunction(() => /2 of 3 entries/.test(document.getElementById('lorebookSummary').textContent));

    await page.locator('#lorebookName').fill('Harbour lore');
    await page.locator('#lorebookName').dispatchEvent('change');
    await page.locator('#lorebookScanDepth').fill('3');
    await page.locator('#lorebookScanDepth').dispatchEvent('change');
    await page.locator('#lorebookBudget').fill('99999');
    await page.locator('#lorebookBudget').dispatchEvent('change');
    const settings = await page.evaluate(() => {
      const book = getActiveConv().lorebook;
      return { name: book.name, scanDepth: book.scanDepth, budget: book.budget, field: document.getElementById('lorebookBudget').value };
    });
    assert.deepEqual(settings, { name: 'Harbour lore', scanDepth: 3, budget: 20000, field: '20000' }, 'settings are clamped and saved');

    // Import merges entries from a file; export writes a character book.
    await page.locator('#lorebookImportInput').setInputFiles({ name: 'cliffs.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ entries: { 0: { key: ['gull'], comment: 'Gulls', content: 'Gulls steal chips.' } } })) });
    await page.waitForFunction(() => document.querySelectorAll('#lorebookList .lore-row').length === 4);
    assert.equal(await page.evaluate(() => getActiveConv().lorebook.name), 'Harbour lore', 'import keeps the existing settings');
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#lorebookExportBtn').click()]);
    assert.equal(download.suggestedFilename(), 'harbour-lore-lorebook.json');
    const exported = JSON.parse(require('node:fs').readFileSync(await download.path(), 'utf8'));
    assert.equal(exported.name, 'Harbour lore');
    assert.equal(exported.scan_depth, 3);
    assert.equal(exported.entries.length, 4);
    assert.deepEqual(exported.entries.find(entry => entry.name === 'Mira').keys, ['lighthouse', 'Mira']);
    const reimported = await page.evaluate(book => __branchTest.lorebookFromImport(book, 'x').entries.length, exported);
    assert.equal(reimported, 4, 'an exported lorebook imports again');

    await page.locator('#lorebookList .lore-row', { hasText: 'Gulls' }).getByRole('button', { name: 'Delete Gulls', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('#lorebookList .lore-row').length === 3);
    await page.evaluate(() => closeModal('lorebookModal'));

    // The context panel, composer chip and preview explain what is sent.
    const sectionText = await panelSection('lorebookSection').textContent();
    assert.match(sectionText, /2 of 3/);
    assert.match(sectionText, /Sent with the next message:/);
    assert.match(sectionText, /Mira/);
    await page.locator('#chatInput').fill('Any dragon nearby?');
    await page.locator('#chatInput').dispatchEvent('input');
    await page.waitForFunction(() => [...document.querySelectorAll('.composer-chip')].some(chip => chip.textContent === '3 lore entries'));
    const preview = await page.evaluate(async () => {
      await openContextPreview();
      return document.getElementById('contextPreviewBody').textContent;
    });
    assert.match(preview, /Lorebook entries sent/);
    assert.match(preview, /Dragons · Matched “dragon”/);
    await page.evaluate(() => closeTopModal());

    const before = requests.length;
    await page.locator('#sendBtn').click();
    await page.waitForFunction(count => getActiveConv().messages.length === 6 && !document.getElementById('sendBtn').classList.contains('streaming'), before);
    const sent = systemText(requests[before]);
    assert.match(sent, /Lore notes that apply to this part of the conversation:/);
    assert.match(sent, /\[Dragons\]\nDragons nest in the cliffs\./);
    assert.match(sent, /\[Weather\]\nFog rolls in every evening\./);
    assert.match(sent, /\[Mira\]\nMira, the keeper/);

    // A temporary character card keeps its book as the chat's lorebook.
    await page.locator('#charImportInput').setInputFiles({ name: 'keeper.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ spec: 'chara_card_v2', data: { name: 'Keeper', description: 'Keeps the light.',
        first_mes: 'Welcome to the lighthouse.', character_book: { name: 'Keeper lore', entries: [
          { keys: ['lamp'], content: 'The lamp is brass.' }, { keys: ['stairs'], content: 'There are 212 stairs.' }
        ] } } })) });
    await page.waitForFunction(() => getActiveConv().title === 'Keeper');
    const imported = await page.evaluate(() => {
      const conv = getActiveConv();
      return { entries: conv.lorebook.entries.length, name: conv.lorebook.name, cardBook: 'character_book' in conv.characterCard };
    });
    assert.deepEqual(imported, { entries: 2, name: 'Keeper lore', cardBook: false });
    assert.match(await page.locator('.toast').last().textContent(), /Character imported: Keeper, with 2 lorebook entries/);

    // Bookmarks: add, jump, rename, branch, remove.
    await page.evaluate(() => {
      const harbour = __branchTest.conversations.find(conv => conv.title === 'Harbour');
      switchConversation(harbour.id);
    });
    await page.waitForFunction(() => getActiveConv().title === 'Harbour');
    await page.evaluate(() => {
      window.prompt = (message, value) => { window.__lastPrompt = { message, value }; return window.__nextPrompt === undefined ? value : window.__nextPrompt; };
    });
    const setPrompt = value => page.evaluate(value => { window.__nextPrompt = value; }, value);
    const message = index => page.locator('.msg-wrapper[data-msg-idx="' + index + '"]');
    const openMore = async index => {
      await message(index).focus();
      await message(index).getByRole('button', { name: 'More', exact: true }).click();
    };
    await setPrompt(null);
    await openMore(2);
    await page.getByRole('menuitem', { name: 'Bookmark', exact: true }).click();
    assert.equal(await page.evaluate(() => getActiveConv().messages[2].bookmark), undefined, 'cancelling the name adds nothing');
    assert.equal(await page.evaluate(() => window.__lastPrompt.value), 'Who lives in the lighthouse?');
    await setPrompt('Lighthouse question');
    await openMore(2);
    await page.getByRole('menuitem', { name: 'Bookmark', exact: true }).click();
    await message(2).locator('.msg-bookmark').waitFor();
    assert.equal(await message(2).locator('.msg-bookmark').textContent(), 'Bookmark: Lighthouse question');
    assert.match(await message(2).getAttribute('aria-label'), /bookmarked: Lighthouse question/);

    await openSection('bookmarksSection');
    assert.equal(await page.locator('#bookmarksStatus').textContent(), '1');
    const jump = panelSection('bookmarksSection').getByRole('button', { name: 'Go to Lighthouse question, message 3', exact: true });
    await jump.click();
    await page.waitForFunction(() => document.activeElement?.dataset?.msgIdx === '2' && document.activeElement.classList.contains('msg-flash'));

    await setPrompt('Who keeps the light');
    await openMore(2);
    await page.getByRole('menuitem', { name: 'Rename bookmark', exact: true }).click();
    await page.waitForFunction(() => getActiveConv().messages[2].bookmark?.label === 'Who keeps the light');

    const rootId = await page.evaluate(() => getActiveConv().id);
    await openSection('bookmarksSection');
    await panelSection('bookmarksSection').getByRole('button', { name: 'Branch from Who keeps the light', exact: true }).click();
    await page.waitForFunction(rootId => getActiveConv().id !== rootId, rootId);
    const forkId = await page.evaluate(() => getActiveConv().id);
    assert.equal(await page.evaluate(() => getActiveConv().messages.length), 3, 'branching keeps messages up to the bookmark');

    // The branch tree shows the whole family, with the open chat marked.
    await openSection('forksSection');
    const tree = panelSection('forksSection').locator('.branch-tree');
    await tree.waitFor();
    assert.equal(await page.locator('#forksStatus').textContent(), '2');
    assert.equal(await tree.locator('.branch-link').count(), 2);
    const current = tree.locator('.branch-link[aria-current="true"]');
    assert.match(await current.textContent(), /From message 3 · 3 messages · Open now/);
    assert.equal(await tree.locator('.branch-row').nth(1).evaluate(node => node.style.getPropertyValue('--branch-depth')), '1');
    await tree.locator('.branch-link').first().click();
    await page.waitForFunction(rootId => getActiveConv().id === rootId, rootId);
    await openSection('forksSection');
    assert.match(await tree.locator('.branch-link[aria-current="true"]').textContent(), /First chat/);

    await page.evaluate(forkId => {
      const fork = __branchTest.conversations.find(conv => conv.id === forkId);
      fork.parentConversationId = 'conv_missing';
      switchConversation(forkId);
    }, forkId);
    await openSection('forksSection');
    assert.match(await panelSection('forksSection').textContent(), /branched from a chat that has been deleted/);
    await page.evaluate(rootId => switchConversation(rootId), rootId);

    await openMore(2);
    await page.getByRole('menuitem', { name: 'Remove bookmark', exact: true }).click();
    await page.waitForFunction(() => !getActiveConv().messages[2].bookmark);
    assert.equal(await message(2).locator('.msg-bookmark').count(), 0);

    // Deleting a message keeps outputs pointing at the right source.
    await page.evaluate(async () => {
      const conv = getActiveConv();
      conv.outputs = [
        { id: 'out_a', title: 'From one', language: 'text', versions: [{ id: 'v1', number: 1, content: 'a', savedAt: 1 }], createdAt: 1, updatedAt: 1, sourceMessageIndex: 1 },
        { id: 'out_b', title: 'From three', language: 'text', versions: [{ id: 'v2', number: 1, content: 'b', savedAt: 1 }], createdAt: 1, updatedAt: 1, sourceMessageIndex: 3 }
      ];
      await __branchTest.saveConversationImmediately(conv);
      renderMessages();
    });
    await openMore(1);
    await page.getByRole('menuitem', { name: 'Delete response', exact: true }).click();
    const outputs = await page.evaluate(() => getActiveConv().outputs.map(output => [output.id, output.sourceMessageIndex ?? null]));
    assert.deepEqual(outputs, [['out_a', null], ['out_b', 2]]);

    // The lorebook survives a reload.
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__branchTest && getActiveConv());
    const stored = await page.evaluate(rootId => {
      const conv = __branchTest.conversations.find(item => item.id === rootId);
      return { entries: conv.lorebook.entries.length, budget: conv.lorebook.budget };
    }, rootId);
    assert.deepEqual(stored, { entries: 3, budget: 20000 });

    // Deleting the lorebook.
    await page.evaluate(rootId => {
      closeModal('setupModal', false);
      window.confirm = () => true;
      switchConversation(rootId);
      openLorebook();
    }, rootId);
    await modal.waitFor({ state: 'visible' });
    await page.locator('#lorebookDeleteBtn').click();
    await page.waitForFunction(rootId => !__branchTest.conversations.find(conv => conv.id === rootId).lorebook, rootId);
    await page.evaluate(() => closeModal('lorebookModal'));

    // Phones: the bookmark and branch buttons stay large enough to tap.
    await page.setViewportSize({ width: 390, height: 800 });
    await page.evaluate(() => { getActiveConv().messages[0].bookmark = { label: 'Start', createdAt: 1 }; renderContextPanel(); });
    await openSection('bookmarksSection');
    const tapHeight = await panelSection('bookmarksSection').locator('.bookmark-jump').evaluate(node => node.getBoundingClientRect().height);
    assert.ok(tapHeight >= 44, 'bookmark rows are at least 44px tall on phones');
    await page.evaluate(() => { delete getActiveConv().messages[0].bookmark; toggleContextPanel(false, false); });
    await page.setViewportSize({ width: 1280, height: 800 });
  } finally {
    await page.unroute(base + '/**', provider);
    await page.unroute(pattern, instrument);
  }
};
