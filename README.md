# Honolus

[![npm version](https://img.shields.io/npm/v/@untitledsekai/honolus.svg)](https://www.npmjs.com/package/@untitledsekai/honolus)
[![license](https://img.shields.io/npm/l/@untitledsekai/honolus.svg)](https://github.com/Untitled-Sekai/Honolus/blob/main/LICENSE)

Honolus is a type-safe Sonolus server framework built on [Hono](https://hono.dev/). It provides typed routes, pluggable databases, search and cursor pagination, Pack import, asset delivery, durable jobs, authentication, and production observability.

## Requirements

- Node.js 20 or later
- TypeScript is recommended

## Installation

```bash
npm install @untitledsekai/honolus
```

## Quick start

```ts
import { Honolus, createSonolusDatabase } from '@untitledsekai/honolus'

export const database = createSonolusDatabase({ driver: 'memory' })

export const sonolus = new Honolus({
    database,
    version: '1.1.3',
})

export default sonolus.getApp()
```

Pass the returned Hono application to the runtime adapter used by your project. With a database configured, Honolus registers the standard item info, list, and detail routes automatically.

For production, use a shared PostgreSQL database and shared session/rate-limit stores instead of Memory or JSON storage.

```ts
import { Pool } from 'pg'
import { PostgresExecutor, createSonolusDatabase } from '@untitledsekai/honolus'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const executor = new PostgresExecutor({ pool, statementTimeoutMs: 5_000 })

export const database = createSonolusDatabase({
    driver: 'sql',
    executor,
    cursorSecret: process.env.CURSOR_SECRET,
    autoMigrate: false,
})
```

The PostgreSQL driver itself is intentionally not bundled. Install the `pg` version selected by your application.

## CLI

```bash
honolus generate project ./my-server
honolus generate route levels ./my-server
honolus routes --module ./dist/app.js
honolus openapi --module ./dist/app.js --output openapi.json
honolus db migrate --module ./dist/app.js
```

## Documentation

The full VitePress documentation is maintained in [`docs-site`](https://github.com/Untitled-Sekai/Honolus/tree/main/docs-site). Design notes and compatibility information are available in [`docs`](https://github.com/Untitled-Sekai/Honolus/tree/main/docs).

- [Getting started](https://github.com/Untitled-Sekai/Honolus/blob/main/docs-site/guide/getting-started.md)
- [Database and PostgreSQL](https://github.com/Untitled-Sekai/Honolus/blob/main/docs-site/features/database.md)
- [Authentication and authorization](https://github.com/Untitled-Sekai/Honolus/blob/main/docs-site/features/auth.md)
- [Production deployment](https://github.com/Untitled-Sekai/Honolus/blob/main/docs-site/operations/production.md)
- [Compatibility policy](https://github.com/Untitled-Sekai/Honolus/blob/main/docs/Compatibility.md)

## Development

```bash
npm install
npm run check
npm run docs:dev
```

## License

[ISC](https://github.com/Untitled-Sekai/Honolus/blob/main/LICENSE)
