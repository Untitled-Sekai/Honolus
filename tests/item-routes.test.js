const assert = require('node:assert/strict');
const test = require('node:test');
const { Honolus } = require('../dist');

test('type-specific item routes expose itemName explicitly', async () => {
    const sonolus = new Honolus();

    class LevelInfoHandler {
        handle() {
            return {
                title: 'Levels',
                sections: [],
            };
        }
    }

    class LevelDetailHandler {
        handle(context, itemName) {
            return {
                item: {
                    nameFromArgument: itemName,
                    nameFromContext: context.itemName,
                },
                actions: [],
                hasCommunity: false,
                leaderboards: [],
                sections: [],
            };
        }
    }

    sonolus.route.server.level.info(LevelInfoHandler);
    sonolus.route.server.level.detail(LevelDetailHandler);

    const infoResponse = await sonolus.getApp().request('/sonolus/levels/info');
    const detailResponse = await sonolus.getApp().request('/sonolus/levels/example-level');

    assert.equal(infoResponse.status, 200);
    assert.equal((await infoResponse.json()).title, 'Levels');
    assert.equal(detailResponse.status, 200);
    assert.deepEqual((await detailResponse.json()).item, {
        nameFromArgument: 'example-level',
        nameFromContext: 'example-level',
    });
});

test('every item decorator maps to its own plural URL', async () => {
    const sonolus = new Honolus();
    const itemPaths = {
        post: 'posts',
        playlist: 'playlists',
        level: 'levels',
        skin: 'skins',
        background: 'backgrounds',
        effect: 'effects',
        particle: 'particles',
        engine: 'engines',
        replay: 'replays',
        room: 'rooms',
    };

    for (const [type, path] of Object.entries(itemPaths)) {
        class ItemInfoHandler {
            handle() {
                return { title: type, sections: [] };
            }
        }

        sonolus.route.server[type].info(ItemInfoHandler);
        const response = await sonolus.getApp().request(`/sonolus/${path}/info`);

        assert.equal(response.status, 200);
        assert.equal((await response.json()).title, type);
    }

    assert.equal((await sonolus.getApp().request('/sonolus/unknown/info')).status, 404);
});

test('static info route wins even when detail is decorated first', async () => {
    const sonolus = new Honolus();

    class LevelDetailHandler {
        handle() {
            return { route: 'detail' };
        }
    }

    class LevelInfoHandler {
        handle() {
            return { route: 'info' };
        }
    }

    sonolus.route.server.level.detail(LevelDetailHandler);
    sonolus.route.server.level.info(LevelInfoHandler);

    const response = await sonolus.getApp().request('/sonolus/levels/info');

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { route: 'info' });
});

test('typed list route wins over detail and returns pagination', async () => {
    const sonolus = new Honolus();

    class LevelDetailHandler {
        handle() {
            return { route: 'detail' };
        }
    }

    class LevelListHandler {
        handle(context) {
            return {
                title: 'Levels',
                pageCount: 3,
                items: [],
                quickSearchValues: `offset=${context.pagination.offset}`,
            };
        }
    }

    sonolus.route.server.level.detail(LevelDetailHandler);
    sonolus.route.server.level.list(LevelListHandler);

    const response = await sonolus.getApp().request('/sonolus/levels/list?page=2');

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
        title: 'Levels',
        pageCount: 3,
        items: [],
        quickSearchValues: 'offset=40',
    });
});
