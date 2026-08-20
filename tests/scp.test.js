const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { Honolus, ScpArchive } = require('../dist');

const scpPath = path.join(process.cwd(), 'docs/sample_assets/FreePack.scp');

test('scp archive serves static API files and repository assets', async () => {
    const archive = ScpArchive.fromFile(scpPath);
    assert.equal(archive.has('sonolus/skins/list'), true);
    assert.match(new TextDecoder().decode(archive.read('sonolus/skins/list')), /"pixel"/);

    const sonolus = new Honolus({ pack: { type: 'scp', path: scpPath } });
    const list = await sonolus.getApp().request('/sonolus/skins/list');
    assert.equal(list.status, 200);
    assert.equal(list.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.match(await list.text(), /"pixel"/);
    assert.equal(list.headers.get('Sonolus-Version'), '1.1.3');

    const asset = await sonolus.getApp().request('/sonolus/repository/b130ca64e3a9ee209b7466b1342a33c2f80abeae');
    assert.equal(asset.status, 200);
    assert.equal(asset.headers.get('content-type'), 'application/octet-stream');
    assert.equal((await asset.arrayBuffer()).byteLength, 448);
});

test('scp static mount falls through for entries not in the archive', async () => {
    const sonolus = new Honolus({ pack: { type: 'scp', path: scpPath } });
    assert.equal((await sonolus.getApp().request('/sonolus/not-in-pack')).status, 404);
});
