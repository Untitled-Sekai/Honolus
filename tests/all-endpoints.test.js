const assert = require('node:assert/strict');
const test = require('node:test');
const { Honolus } = require('../dist');

const jsonRequest = (body = {}) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

const uploadRequest = () => {
    const body = new FormData();
    body.append('files', new Blob(['file']), 'file.txt');
    return { method: 'POST', body };
};

test('all documented non-authenticate endpoints are decorator-routable', async () => {
    const sonolus = new Honolus();
    const calls = [];

    const register = (decorator, name) => {
        class Handler {
            handle(context, ...arguments_) {
                calls.push({ name, context, arguments_ });
                return { endpoint: name };
            }
        }
        decorator(Handler);
    };

    register(sonolus.route.server.info, 'server.info');
    register(sonolus.route.server.post.info, 'post.info');
    register(sonolus.route.server.post.list, 'post.list');
    register(sonolus.route.server.post.detail, 'post.detail');
    register(sonolus.route.server.post.create, 'post.create');
    register(sonolus.route.server.post.createUpload, 'post.createUpload');
    register(sonolus.route.server.post.submit, 'post.submit');
    register(sonolus.route.server.post.upload, 'post.upload');
    register(sonolus.route.server.post.community.info, 'community.info');
    register(sonolus.route.server.post.community.submit, 'community.submit');
    register(sonolus.route.server.post.community.upload, 'community.upload');
    register(sonolus.route.server.post.community.comments.list, 'comments.list');
    register(sonolus.route.server.post.community.comments.submit, 'comments.submit');
    register(sonolus.route.server.post.community.comments.upload, 'comments.upload');
    register(sonolus.route.server.post.leaderboard.detail, 'leaderboard.detail');
    register(sonolus.route.server.post.leaderboard.records.list, 'records.list');
    register(sonolus.route.server.post.leaderboard.records.detail, 'records.detail');
    register(sonolus.route.server.level.result.info, 'result.info');
    register(sonolus.route.server.level.result.submit, 'result.submit');
    register(sonolus.route.server.level.result.upload, 'result.upload');
    register(sonolus.route.server.room.create, 'room.create');
    register(sonolus.route.server.room.join, 'room.join');

    const requests = [
        ['/sonolus/info?option=one&option=two', undefined, 'server.info'],
        ['/sonolus/posts/info', undefined, 'post.info'],
        ['/sonolus/posts/list?page=2&cursor=next', undefined, 'post.list'],
        ['/sonolus/posts/item-a', undefined, 'post.detail'],
        ['/sonolus/posts/create', jsonRequest({ values: 'a=1' }), 'post.create'],
        ['/sonolus/posts/upload', uploadRequest(), 'post.createUpload'],
        ['/sonolus/posts/item-a/submit', jsonRequest({ values: 'a=1' }), 'post.submit'],
        ['/sonolus/posts/item-a/upload', uploadRequest(), 'post.upload'],
        ['/sonolus/posts/item-a/community/info', undefined, 'community.info'],
        ['/sonolus/posts/item-a/community/submit', jsonRequest({ values: 'a=1' }), 'community.submit'],
        ['/sonolus/posts/item-a/community/upload', uploadRequest(), 'community.upload'],
        ['/sonolus/posts/item-a/community/comments/list', undefined, 'comments.list'],
        ['/sonolus/posts/item-a/community/comments/comment-a/submit', jsonRequest({ values: 'a=1' }), 'comments.submit'],
        ['/sonolus/posts/item-a/community/comments/comment-a/upload', uploadRequest(), 'comments.upload'],
        ['/sonolus/posts/item-a/leaderboards/score', undefined, 'leaderboard.detail'],
        ['/sonolus/posts/item-a/leaderboards/score/records/list', undefined, 'records.list'],
        ['/sonolus/posts/item-a/leaderboards/score/records/record-a', undefined, 'records.detail'],
        ['/sonolus/levels/result/info', undefined, 'result.info'],
        ['/sonolus/levels/result/submit', jsonRequest({ replay: {}, values: '' }), 'result.submit'],
        ['/sonolus/levels/result/upload', uploadRequest(), 'result.upload'],
        ['/sonolus/rooms/create', jsonRequest({}), 'room.create'],
        ['/sonolus/rooms/room-a', jsonRequest({}), 'room.join'],
    ];

    for (const [path, init, endpoint] of requests) {
        const response = await sonolus.getApp().request(path, init);
        assert.equal(response.status, 200, path);
        assert.equal((await response.json()).endpoint, endpoint, path);
    }

    const infoCall = calls.find(({ name }) => name === 'server.info');
    assert.equal(infoCall.context.query('option'), 'one');
    assert.deepEqual(infoCall.context.queries('option'), ['one', 'two']);
    assert.deepEqual(infoCall.context.queryParams.getAll('option'), ['one', 'two']);

    const detailCall = calls.find(({ name }) => name === 'post.detail');
    assert.deepEqual(detailCall.arguments_, ['item-a']);

    const commentCall = calls.find(({ name }) => name === 'comments.submit');
    assert.equal(commentCall.arguments_[0], 'item-a');
    assert.equal(commentCall.arguments_[1], 'comment-a');
    assert.deepEqual(commentCall.arguments_[2], { values: 'a=1' });

    const recordCall = calls.find(({ name }) => name === 'records.detail');
    assert.deepEqual(recordCall.arguments_, ['item-a', 'score', 'record-a']);

    const uploadCall = calls.find(({ name }) => name === 'post.upload');
    assert.equal(uploadCall.arguments_[0], 'item-a');
    assert.ok(uploadCall.arguments_[1] instanceof FormData);
});
