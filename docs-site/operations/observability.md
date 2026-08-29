# 観測性とヘルスチェック

## ヘルスチェック

| Endpoint | 用途 |
| --- | --- |
| `/health/live` | processが応答できるか |
| `/health/ready` | DB、queue、追加依存が利用可能か |

readinessへ独自依存を追加できます。

```ts
const assetDependency = {
    name: 'assets',
    async ready() {
        await assetClient.headBucket()
    },
}
```

## ログ、メトリクス、トレース

`observability`にはvendor固有SDKを直接要求せず、adapter契約を渡します。

```ts
const sonolus = new Honolus({
    observability: {
        logger: new JsonConsoleLogger(),
        metrics,
        tracer,
    },
})
```

HTTPメトリクスのroute labelには実際のitem名ではなく登録route patternが使われ、時系列の高カーディナリティ化を避けます。ログにはrequest ID、method、route、status、処理時間が含まれます。

DBでは`PostgresExecutor`へ同じ`metrics`を渡すとquery件数とdurationを記録できます。
