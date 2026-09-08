const assert = require('node:assert/strict');

module.exports = async function(page) {
  await page.waitForFunction(() => window.renderMessages && document.getElementById('settingsModal').dataset.a11yInit === '1');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (await page.locator('#setupModal').evaluate(el => el.classList.contains('open'))) {
    await page.getByRole('button', { name: 'Continue disconnected', exact: true }).click();
  }

  const search = await page.evaluate(() => {
    createConversation();
    const conv = getActiveConv();
    const assistant = 'hel**lo** world\n## Heading\nparagraph [li**nk**](https://example.invalid/hidden_destination)\n' +
      '| Left | Right |\n| --- | --- |\n| one | two |\n' +
      '```text\nsnake_case C# a < b && c > d\n```\n' +
      '\u0130Z \u{1F600} \u{10400} \u039F\u03A3\n<think>hidden_reasoning</think>visible ending';
    conv.messages.push(
      { role: 'user', content: 'literal_*_#|~ a < b && c > d [label](literal_url) <think>user_literal</think>' },
      { role: 'assistant', content: assistant, swipes: [assistant], swipeIndex: 0 }
    );
    renderMessages();
    // Simulate the text-node splits produced by syntax highlighting, without a CDN.
    const code = document.querySelector('.msg-bubble pre code');
    const token = document.createElement('span');
    token.textContent = 'snake';
    code.replaceChildren(token, document.createTextNode('_case C# a < b && c > d'));
    const before = Array.from(document.querySelectorAll('.msg-bubble'), el => el.textContent);
    openGlobalSearch();
    const rows = [];
    for (const [query, expected, highlight] of [
      ['literal_*_#|~', 1], ['[label](literal_url)', 1], ['<think>user_literal</think>', 1],
      ['snake_case', 1], ['C#', 1], ['a < b && c > d', 2], ['hello world', 1, 'hello world'],
      ['Heading paragraph', 1], ['paragraph link', 1], ['Left Right', 1], ['one two', 1],
      ['Headingparagraph', 0], ['hidden_destination', 0], ['hidden_reasoning', 0],
      ['hello   world', 1, 'hello world'], ['\u0130z', 1, '\u0130Z'], ['z \u{1F600}', 1, 'Z \u{1F600}'],
      ['\u{10428}', 1, '\u{10400}'], ['\u03BF\u03C2', 1, '\u039F\u03A3']
    ]) {
      document.getElementById('chatSearchInput').value = query;
      performChatSearch();
      performGlobalSearch(query);
      rows.push({ query, expected, highlight,
        count: document.getElementById('chatSearchCount').textContent,
        global: document.querySelectorAll('.global-search-result').length,
        highlighted: Array.from(document.querySelectorAll('.search-highlight'), el => el.textContent).join(''),
        globalHighlight: document.querySelector('.global-search-result-snippet mark')?.textContent
      });
    }
    clearChatHighlights();
    const after = Array.from(document.querySelectorAll('.msg-bubble'), el => el.textContent);
    document.getElementById('globalSearchInput').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    closeChatSearch();
    return { rows, before, after };
  });
  for (const result of search.rows) {
    assert.equal(result.count, result.expected ? result.expected + ' matches' : 'No matches', result.query + ': chat');
    assert.equal(result.global, result.expected, result.query + ': global');
    if (result.highlight) {
      assert.equal(result.highlighted, result.highlight, result.query + ': DOM highlight offsets');
      assert.equal(result.globalHighlight, result.highlight, result.query + ': snippet offsets');
    }
  }
  assert.deepEqual(search.after, search.before, 'Repeated search and cleanup preserve literal text');

  await page.evaluate(() => enterSelectMode());
  const checkbox = page.getByRole('checkbox', { name: 'Select user message 1 for screenshot', exact: true });
  await checkbox.focus();
  await page.keyboard.press('Space');
  assert.equal(await checkbox.isChecked(), true, 'Native keyboard selection toggles once');
  assert.equal(await page.locator('#selectCount').textContent(), '1 selected');
  assert.equal(await page.locator('#selectCount').getAttribute('role'), 'status');
  await page.evaluate(() => renderMessages());
  assert.equal(await checkbox.isChecked(), true, 'Selection survives rerender');
  await page.locator('.msg-wrapper').first().focus();
  await page.keyboard.press('Enter');
  assert.equal(await checkbox.isChecked(), false, 'Article keyboard shortcut stays supported');
  await checkbox.check();
  assert.equal(await checkbox.isChecked(), true, 'Native pointer selection is not cancelled by capture');
  await page.evaluate(() => exitSelectMode());
  assert.equal(await checkbox.count(), 0, 'Selection controls leave the accessibility tree on exit');
  assert.equal(await page.locator('[aria-pressed].msg-wrapper').count(), 0);
  assert.equal(await page.locator('#selectCount').textContent(), '0 selected');
  assert.equal(await page.locator('#ssBtn').isDisabled(), true);
  await page.evaluate(() => { enterSelectMode(); toggleMsgSelect(NaN); });
  assert.equal(await checkbox.isChecked(), false, 'Re-entry resets selection and rejects invalid indices');
  await page.locator('.msg-bubble').first().click();
  assert.equal(await checkbox.isChecked(), true, 'First toolbar-mode click selects immediately');
  await page.evaluate(() => { exitSelectMode(); enterSelectMode(true); toggleMsgSelect(0); });
  await page.locator('.msg-bubble').first().click();
  assert.equal(await checkbox.isChecked(), true, 'Long-press release does not undo selection');
  await page.locator('.msg-bubble').first().click();
  assert.equal(await checkbox.isChecked(), false);
  const screenshot = await page.evaluate(async () => {
    toggleMsgSelect(0);
    let controls = -1;
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = () => {};
    window.html2canvas = async container => {
      controls = container.querySelectorAll('.msg-select-checkbox').length;
      return { toDataURL: () => 'data:image/png;base64,AA==' };
    };
    try { await screenshotSelected(); }
    finally { HTMLAnchorElement.prototype.click = click; delete window.html2canvas; }
    return { controls, disabled: document.getElementById('ssBtn').disabled, count: document.getElementById('selectCount').textContent };
  });
  assert.deepEqual(screenshot, { controls: 0, disabled: true, count: '0 selected' });

  const normalized = await page.evaluate(() => {
    const result = normalizeImportedData({ conversations: [{ id: 'interaction-import', messages: [
      { role: 'user', content: 'first' }, { role: 'tool', content: 'removed' }, { role: 'user', content: 'last' }
    ], docs: [
      { id: 'owned', messageIndex: 2 }, { id: 'legacy' }, { id: 'legacy-null', messageIndex: null },
      ...[-1, 1, 3, 1.5, '2', {}, { valueOf: 1, toString: 1 }].map((messageIndex, i) => ({ id: 'bad-' + i, messageIndex }))
    ] }] }).conversations[0];
    return result.docs.map(doc => ({ id: doc.id, index: doc.messageIndex ?? null, hasIndex: Object.hasOwn(doc, 'messageIndex') }));
  });
  assert.deepEqual(normalized, [
    { id: 'owned', index: 1, hasIndex: true }, { id: 'legacy', index: null, hasIndex: false },
    { id: 'legacy-null', index: null, hasIndex: false }
  ], 'Normalize owners without coercion, remap filtered turns, preserve unowned legacy docs');

  await page.evaluate(async () => {
    createConversation();
    const conv = getActiveConv();
    const file = name => [{ type: 'file', file: { name, textContent: 'document text' } }];
    conv.messages.push({ role: 'user', content: file('first.txt') },
      { role: 'assistant', content: 'reply', swipes: ['reply'], swipeIndex: 0 },
      { role: 'user', content: file('last.txt') });
    conv.docs = [
      { id: 'first', name: 'first.txt', text: 'first document', messageIndex: 0 },
      { id: 'last', name: 'last.txt', text: 'retained document', messageIndex: 2 },
      { id: 'legacy', name: 'legacy.txt', text: 'legacy document' }
    ];
    await saveConversations();
    switchConversation(getActiveConv().id);
  });
  await page.locator('.msg-wrapper').first().hover();
  await page.locator('.msg-wrapper').first().getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Delete message', exact: true }).click();
  const fork = await page.evaluate(() => {
    const before = getActiveConv().docs.map(doc => [doc.id, doc.messageIndex ?? null]);
    const forked = forkBranch(1);
    return { before, docs: forked.docs.map(doc => [doc.id, doc.messageIndex ?? null]),
      hits: searchLocalDocs('retained', forked).map(doc => doc.id) };
  });
  assert.deepEqual(fork, { before: [['last', 1], ['legacy', null]], docs: [['last', 1], ['legacy', null]], hits: ['last'] });
  assert.deepEqual(await page.evaluate(() => forkBranch(0).docs.map(doc => doc.id)), ['legacy'], 'Earlier forks retain only unowned legacy docs');
  const legacy = await page.evaluate(() => normalizeImportedData({ conversations: [{ id: 'interaction-legacy', messages: [
    { role: 'user', content: 'shared' },
    { role: 'user', content: 'original', branches: [[{ role: 'user', content: 'replacement' }]] }
  ], docs: [{ id: 'shared', messageIndex: 0 }, { id: 'divergent', messageIndex: 1 }, { id: 'legacy' }] }] })
    .conversations.find(conv => conv.parentConversationId === 'interaction-legacy').docs.map(doc => doc.id));
  assert.deepEqual(legacy, ['shared', 'legacy'], 'Migrated branch excludes the replaced message owner');

  await page.evaluate(async () => {
    for (const [title, order, pinned] of [
      ['visible A', 10, false], ['hidden B', 11, false], ['visible C', 12, false],
      ['hidden D', 13, false], ['visible E', 14, false], ['visible Pinned', 0, true]
    ]) {
      createConversation();
      Object.assign(getActiveConv(), { title, sortOrder: order, pinned });
    }
    await saveConversations();
    setConversationSort('manual');
    document.getElementById('sidebarSearch').value = 'visible';
    filterConversations();
  });
  const visibleOrder = () => page.locator('.conv-item:visible .conv-title').allTextContents();
  await page.getByRole('button', { name: 'Actions for visible A', exact: true }).click();
  assert.equal(await page.getByRole('menuitem', { name: 'Move up', exact: true }).isDisabled(), true, 'Hidden and pinned rows are not move-up targets');
  assert.equal(await page.getByRole('menuitem', { name: 'Move down', exact: true }).isDisabled(), false);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Actions for visible C', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Move up', exact: true }).click();
  assert.deepEqual(await visibleOrder(), ['visible Pinned', 'visible C', 'visible A', 'visible E']);
  await page.getByRole('button', { name: 'Actions for visible C', exact: true }).click();
  assert.equal(await page.getByRole('menuitem', { name: 'Move up', exact: true }).isDisabled(), true);
  await page.keyboard.press('Escape');
  const drag = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.conv-item'));
    const source = rows.find(row => row.querySelector('.conv-title').textContent === 'visible E');
    const target = rows.find(row => row.querySelector('.conv-title').textContent === 'visible C');
    const transfer = new DataTransfer();
    transfer.setData('text/plain', source.dataset.convId);
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    return Array.from(document.querySelectorAll('.conv-item .conv-title'), el => el.textContent)
      .filter(title => /^(visible|hidden) /.test(title));
  });
  assert.deepEqual(drag, ['visible Pinned', 'visible E', 'hidden B', 'visible C', 'hidden D', 'visible A'], 'Drag and keyboard share visible-slot ordering');
  await page.getByRole('button', { name: 'Actions for visible A', exact: true }).click();
  assert.equal(await page.getByRole('menuitem', { name: 'Move down', exact: true }).isDisabled(), true);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Actions for visible Pinned', exact: true }).click();
  assert.equal(await page.getByRole('menuitem', { name: 'Move up', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('menuitem', { name: 'Move down', exact: true }).isDisabled(), true);
  await page.keyboard.press('Escape');

  await page.evaluate(() => {
    openSettingsSection('prompts');
    savePromptEntries([{ id: 7, name: 'Numeric', content: 'one', enabled: true },
      { id: 'quote"id', name: 'Quoted', content: 'two', enabled: true },
      { id: 'last', name: 'Last', content: 'three', enabled: true }]);
    renderPromptEntries();
  });
  assert.equal(await page.getByRole('button', { name: 'Move prompt Numeric up', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Move prompt Quoted down', exact: true }).click();
  assert.equal(await page.evaluate(() => document.activeElement.value), 'Quoted', 'Moving to the boundary keeps focus on the moved prompt');
  assert.equal(await page.getByRole('button', { name: 'Move prompt Quoted down', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Move prompt Numeric down', exact: true }).click();
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Move prompt Numeric down', 'Repeat movement keeps its direction');
  assert.deepEqual(await page.evaluate(() => loadPromptEntries().map(entry => entry.id)), ['last', '7', 'quote"id']);
  await page.keyboard.press('Escape');
  console.log('Interaction: literal/rendered search, Unicode highlights, screenshot selection, document owners, filtered reorder and prompt controls passed.');
};
