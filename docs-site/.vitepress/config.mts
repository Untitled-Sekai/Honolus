import { defineConfig } from 'vitepress'

export default defineConfig({
    lang: 'ja-JP',
    title: 'Honolus',
    description: 'Honoで構築する、型安全なSonolusサーバーフレームワーク',
    cleanUrls: true,
    lastUpdated: true,
    head: [['meta', { name: 'theme-color', content: '#7257ff' }]],
    themeConfig: {
        logo: '/logo.svg',
        siteTitle: 'Honolus',
        nav: [
            { text: 'ガイド', link: '/guide/getting-started' },
            { text: '機能', link: '/features/database' },
            { text: '運用', link: '/operations/production' },
            { text: 'API', link: '/reference/configuration' },
        ],
        sidebar: {
            '/guide/': [
                { text: 'はじめる', items: [
                    { text: 'Honolusとは', link: '/guide/' },
                    { text: 'クイックスタート', link: '/guide/getting-started' },
                    { text: 'Exampleを動かす', link: '/guide/example' },
                    { text: 'プロジェクト構成', link: '/guide/project-structure' },
                    { text: 'ルートを作る', link: '/guide/routes' },
                ] },
            ],
            '/features/': [
                { text: 'コア機能', items: [
                    { text: 'データベース', link: '/features/database' },
                    { text: '検索とページング', link: '/features/search' },
                    { text: 'Packとアセット', link: '/features/pack' },
                    { text: '非同期ジョブ', link: '/features/jobs' },
                    { text: '認証・認可', link: '/features/auth' },
                    { text: 'Outbox', link: '/features/outbox' },
                ] },
            ],
            '/operations/': [
                { text: '本番運用', items: [
                    { text: 'Production構成', link: '/operations/production' },
                    { text: '観測性とヘルスチェック', link: '/operations/observability' },
                    { text: 'セキュリティ', link: '/operations/security' },
                    { text: '負荷・障害試験', link: '/operations/load-testing' },
                ] },
            ],
            '/reference/': [
                { text: 'リファレンス', items: [
                    { text: 'HonolusOptions', link: '/reference/configuration' },
                    { text: 'CLI', link: '/reference/cli' },
                    { text: '公開API', link: '/reference/api' },
                ] },
            ],
        },
        socialLinks: [],
        search: { provider: 'local' },
        outline: { level: [2, 3], label: '目次' },
        docFooter: { prev: '前へ', next: '次へ' },
        lastUpdated: { text: '最終更新' },
        footer: { message: 'Released under the ISC License.', copyright: 'Honolus contributors' },
    },
})
