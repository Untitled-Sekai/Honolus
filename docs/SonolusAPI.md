# SonolusAPI

`Honolus` のインスタンスが持つデコレーターをクラスに付けることで、Sonolus API のルートを登録できます。

## 基本的な使い方

```ts
import type { ServerAuthenticateResponse } from '@sonolus/core'
import { Honolus, SonolusContext } from 'honolus'

const sonolus = new Honolus()

@sonolus.route.server.authenticate
class AuthenticateHandler {
    async handle(c: SonolusContext): Promise<ServerAuthenticateResponse> {
        // c.session、c.localization などを利用できます。
        return {
            session: 'generated-session-id',
            expiration: Date.now() + 60 * 60 * 1000,
        }
    }
}

export default sonolus.getApp()
```

この例では `POST /sonolus/authenticate` が登録され、`handle` の戻り値が JSON として返されます。`handle` の戻り値には `Promise<ServerAuthenticateResponse>` を明記することで、`@sonolus/core` と異なるレスポンスをコンパイル時に検出できます。

`server.authenticate` では、最初に `src/api/authenticate.ts` の認証処理が実行されます。リクエスト形式、期限、署名の検証がすべて成功した場合だけ `handle` が呼ばれます。検証に失敗した場合は、その時点でエラーレスポンスを返し、`handle` は呼ばれません。

## アイテムルート

```ts
import type { ServerItemInfo } from '@sonolus/core'

@sonolus.route.server.level.info
class ItemInfoHandler {
    async handle(c: SonolusContext): Promise<ServerItemInfo> {
        return {
            title: 'Levels',
            sections: [],
        }
    }
}
```

```ts
import type { PostItem, ServerItemDetails } from '@sonolus/core'

@sonolus.route.server.post.detail
class ItemDetailHandler {
    async handle(
        c: SonolusContext,
        itemName: string,
    ): Promise<ServerItemDetails<PostItem>> {
        // c.itemName からも同じ値を取得できます。
        return await loadPostDetails(itemName)
    }
}
```

```ts
import type { LevelItem, ServerItemList } from '@sonolus/core'

@sonolus.route.server.level.list
class LevelListHandler {
    async handle(c: SonolusContext): Promise<ServerItemList<LevelItem>> {
        const items = await loadLevels(c.pagination)

        return {
            pageCount: c.utils.calc_pagecount(items.totalCount),
            items: items.values,
        }
    }
}
```

| 種類 | デコレーター例 | HTTPルート |
| --- | --- | --- |
| post | `server.post.info` / `.list` / `.detail` | `/sonolus/posts/info` / `/list` / `/:itemName` |
| playlist | `server.playlist.info` / `.list` / `.detail` | `/sonolus/playlists/...` |
| level | `server.level.info` / `.list` / `.detail` | `/sonolus/levels/...` |
| skin | `server.skin.info` / `.list` / `.detail` | `/sonolus/skins/...` |
| background | `server.background.info` / `.list` / `.detail` | `/sonolus/backgrounds/...` |
| effect | `server.effect.info` / `.list` / `.detail` | `/sonolus/effects/...` |
| particle | `server.particle.info` / `.list` / `.detail` | `/sonolus/particles/...` |
| engine | `server.engine.info` / `.list` / `.detail` | `/sonolus/engines/...` |
| replay | `server.replay.info` / `.list` / `.detail` | `/sonolus/replays/...` |
| room | `server.room.info` / `.list` / `.detail` | `/sonolus/rooms/...` |

detailの `handle` には、`SonolusContext` の次の引数として `itemName: string` が明示的に渡されます。同じ値は `c.itemName` または `c.param('itemName')` でも取得できます。各デコレーターのレスポンス型はアイテムごとに分かれており、例えば `server.level.detail` は `ServerItemDetails<LevelItem>` を要求します。

listもアイテムごとに型が決まります。例えば `server.level.list` は `ServerItemList<LevelItem>`、`server.post.list` は `ServerItemList<PostItem>` を要求するため、`items` に異なる種類のアイテムを返すと型エラーになります。

## 全エンドポイント

表の `server` は `sonolus.route.server` を表します。

