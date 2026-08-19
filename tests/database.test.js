const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createSonolusDatabase } = require('../dist');

function level(name, rating, title = name) {
    const resource = { hash: null, url: `https://example.test/${name}` };
    return {
        name,
        version: 1,
        rating,
        title: { en: title },
        artists: { en: 'Artist' },
        author: { en: 'Author' },
        tags: [{ title: { en: 'Music' } }],
        engine: 'engine',
        useSkin: { useDefault: true },
        useBackground: { useDefault: true },
        useEffect: { useDefault: true },
        useParticle: { useDefault: true },
        cover: resource,
        bgm: resource,
        data: resource,
    };
}

test('memory database stores, validates, searches, and paginates items', async () => {
    const database = createSonolusDatabase({
        driver: 'memory',
        seed: [level('b', 20, 'Beta'), level('a', 10, 'Alpha'), level('c', 30, 'Gamma')],
    });
    const levels = database.repository('level');

    assert.equal((await levels.get('a')).name, 'a');
    assert.equal((await levels.count({ where: { rating: { min: 20 } } })), 2);

    const page = await levels.list({ orderBy: [{ field: 'rating', direction: 'desc' }], page: { limit: 2 } });
    assert.deepEqual(page.items.map((item) => item.name), ['c', 'b']);
    assert.ok(page.nextCursor);
    const next = await levels.list({ orderBy: [{ field: 'rating', direction: 'desc' }], page: { limit: 2, cursor: page.nextCursor } });
    assert.deepEqual(next.items.map((item) => item.name), ['a']);
});

test('json database persists and supports readonly mode', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'honolus-db-'));
    const file = path.join(directory, 'sonolus.json');
    const database = createSonolusDatabase({ driver: 'json', path: file, seed: [level('persisted', 1)] });
    await database.close();

    const reopened = createSonolusDatabase({ driver: 'json', path: file, mode: 'readonly' });
    assert.equal((await reopened.repository('level').get('persisted')).name, 'persisted');
    await assert.rejects(() => reopened.repository('level').put(level('new', 2)), /readonly/);
    await reopened.close();
    await fs.rm(directory, { recursive: true, force: true });
});

test('database rejects malformed items', async () => {
    const database = createSonolusDatabase({ driver: 'memory' });
    await assert.rejects(() => database.repository('level').put({ name: 'broken', version: 999 }), /Invalid level item/);
});
