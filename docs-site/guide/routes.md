# ルートを作る

ルートは`Honolus`インスタンスが公開するデコレーターで登録します。

```ts
import type { ServerInfo } from '@sonolus/core'
import type { SonolusContext } from 'honolus'
import { sonolus } from '../app'

@sonolus.route.server.info
export class InfoHandler {
    async handle(context: SonolusContext): Promise<ServerInfo> {
        return { sections: [] }
    }
}
```

ハンドラーはリクエストごとに生成されます。戻り値の型を明記すると、Sonolus protocolと異なるレスポンスをコンパイル時に検出できます。

detailやsubmitでは、`SonolusContext`の後にpath parameterや検証済みrequestが渡されます。検索値、session、pagination、headerはcontextから取得できます。

```ts
@sonolus.route.server.post.detail
class PostDetailHandler {
    async handle(context: SonolusContext, itemName: string) {
        return loadPost(itemName, context.localization)
    }
}
```

登録済みrouteは`sonolus.getRouteManifest()`、最小OpenAPI文書は`sonolus.getOpenApiDocument()`で取得できます。
