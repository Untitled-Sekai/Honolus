const assert = require('node:assert/strict');
const test = require('node:test');
const { createHash } = require('node:crypto');
const {
    Honolus, MemoryCacheStore, RedisCacheStore, S3SonolusAssetStore,
    createSonolusDatabase, defineHandler, generateLoadSeed, requirePermission, TransactionalOutbox,
} = require('../dist');

test('shared sessions resolve an authenticated user without exposing raw store keys', async () => {
    const store = new MemoryCacheStore();
    const sonolus = new Honolus({ auth: { sessions: store } });
    const created = await sonolus.sessions.create({ id: 'u1', roles: ['admin'], permissions: ['level:write'] });
    let user;
    sonolus.route.server.info(class { handle(context) { user = context.user; return { sections: [] }; } });
    const response = await sonolus.getApp().request('/sonolus/info', { headers: { 'Sonolus-Session': created.session } });
    assert.equal(response.status, 200);
    assert.equal(user.id, 'u1');
    assert.equal(await store.get(created.session), undefined);
    await sonolus.close();
});

test('route policies deny by default and allow matching permissions', async () => {
    const store = new MemoryCacheStore(); const logs = [];
    const sonolus = new Honolus({ auth: { sessions: store } });
    sonolus.route.server.info.use(requirePermission('server:read', { logger: { log: (...values) => logs.push(values) } }))(class { handle() { return { sections: [] }; } });
    const deniedSession = await sonolus.sessions.create({ id: 'denied' });
    assert.equal((await sonolus.getApp().request('/sonolus/info', { headers: { 'Sonolus-Session': deniedSession.session } })).status, 403);
    const allowedSession = await sonolus.sessions.create({ id: 'allowed', permissions: ['server:read'] });
    assert.equal((await sonolus.getApp().request('/sonolus/info', { headers: { 'Sonolus-Session': allowedSession.session } })).status, 200);
    assert.equal(logs.length, 2);
});

test('defineHandler injects explicit dependencies', async () => {
    const sonolus = new Honolus();
    const Handler = defineHandler({ dependencies: { value: 42 }, handle: ({ dependencies }) => ({ sections: [], value: dependencies.value }) });
    sonolus.route.server.info(Handler);
    assert.equal((await (await sonolus.getApp().request('/sonolus/info')).json()).value, 42);
});

test('closing rejects new requests and is idempotent', async () => {
    const sonolus = await Honolus.create();
    await sonolus.close({ gracePeriodMs: 10 });
    await sonolus.close();
    assert.equal((await sonolus.getApp().request('/health/live')).status, 503);
});

test('Redis cache adapter namespaces and round trips values', async () => {
    const values = new Map();
    const client = { async sendCommand(args) { if (args[0] === 'SET') { values.set(args[1], args[2]); return 'OK'; } if (args[0] === 'GET') return values.get(args[1]) ?? null; if (args[0] === 'DEL') return values.delete(args[1]) ? 1 : 0; } };
    const cache = new RedisCacheStore({ client, namespace: 'test' });
    await cache.set('answer', { value: 42 }, { ttlMs: 1000 });
    assert.deepEqual(await cache.get('answer'), { value: 42 });
    assert.ok(values.has('test:cache:answer'));
});

test('S3 assets stage verified content before publishing', async () => {
    const objects = new Map();
    const client = {
        async head(key) { return { exists: objects.has(key) }; }, async get(key) { return new Response(objects.get(key)).body; },
        async put(key, body) { objects.set(key, body); }, async copy(source, destination) { objects.set(destination, objects.get(source)); }, async delete(key) { objects.delete(key); }, async list() { return []; },
        async createMultipart() { return 'upload'; }, async uploadPart() { return { etag: 'etag' }; }, async completeMultipart() {}, async abortMultipart() {},
    };
    const assets = new S3SonolusAssetStore({ client, prefix: 'assets' });
    const data = new TextEncoder().encode('asset'); const hash = createHash('sha1').update(data).digest('hex');
    await assets.put(hash, data);
    assert.equal(await assets.has(hash), true);
    assert.equal([...objects.keys()].some((key) => key.includes('.staging')), false);
    await assert.rejects(() => assets.put('f'.repeat(40), data), /hash mismatch/);
});

test('load seeds are deterministic and accepted by the database', async () => {
    const first = generateLoadSeed(100, 123); const second = generateLoadSeed(100, 123);
    assert.deepEqual(first, second);
    const database = createSonolusDatabase({ driver: 'memory', seed: first });
    assert.equal(await database.repository('level').count(), 100);
});

test('transactional outbox writes events through the same executor transaction', async () => {
    const queries = []; let transactions = 0;
    const executor = {
        async query(sql, parameters) { queries.push([sql, parameters]); return { rows: sql.startsWith('INSERT INTO honolus_outbox') ? [{ id: parameters[0] }] : [] }; },
        async transaction(callback) { transactions++; return callback(this); },
    };
    const outbox = new TransactionalOutbox({ executor });
    await outbox.ready();
    const result = await outbox.transaction(async (_database, events) => events.append('test.event', { value: 1 }, { idempotencyKey: 'once' }));
    assert.ok(result.id);
    assert.equal(transactions, 1);
    assert.ok(queries.some(([sql]) => sql.startsWith('INSERT INTO honolus_outbox')));
});
