const assert = require('node:assert/strict');

// Scoped memories, selective project files, and the context preview that explains them.
module.exports = async function(page) {
  const standalone = new URL(page.url()).pathname.endsWith('/synapse.html');
  const pattern = standalone ? '**/synapse.html*' : '**/js/main.js*';
  const exposure = `
    window.__knowledgeTest = { createProject, saveProjects, getProject, selectMemoriesForConversation,
      defaultMemoryScope, memoryAppliesTo, normalizeMemoryEntry, syncMergeMemoryLists,
      get conversations() { return conversations; } };
  `;
  const route = async request => {
    const response = await request.fetch();
    const body = await response.text();
    await request.fulfill({ response, body: standalone
      ? body.replace('</body>', '<script>' + exposure + '</script></body>') : body + exposure });
  };
  await page.route(pattern, route);
  try {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__knowledgeTest && getActiveConv());
    await page.evaluate(() => {
      window.confirm = () => true;
      closeModal('setupModal', false);
      localStorage.setItem('llmMemoryEnabled', 'true');
      localStorage.setItem('assistantSyncAutoPush', 'false');
    });

    const scoped = await page.evaluate(async () => {
      const t = __knowledgeTest;
      const project = t.createProject('Garden');
      await t.saveProjects();
      createConversation();
      const projectChat = getActiveConv();
      projectChat.projectId = project.id;
      projectChat.characterCard = { name: 'Mira' };
      createConversation();
      const plainChat = getActiveConv();
      const now = Date.now();
      await saveMemories([
        { id: 'm-global', text: 'Prefers metric units', createdAt: now - 5000 },
        { id: 'm-project', text: 'Garden beds face south', createdAt: now - 4000, scope: 'project', scopeId: project.id, scopeLabel: 'Garden' },
        { id: 'm-char', text: 'Mira owes the user a favour', createdAt: now - 3000, scope: 'character', scopeId: 'char:mira', scopeLabel: 'Mira' },
        { id: 'm-other', text: 'Belongs to another project', createdAt: now - 2000, scope: 'project', scopeId: 'proj_other' },
        { id: 'm-pinned', text: 'Pinned but old', createdAt: now - 90000, pinned: true }
      ]);
      const plainPrompt = await getMemoryPrompt(plainChat);
      const projectPrompt = await getMemoryPrompt(projectChat);
      const systemText = (await buildSystemMessages(projectChat)).map(message => message.content).join('\n');
      const ordered = t.selectMemoriesForConversation(await loadMemories(), projectChat).included.map(memory => memory.id);
      const tight = t.selectMemoriesForConversation(await loadMemories(), projectChat, 50);
      return {
        plainPrompt, projectPrompt, systemText, ordered,
        tightIncluded: tight.included.map(memory => memory.id), tightOmitted: tight.omitted.length,
        projectDefault: t.defaultMemoryScope({ ...projectChat, characterCard: null }),
        characterDefault: t.defaultMemoryScope(projectChat),
        plainDefault: t.defaultMemoryScope(plainChat),
        projectId: project.id
      };
    });
    assert.match(scoped.plainPrompt, /Prefers metric units/);
    assert.doesNotMatch(scoped.plainPrompt, /Garden beds|Mira owes|another project/, 'scoped memories stay out of unrelated chats');
    assert.match(scoped.projectPrompt, /Garden beds face south/);
    assert.match(scoped.projectPrompt, /Mira owes the user a favour/);
    assert.doesNotMatch(scoped.projectPrompt, /another project/);
    assert.match(scoped.systemText, /Garden beds face south/, 'the request uses the conversation being sent, not the active one');
    assert.equal(scoped.ordered[0], 'm-pinned', 'pinned memories come first');
    assert.deepEqual(scoped.tightIncluded, ['m-pinned', 'm-char'], 'the allowance keeps pinned then newest memories');
    assert.equal(scoped.tightOmitted, 2);
    assert.equal(scoped.characterDefault.scope, 'character');
    assert.equal(scoped.projectDefault.scope, 'project');
    assert.equal(scoped.projectDefault.scopeId, scoped.projectId);
    assert.deepEqual(scoped.plainDefault, {});

    const normalized = await page.evaluate(() => {
      const t = __knowledgeTest;
      return {
        bad: t.normalizeMemoryEntry({ id: 'a', text: 'x', createdAt: 5, scope: 'project', scopeId: '', pinned: 'yes', updatedAt: 1, sourceConvId: '<bad>' }, 0),
        good: t.normalizeMemoryEntry({ id: 'b', text: 'y', createdAt: 5, scope: 'character', scopeId: 'char:mira', pinned: true, updatedAt: 9, sourceConvId: 'conv_1', sourceTitle: 'Chat' }, 0),
        merged: t.syncMergeMemoryLists([{ id: 'c', text: 'Edited here', createdAt: 5, updatedAt: 50 }], [{ id: 'c', text: 'Original', createdAt: 5 }])
      };
    });
    assert.deepEqual(normalized.bad, { id: 'a', text: 'x', createdAt: 5 }, 'invalid optional fields are dropped');
    assert.deepEqual(normalized.good, { id: 'b', text: 'y', createdAt: 5, scope: 'character', scopeId: 'char:mira', pinned: true, updatedAt: 9, sourceConvId: 'conv_1', sourceTitle: 'Chat' });
    assert.equal(normalized.merged.find(memory => memory.id === 'c').text, 'Edited here', 'a later edit wins a sync merge');

    // The manager: edit, pin, rescope, add, delete, with the active-chat preview.
    await page.evaluate(async () => {
      const conv = __knowledgeTest.conversations.find(item => item.characterCard?.name === 'Mira');
      switchConversation(conv.id);
      await openManageMemories();
    });
    await page.waitForSelector('#memoriesModal.open .memory-row');
    const summary = await page.textContent('#memorySummary');
    assert.match(summary, /4 of 5 sent with the next message in this chat/);
    const rows = await page.$$eval('#memoryList .memory-row', rows => rows.map(row => row.dataset.memoryId));
    assert.deepEqual(rows.sort(), ['m-char', 'm-global', 'm-pinned', 'm-project']);

    await page.click('.memory-row[data-memory-id="m-global"] button:has-text("Edit")');
    await page.fill('.memory-row[data-memory-id="m-global"] textarea', 'Prefers metric units and Celsius');
    await page.click('.memory-row[data-memory-id="m-global"] button:has-text("Save memory")');
    await page.waitForFunction(() => document.querySelector('.memory-row[data-memory-id="m-global"] .memory-text')?.textContent.includes('Celsius'));
    await page.click('.memory-row[data-memory-id="m-project"] button:has-text("Pin")');
    await page.waitForSelector('.memory-row.pinned[data-memory-id="m-project"]');

    await page.click('#memoryAddSection summary');
    await page.fill('#memoryNewText', 'Waters the beds at dawn');
    const scopeOptions = await page.$$eval('#memoryNewScope option', options => options.map(option => option.textContent));
    assert.deepEqual(scopeOptions, ['Everywhere', 'This project: Garden', 'This character: Mira']);
    assert.equal(await page.$eval('#memoryNewScope', select => select.selectedOptions[0].textContent), 'This character: Mira', 'new memories default to the chat\'s narrowest scope');
    await page.selectOption('#memoryNewScope', { label: 'This project: Garden' });
    await page.click('button:has-text("Add memory")');
    await page.waitForFunction(() => [...document.querySelectorAll('.memory-text')].some(node => node.textContent === 'Waters the beds at dawn'));

    await page.click('.memory-row[data-memory-id="m-char"] button:has-text("Delete")');
    await page.waitForFunction(() => !document.querySelector('.memory-row[data-memory-id="m-char"]'));

    const stored = await page.evaluate(async () => (await loadMemories()).map(({ id, text, scope, pinned, updatedAt }) => ({ id, text, scope, pinned, edited: Boolean(updatedAt) })));
    const byText = Object.fromEntries(stored.map(memory => [memory.text, memory]));
    assert.equal(byText['Prefers metric units and Celsius'].edited, true);
    assert.equal(byText['Garden beds face south'].pinned, true);
    assert.equal(byText['Waters the beds at dawn'].scope, 'project');
    assert.equal(stored.some(memory => memory.id === 'm-char'), false);

    await page.selectOption('#memoryFilter', 'all');
    assert.equal(await page.$$eval('#memoryList .memory-row', rows => rows.length), 5, 'All memories includes other scopes');
    await page.evaluate(() => closeModal('memoriesModal'));

    const preview = await page.evaluate(async () => {
      await openContextPreview();
      return document.getElementById('contextPreviewBody').textContent;
    });
    assert.match(preview, /Memories sent/);
    assert.match(preview, /Project: Garden, pinned: Garden beds face south/);
  } finally {
    await page.unroute(pattern, route);
  }
};
