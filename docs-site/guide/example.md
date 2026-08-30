# Post Exampleを動かす

リポジトリの[`example/`](https://github.com/Untitled-Sekai/Honolus/tree/main/example)は、テスト用PostをMemory DBへ登録し、Postのinfo、list、detailを実際のデコレーターで実装します。

大きな一枚のファイルにはせず、実際のサーバーへ機能を追加しやすい最小限の責務で分割しています。

## ファイル配置

```text
example/
├─ src/
│  ├─ fixtures/posts.ts       # DatabasePostItemのテストデータ
│  ├─ routes/
│  │  ├─ server-info.ts       # サーバー入口
│  │  └─ posts/
│  │     ├─ info.ts           # Post info
│  │     ├─ list.ts           # Post list
│  │     ├─ detail.ts         # Post detail
│  │     └─ mapper.ts         # DB用Postから表示用Postへの変換
│  ├─ database.ts             # DB生成とseed
│  ├─ sonolus.ts              # Honolus設定
│  ├─ app.ts                  # route moduleの登録
│  └─ server.ts               # Node.js listenerと終了処理
└─ test/posts.test.js         # info/list/detailのHTTPテスト
```

## 起動する

```bash
git clone https://github.com/Untitled-Sekai/Honolus.git
cd Honolus/example
npm install
npm run dev
```

既定では`http://localhost:3000`で待ち受けます。

## テスト用Postを作る

[`fixtures/posts.ts`](https://github.com/Untitled-Sekai/Honolus/blob/main/example/src/fixtures/posts.ts)に、DBへ保存する`DatabasePostItem`を定義します。

```ts
export const welcomePost: DatabasePostItem = {
    name: 'welcome',
    version: 1,
    title: {
        en: 'Welcome to Honolus',
        ja: 'Honolusへようこそ',
    },
    time: 1_788_022_800_000,
    author: {
        en: 'Untitled Sekai',
        ja: 'Untitled Sekai',
    },
    tags: [
        { title: { en: 'Example', ja: 'サンプル' } },
    ],
    description: {
        en: 'This post is loaded from the example Memory database.',
        ja: 'ExampleのMemoryデータベースから取得したポストです。',
    },
}
```

[`database.ts`](https://github.com/Untitled-Sekai/Honolus/blob/main/example/src/database.ts)からseedとして渡します。

```ts
export const database = createSonolusDatabase({
    driver: 'memory',
    seed: { post: [welcomePost] },
})
```

## 独自デコレーターを有効にする

HonolusへDBを渡しつつ、組み込みDB routeは無効化します。これによりDB lifecycleと`context.database`を維持したまま、Post routeを自分で登録できます。

```ts
export const sonolus = new Honolus({
    database,
    databaseRoutes: false,
})
```

## Post info

```ts
@sonolus.route.server.post.info
export class PostInfoHandler {
    public handle(_context: SonolusContext): ServerItemInfo {
        return {
            title: 'Posts',
            sections: [],
        }
    }
}
```

## Post list

list handlerはRepositoryからPostを検索し、DB用のlocalized textをクライアント表示用文字列へ変換します。

```ts
@sonolus.route.server.post.list
export class PostListHandler {
    public async handle(
        context: SonolusContext,
    ): Promise<ServerItemList<PostItem>> {
        const result = await context.database!.repository('post').list({
            page: { limit: context.pagination.limit },
        })

        return {
            title: 'Posts',
            pageCount: Math.ceil(
                (result.totalCount ?? result.items.length) /
                context.pagination.limit,
            ),
            items: result.items.map((post) =>
                toPostItem(post, context.localization),
            ),
        }
    }
}
```

## Post detail

detail handlerの第2引数にはURLの`itemName`が渡されます。存在しない場合は`NotFoundError`を投げることで404になります。

```ts
@sonolus.route.server.post.detail
export class PostDetailHandler {
    public async handle(
        context: SonolusContext,
        itemName: string,
    ): Promise<ServerItemDetails<PostItem>> {
        const post = await context.database!.repository('post').get(itemName)
        if (!post) throw new PostNotFoundError(itemName)

        return {
            item: toPostItem(post, context.localization),
            description: localized(post.description!, context.localization),
            actions: [],
            hasCommunity: false,
            leaderboards: [],
            sections: [],
        }
    }
}
```

完全な実装は[`routes/posts/`](https://github.com/Untitled-Sekai/Honolus/tree/main/example/src/routes/posts)にあります。

## HTTPで取得する

```bash
curl http://localhost:3000/sonolus/posts/info
curl 'http://localhost:3000/sonolus/posts/list?localization=ja'
curl 'http://localhost:3000/sonolus/posts/welcome?localization=ja'
```

detailでは次のようにPostを取得できます。

```json
{
  "item": {
    "name": "welcome",
    "version": 1,
    "title": "Honolusへようこそ",
    "time": 1788022800000,
    "author": "Untitled Sekai",
    "tags": [{ "title": "サンプル" }]
  },
  "description": "ExampleのMemoryデータベースから取得したポストです。",
  "actions": [],
  "hasCommunity": false,
  "leaderboards": [],
  "sections": []
}
```

## 自動テスト

```bash
npm test
```

[`test/posts.test.js`](https://github.com/Untitled-Sekai/Honolus/blob/main/example/test/posts.test.js)はinfo、list、detailをHono appへHTTP requestし、Post名、日本語タイトル、説明、404を確認します。

本番化するときはMemory DBを[PostgreSQL](/features/database#postgresql)へ交換し、同じRepository呼び出しを維持できます。
