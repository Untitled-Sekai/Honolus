# Transactional Outbox

DB更新とjob登録の間でprocessが停止してもeventを失わないため、同じtransactionへoutbox recordを追加します。

```ts
const outbox = new TransactionalOutbox({ executor })
await outbox.ready()

await outbox.transaction(async (database, events) => {
    await database.repository('level').put(level)
    await events.append(
        'search.index-level',
        { name: level.name },
        { idempotencyKey: `index:${level.name}:${level.version}` },
    )
})
```

dispatcherは複数process間でleaseを取得し、job queueへ冪等キー付きで配送します。

```ts
const dispatcher = new OutboxDispatcher({ executor, queue })
dispatcher.start()

// graceful shutdown
await dispatcher.close()
```
