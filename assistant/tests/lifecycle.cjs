const assert = require('node:assert/strict');

module.exports = async function(page) {
  const origin = new URL(page.url()).origin;
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));
  const standalone = new URL(page.url()).pathname.endsWith('/synapse.html');
  const pattern = standalone ? '**/synapse.html*' : '**/js/main.js*';
  const exposure = `
    window.__lifecycleTest = {
      beginSendingAction, endSendingAction, processQueuedFollowUps, contextDrafts,
      get action() { return foregroundAction; },
      startForeground() {
        if (!beginSendingAction()) throw new Error('Fixture foreground action refused');
        streaming = true;
        updateSendBtnState();
      },
      context() {
        const conv = getActiveConv();
        return structuredClone({ summary: conv.summary, updated: conv.summaryUpdatedAt,
          coverage: conv.summaryCoverage, draft: contextDrafts.get(conv)?.summary,
          flags: conv.messages.map(message => [message.includeInContext, message.autoCompacted]) });
      },
      state() {
        return { sending, streaming, queueing: queueingFollowUp,
          processing: processingFollowUpConversationId,
          armed: armedFollowUpConversationIds.has(getActiveConv().id),
          queue: structuredClone(getActiveConv().queuedFollowUps || []) };
      },
      delaySave() {
        const original = saveConversationImmediately;
        this.waiting = false;
        saveConversationImmediately = async (...args) => {
          saveConversationImmediately = original;
          this.waiting = true;
          await new Promise((resolve, reject) => {
            this.release = fail => fail ? reject(new Error('Injected lifecycle save failure')) : resolve();
          });
          return original(...args);
        };
      }
    };
    const lifecycleToast = showToast;
    __lifecycleTest.notices = [];
    showToast = (...args) => { __lifecycleTest.notices.push(String(args[0])); return lifecycleToast(...args); };
  `;
  // Append exposure to the actual source or bundle; never replace the bundle with source.
  const instrument = async route => {
    const response = await route.fetch();
    const body = await response.text();
    if (standalone) assert.ok(body.includes('</body>'), 'bundle instrumentation point exists');
    await route.fulfill({ response, body: standalone
      ? body.replace('</body>', '<script>' + exposure + '</script></body>') : body + exposure });
  };
  await page.route(pattern, instrument);
  const passed = [];
  const failures = [];
  const setup = async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__lifecycleTest && getActiveConv());
    await page.evaluate(async origin => {
      window.confirm = () => true;
      closeModal('setupModal', false);
      closeModal('settingsModal', false);
      Object.entries({ llmProvider: 'custom', llmProxyUrl: origin + '/__lifecycle/v1', llmModel: 'lifecycle-model',
        llmApiFormat: 'openai', llmStreaming: 'false', llmMaxTokens: '64', llmContextWindow: '',
        llmMemoryEnabled: 'false', llmWebSearch: 'false', llmUrlFetch: 'false', llmToolConfirm: 'false',
        llmPrefill: '', llmExtraParams: '', llmExcludeParams: '', llmForceSearch: 'false',
        assistantSyncAutoPush: 'false' }).forEach(([key, value]) => localStorage.setItem(key, value));
      createConversation();
      const conv = getActiveConv();
      conv.toolPolicy = { webSearch: false, urlFetch: false, confirm: false };
      for (let index = 0; index < 6; index++) conv.messages.push(index % 2
        ? { role: 'assistant', content: 'Partial ' + index, swipes: ['Partial ' + index], swipeIndex: 0,
            swipeRequests: [{ status: 'stopped', connection: { provider: 'custom',
              baseUrl: origin + '/__lifecycle/v1', apiFormat: 'openai', model: 'lifecycle-model', maxTokens: 64 } }] }
        : { role: 'user', content: 'Source ' + index });
      conv.summary = 'Crossing summary';
      conv.summaryCoverage = { version: 1, through: 6 };
      conv.summaryUpdatedAt = 123;
      conv.messages[0].includeInContext = false;
      conv.messages[2].includeInContext = false;
      conv.messages[2].autoCompacted = true;
      renderMessages();
      await saveConversations();
      const t = __lifecycleTest;
      t.requests = [];
      const fetch = window.fetch;
      window.fetch = async (url, options) => {
        if (!String(url).startsWith(origin + '/__lifecycle/')) return fetch(url, options);
        if (options?.method !== 'POST') return new Response('{"data":[]}', { headers: { 'Content-Type': 'application/json' } });
        t.requests.push({ body: JSON.parse(options.body), context: t.context() });
        return new Response(JSON.stringify({ choices: [{ message: { content: t.reply || ' suffix' }, finish_reason: 'stop' }] }),
          { headers: { 'Content-Type': 'application/json' } });
      };
    }, origin);
  };
  const start = async (name, args = []) => page.evaluate(({ name, args }) => {
    const t = __lifecycleTest;
    t.done = false;
    t.task = Promise.resolve().then(() => window[name](...args)).then(
      value => { t.result = value; }, error => { t.error = error.name + ': ' + error.message; }
    ).finally(() => { t.done = true; });
  }, { name, args });
  const finish = async () => {
    await page.waitForFunction(() => __lifecycleTest.done, null, { timeout: 5000 });
    const result = await page.evaluate(() => ({ result: __lifecycleTest.result, error: __lifecycleTest.error,
      notices: __lifecycleTest.notices, state: __lifecycleTest.state(),
      requestErrors: getActiveConv().messages.flatMap(message => (message.swipeRequests || []).map(request => request?.error || '')) }));
    assert.equal(result.error, undefined, 'action has no uncaught exception');
    assert.doesNotMatch([...result.notices, ...result.requestErrors].join('\n'), /ReferenceError|is not defined/, 'caught errors contain no ReferenceError');
    assert.equal(result.state.sending, false, 'foreground action is released');
    assert.equal(result.state.streaming, false, 'stream is released');
    return result;
  };
  const context = () => page.evaluate(() => __lifecycleTest.context());
  const requests = () => page.evaluate(() => __lifecycleTest.requests);
  const waitSave = () => page.waitForFunction(() => __lifecycleTest.waiting || __lifecycleTest.done, null, { timeout: 5000 });
  const check = async (name, test) => {
    try {
      await setup();
      await test();
      passed.push(name);
      console.log('  lifecycle: ' + name + ': passed');
    } catch (error) {
      failures.push(name + ': ' + error.message);
      console.error('  lifecycle: ' + name + ': FAILED: ' + error.message);
    } finally {
      await page.evaluate(async () => {
        const t = window.__lifecycleTest;
        t?.action?.controller.abort();
        t?.release?.();
        await t?.task;
      }).catch(() => {});
    }
  };
  try {
    for (const action of ['retryRequest', 'regenerate', 'continueMessage']) {
      const args = action === 'retryRequest' ? [3] : [];
      await check(action + ': context-limit preparation preserves summary', async () => {
        await page.evaluate(() => {
          localStorage.setItem('llmContextWindow', '128');
          getActiveConv().messages[2].content = 'large '.repeat(2000);
          getActiveConv().messages[3].swipeRequests[0].connection.contextWindow = 128;
        });
        const before = await context();
        await start(action, args);
        const result = await finish();
        assert.match(result.notices.join('\n'), /too large|context window/i, 'the size guard actually ran');
        assert.deepEqual(await requests(), [], 'blocked preparation never fetches');
        assert.deepEqual(await context(), before, 'summary, coverage and compaction flags are unchanged');
      });

      for (const outcome of ['save-failure', 'stop', 'context-draft', 'context-save', 'complete', 'retained-summary']) {
        await check(action + ': delayed dispatch ' + outcome, async () => {
          await page.evaluate(outcome => {
            if (outcome === 'retained-summary') getActiveConv().summaryCoverage.through = 3;
            __lifecycleTest.delaySave();
          }, outcome);
          const before = await context();
          await start(action, args);
          await waitSave();
          assert.equal(await page.evaluate(() => __lifecycleTest.waiting), true, 'action reaches the real stream save');
          assert.deepEqual(await context(), before, 'adding a swipe does not invalidate context before dispatch');
          assert.deepEqual(await requests(), [], 'nothing sent while save is pending');
          await page.evaluate(async outcome => {
            if (outcome === 'stop') await sendMessage();
            if (outcome === 'context-draft' || outcome === 'context-save') {
              const input = document.getElementById('summaryText');
              input.value = 'New Context during preparation';
              input.dispatchEvent(new Event('input', { bubbles: true }));
              if (outcome === 'context-save') saveConversationSummary();
            }
          }, outcome);
          const changed = await context();
          await page.evaluate(fail => __lifecycleTest.release(fail), outcome === 'save-failure');
          const result = await finish();
          const sent = await requests();
          if (['complete', 'retained-summary'].includes(outcome)) {
            assert.equal(result.result, 'complete');
            assert.equal(sent.length, 1, 'one accepted provider dispatch');
            assert.deepEqual(await context(), sent[0].context, 'response completion does not change summary validity again');
            const payload = JSON.stringify(sent[0].body.messages);
            assert.doesNotMatch(payload, /Source 0/, 'manual exclusion survives');
            if (outcome === 'complete') {
              assert.equal(sent[0].context.summary, '', 'crossing summary is invalidated by first fetch');
              assert.equal(sent[0].context.coverage, undefined);
              assert.deepEqual(sent[0].context.flags[2], [true, undefined]);
              assert.doesNotMatch(payload, /Crossing summary/);
              assert.match(payload, /Source 2/, 'automatically compacted history returns');
            } else {
              assert.deepEqual(sent[0].context, before, 'non-crossing summary and flags survive dispatch');
              assert.match(payload, /Crossing summary/);
              assert.doesNotMatch(payload, /Source 2/);
            }
            const msg = await page.evaluate(index => getActiveConv().messages[index], action === 'retryRequest' ? 3 : 5);
            assert.equal(msg.swipes[0], action === 'retryRequest' ? 'Partial 3' : 'Partial 5');
            assert.equal(msg.content, action === 'continueMessage' ? 'Partial 5 suffix' : ' suffix');
            if (action === 'continueMessage') assert.match(payload, /Partial 5/, 'stopped partial is included for continuation');
            if (action === 'retryRequest') assert.doesNotMatch(payload, /Source 4|Partial 5/, 'earlier retry excludes later history');
          } else {
            assert.equal(sent.length, 0, 'rejected dispatch never fetches');
            assert.deepEqual(await context(), changed, 'failed preparation never overwrites current Context');
            assert.equal(result.result, outcome === 'stop' ? 'stopped' : 'failed');
            if (outcome === 'save-failure') assert.match(result.requestErrors.join('\n'), /Injected lifecycle save failure/);
            if (outcome.startsWith('context-')) {
              assert.match(result.requestErrors.join('\n'), /context changed during preparation/i);
              assert.equal(outcome === 'context-draft' ? changed.draft : changed.summary, 'New Context during preparation');
            }
          }
        });
      }
    }

    for (const outcome of ['stopped', 'failed', 'complete', 'complete-paused']) {
      await check('queue: delayed append after ' + outcome, async () => {
        await page.evaluate(outcome => {
          const t = __lifecycleTest;
          if (outcome === 'complete-paused') getActiveConv().queuedFollowUps = [
            { id: 'paused-item', text: 'Older paused item', attachments: [], createdAt: 1 }
          ];
          t.startForeground();
          t.delaySave();
          document.getElementById('chatInput').value = 'Delayed follow-up';
        }, outcome);
        await start('queueFollowUpFromComposer');
        await waitSave();
        assert.equal(await page.evaluate(() => __lifecycleTest.waiting), true);
        await page.evaluate(async outcome => {
          const t = __lifecycleTest;
          if (outcome === 'stopped') await sendMessage();
          t.action.status = outcome === 'failed' ? 'failed' : 'complete';
          t.endSendingAction();
          // Let completion's scheduled processor hit the still-pending mutation guard.
          await new Promise(resolve => setTimeout(resolve, 0));
        }, outcome);
        assert.deepEqual(await requests(), []);
        await page.evaluate(() => __lifecycleTest.release());
        await page.waitForFunction(() => __lifecycleTest.done, null, { timeout: 5000 });
        if (outcome === 'complete') {
          await page.waitForFunction(() => __lifecycleTest.requests.length === 1 && !__lifecycleTest.state().processing && !__lifecycleTest.state().sending,
            null, { timeout: 5000 });
          assert.equal((await requests()).length, 1, 'successful delayed append drains exactly once without manual Resume');
          assert.equal((await page.evaluate(() => __lifecycleTest.state())).queue.length, 0);
        } else {
          const state = await page.evaluate(async () => {
            await __lifecycleTest.processQueuedFollowUps(getActiveConv().id);
            return __lifecycleTest.state();
          });
          assert.equal(state.armed, false, 'save completion never grants revoked or paused permission');
          assert.equal(state.queue.length, outcome === 'complete-paused' ? 2 : 1);
          assert.deepEqual(await requests(), []);
          assert.equal(await page.locator('#followUpQueueResume').textContent(), 'Resume');
        }
        await finish();
      });
    }

    for (const mutation of ['append', 'remove', 'clear']) {
      for (const outcome of mutation === 'append' ? ['stopped'] : ['stopped', 'complete']) {
        await check('queue: failed ' + mutation + ' save during ' + outcome, async () => {
          await page.evaluate(() => {
            getActiveConv().queuedFollowUps = [
              { id: 'first', text: 'First queued item', attachments: [], createdAt: 1 },
              { id: 'second', text: 'Second queued item', attachments: [], createdAt: 2 }
            ];
            __lifecycleTest.startForeground();
            toggleFollowUpQueue();
            __lifecycleTest.delaySave();
            document.getElementById('chatInput').value = 'Failed append';
          });
          await start(mutation === 'append' ? 'queueFollowUpFromComposer' : mutation === 'remove' ? 'cancelQueuedFollowUp' : 'cancelAllQueuedFollowUps',
            mutation === 'remove' ? ['first'] : []);
          await waitSave();
          assert.equal(await page.evaluate(() => __lifecycleTest.waiting), true);
          await page.evaluate(async outcome => {
            const t = __lifecycleTest;
            if (outcome === 'stopped') await sendMessage();
            t.action.status = 'complete';
            t.endSendingAction();
            await new Promise(resolve => setTimeout(resolve, 0));
            t.release(true);
          }, outcome);
          await page.waitForFunction(() => __lifecycleTest.done, null, { timeout: 5000 });
          if (outcome === 'complete') {
            await page.waitForFunction(() => __lifecycleTest.requests.length === 2 && !__lifecycleTest.state().processing && !__lifecycleTest.state().sending,
              null, { timeout: 5000 });
            assert.equal((await requests()).length, 2, 'failed mutation does not strand the still-authorised queue');
            assert.deepEqual((await page.evaluate(() => __lifecycleTest.state())).queue, []);
          } else if (outcome === 'stopped') {
            const state = await page.evaluate(async () => {
              await __lifecycleTest.processQueuedFollowUps(getActiveConv().id);
              return __lifecycleTest.state();
            });
            assert.equal(state.armed, false, 'failed mutation cannot undo Stop');
            assert.deepEqual(state.queue.map(item => item.id), ['first', 'second'], 'failed mutation restores the saved queue');
            assert.deepEqual(await requests(), []);
          }
          const result = await finish();
          assert.match(result.notices.join('\n'), /Injected lifecycle save failure/, 'failure path was exercised');
        });
      }
    }

    for (const change of ['edited', 'excluded']) {
      await check('memory: ' + change + ' source before extraction is not sent', async () => {
        const result = await page.evaluate(async change => {
          const conv = getActiveConv();
          // Positive control: unchanged included content must still reach extraction.
          conv.messages.push({ role: 'user', content: 'Still eligible' });
          const prepared = await buildRequestMessages(conv);
          const source = conv.messages[4];
          if (change === 'edited') source.content = 'Changed after request preparation';
          else source.includeInContext = false;
          localStorage.setItem('llmMemoryEnabled', 'true');
          __lifecycleTest.reply = '[]';
          await extractMemories(prepared.messages, conv, null, prepared);
          return __lifecycleTest.requests;
        }, change);
        assert.equal(result.length, 1, 'real extraction reaches the provider');
        const payload = JSON.stringify(result[0].body.messages);
        assert.match(payload, /Still eligible/);
        assert.doesNotMatch(payload, /Source 4|Changed after request preparation/, 'stale or newly edited source is not extracted');
      });
    }
    assert.deepEqual(failures, [], passed.length + ' lifecycle cases passed; remaining failures');
    return passed;
  } finally {
    await page.unroute(pattern, instrument);
  }
};
