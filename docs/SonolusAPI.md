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
- グループのデコレーター公開は `src/api/<グループ>/index.ts`
- 共通の登録・実行処理は `src/api/registry.ts`

この分離により、個別エンドポイント固有のレスポンス変換などは `RouteDefinition.respond` へ追加でき、共通登録処理を変更せず拡張できます。
