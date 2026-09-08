const assert = require('node:assert/strict');

module.exports = async function(page) {
  const standalone = new URL(page.url()).pathname.endsWith('/synapse.html');
  const pattern = standalone ? '**/synapse.html*' : '**/js/main.js*';
  const exposure = `
    window.__recoveryTest = { syncMergeSettingsStates, syncRecordTombstones, syncSaveTombstones,
      syncLoadTombstones, syncMergeConversationLists, createProject, saveProjects,
      reconcileConversationRecord, normalizeConversationRecord, contextDrafts, contextRevisions,
      replacePersistentConversations, getPersistentConversations, syncCapturePullSnapshot,
      syncPersistPullData, get pendingImport() { return pendingImport; } };
  `;
  // Instrument the actual response, including the bundled implementation in standalone mode.
  const route = async request => {
    const response = await request.fetch();
    const body = await response.text();
    if (standalone) assert.ok(body.includes('</body>'), 'standalone response has an instrumentation point');
    await request.fulfill({ response, body: standalone
      ? body.replace('</body>', '<script>' + exposure + '</script></body>') : body + exposure });
  };
  await page.route(pattern, route);
  try {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__recoveryTest && getActiveConv());
    await page.evaluate(async () => {
      window.confirm = () => true;
      closeModal('setupModal');
      localStorage.setItem('assistantSyncAutoPush', 'false');
      await saveConversations();
    });

    const publicationOrder = await page.evaluate(() => {
      const t = __recoveryTest;
      const base = t.normalizeConversationRecord({ id: 'publication-order', title: 'Same content', messages: [], createdAt: 1, updatedAt: 100, syncVersion: { writer: 1 } });
      const published = { ...base, shareGistId: 'publication', shareUrl: 'https://example.test/share', shareId: 'legacy-id', updatedAt: 20, syncVersion: { writer: 2 } };
      const revoked = { ...base, updatedAt: 10, syncVersion: { writer: 3 } };
      const merge = (current, incoming) => t.reconcileConversationRecord(new Map([[current.id, current]]), incoming, 'unused-conflict');
      const fields = record => ['shareGistId', 'shareUrl', 'shareId'].map(key => Object.hasOwn(record, key));
      const legacyPublished = { ...published, syncVersion: undefined, updatedAt: 1 };
      const legacyRevoked = { ...revoked, syncVersion: undefined, updatedAt: 2 };
      const tiedPublished = { ...published, syncVersion: revoked.syncVersion, updatedAt: revoked.updatedAt };
      return {
        published: merge(base, published).shareGistId,
        publishedReverse: merge(published, base).shareGistId,
        revoked: fields(merge(published, revoked)),
        revokedReverse: fields(merge(revoked, { ...published, updatedAt: 1000 })),
        legacy: fields(merge(legacyPublished, legacyRevoked)),
        legacyReverse: fields(merge(legacyRevoked, legacyPublished)),
        tied: fields(merge(tiedPublished, revoked)),
        tiedReverse: fields(merge(revoked, tiedPublished))
      };
    });
    assert.equal(publicationOrder.published, 'publication', 'newer publication revision wins despite an older clock');
    assert.equal(publicationOrder.publishedReverse, 'publication', 'older unpublished revision cannot erase publication');
    for (const key of ['revoked', 'revokedReverse', 'legacy', 'legacyReverse', 'tied', 'tiedReverse']) {
      assert.deepEqual(publicationOrder[key], [false, false, false], key + ': revocation clears all ownership fields without resurrection');
    }

    const importValidation = await page.evaluate(() => {
      const rejected = [{}, [], { memories: [null, {}, ''] }, { settings: { unknown: 'ignored' } },
        { settings: { llmPromptEntries: '{}' } }, { profiles: [null, 7, []] }, { projects: [null, 7, []] }];
      const accepted = [{ settings: { assistantTheme: 'dark' } }, { settings: { assistantPresets: '[]' } },
        { memories: ['Recognised fact'] }, { projects: [{ id: 'project-only', name: 'Only project' }] },
        { profiles: [{ id: 'profile-only', name: 'Only profile', settings: { llmModel: 'model' } }] },
        { conversation: { id: 'empty-chat', messages: [] } }];
      const accepts = data => { try { normalizeImportedData(data); return true; } catch { return false; } };
      return { rejected: rejected.map(accepts), accepted: accepted.map(accepts) };
    });
    assert.ok(importValidation.rejected.every(value => value === false), 'normalised empty or unrecognised imports are rejected');
    assert.ok(importValidation.accepted.every(Boolean), 'recognised non-chat data and empty chat records remain importable');

    const draftId = await page.evaluate(async () => {
      createConversation();
      setModelOverride('recovery-draft-model');
      const input = document.getElementById('chatInput');
      input.value = 'Draft survives reload';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await saveConversations();
      return getActiveConv().id;
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__recoveryTest && getActiveConv());
    const draftReload = await page.evaluate(() => {
      window.confirm = () => true;
      const normalize = modelOverride => __recoveryTest.normalizeConversationRecord({ id: 'draft-schema', draft: { modelOverride } }).draft.modelOverride;
      return { id: getActiveConv().id, draft: getActiveConv().draft, badge: document.getElementById('modelOverrideText').textContent,
        bounded: normalize('m'.repeat(400)), invalid: normalize({ model: 'invalid' }), empty: normalize('') };
    });
    assert.equal(draftReload.id, draftId);
    assert.equal(draftReload.draft.text, 'Draft survives reload');
    assert.equal(draftReload.draft.modelOverride, 'recovery-draft-model');
    assert.equal(draftReload.badge, 'recovery-draft-model', 'reload restores the draft model in the composer');
    assert.equal(draftReload.bounded.length, 300);
    assert.equal(draftReload.invalid, null);
    assert.equal(draftReload.empty, null);

    const libraries = await page.evaluate(() => {
      const merge = __recoveryTest.syncMergeSettingsStates;
      return ['llmPromptEntries', 'assistantPresets', 'assistantProfiles'].map(key => {
        const first = { id: 'first', name: 'First', content: 'old', enabled: true, createdAt: 1, updatedAt: 1 };
        const second = { ...first, id: 'second', name: 'Second' };
        const state = (entries, revision) => ({ settings: { [key]: JSON.stringify(entries) }, revisions: { [key]: revision } });
        const old = state([first, second], 1);
        const edited = state([second, { ...first, name: 'Edited', content: 'new' }], 2);
        const changed = merge(old, edited);
        let repeated = changed;
        for (let i = 0; i < 4; i++) repeated = merge(repeated, edited);
        const deleted = merge(old, state([], 3));
        return {
          key, changed, repeated, deleted, stale: merge(deleted, old),
          changedRecords: JSON.parse(changed.settings[key]),
          reverse: merge(edited, old), cleared: merge(old, { settings: { [key]: null }, revisions: { [key]: 3 } })
        };
      });
    });
    for (const result of libraries) {
      assert.deepEqual(result.changedRecords.map(record => record.id), ['second', 'first'], result.key + ': newer order wins');
      assert.equal(result.changedRecords[1].name, 'Edited', result.key + ': edit replaces rather than duplicates');
      if (result.key === 'llmPromptEntries') assert.equal(result.changedRecords[1].content, 'new');
      assert.deepEqual(result.changed, result.repeated, result.key + ': repeated pulls are idempotent');
      assert.deepEqual(result.changed, result.reverse, result.key + ': archive replay order does not override revisions');
      assert.equal(result.deleted.settings[result.key], '[]', result.key + ': deletion wins');
      assert.deepEqual(result.deleted, result.stale, result.key + ': stale archive cannot restore deletion');
      assert.equal(result.cleared.settings[result.key], null, result.key + ': cleared collection stays cleared');
    }

    const migration = await page.evaluate(async () => {
      await idbPut('memories', { id: 'database-memory', text: 'Database memory', createdAt: 1 });
      const fallback = JSON.stringify([{ id: 'fallback-memory', text: 'Fallback memory', createdAt: 2 }]);
      localStorage.setItem('assistantMemories', fallback);
      const put = IDBObjectStore.prototype.put;
      let readable;
      let retained;
      try {
        IDBObjectStore.prototype.put = function(...args) {
          if (this.name === 'memories') throw new Error('Injected memory migration failure');
          return put.apply(this, args);
        };
        readable = await loadMemories();
        retained = localStorage.getItem('assistantMemories');
      } finally { IDBObjectStore.prototype.put = put; }
      const beforeRetry = await idbGetAll('memories');
      await loadMemories();
      return { readable, retained, fallback, beforeRetry, saved: await idbGetAll('memories'), afterRetry: localStorage.getItem('assistantMemories') };
    });
    assert.deepEqual(migration.readable.map(memory => memory.id).sort(), ['database-memory', 'fallback-memory']);
    assert.equal(migration.retained, migration.fallback, 'failed migration retains its fallback source');
    assert.equal(migration.beforeRetry.length, 1, 'failed migration leaves database source untouched');
    assert.equal(migration.saved.length, 2, 'retry persists both readable sources');
    assert.equal(migration.afterRetry, null, 'only successful migration removes the fallback');

    const projectFiles = await page.evaluate(async () => {
      const t = __recoveryTest;
      const original = t.createProject('Files');
      original.docs.push({ id: 'remove-me', name: 'Old file', text: 'Old contents', createdAt: 1 });
      await t.saveProjects();
      openProjectsModal(original.id);
      document.getElementById('projName').value = 'Renamed';
      scheduleProjectAutosave();
      await removeProjectDoc('remove-me');
      const removed = structuredClone(getProject(original.id));
      document.getElementById('projName').value = 'Before attachment';
      scheduleProjectAutosave();
      const file = new File(['contents'], 'attached.txt', { type: 'text/plain' });
      file.text = async () => {
        document.getElementById('projInstructions').value = 'Edited while reading';
        scheduleProjectAutosave();
        return 'Attached contents';
      };
      await addProjectFiles({ target: { files: [file], value: 'selected' } });
      const attached = structuredClone(getProject(original.id));

      const beforeConflict = getProject(original.id);
      const stored = (await idbGet('meta', 'projects')).value;
      stored.find(project => project.id === original.id).instructions = 'Peer instructions';
      await idbPut('meta', { key: 'projects', value: stored });
      document.getElementById('projName').value = 'Conflict edit';
      scheduleProjectAutosave();
      await removeProjectDoc(attached.docs[0].id);
      const conflict = structuredClone(getProject(beforeConflict.id));
      const peer = structuredClone(getProject(original.id));

      const pending = new File(['late'], 'late.txt', { type: 'text/plain' });
      pending.text = async () => {
        deleteProject(conflict.id);
        await t.saveProjects();
        return 'Must not restore deleted project';
      };
      await addProjectFiles({ target: { files: [pending], value: 'selected' } });
      return { removed, attached, conflict, peer, deleted: !getProject(conflict.id), saved: (await idbGet('meta', 'projects')).value };
    });
    assert.equal(projectFiles.removed.name, 'Renamed');
    assert.equal(projectFiles.removed.docs.length, 0, 'removal survives ordinary autosave object replacement');
    assert.equal(projectFiles.attached.name, 'Before attachment');
    assert.equal(projectFiles.attached.instructions, 'Edited while reading');
    assert.equal(projectFiles.attached.docs[0].text, 'Attached contents', 'attachment survives both autosave waits');
    assert.notEqual(projectFiles.conflict.id, projectFiles.peer.id, 'conflict save rekeys the project');
    assert.equal(projectFiles.conflict.docs.length, 0, 'removal follows the rekeyed project');
    assert.equal(projectFiles.peer.docs.length, 1, 'peer project is not modified');
    assert.equal(projectFiles.deleted, true, 'late file read honours project deletion');
    assert.ok(!projectFiles.saved.some(project => project.id === projectFiles.conflict.id));

    const recovery = await page.evaluate(async () => {
      const t = __recoveryTest;
      closeModal('projectsModal');
      await t.saveProjects();
      createConversation();
      const conv = getActiveConv();
      conv.messages.push({ role: 'user', content: 'Saved message' });
      await saveConversations();
      const project = t.createProject('Recovery project');
      project.instructions = 'Saved instructions';
      await t.saveProjects();
      conv.messages.push({ role: 'user', content: 'Unsaved message' });
      document.getElementById('chatInput').value = 'Unsaved draft';
      getProject(project.id).instructions = 'Unsaved instructions';
      await idbPut('conversations', { id: 'database-only-chat', title: 'Stored only', messages: [], createdAt: 1, updatedAt: 1 });
      const storedProjects = (await idbGet('meta', 'projects')).value;
      storedProjects.push({ id: 'database-only-project', name: 'Stored only', instructions: 'Stored instructions', docs: [], createdAt: 1, updatedAt: 1 });
      await idbPut('meta', { key: 'projects', value: storedProjects });
      const fallback = JSON.stringify([{ id: 'recovery-memory', text: 'Fallback during failed export save', createdAt: 3 }]);
      localStorage.setItem('assistantMemories', fallback);
      const put = IDBObjectStore.prototype.put;
      const click = HTMLAnchorElement.prototype.click;
      try {
        IDBObjectStore.prototype.put = function(...args) {
          if (['conversations', 'memories'].includes(this.name)) throw new Error('Injected recovery write failure');
          return put.apply(this, args);
        };
        HTMLAnchorElement.prototype.click = function() { if (!this.download) return click.call(this); };
        const backup = await exportAllConversations();
        return {
          backup, imported: normalizeImportedData(backup), chatId: conv.id, projectId: project.id,
          live: structuredClone(conv), stored: await idbGet('conversations', conv.id),
          fallback, retained: localStorage.getItem('assistantMemories')
        };
      } finally {
        IDBObjectStore.prototype.put = put;
        HTMLAnchorElement.prototype.click = click;
        await saveConversations();
      }
    });
    assert.match(recovery.backup.recovery, /Local saving failed/);
    const ownChat = recovery.backup.conversations.find(chat => chat.id === recovery.chatId);
    assert.equal(ownChat.messages.at(-1).content, 'Unsaved message');
    assert.equal(ownChat.draft.text, 'Unsaved draft');
    assert.equal(recovery.backup.drafts.find(draft => draft.conversationId === recovery.chatId).text, 'Unsaved draft');
    assert.ok(recovery.backup.conversations.some(chat => chat.conflictOf === recovery.chatId && chat.messages.length === 1), 'different stored chat is a separate recovery copy');
    assert.ok(recovery.backup.conversations.some(chat => chat.id === 'database-only-chat'));
    assert.equal(recovery.backup.projects.find(project => project.id === recovery.projectId).instructions, 'Unsaved instructions');
    assert.ok(recovery.backup.projects.some(project => project.id !== recovery.projectId && project.instructions === 'Saved instructions'));
    assert.ok(recovery.backup.projects.some(project => project.id === 'database-only-project'));
    assert.ok(recovery.backup.memories.some(memory => memory.id === 'recovery-memory'), 'export keeps readable fallback despite failed migration');
    assert.equal(recovery.retained, recovery.fallback);
    assert.equal(recovery.live.messages.at(-1).content, 'Unsaved message', 'export does not replace live edits');
    assert.equal(recovery.stored.messages.length, 1, 'failed export save leaves stored data unchanged');
    assert.equal(recovery.imported.conversations.length, recovery.backup.conversations.length, 'recovery copy remains importable');

    const sharing = await page.evaluate(async () => {
      localStorage.setItem('assistantSyncGistToken', 'disposable-recovery-test');
      createConversation();
      const conv = getActiveConv();
      conv.messages.push({ role: 'user', content: 'Share base' });
      await saveConversations();
      const peer = structuredClone(conv);
      conv.messages.push({ role: 'user', content: 'Local edit' });
      peer.messages.push({ role: 'user', content: 'Peer edit' });
      peer.syncVersion.peer = 1;
      peer.updatedAt++;
      await idbPut('conversations', peer);
      const fetch = window.fetch;
      let publication = 0;
      window.fetch = async (url, options) => {
        if (!String(url).startsWith('https://api.github.com/gists')) return fetch(url, options);
        return new Response(JSON.stringify({ id: 'recovery-publication-' + (++publication) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      };
      try {
        const conflictResult = await shareConversation({ confirmPublish: false });
        const conflictRecords = await idbGetAll('conversations');
        const warning = document.body.textContent.includes('Keep/revoke this link:');
        const successResult = await shareConversation({ confirmPublish: false });
        const owner = await idbGet('conversations', conv.id);
        const put = IDBObjectStore.prototype.put;
        let failedResult;
        try {
          IDBObjectStore.prototype.put = function(...args) {
            if (this.name === 'conversations') throw new Error('Injected share save failure');
            return put.apply(this, args);
          };
          failedResult = await shareConversation({ confirmPublish: false });
        } finally { IDBObjectStore.prototype.put = put; }
        return { conflictResult, conflictRecords, warning, successResult, owner, failedResult };
      } finally { window.fetch = fetch; }
    });
    assert.equal(sharing.conflictResult, false, 'publication without persisted ownership is not success');
    assert.ok(!sharing.conflictRecords.some(chat => chat.shareGistId === 'recovery-publication-1'));
    assert.equal(sharing.warning, true, 'lost ownership gives a persistent keep/revoke warning');
    assert.equal(sharing.successResult, true, 'normal sharing succeeds after verifying storage');
    assert.equal(sharing.owner.shareGistId, 'recovery-publication-2');
    assert.equal(sharing.failedResult, false, 'save rejection remains a publication warning, not success');

    const tombstones = await page.evaluate(async () => {
      const t = __recoveryTest;
      const project = t.createProject('Collision');
      await t.saveProjects();
      const future = Date.now() + 100000;
      getProject(project.id).updatedAt = future;
      const ledger = t.syncLoadTombstones();
      ledger.conversations[project.id] = 100;
      ledger.conversationVersions[project.id] = { writer: 1 };
      ledger.conversationRoots[project.id] = 'deleted-root';
      t.syncSaveTombstones(ledger);
      t.syncRecordTombstones('projects', [project.id], 300);
      const after = t.syncLoadTombstones();
      const merged = await t.syncMergeConversationLists([], [{ id: 'deleted-root', title: 'Deleted', messages: [], createdAt: 1, updatedAt: 1, syncVersion: { writer: 1 } }], after.conversations, after.conversationVersions, after.conversationRoots);
      return { id: project.id, after, future, visible: merged.conversations };
    });
    assert.equal(tombstones.after.conversationRoots[tombstones.id], 'deleted-root', 'project deletion leaves chat ancestry alone');
    assert.deepEqual(tombstones.after.conversationVersions[tombstones.id], { writer: 1 });
    assert.equal(tombstones.after.projects[tombstones.id], tombstones.future, 'deletion still covers a future timestamp');
    assert.deepEqual(tombstones.visible, [], 'deleted root is not resurrected after a project deletion');

    const stageImport = async data => {
      await page.evaluate(data => {
        closeModal('importPreviewModal');
        importConversation({ target: { files: [new File([JSON.stringify(data)], 'context-recovery.json', { type: 'application/json' })], value: '' } });
      }, data);
      await page.waitForFunction(() => document.getElementById('importPreviewModal').classList.contains('open'));
    };
    const contextImport = await page.evaluate(async () => {
      const t = __recoveryTest;
      await saveConversations();
      await t.saveProjects();
      createConversation();
      getActiveConv().messages.push({ role: 'user', content: 'Original context owner' });
      await saveConversations();
      const owner = getActiveConv();
      t.contextDrafts.set(owner, { summary: 'Unsaved summary', tools: { webSearch: true, urlFetch: false, confirm: true } });
      const snapshot = await t.syncCapturePullSnapshot();
      return { id: owner.id, data: { conversations: snapshot.conversations.map(record => record.id === owner.id
        ? { ...record, messages: [{ role: 'user', content: 'Imported source' }] } : record), projects: snapshot.projects, memories: snapshot.memories,
        drafts: [{ conversationId: owner.id, text: 'Imported draft', modelOverride: 'imported-model', updatedAt: Date.now() + 1000 }] } };
    });
    await stageImport(contextImport.data);
    for (const failure of ['cancel', 'write']) {
      const retained = await page.evaluate(async failure => {
        const t = __recoveryTest;
        const source = t.pendingImport;
        const owner = getActiveConv();
        const draft = t.contextDrafts.get(owner);
        const before = await idbGetAll('conversations');
        const prompts = [];
        const confirm = window.confirm;
        const put = IDBObjectStore.prototype.put;
        let consentBeforeWrite = false;
        window.confirm = text => { prompts.push(text); return failure !== 'cancel' || !text.includes('unsaved Context'); };
        try {
          if (failure === 'write') IDBObjectStore.prototype.put = function(record, ...args) {
            if (this.name === 'conversations' && record.messages?.some(message => message.content === 'Imported source')) {
              consentBeforeWrite = prompts.some(text => text.includes('unsaved Context'));
              throw new Error('Injected import transaction failure');
            }
            return put.call(this, record, ...args);
          };
          const result = await applyImport('replace');
          return { result, prompts, consentBeforeWrite, before, after: await idbGetAll('conversations'),
            sameOwner: getActiveConv() === owner, sameDraft: t.contextDrafts.get(owner) === draft, draft,
            sameSource: t.pendingImport === source };
        } finally { window.confirm = confirm; IDBObjectStore.prototype.put = put; }
      }, failure);
      assert.equal(retained.result, false, failure + ': destructive import was not applied');
      assert.ok(retained.prompts.some(text => text.includes('unsaved Context')), failure + ': asks explicitly about Context drafts');
      if (failure === 'write') assert.equal(retained.consentBeforeWrite, true, 'consent precedes the destructive transaction');
      assert.deepEqual(retained.after, retained.before, failure + ': stored chats are unchanged');
      assert.equal(retained.sameOwner, true);
      assert.equal(retained.sameDraft, true);
      assert.equal(retained.draft.summary, 'Unsaved summary');
      assert.equal(retained.sameSource, true, failure + ': staged import remains available for retry');
    }
    const applied = await page.evaluate(async id => {
      const result = await applyImport('replace');
      switchConversation(id);
      return { result, source: __recoveryTest.pendingImport, owner: getActiveConv(), draft: __recoveryTest.contextDrafts.get(getActiveConv()) };
    }, contextImport.id);
    assert.equal(applied.result, true, 'explicitly approved retry applies the import');
    assert.equal(applied.source, null);
    assert.equal(applied.owner.messages[0].content, 'Imported source');
    assert.equal(applied.owner.draft.modelOverride, 'imported-model', 'separate imported draft records retain their model choice');
    assert.equal(applied.draft?.summary, undefined, 'only successful approved replacement discards the Context draft');

    const removedOwnerImport = { ...contextImport.data, conversations: contextImport.data.conversations.filter(record => record.id !== contextImport.id), drafts: [] };
    await page.evaluate(() => __recoveryTest.contextDrafts.set(getActiveConv(), { summary: 'Do not drop a removed owner' }));
    await stageImport(removedOwnerImport);
    const removedOwner = await page.evaluate(async () => {
      const confirm = window.confirm;
      let asked = false;
      window.confirm = text => { if (text.includes('unsaved Context')) { asked = true; return false; } return true; };
      try { return { result: await applyImport('replace'), asked, draft: __recoveryTest.contextDrafts.get(getActiveConv()) }; }
      finally { window.confirm = confirm; }
    });
    assert.equal(removedOwner.result, false);
    assert.equal(removedOwner.asked, true, 'removing a draft owner also needs explicit consent');
    assert.equal(removedOwner.draft.summary, 'Do not drop a removed owner');

    const unchangedImport = await page.evaluate(() => ({ conversation: structuredClone(getActiveConv()) }));
    await stageImport(unchangedImport);
    const unchangedDraft = await page.evaluate(async () => {
      const t = __recoveryTest;
      const original = getActiveConv();
      const draft = t.contextDrafts.get(original);
      t.contextRevisions.set(original, 42);
      const confirm = window.confirm;
      let asked = false;
      window.confirm = text => { if (text.includes('unsaved Context')) asked = true; return false; };
      try {
        const result = await applyImport('merge');
        return { result, asked, sameDraft: t.contextDrafts.get(getActiveConv()) === draft, revision: t.contextRevisions.get(getActiveConv()) };
      } finally { window.confirm = confirm; }
    });
    assert.equal(unchangedDraft.result, true);
    assert.equal(unchangedDraft.asked, false, 'unchanged saved content needs no discard prompt');
    assert.equal(unchangedDraft.sameDraft, true, 'unchanged replacement inherits the Context draft');
    assert.equal(unchangedDraft.revision, 42);

    const lateDraft = await page.evaluate(async () => {
      const t = __recoveryTest;
      const snapshot = await t.syncCapturePullSnapshot();
      const transaction = IDBDatabase.prototype.transaction;
      const owner = getActiveConv();
      let error = '';
      IDBDatabase.prototype.transaction = function(names, mode, ...args) {
        const tx = transaction.call(this, names, mode, ...args);
        if (mode === 'readwrite' && Array.isArray(names) && names.includes('conversations')) {
          queueMicrotask(() => t.contextDrafts.set(owner, { summary: 'Edited after preparation' }));
        }
        return tx;
      };
      try {
        await t.syncPersistPullData({ conversations: snapshot.conversations, projects: snapshot.projects,
          memories: snapshot.memories, persistentActiveId: snapshot.persistentActiveId }, snapshot);
      } catch (caught) { error = caught.message; }
      finally { IDBDatabase.prototype.transaction = transaction; }
      return { error, draft: t.contextDrafts.get(owner), sameOwner: getActiveConv() === owner };
    });
    assert.match(lateDraft.error, /Local data changed/);
    assert.equal(lateDraft.sameOwner, true);
    assert.equal(lateDraft.draft.summary, 'Edited after preparation', 'a late Context edit invalidates the prepared write');

    const temporaryDraft = await page.evaluate(async () => {
      const t = __recoveryTest;
      createTemporaryConversation();
      const owner = getActiveConv();
      owner.title = 'Temporary draft owner';
      t.contextDrafts.set(owner, { summary: 'Temporary unsaved summary' });
      await saveConversations();
      const snapshot = await t.syncCapturePullSnapshot();
      const preserved = t.replacePersistentConversations(snapshot.conversations, true, true);
      const confirm = window.confirm;
      let asked = false;
      let error = '';
      window.confirm = text => { asked = text.includes('Temporary draft owner'); return false; };
      try {
        await t.syncPersistPullData({ conversations: snapshot.conversations, projects: snapshot.projects, memories: snapshot.memories,
          persistentActiveId: snapshot.persistentActiveId, preserveTemporary: false }, snapshot);
      } catch (caught) { error = caught.message; }
      finally { window.confirm = confirm; }
      return { preserved, asked, error, sameOwner: getActiveConv() === owner, draft: t.contextDrafts.get(owner) };
    });
    assert.deepEqual(temporaryDraft.preserved, [], 'pull-style replacement preserves temporary drafts without prompting');
    assert.equal(temporaryDraft.asked, true, 'Replace includes temporary draft owners in its discard prompt');
    assert.match(temporaryDraft.error, /cancelled/);
    assert.equal(temporaryDraft.sameOwner, true);
    assert.equal(temporaryDraft.draft.summary, 'Temporary unsaved summary');
  } finally {
    await page.unroute(pattern, route);
  }
};
