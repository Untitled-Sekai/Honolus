# 認証・認可

共有`SessionStore`を渡すと、複数instanceで同じsessionを解決できます。

```ts
const sessions = new RedisSessionStore({ client: redis })
const sonolus = new Honolus({
    auth: {
        sessions,
        sessionTtlMs: 60 * 60 * 1000,
        refreshTtlMs: 30 * 24 * 60 * 60 * 1000,
        logger,
    },
})

const credentials = await sonolus.sessions.create({
    id: user.id,
    roles: user.roles,
    permissions: user.permissions,
})
```

storeには生のsession IDではなくSHA-256化したキーが保存されます。`rotate()`はrefresh tokenを一度失効させ、新しいsessionとrefresh tokenを発行します。

## Route policy

```ts
sonolus.route.server.level.submit
    .use(requireSession(), requirePermission('level:submit', { logger }))
    (LevelSubmitHandler)
```

`requireRole()`と`requirePolicy()`も利用できます。policy評価はuser、permission、resource、request IDとともに監査loggerへ記録できます。

## Redis共有ストア

`RedisCacheStore`、`RedisSessionStore`、`RedisRateLimitStore`、`RedisLockStore`は`sendCommand(args)`互換clientを受け取ります。namespaceをservice／environmentごとに分けてください。
