# 検索とページング

Repositoryは型付きの検索DSLを受け取ります。

```ts
const page = await database.repository('level').list({
    search: 'expert',
    tags: ['music'],
    where: {
        rating: { min: 20, max: 35 },
        author: { contains: 'team' },
    },
    orderBy: [{ field: 'rating', direction: 'desc' }],
    page: { limit: 20 },
})
```

`nextCursor`を次のrequestへそのまま渡します。cursorには並び順と検索条件が結び付いているため、異なる検索へ流用すると拒否されます。

```ts
const next = await levels.list({
    ...query,
    page: { limit: 20, cursor: page.nextCursor },
})
```

公開サービスではSQL databaseに`cursorSecret`を設定し、cursor改ざんをHMACで検出してください。

## COUNTを省略する

大量データでは`COUNT(*)`が一覧本体より高価になることがあります。無限スクロールなど総件数が不要なUIでは省略できます。

```ts
const page = await levels.list({
    page: { limit: 50 },
    includeTotalCount: false,
})
```

この場合`totalCount`は`undefined`です。Sonolus標準list routeで`pageCount`が必要な場合は、既定値のままCOUNTを取得してください。