| デコレーター | HTTPルート |
| --- | --- |
| `server.info` | `GET /sonolus/info` |
| `server.authenticate` | `POST /sonolus/authenticate` |
| `server.<item>.info` | `GET /sonolus/{type}/info` |
| `server.<item>.list` | `GET /sonolus/{type}/list` |
| `server.<item>.detail` | `GET /sonolus/{type}/{itemName}` |
| `server.<item>.create` | `POST /sonolus/{type}/create` |
| `server.<item>.createUpload` | `POST /sonolus/{type}/upload` |
| `server.<item>.submit` | `POST /sonolus/{type}/{itemName}/submit` |
| `server.<item>.upload` | `POST /sonolus/{type}/{itemName}/upload` |
| `server.<item>.community.info` | `GET /sonolus/{type}/{itemName}/community/info` |
| `server.<item>.community.submit` | `POST /sonolus/{type}/{itemName}/community/submit` |
| `server.<item>.community.upload` | `POST /sonolus/{type}/{itemName}/community/upload` |
| `server.<item>.community.comments.list` | `GET /sonolus/{type}/{itemName}/community/comments/list` |
| `server.<item>.community.comments.submit` | `POST /sonolus/{type}/{itemName}/community/comments/{commentName}/submit` |
| `server.<item>.community.comments.upload` | `POST /sonolus/{type}/{itemName}/community/comments/{commentName}/upload` |
| `server.<item>.leaderboard.detail` | `GET /sonolus/{type}/{itemName}/leaderboards/{leaderboardName}` |
| `server.<item>.leaderboard.records.list` | `GET /sonolus/{type}/{itemName}/leaderboards/{leaderboardName}/records/list` |
| `server.<item>.leaderboard.records.detail` | `GET /sonolus/{type}/{itemName}/leaderboards/{leaderboardName}/records/{recordName}` |
| `server.level.result.info` | `GET /sonolus/levels/result/info` |
| `server.level.result.submit` | `POST /sonolus/levels/result/submit` |
| `server.level.result.upload` | `POST /sonolus/levels/result/upload` |
| `server.room.create` | `POST /sonolus/rooms/create` |
| `server.room.join` | `POST /sonolus/rooms/{itemName}` |

`<item>` は `post`, `playlist`, `level`, `skin`, `background`, `effect`, `particle`, `engine`, `replay` のいずれかです。roomは読み取り用の `info`, `list`, `detail` と、専用の `create`, `join` を持ちます。

## クエリパラメーター

クエリ名は固定していないため、Configuration Optionsを含む任意の値を取得できます。

```ts
@sonolus.route.server.level.list
class LevelListHandler {
    async handle(c: SonolusContext): Promise<ServerItemList<LevelItem>> {
        const search = c.query('search')          // string | undefined
        const tags = c.queries('tag')             // string[]
        const all = c.queryParams                 // URLSearchParams
        const page = c.pagination.page
        const cursor = c.pagination.cursor

        return await findLevels({ search, tags, all, page, cursor })
    }
}
```

## POSTリクエストとパス引数

JSON本文、パス引数、アップロードデータは `SonolusContext` より後ろへ型付きで渡されます。

```ts
@sonolus.route.server.post.submit
class PostSubmitHandler {
    async handle(
        c: SonolusContext,
        itemName: string,
        request: ServerSubmitItemActionRequest,
    ): Promise<ServerSubmitItemActionResponse> {
        return await submitPostAction(itemName, request, c.session)
    }
}
```

multipartエンドポイントでは最後の引数が `FormData` になります。`Sonolus-Upload-Key` は `c.upload_key`、ルーム作成キーは `c.room_key`、その他のヘッダーは `c.header(name)` で取得できます。

`sonolus` はデコレーターより先に生成してください。デコレーターの評価時に、その `sonolus` インスタンスへルートが登録されます。同じインスタンスの同じ HTTP メソッド・パスへ複数のハンドラーを登録するとエラーになります。

## オプション

```ts
const sonolus = new Honolus({
    basePath: '/api/sonolus',
    version: '1.1.3',
})
```

| オプション | 既定値 | 説明 |
| --- | --- | --- |
| `basePath` | `/sonolus` | 全 Sonolus API ルートに付くパス |
| `version` | `1.1.3` | `Sonolus-Version` レスポンスヘッダーの値 |

ハンドラークラスは引数なしで生成できる必要があります。リクエストごとに新しいインスタンスが生成され、`handle(c: SonolusContext)` が一度呼び出されます。

## エンドポイントの追加方針

フレームワークへ新しいエンドポイントを実装する場合は、次の単位を維持します。

- HTTP メソッド、パス、レスポンス型の定義は `src/api/<グループ>/<エンドポイント>.ts`
- グループのデコレーター公開は各ディレクトリの `index.ts`
- 共通の登録・実行処理は `src/api/registry.ts`

この分離により、個別エンドポイント固有の前処理は `RouteDefinition.before`、レスポンス変換は `RouteDefinition.respond` へ追加でき、共通登録処理を変更せず拡張できます。`before` は配列の順番どおりに実行され、レスポンスを返した時点で後続の処理を中止します。
