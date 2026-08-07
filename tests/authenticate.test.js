const assert = require('node:assert/strict');
const test = require('node:test');
const { Honolus } = require('../dist');

test('server.authenticate decorator registers the handler', async () => {
    const sonolus = new Honolus();

    class AuthenticateHandler {
        async handle() {
            return {
                session: 'test-session',
                expiration: 1234567890,
            };
        }
    }

    sonolus.route.server.authenticate(AuthenticateHandler);

    const response = await sonolus.getApp().request('/sonolus/authenticate', {
        method: 'POST',
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Sonolus-Version'), '1.1.3');
    assert.deepEqual(await response.json(), {
        session: 'test-session',
        expiration: 1234567890,
    });
});

test('Honolus options customize the base path and version', async () => {
    const sonolus = new Honolus({ basePath: '/api/sonolus/', version: '1.2.0' });

    class AuthenticateHandler {
        handle() {
            return { session: 'custom', expiration: 1 };
        }
    }

    sonolus.route.server.authenticate(AuthenticateHandler);

    const response = await sonolus.getApp().request('/api/sonolus/authenticate', {
        method: 'POST',
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Sonolus-Version'), '1.2.0');
});
