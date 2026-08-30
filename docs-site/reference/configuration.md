# HonolusOptions

```ts
const sonolus = new Honolus(options)
```

| Option | 型・既定値 | 説明 |
| --- | --- | --- |
| `basePath` | `'/sonolus'` | Sonolus APIのbase path |
| `version` | `'1.1.3'` | `Sonolus-Version` header |
| `database` | `SonolusDatabase` | item repositoryと自動route |
| `databaseRoutes` | `true` | `false`なら独自decorator用にDB自動routeを無効化 |
| `assets` | `SonolusAssetStore` | `/repository/:hash`の配信元 |
| `pack` | scp / directory / npm | read-only static Pack |
| `timeoutMs` | number | request deadline |
| `rateLimit` | `RateLimitOptions` | rate limit storeと制限値 |
| `observability` | logger / metrics / tracer | 観測性adapter |
| `jobQueue` | `JobQueue` | lifecycleとreadinessへ接続するqueue |
| `readiness` | dependency[] | 独自の依存サービスcheck |
| `auth` | `AuthOptions` | 共有session、TTL、監査logger |

## Lifecycle

```ts
sonolus.getApp()             // Hono app
sonolus.getRouteManifest()   // 登録route一覧
sonolus.getOpenApiDocument() // OpenAPI 3.0.3
await sonolus.close()        // queueとDBを終了
```

`await Honolus.create(options)`を使うと、全依存のreadinessが成功してからinstanceを受け取れます。`close({ gracePeriodMs })`は新規requestを拒否し、処理中requestを期限まで待機します。

## Context

`SonolusContext`から主に次の値を取得できます。

| Property / method | 内容 |
| --- | --- |
| `localization` | requestのlocalization |
| `pagination` | page、offset、cursor、limit |
| `session` | `Sonolus-Session` |
| `requestId` | request追跡ID |
| `abortSignal` | timeout時にabortされるsignal |
| `query(name)` | query parameter |
| `search()` | 登録済み検索フォームの解析結果 |
| `itemName` | detail routeのitem name |
| `database` / `assets` | 注入された依存 |
