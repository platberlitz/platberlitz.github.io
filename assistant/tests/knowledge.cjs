const assert = require('node:assert/strict');

// Scoped memories, selective project files, and the context preview that explains them.
module.exports = async function(page) {
  const standalone = new URL(page.url()).pathname.endsWith('/synapse.html');
  const pattern = standalone ? '**/synapse.html*' : '**/js/main.js*';
  const exposure = `
    window.__knowledgeTest = { createProject, saveProjects, getProject, selectMemoriesForConversation,
      defaultMemoryScope, memoryAppliesTo, normalizeMemoryEntry, syncMergeMemoryLists,
      normalizeProjectRecord, splitDocPassages, rankProjectPassages, projectFileContext,
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

    const files = await page.evaluate(async () => {
      const t = __knowledgeTest;
      const normalized = t.normalizeProjectRecord({ id: 'proj_norm', docs: [
        { id: 'a', name: 'A', text: 'x', mode: 'search' },
        { id: 'b', name: 'B', text: 'x', mode: 'off' },
        { id: 'c', name: 'C', text: 'x', mode: 'always' },
        { id: 'd', name: 'D', text: 'x', mode: 'bogus' }
      ] }).docs.map(doc => doc.mode || null);
      const long = 'word '.repeat(500).trim();
      const split = t.splitDocPassages('Short one.\n\nShort two.\n\n' + long);
      const project = t.createProject('Library');
      const filler = Array.from({ length: 6 }, (_, i) => ('Chapter ' + i + ' covers pruning roses and compost heaps in detail. ').repeat(14).trim()).join('\n\n');
      project.docs.push(
        { id: 'doc-style', name: 'Style guide', text: 'Write in short sentences.', createdAt: Date.now() },
        { id: 'doc-manual', name: 'Garden manual', mode: 'search', createdAt: Date.now(),
          text: filler + '\n\nWater the tomatoes deeply twice a week, more often in a heatwave.' },
        { id: 'doc-secret', name: 'Private notes', mode: 'off', text: 'EXCLUDED-MARKER tomatoes', createdAt: Date.now() }
      );
      await t.saveProjects();
      createConversation();
      const conv = getActiveConv();
      conv.projectId = project.id;
      const built = await buildRequestMessages(conv, { messageList: [], draftMessage: { role: 'user', content: 'How often should I water the tomatoes?' } });
      const systemText = built.systemMessages.map(message => message.content).join('\n');
      const empty = await buildRequestMessages(conv, { messageList: [] });
      return {
        normalized, splitCount: split.length, splitMax: Math.max(...split.map(part => part.length)), systemText,
        passages: built.projectFiles.passages.map(p => p.name + ':' + p.part),
        emptyPassages: empty.projectFiles.passages.length, projectId: project.id
      };
    });
    assert.deepEqual(files.normalized, ['search', 'off', null, null], 'only non-default valid modes are stored');
    assert.ok(files.splitCount >= 3 && files.splitMax <= 900, 'long text is split into bounded passages');
    assert.match(files.systemText, /Write in short sentences\./, 'always-included files are sent in full');
    assert.match(files.systemText, /Water the tomatoes deeply/, 'matching passages are sent');
    assert.match(files.systemText, /cite it as \[file name, part N\]/);
    assert.doesNotMatch(files.systemText, /EXCLUDED-MARKER/, 'excluded files are never sent');
    assert.doesNotMatch(files.systemText, /pruning roses/, 'unrelated passages stay out');
    assert.deepEqual(files.passages, ['Garden manual:7']);
    assert.equal(files.emptyPassages, 0, 'no passages without a message to match');

    await page.evaluate(projectId => openProjectsModal(projectId), files.projectId);
    const modes = await page.$$eval('#projDocList .project-doc-mode', selects => selects.map(select => select.value));
    assert.deepEqual(modes, ['always', 'search', 'off']);
    await page.selectOption('#projDocList .project-doc-row:nth-child(1) .project-doc-mode', 'off');
    await page.waitForFunction(projectId => __knowledgeTest.getProject(projectId).docs[0].mode === 'off', files.projectId);
    await page.waitForFunction(() => document.getElementById('projectSaveStatus').textContent === 'Saved');
    await page.evaluate(() => closeModal('projectsModal'));

    const filePreview = await page.evaluate(async () => {
      document.getElementById('chatInput').value = 'tomatoes watering schedule';
      await openContextPreview();
      const text = document.getElementById('contextPreviewBody').textContent;
      document.getElementById('chatInput').value = '';
      return { text, panel: document.getElementById('contextFilesBody').textContent };
    });
    assert.match(filePreview.text, /Project file passages/);
    assert.match(filePreview.text, /Garden manual, part 7 of 7/);
    assert.match(filePreview.text, /Project files excluded/);
    assert.match(filePreview.text, /Style guide/);
    assert.match(filePreview.panel, /Search when needed/);
  } finally {
    await page.unroute(pattern, route);
  }
};
