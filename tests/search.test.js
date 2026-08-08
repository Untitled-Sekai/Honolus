const assert = require('node:assert/strict');
const test = require('node:test');
const { Honolus } = require('../dist');

const searches = [
    {
        type: 'advanced',
        title: 'Advanced',
        requireConfirmation: false,
        options: [
            {
                query: 'keywords', name: 'Keywords', required: false, type: 'text',
                def: '', placeholder: 'Keywords', limit: 20, shortcuts: [],
            },
            {
                query: 'rating', name: 'Rating', required: false, type: 'slider',
                def: 0, min: 0, max: 100, step: 1,
            },
            {
                query: 'random', name: 'Random', required: false, type: 'toggle', def: true,
            },
            {
                query: 'genre', name: 'Genre', required: false, type: 'select', def: 'pop',
                values: [{ name: 'pop', title: 'Pop' }, { name: 'rock', title: 'Rock' }],
            },
            {
                query: 'difficulty', name: 'Difficulty', required: false, type: 'multi',
                def: [true, false],
                values: [{ name: 'easy', title: 'Easy' }, { name: 'hard', title: 'Hard' }],
            },
            {
                query: 'single', name: 'Single', required: false, type: 'serverItem',
                itemType: 'level', def: null, allowOtherServers: true,
            },
            {
                query: 'multiple', name: 'Multiple', required: false, type: 'serverItems',
                itemType: 'level', def: [], allowOtherServers: true, limit: 2,
            },
            {
                query: 'collection', name: 'Collection', required: false,
                type: 'collectionItem', itemType: 'level',
            },
            {
                query: 'asset', name: 'Asset', required: false, type: 'file', def: '',
            },
        ],
    },
];

test('registered search parses and normalizes every ServerOption type', async () => {
    const sonolus = new Honolus();
    const levelSearch = sonolus.search.level(searches);
    let explicit;
    let automatic;

    class LevelListHandler {
        handle(context) {
            explicit = context.search(levelSearch);
            automatic = context.search();
            return { pageCount: 0, items: [] };
        }
    }

    sonolus.route.server.level.list(LevelListHandler);

    const parameters = new URLSearchParams({
        type: 'advanced',
        keywords: 'expert',
        rating: '75',
        random: '0',
        genre: 'rock',
        difficulty: 'easy,hard',
        single: JSON.stringify({ address: 'https://example.com', name: 'one' }),
        multiple: JSON.stringify([{ address: 'https://example.com', name: 'two' }]),
        collection: JSON.stringify({ name: 'collection-level' }),
        asset: 'hash',
    });
    const response = await sonolus.getApp().request(`/sonolus/levels/list?${parameters}`);

    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).searches, searches);
    assert.deepEqual(explicit, automatic);
    assert.deepEqual(explicit, {
        type: 'advanced',
        options: {
            keywords: 'expert',
            rating: 75,
            random: false,
            genre: 'rock',
            difficulty: { easy: true, hard: true },
            single: { address: 'https://example.com', name: 'one' },
            multiple: [{ address: 'https://example.com', name: 'two' }],
            collection: { name: 'collection-level' },
            asset: 'hash',
        },
        rawOptions: {
            keywords: 'expert',
            rating: 75,
            random: false,
            genre: 'rock',
            difficulty: { easy: true, hard: true },
            single: { address: 'https://example.com', name: 'one' },
            multiple: [{ address: 'https://example.com', name: 'two' }],
            collection: { name: 'collection-level' },
            asset: 'hash',
        },
    });
});

test('registered search applies defaults and supports quick search', async () => {
    const sonolus = new Honolus();
    const levelSearch = sonolus.search.level(searches);
    const values = [];

    class LevelListHandler {
        handle(context) {
            values.push(context.search(levelSearch));
            return { pageCount: 0, items: [] };
        }
    }

    sonolus.route.server.level.list(LevelListHandler);
    await sonolus.getApp().request('/sonolus/levels/list?type=advanced&rating=999');
    await sonolus.getApp().request('/sonolus/levels/list?type=quick&keywords=hello');

    assert.equal(values[0].options.rating, 0);
    assert.equal(values[0].options.random, true);
    assert.deepEqual(values[0].options.difficulty, { easy: true, hard: false });
    assert.deepEqual(values[0].rawOptions, { rating: 999 });
    assert.deepEqual(values[1], {
        type: 'quick',
        options: { keywords: 'hello' },
        rawOptions: { keywords: 'hello' },
    });
});

test('search registration rejects ambiguous form definitions', () => {
    const sonolus = new Honolus();

    assert.throws(
        () => sonolus.search.level([
            { type: 'quick', title: 'Quick', requireConfirmation: false, options: [] },
        ]),
        /reserved/,
    );
    assert.throws(
        () => sonolus.search.level([
            { type: 'same', title: 'One', requireConfirmation: false, options: [] },
            { type: 'same', title: 'Two', requireConfirmation: false, options: [] },
        ]),
        /Duplicate/,
    );
});
