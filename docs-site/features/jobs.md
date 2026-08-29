# 非同期ジョブ

## Memory queue

テストではプロセス内queueを使用できます。

```ts
const queue = new MemoryJobQueue()

queue.register('ranking.rebuild', async (payload, context) => {
    return rebuildRanking(payload.levelName)
})

await queue.enqueue(
    'ranking.rebuild',
    { levelName: 'tutorial' },
    { idempotencyKey: 'ranking:tutorial', maxAttempts: 3 },
)
```

## PostgreSQL queue

```ts
const queue = new PostgresJobQueue({
    executor,
    pollIntervalMs: 250,
    leaseMs: 30_000,
})

queue.register('ranking.rebuild', rebuildRanking)
await queue.ready()
```

複数workerは`FOR UPDATE SKIP LOCKED`でjobを排他的に取得します。実行中はheartbeatでleaseを延長し、worker停止後に期限切れjobを別workerが回収します。失敗時は指数backoffで再試行し、`maxAttempts`到達後は`dead`になります。

::: tip Webとworkerの分離
大規模構成では、web processはenqueueだけを担当し、handlerを登録するworker processを別に起動してください。
:::

終了時は`await queue.close()`でpollを停止し、実行中処理の境界を安全に閉じます。
