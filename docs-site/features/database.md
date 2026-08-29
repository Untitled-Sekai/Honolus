# データベース

## Memory

テストやローカル開発向けです。プロセス終了時に消えます。

```ts
const database = createSonolusDatabase({
    driver: 'memory',
    seed: { level: [tutorialLevel] },
})
```

## JSON

単一プロセスの小規模なデータやfixture向けです。書き込みは一時ファイルからrenameするため、ファイル単位では原子的です。

```ts
const database = createSonolusDatabase({
    driver: 'json',
    path: './data/sonolus.json',
    mode: 'readwrite',
})
```

## PostgreSQL

Honolusは特定の`pg`バージョンを強制せず、`pg.Pool`互換オブジェクトを受け取ります。

```ts
import { Pool } from 'pg'
import {
    PostgresExecutor,
    createSonolusDatabase,
} from 'honolus'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
})

const executor = new PostgresExecutor({
    pool,
    statementTimeoutMs: 5_000,
    lockTimeoutMs: 1_000,
    metrics,
})

export const database = createSonolusDatabase({
    driver: 'sql',
    executor,
    autoMigrate: false,
    cursorSecret: process.env.CURSOR_SECRET,
})
```

本番ではdeploy前の独立したmigration jobから`database.migrate()`相当の処理を実行し、web processの`autoMigrate`は無効にします。

## Repository

```ts
const levels = database.repository('level')

await levels.put(level)
const found = await levels.get(level.name)
await levels.delete(level.name)
```

`put`は`{ type, name }`をキーにしたupsertです。複数itemをまとめて変更する場合はtransactionを使用します。

```ts
await database.transaction?.(async (tx) => {
    await tx.repository('level').put(levelA)
    await tx.repository('level').put(levelB)
})
```
