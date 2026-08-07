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

## 可変アイテムルート

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

| 種類 | デコレーター例 | HTTPルート |
| --- | --- | --- |
| post | `server.post.info` / `server.post.detail` | `/sonolus/posts/info` / `/sonolus/posts/:itemName` |
| playlist | `server.playlist.info` / `server.playlist.detail` | `/sonolus/playlists/...` |
| level | `server.level.info` / `server.level.detail` | `/sonolus/levels/...` |
| skin | `server.skin.info` / `server.skin.detail` | `/sonolus/skins/...` |
| background | `server.background.info` / `server.background.detail` | `/sonolus/backgrounds/...` |
| effect | `server.effect.info` / `server.effect.detail` | `/sonolus/effects/...` |
| particle | `server.particle.info` / `server.particle.detail` | `/sonolus/particles/...` |
| engine | `server.engine.info` / `server.engine.detail` | `/sonolus/engines/...` |
| replay | `server.replay.info` / `server.replay.detail` | `/sonolus/replays/...` |
| room | `server.room.info` / `server.room.detail` | `/sonolus/rooms/...` |

detailの `handle` には、`SonolusContext` の次の引数として `itemName: string` が明示的に渡されます。同じ値は `c.itemName` または `c.param('itemName')` でも取得できます。各デコレーターのレスポンス型はアイテムごとに分かれており、例えば `server.level.detail` は `ServerItemDetails<LevelItem>` を要求します。

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
