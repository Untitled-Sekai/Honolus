const assert = require('node:assert/strict');
const test = require('node:test');
const { Honolus } = require('../dist');

const authenticationBody = {
    type: 'authenticateServer',
    address: 'https://example.com',
    time: Date.now(),
    userProfile: {
        id: 'service-user-id',
        handle: 'user',
        name: 'User',
        avatarType: 'default',
        avatarForegroundType: 'default',
        avatarForegroundColor: '#ffffff',
        avatarBackgroundType: 'default',
        avatarBackgroundColor: '#000000',
        bannerType: 'default',
        aboutMe: '',
        favorites: [],
    },
};

test('server.authenticate stops before handle when authentication fails', async () => {
    const sonolus = new Honolus();
    let handleCalled = false;

    class AuthenticateHandler {
        handle() {
            handleCalled = true;
            return { session: 'unreachable', expiration: 0 };
        }
    }

    sonolus.route.server.authenticate(AuthenticateHandler);

    const response = await sonolus.getApp().request('/sonolus/authenticate', {
        method: 'POST',
    });

    assert.equal(response.status, 400);
    assert.equal(handleCalled, false);
    assert.deepEqual(await response.json(), { error: 'Missing session or signature' });
});

test('server.authenticate runs authentication before handle', async () => {
    const sonolus = new Honolus();
    const executionOrder = [];
    const subtle = globalThis.crypto.subtle;
    const originalVerify = subtle.verify;

    subtle.verify = async () => {
        executionOrder.push('authenticate');
        return true;
    };

    try {
        class AuthenticateHandler {
            async handle() {
                executionOrder.push('handle');
                return {
                    session: 'test-session',
                    expiration: 1234567890,
                };
            }
        }

        sonolus.route.server.authenticate(AuthenticateHandler);

        const response = await sonolus.getApp().request('/sonolus/authenticate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Sonolus-Session': 'request-session',
                'Sonolus-Signature': 'AA==',
            },
            body: JSON.stringify(authenticationBody),
        });

        assert.equal(response.status, 200);
        assert.equal(response.headers.get('Sonolus-Version'), '1.1.3');
        assert.deepEqual(executionOrder, ['authenticate', 'handle']);
        assert.deepEqual(await response.json(), {
            session: 'test-session',
            expiration: 1234567890,
        });
    } finally {
        subtle.verify = originalVerify;
    }
});

test('Honolus options customize the base path and version', async () => {
    const sonolus = new Honolus({ basePath: '/api/sonolus/', version: '1.2.0' });

    class ItemInfoHandler {
        handle() {
            return { sections: [] };
        }
    }

    sonolus.route.server.post.info(ItemInfoHandler);

    const response = await sonolus.getApp().request('/api/sonolus/posts/info');

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Sonolus-Version'), '1.2.0');
});
