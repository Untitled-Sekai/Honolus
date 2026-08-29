# Honolus CLI

`npm install @untitledsekai/honolus` でインストールした場合、`honolus` コマンドを利用できます。

```bash
honolus generate project ./my-server
honolus generate route levels ./my-server
honolus routes --module ./dist/app.js
honolus openapi --module ./dist/app.js --output openapi.json
```

生成プロジェクトには TypeScript の最小構成、`src/app.ts`、`docker-compose.yml`（PostgreSQL と Redis）が含まれます。既存ファイルは上書きしません。

## DB コマンド

アプリケーションモジュールから `database` を export してください。

```ts
export const database = createSonolusDatabase({
    driver: 'json',
    path: './data/sonolus.json',
})
```

```bash
honolus db migrate --module ./dist/app.js
honolus db seed --module ./dist/app.js --fixture ./fixtures/items.json
```

`seed` は item の schema 検証を通して repository へ upsert します。production の reset は CLI に自動実装せず、DB 製品のバックアップ・承認手順を含む運用コマンドとして別途用意します。

## manifest と OpenAPI

`Honolus#getRouteManifest()` は登録済み route の機械可読 manifest を返します。`getOpenApiDocument()` は path parameter を OpenAPI 形式へ変換した最小 OpenAPI 3.0.3 文書を返します。レスポンス schema の詳細は endpoint ごとの schema metadata を追加した段階で拡張します。
