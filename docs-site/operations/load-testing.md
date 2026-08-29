# 負荷・障害試験

再現可能なseedを生成できます。

```ts
const seed = generateLoadSeed(1_000_000, 20260829)
```

Repositoryの基本latencyを測定します。

```ts
const result = await benchmarkRepository(database.repository('level'), {
    iterations: 1_000,
    pageSize: 50,
})

console.log(result.p50Ms, result.p95Ms, result.p99Ms)
```

`FaultInjectingSqlExecutor`で一定間隔の失敗や遅延を注入できます。queue lease回収、outbox再配送、readiness、timeoutを、通常の成功系とは別のCI jobで検証してください。

本番相当試験では、複数web／worker、実際のPostgreSQL index、接続pool上限、worker強制終了、DB再起動を含めます。
