const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Honolus, createSonolusDatabase } = require('../dist');

function item(name) {
    return {
        name, version: 1, rating: 10, title: { en: name }, artists: { en: 'artist' }, author: { en: 'author' }, tags: [],
        engine: 'engine', useSkin: { useDefault: true }, useBackground: { useDefault: true }, useEffect: { useDefault: true }, useParticle: { useDefault: true },
        cover: { hash: null, url: null }, bgm: { hash: null, url: null }, data: { hash: null, url: null },
    };
}

async function repositoryContract(database) {
    const repository = database.repository('level');
    await repository.put(item('b'));
    await repository.put(item('a'));
    assert.equal((await repository.get('a')).name, 'a');
    assert.deepEqual((await repository.list({ page: { limit: 1 } })).items.map((value) => value.name), ['a']);
    const first = await repository.list({ page: { limit: 1 } });
    assert.deepEqual((await repository.list({ page: { limit: 1, cursor: first.nextCursor } })).items.map((value) => value.name), ['b']);
    assert.equal(await repository.delete('a'), true);
    assert.equal(await repository.delete('missing'), false);
}

test('repository contract works for memory and JSON databases', async () => {
    await repositoryContract(createSonolusDatabase({ driver: 'memory' }));
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'honolus-phase1-'));
    const database = createSonolusDatabase({ driver: 'json', path: path.join(directory, 'db.json') });
    await repositoryContract(database);
    await database.close();
    await fs.rm(directory, { recursive: true, force: true });
});

test('health endpoints and request id are available', async () => {
    const sonolus = new Honolus();
    const live = await sonolus.getApp().request('/health/live', { headers: { 'X-Request-Id': 'test-request' } });
    assert.equal(live.status, 200);
    assert.equal(live.headers.get('X-Request-Id'), 'test-request');
    assert.deepEqual(await live.json(), { status: 'ok', requestId: 'test-request' });
    const ready = await sonolus.getApp().request('/health/ready');
    assert.equal(ready.status, 200);
});

test('query limits reject unbounded search input', async () => {
    const database = createSonolusDatabase({ driver: 'memory', seed: [item('a')] });
    await assert.rejects(() => database.repository('level').list({ search: 'x'.repeat(257) }), /at most 256/);
});
