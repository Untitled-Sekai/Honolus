import type { DatabasePostItem } from '@sonolus/core'

export const welcomePost: DatabasePostItem = {
    name: 'welcome',
    version: 1,
    title: { en: 'Welcome to Honolus', ja: 'Honolusへようこそ' },
    time: 1_788_022_800_000,
    author: { en: 'Untitled Sekai', ja: 'Untitled Sekai' },
    tags: [{ title: { en: 'Example', ja: 'サンプル' } }],
    description: {
        en: 'This post is loaded from the example Memory database.',
        ja: 'ExampleのMemoryデータベースから取得したポストです。',
    },
}
