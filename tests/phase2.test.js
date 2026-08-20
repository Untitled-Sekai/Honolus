const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Honolus, MemoryJobQueue, MemoryMetrics, MemoryRateLimitStore, FileSonolusAssetStore } = require('../dist');

test('rate limiting and observability middleware are pluggable', async () => {
    const metrics = new MemoryMetrics();
    const logs = [];
    const sonolus = new Honolus({
        rateLimit: { limit: 1, windowMs: 60_000, store: new MemoryRateLimitStore() },
        observability: { metrics, logger: { log: (...args) => logs.push(args) } },
    });
    const first = await sonolus.getApp().request('/health/live');
    const second = await sonolus.getApp().request('/health/live');
    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
    assert.equal(metrics.counters.get('http.requests.total{"method":"GET","route":"/health/live","status":"200"}'), 1);
    assert.equal(logs.length, 2);
});

test('request timeout returns a typed error response', async () => {
    const sonolus = new Honolus({ timeoutMs: 5 });
    sonolus.route.server.info(class { async handle() { await new Promise((resolve) => setTimeout(resolve, 30)); return { sections: [] }; } });
    const response = await sonolus.getApp().request('/sonolus/info');
    assert.equal(response.status, 504);
    assert.equal((await response.json()).code, 'INTERNAL_ERROR');
});

test('memory job queue executes registered jobs and preserves idempotency', async () => {
    const queue = new MemoryJobQueue();
    queue.register('test', async (payload) => payload.value * 2);
    const first = await queue.enqueue('test', { value: 3 }, { idempotencyKey: 'same' });
    const second = await queue.enqueue('test', { value: 9 }, { idempotencyKey: 'same' });
    assert.equal(first.id, second.id);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const job = await queue.get(first.id);
    assert.equal(job.state, 'succeeded');
    assert.equal(job.result, 6);
    await queue.close();
});

test('asset responses support immutable ETag caching', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'honolus-phase2-'));
    const assets = new FileSonolusAssetStore(directory);
    const data = new TextEncoder().encode('asset');
    const hash = 'f' .repeat(40);
    await assets.put(hash, data);
    const sonolus = new Honolus({ assets });
    const cached = await sonolus.getApp().request(`/sonolus/repository/${hash}`, { headers: { 'If-None-Match': `"${hash}"` } });
    assert.equal(cached.status, 304);
    assert.equal(cached.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
    await fs.rm(directory, { recursive: true, force: true });
});
