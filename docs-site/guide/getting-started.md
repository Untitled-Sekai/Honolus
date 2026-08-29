# クイックスタート

## 必要な環境

- Node.js 22以上を推奨
- npmまたは互換パッケージマネージャー
- TypeScript 5以降

## インストール

```bash
npm install @untitledsekai/honolus @sonolus/core
npm install -D typescript tsx @types/node
```

## 最小アプリケーション

`src/app.ts`を作成します。

```ts
import { Honolus, createSonolusDatabase } from '@untitledsekai/honolus'

export const database = createSonolusDatabase({ driver: 'memory' })

export const sonolus = new Honolus({
    database,
    version: '1.1.3',
})

export default sonolus.getApp()
```

HonoのNode.js adapterなど、使用するruntimeのadapterへ`sonolus.getApp()`を渡してください。Hono互換runtimeでは同じアプリをCloudflare Workers等へ接続できますが、filesystem PackやNode.js streamを使う機能にはNode.js環境が必要です。

## 動作確認

起動後、次のendpointを確認します。

```bash
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready
curl http://localhost:3000/sonolus/info
```

`database`を指定すると、itemのinfo、list、detail routeが自動登録されます。独自レスポンスが必要な場合は[ルートを作る](/guide/routes)を参照してください。

::: warning 本番環境
MemoryとJSONは複数プロセス間で状態を共有しません。本番の共有更新データにはPostgreSQLを使用してください。
:::
