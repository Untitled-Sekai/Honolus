const assert = require('node:assert/strict');
const test = require('node:test');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const { runCli } = require('../dist/cli');
const modulePath = resolve('tests/fixtures/cli-module.js');

test('routes passes --module to the option parser', async () => {
    let output = '';
    await runCli(['routes', '--module', modulePath], { write: (value) => { output += value; } });
    const manifest = JSON.parse(output);
    assert.ok(manifest.routes.some((route) => route.path === '/sonolus/info'));
});

test('openapi accepts --module and writes --output', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'honolus-cli-'));
    const output = join(directory, 'openapi.json');
    try {
        await runCli(['openapi', '--module', modulePath, '--output', output]);
        const document = JSON.parse(readFileSync(output, 'utf8'));
        assert.equal(document.openapi, '3.0.3');
        assert.ok(document.paths['/sonolus/info']);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});
