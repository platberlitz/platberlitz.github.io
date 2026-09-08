const assert = require('node:assert/strict');

module.exports = async function(page) {
  await page.evaluate(() => {
    closeModal('setupModal', false);
    const originalFetch = window.fetch;
    const fixture = window.__transport = { plans: [], calls: [], releases: [], restore: () => { window.fetch = originalFetch; } };
    window.fetch = async (url, options = {}) => {
      fixture.calls.push({ url: String(url), headers: Object.fromEntries(new Headers(options.headers)),
        body: options.body ? JSON.parse(options.body) : null });
      const plan = fixture.plans.shift();
      if (!plan) throw new Error('Unexpected synthetic transport request: ' + url);
      if (plan.hold) await new Promise((resolve, reject) => {
        fixture.releases.push(resolve);
        if (options.signal?.aborted) reject(options.signal.reason);
        else options.signal?.addEventListener('abort', () => reject(options.signal.reason), { once: true });
      });
      if (plan.error) throw new TypeError(plan.error);
      if (plan.chunks || plan.sse) {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(plan.sse || '');
        const chunks = plan.chunks ? plan.chunks.map(chunk => encoder.encode(chunk))
          : Array.from(bytes, byte => new Uint8Array([byte]));
        return new Response(new ReadableStream({
          pull(controller) {
            if (chunks.length) controller.enqueue(chunks.shift());
            else controller.close();
          }
        }), { headers: { 'Content-Type': 'text/event-stream' } });
      }
      const response = new Response(plan.text ?? JSON.stringify(plan.json), {
        status: plan.status || 200, headers: { 'Content-Type': plan.text != null ? 'text/plain' : 'application/json' }
      });
      if (plan.frozen) {
        const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
        response.json = async () => freeze(plan.json);
      }
      return response;
    };
    fixture.target = (format = 'openai', extra = {}) => ({
      baseUrl: location.origin + '/__transport/v1?api-version=fixture', host: location.host,
      provider: 'custom', model: 'transport-fixture', apiFormat: format, apiKey: 'synthetic-key',
      keyRequired: false, maxTokens: 64, temperature: null, stream: true, promptCache: false,
      extraParams: '', excludeParams: '', corsProxy: 'https://corsproxy.io/?url=', ...extra
    });
    fixture.run = async (format, targetOptions = {}, webSearch = false) => {
      createConversation();
      const conv = getActiveConv();
      const assistant = { role: 'assistant', content: '', swipes: [''], swipeIndex: 0 };
      const input = { role: 'user', content: 'Synthetic prompt' };
      conv.messages.push(input, assistant);
      renderMessages();
      const status = await streamResponse([input], assistant, 0, document.querySelector('.msg-bubble.assistant'), null, null, {
        conv, messageList: conv.messages, target: fixture.target(format, targetOptions),
        toolPolicy: { webSearch, urlFetch: false, confirm: false }
      });
      return { status, text: assistant.content, sources: assistant.swipeSources?.[0] || [], error: assistant.swipeRequests[0].error };
    };
  });
  const plan = (...plans) => page.evaluate(plans => { __transport.plans.push(...plans); __transport.calls = []; }, plans);
  const calls = () => page.evaluate(() => __transport.calls);
  const run = (format = 'openai', options = {}, search = false) => page.evaluate(({ format, options, search }) => __transport.run(format, options, search), { format, options, search });
  const event = (data, newline = '\n') => 'data: ' + (typeof data === 'string' ? data : JSON.stringify(data)) + newline + newline;
  const choice = (content, index = 0, finish_reason = null) => ({ choices: [{ index, delta: { content }, finish_reason }] });
  const jsonAnswer = content => ({ choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }] });
  try {
    for (const newline of ['\n', '\r', '\r\n']) {
      const body = ': heartbeat' + newline + newline + event(choice('Split \u{1F600} text'), newline) + event(choice('', 0, 'stop'), newline);
      await plan({ sse: body });
      const result = await run();
      assert.equal(result.status, 'complete', JSON.stringify(newline) + ': split delimiters and UTF-8');
      assert.equal(result.text, 'Split \u{1F600} text');
    }
    await plan({ chunks: ['data: {"choices":\r', 'data: [{"index":0,"delta":{"content":"multiline"}}]}\r\r', event(choice('', 0, 'stop'), '\r')] });
    assert.equal((await run()).text, 'multiline', 'A held CR follows the pending line instead of preceding it');

    await plan({ json: { choices: [
      { index: 1, message: { content: 'wrong' }, finish_reason: 'stop' },
      { index: 0, message: { content: 'zero' }, finish_reason: 'stop' }
    ] } });
    assert.equal((await run()).text, 'zero', 'JSON selects index zero, not array position');
    await plan({ sse: event(choice('wrong', 1, 'stop')) + event(choice('zero')) + event(choice('wrong again', 2, 'stop')) + event(choice('', 0, 'stop')) });
    assert.equal((await run()).text, 'zero', 'Alternatives cannot lock the stream or finish choice zero');
    await plan({ sse: event({ choices: [
      { index: 1, message: { content: 'wrong' }, finish_reason: 'stop' },
      { index: 0, message: { content: 'zero message' }, finish_reason: 'stop' }
    ] }) });
    assert.equal((await run()).text, 'zero message');
    await plan({ json: { choices: [{ index: 1, message: { content: 'wrong' }, finish_reason: 'stop' }] } });
    assert.equal((await run()).status, 'failed', 'Missing primary choice is not a successful alternative');
    await plan({ sse: event({ choices: [{ delta: { content: 'unindexed' }, finish_reason: 'stop' }] }) });
    assert.equal((await run()).text, 'unindexed', 'Single-choice compatible providers may omit index');

    const refusal = { choices: [{ index: 0, message: { content: 'Context', refusal: 'Cannot comply.' }, finish_reason: 'stop' }] };
    await plan({ json: refusal });
    assert.equal((await run()).text, 'Context\n\nCannot comply.');
    for (const terminal of [true, false]) {
      await plan({ sse: event(choice('Context')) + event({ choices: [{ index: 0, delta: { refusal: 'Cannot ' } }] }) +
        event({ choices: [{ index: 0, delta: { refusal: 'comply.' }, ...(terminal ? { finish_reason: 'stop' } : {}) }] }) });
      const result = await run();
      assert.equal(result.text, 'Context\n\nCannot comply.', 'Refusal survives final parsing and interrupted closure');
      assert.equal(result.status, terminal ? 'complete' : 'interrupted');
    }
    await plan({ json: { choices: [{ message: { content: ' ', refusal: 'Refusal only' } }] } });
    assert.equal((await run()).text, 'Refusal only');
    await plan({ json: { choices: [{ index: 1, message: { content: 'wrong' } }, ...refusal.choices] } });
    assert.equal(await page.evaluate(() => callApiNonStreaming([{ role: 'user', content: 'fixture' }], { target: __transport.target() })), 'Context\n\nCannot comply.', 'Non-streaming helper shares primary choice and refusal handling');
    await plan({ json: jsonAnswer('a'.repeat(128)) });
    assert.equal((await run()).text, 'a'.repeat(128), 'Base64-looking prose remains text');

    const citation = { type: 'web_search_result_location', url: 'https://example.invalid/source?token=private', title: 'Source', cited_text: 'A quotation absent from the answer', encrypted_index: 'signed-index' };
    const first = { type: 'text', text: 'First paraphrase. ', citations: [citation, citation, { url: 'javascript:bad', cited_text: 'bad' }] };
    const second = { type: 'text', text: 'Second paraphrase.', citations: [{ ...citation, url: 'https://example.invalid/other' }] };
    const thinking = { type: 'thinking', thinking: 'Private reasoning', signature: 'signed-thinking' };
    const wire = [thinking, first, second];
    for (const streaming of [false, true]) {
      const streamed = wire.map((block, index) => event({ type: 'content_block_start', index, content_block: block }) +
        event({ type: 'content_block_stop', index }) + event({ type: 'content_block_stop', index })).join('') +
        event({ type: 'message_delta', delta: { stop_reason: 'pause_turn' } }) + event({ type: 'message_stop' });
      await plan(streaming ? { sse: streamed } : { json: { content: wire, stop_reason: 'pause_turn' }, frozen: true },
        { json: { content: [{ type: 'text', text: 'Final answer.' }], stop_reason: 'end_turn' } });
      const result = await run('anthropic', {}, true);
      assert.equal(result.status, 'complete');
      assert.equal(result.text, 'First paraphrase. [1] Second paraphrase. [2]\n\nFinal answer.', 'Markers belong to blocks, are present without quotation matches and do not accumulate');
      assert.deepEqual(result.sources.map(source => [source.number, source.url]), [[1, 'https://example.invalid/source'], [2, 'https://example.invalid/other']]);
      const requests = await calls();
      assert.equal(requests.length, 2);
      assert.deepEqual(requests[1].body.messages.at(-1).content, wire, 'Native continuation replays unmodified text, citations and signatures');
    }
    await plan({ sse: event({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }) +
      event({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Cited partial.' } }) +
      event({ type: 'content_block_delta', index: 0, delta: { type: 'citations_delta', citation } }) +
      event({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' More.' } }) });
    const partial = await run('anthropic');
    assert.equal(partial.status, 'interrupted');
    assert.equal(partial.text, 'Cited partial. More. [1]');
    assert.equal(partial.sources.length, 1, 'Citation deltas stay attached even if the text block is interrupted');

    const discoveryBase = await page.evaluate(() => location.origin + '/__transport/discovery/v1?api-version=x&after=start');
    await plan({ json: { data: [{ id: 'a' }], has_more: true } }, { json: { data: [{ id: 'b' }], has_more: true } }, { json: { data: [{ id: 'c' }], has_more: false } });
    assert.deepEqual(await page.evaluate(base => fetchAvailableModels(base, 'discovery-key', 'anthropic', 'anthropic'), discoveryBase), ['a', 'b', 'c']);
    const pages = await calls();
    assert.deepEqual(pages.map(call => new URL(call.url).searchParams.getAll('after')), [['start'], ['a'], ['b']]);
    assert.ok(pages.every(call => new URL(call.url).pathname.endsWith('/v1/models') && new URL(call.url).searchParams.get('api-version') === 'x'));
    assert.ok(pages.every(call => call.headers['x-api-key'] === 'discovery-key' && !call.headers.authorization));
    const cached = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith('llmModelCache:')).map(key => [key, localStorage.getItem(key)])));
    for (const broken of [
      [{ data: [{ id: 'a' }], has_more: true }, { data: [{ id: 'a' }], has_more: true }],
      [{ data: [], has_more: true }], [{ data: [{ name: 'missing-id' }], has_more: true }],
      [{ data: [{ id: 'a' }], last_id: 'start', has_more: true }],
      Array.from({ length: 10 }, (_, i) => ({ data: [{ id: 'page-' + i }], has_more: true }))
    ]) {
      await plan(...broken.map(json => ({ json })));
      const error = await page.evaluate(async base => { try { await fetchAvailableModels(base, 'discovery-key', 'anthropic', 'anthropic'); return ''; } catch (e) { return e.message; } }, discoveryBase);
      assert.match(error, /no progress|exceeded 10 pages/);
      assert.equal((await calls()).length, broken.length);
      assert.deepEqual(await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith('llmModelCache:')).map(key => [key, localStorage.getItem(key)]))), cached, 'Incomplete discovery never replaces cache');
    }
    await plan({ json: { data: [{ id: 'openai-override' }], has_more: true } });
    assert.deepEqual(await page.evaluate(base => fetchAvailableModels(base, 'override-key', 'anthropic', 'openai'), discoveryBase), ['openai-override']);
    assert.equal((await calls())[0].headers.authorization, 'Bearer override-key');
    assert.equal((await calls())[0].headers['x-api-key'], undefined);
    await plan({ json: { models: [{ name: 'local-model' }] } });
    await page.evaluate(base => fetchAvailableModels(base.replace('after=start', 'path=/'), '', 'ollama', 'openai'), discoveryBase);
    assert.equal(new URL((await calls())[0].url).pathname, '/__transport/discovery/api/tags');
    assert.equal(new URL((await calls())[0].url).searchParams.get('path'), '/');

    for (const [action, target] of [['refreshModels', 'settings'], ['testConnection', 'settings'], ['refreshModels', 'setup'], ['testConnection', 'setup']]) {
      await plan({ hold: true, json: { data: [{ id: 'discovered' }] } });
      await page.evaluate(({ action, target }) => {
        const prefix = target === 'setup' ? 'setup' : 'set';
        document.getElementById(prefix + 'Proxy').value = location.origin + '/__transport/ui/v1';
        document.getElementById(prefix + 'Key').value = 'ui-key';
        document.getElementById(prefix + 'Provider').value = 'custom';
        document.getElementById(prefix + 'ApiFormat').value = 'openai';
        document.getElementById(prefix + 'ModelManual').value = '';
        populateModelSelect(target, ['old', 'new'], 'old');
        const button = document.querySelector('[aria-label="Refresh ' + target + ' model list"]');
        __transport.ui = action === 'refreshModels' ? refreshModels(target, button) : testConnection(target);
      }, { action, target });
      await page.waitForFunction(() => __transport.releases.length > 0);
      await page.evaluate(target => {
        document.getElementById((target === 'setup' ? 'setup' : 'set') + 'ModelSelect').value = 'new';
        __transport.releases.shift()();
      }, target);
      await page.evaluate(() => __transport.ui);
      assert.equal(await page.evaluate(target => getSelectedModel(target), target), 'new', action + '/' + target + ': delayed discovery preserves a newer selection absent from results');
    }

    await plan({ hold: true, json: { data: [{ id: 'stale' }] } }, { json: { data: [{ id: 'fresh' }] } });
    await page.evaluate(() => {
      const button = document.querySelector('[aria-label="Refresh settings model list"]');
      __transport.firstDiscovery = refreshModels('settings', button);
    });
    await page.waitForFunction(() => __transport.releases.length > 0);
    await page.evaluate(() => refreshModels('settings', document.querySelector('[aria-label="Refresh settings model list"]')));
    await page.evaluate(() => { __transport.releases.shift()(); return __transport.firstDiscovery; });
    assert.match(await page.locator('#setModelSelect').textContent(), /fresh/);
    assert.doesNotMatch(await page.locator('#setModelSelect').textContent(), /stale/);
    assert.equal(await page.locator('[aria-label="Refresh settings model list"]').isDisabled(), false, 'Superseded discovery releases its button without replacing newer results');

    await plan({ hold: true, json: { data: [{ id: 'too-late' }] } });
    const timeout = await page.evaluate(async () => {
      const setTimer = window.setTimeout;
      // Trigger only discovery's deadline, without waiting 45 seconds or changing other timers.
      window.setTimeout = (callback, delay, ...args) => {
        if (delay === 45000) __transport.expireDiscovery = callback;
        return setTimer(callback, delay, ...args);
      };
      const task = testConnection('settings');
      window.setTimeout = setTimer;
      __transport.expireDiscovery();
      await task;
      __transport.releases.splice(0).forEach(release => release());
      return { status: document.getElementById('settingsConnectionStatus').textContent,
        busy: document.querySelector('#settingsConnectionStatus').closest('.connection-test-row').querySelector('button').disabled };
    });
    assert.match(timeout.status, /timed out/);
    assert.equal(timeout.busy, false, 'Discovery timeout and caller cancellation share a signal');

    await plan({ json: { content: [{ type: 'text', text: 'Non-streaming answer' }] } });
    await page.evaluate(() => callApiNonStreaming([], { target: __transport.target('anthropic', {
      model: 'claude-opus-4-7', extraParams: JSON.stringify({ temperature: 0.5, top_p: 0.8, top_k: 10, model: 'wrong' }), excludeParams: 'model'
    }) }));
    const protectedBody = (await calls())[0].body;
    assert.equal(protectedBody.model, 'claude-opus-4-7');
    assert.ok(!('temperature' in protectedBody) && !('top_p' in protectedBody) && !('top_k' in protectedBody), 'Non-streaming extra parameters obey the same model restrictions as streaming');

    const secret = 'synthetic-secret-'.repeat(20);
    for (const response of [
      { status: 401, text: 'API error: ' + secret },
      { json: { error: { message: 'API error: ' + secret } } },
      { sse: event({ error: { message: 'API error: ' + secret } }) }
    ]) {
      await plan(response);
      const result = await run('openai', { apiKey: secret });
      assert.equal(result.status, 'failed');
      assert.ok(result.error.includes('[redacted]'));
      assert.ok(!result.error.includes('synthetic-secret-'), 'Redact before shortening provider errors');
    }
    await plan({ status: 502, text: 'Proxy unavailable' }, { error: 'Failed to fetch' });
    const fallback = await page.evaluate(async () => {
      try { await callApiNonStreaming([{ role: 'user', content: 'fixture' }], { target: __transport.target('openai', {
        baseUrl: 'http://public.example.invalid/v1', corsProxy: 'https://trusted.example.invalid/?url='
      }) }); } catch (e) { return e.message; }
    });
    assert.ok(fallback);
    assert.deepEqual((await calls()).map(call => new URL(call.url).host), ['trusted.example.invalid', 'public.example.invalid'], 'A failed direct fallback is submitted once');
    for (const url of ['https://public.example.invalid/v1', 'http://public.example.invalid/v1']) {
      await plan({ error: 'Failed to fetch' });
      await page.evaluate(async baseUrl => { try { await callApiNonStreaming([], { target: __transport.target('openai', { baseUrl }) }); } catch {} }, url);
      assert.equal((await calls()).length, 1, 'Sensitive requests never retry through the default public proxy');
      assert.equal(new URL((await calls())[0].url).host, 'public.example.invalid');
    }
    for (const url of ['http://user:password@public.example.invalid/v1', 'http://public.example.invalid/v1?sessionId=private']) {
      await plan({ error: 'Failed to fetch' });
      await page.evaluate(async base => { try { await fetchAvailableModels(base, '', 'custom', 'openai'); } catch {} }, url);
      assert.equal((await calls()).length, 1);
      assert.equal(new URL((await calls())[0].url).host, 'public.example.invalid', 'URL credentials must not be sent to a public proxy');
    }
    await plan({ json: jsonAnswer('joined') });
    await run('openai', { baseUrl: 'https://public.example.invalid/v1?path=/' });
    assert.equal(new URL((await calls())[0].url).pathname, '/v1/chat/completions');
    assert.equal(new URL((await calls())[0].url).searchParams.get('path'), '/', 'Joining paths does not trim query values');
    assert.equal(await page.evaluate(() => __transport.plans.length), 0);
    console.log('Transport: split SSE, choice zero, refusals, immutable native citations, discovery pagination/auth/selection, redaction and proxy fallback passed.');
  } finally {
    await page.evaluate(() => { __transport.releases.splice(0).forEach(release => release()); __transport.restore(); });
  }
};
