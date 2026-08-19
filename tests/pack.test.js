const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createSonolusDatabase, FileSonolusAssetStore, importSonolusPack } = require('../dist');

test('imports the installed free pack into a database and asset store', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'honolus-pack-'));
    const database = createSonolusDatabase({ driver: 'memory' });
    const assets = new FileSonolusAssetStore(path.join(directory, 'repository'));
    const result = await importSonolusPack({
        source: { type: 'directory', path: path.join(process.cwd(), 'node_modules/@sonolus/free-pack/pack') },
        database,
        assets,
        conflict: 'replace',
    });

    assert.equal(result.importedItems, 8);
    assert.equal(result.importedAssets, 19);
    assert.equal((await database.repository('skin').get('pixel')).thumbnail.url, '/sonolus/repository/b130ca64e3a9ee209b7466b1342a33c2f80abeae');
    assert.equal(await assets.has('b130ca64e3a9ee209b7466b1342a33c2f80abeae'), true);
    await fs.rm(directory, { recursive: true, force: true });
});

test('pack import is idempotent and detects conflicting items', async () => {
    const database = createSonolusDatabase({ driver: 'memory' });
    const source = { type: 'directory', path: path.join(process.cwd(), 'node_modules/@sonolus/free-pack/pack') };
    const assetValues = new Map();
    const assets = {
        has: async (hash) => assetValues.has(hash),
        put: async (hash, value) => assetValues.set(hash, value),
        open: async (hash) => new ReadableStream({ start(controller) { controller.enqueue(assetValues.get(hash)); controller.close(); } }),
    };

    const first = await importSonolusPack({ source, database, assets, conflict: 'replace' });
    const second = await importSonolusPack({ source, database, assets, conflict: 'error' });
    assert.equal(first.importedItems, 8);
    assert.equal(second.importedItems, 0);
    assert.equal(second.skippedItems, 8);

    const existing = await database.repository('skin').get('pixel');
    await database.repository('skin').put({ ...existing, title: { en: 'changed' } });
    await assert.rejects(() => importSonolusPack({ source, database, assets, conflict: 'error' }), /Item conflict/);
});
