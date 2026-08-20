const assert = require('node:assert/strict');
const test = require('node:test');
const { Honolus, createOpenApiDocument, createRouteManifest, createSonolusDatabase, seedDatabase, HONOLUS_COMPATIBILITY_VERSION, assertCompatibility } = require('../dist');

function level(name) {
    const resource = { hash: null, url: null };
    return { name, version: 1, rating: 1, title: { en: name }, artists: { en: 'artist' }, author: { en: 'author' }, tags: [], engine: 'engine', useSkin: { useDefault: true }, useBackground: { useDefault: true }, useEffect: { useDefault: true }, useParticle: { useDefault: true }, cover: resource, bgm: resource, data: resource };
}

test('route manifest and OpenAPI document are generated from registered routes', () => {
    const sonolus = new Honolus();
    const manifest = sonolus.getRouteManifest();
    assert.equal(manifest.version, 1);
    assert.ok(manifest.routes.some((route) => route.method === 'GET' && route.path === '/sonolus/info'));
    const openapi = sonolus.getOpenApiDocument({ title: 'Test', version: '1' });
    assert.equal(openapi.info.title, 'Test');
    assert.ok(openapi.paths['/sonolus/posts/{itemName}']);
    assert.deepEqual(createRouteManifest([{ method: 'GET', path: '/health' }]).routes, [{ method: 'GET', path: '/health' }]);
    assert.equal(createOpenApiDocument([{ method: 'GET', path: '/health/:id' }]).paths['/health/{id}'].get.responses['200'].description, 'Success');
});

test('fixture seed and compatibility guard are available', async () => {
    const database = createSonolusDatabase({ driver: 'memory' });
    assert.equal(await seedDatabase(database, [level('fixture')]), 1);
    assert.equal((await database.repository('level').get('fixture')).name, 'fixture');
    assert.doesNotThrow(() => assertCompatibility(HONOLUS_COMPATIBILITY_VERSION));
    assert.throws(() => assertCompatibility(999), /Unsupported/);
});
