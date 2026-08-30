# Honolus basic example

This example runs Honolus on Node.js with `@hono/node-server`. Files are separated by responsibility instead of placing the complete server in one file.

- a Memory database;
- a seeded `DatabasePostItem`;
- decorated Post info, list, and detail handlers;
- an HTTP test that retrieves all three responses;
- JSON request logging and in-memory metrics;
- readiness checks and graceful shutdown.

## Run from this repository

```bash
cd example
npm install
npm run dev
```

Then open or request:

```bash
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready
curl http://localhost:3000/sonolus/info
curl http://localhost:3000/sonolus/posts/info
curl 'http://localhost:3000/sonolus/posts/list?localization=ja'
curl 'http://localhost:3000/sonolus/posts/welcome?localization=ja'
```

Run the HTTP-level example test with:

```bash
npm test
```

OpenAPIを生成する場合は、先にビルドしてからCLIを実行します。

```bash
npm run build
npm run openapi
```

`example/openapi.json`に登録済みのserver infoとPostルートが出力されます。

## Minimal file layout

```text
example/
├─ src/
│  ├─ fixtures/posts.ts       # Test Post data
│  ├─ routes/
│  │  ├─ server-info.ts       # @sonolus.route.server.info
│  │  └─ posts/
│  │     ├─ info.ts           # @sonolus.route.server.post.info
│  │     ├─ list.ts           # @sonolus.route.server.post.list
│  │     ├─ detail.ts         # @sonolus.route.server.post.detail
│  │     └─ mapper.ts         # DatabasePostItem → PostItem
│  ├─ database.ts             # Database and seed
│  ├─ sonolus.ts              # Honolus configuration
│  ├─ app.ts                  # Route registration entry point
│  └─ server.ts               # Node.js listener and shutdown
└─ test/posts.test.js         # info/list/detail HTTP test
```

Use `npm run build && npm start` to run the compiled JavaScript.

The example uses `file:..` for the Honolus dependency so it always exercises the current checkout. In an external project, replace it with `@untitledsekai/honolus` from npm.
