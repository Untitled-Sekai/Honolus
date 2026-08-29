# Production構成

推奨する最小構成です。

```text
Client → Load Balancer / CDN → Honolus Web × N
                                ├─ PostgreSQL
                                ├─ Shared asset storage / CDN
                                └─ PostgreSQL Job Queue → Worker × N
```

## 起動設定

```ts
const sonolus = new Honolus({
    database,
    assets,
    jobQueue,
    timeoutMs: 10_000,
    rateLimit: {
        limit: 120,
        windowMs: 60_000,
        store: sharedRateLimitStore,
        trustProxy: true,
    },
    observability: { logger, metrics, tracer },
    readiness: [assetDependency],
})
```

`trustProxy`は、信頼できるload balancerが外部からの`X-Forwarded-For`を削除・再設定する場合だけ有効にします。

## 終了処理

```ts
let closing = false

async function shutdown() {
    if (closing) return
    closing = true
    // runtime固有のAPIで新規HTTP受付を停止
    await sonolus.close()
}

process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
```

DB pool、queue、asset clientをrequestごとに作成しないでください。process単位で共有し、readiness成功後にtrafficを流します。

## Deploymentチェック

- migrationをweb起動前に一度だけ実行する
- `CURSOR_SECRET`を全web instanceで共有する
- webとworkerへ同じjob schema/versionをdeployする
- `/health/ready`失敗中はload balancerから除外する
- asset URLをcontent hashベースでimmutable cacheする
