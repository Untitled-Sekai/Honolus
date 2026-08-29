# CLI

## Generator

```bash
honolus generate project ./my-server
honolus generate route levels ./my-server
```

generatorは既存ファイルを上書きしません。生成後にruntime adapterと必要なDB driverを追加してください。

## RouteとOpenAPI

```bash
honolus routes --module ./dist/app.js
honolus openapi \
  --module ./dist/app.js \
  --title 'My Sonolus Server' \
  --version 1.0.0 \
  --output openapi.json
```

moduleは`Honolus`インスタンスを`sonolus`、`app`またはdefaultとしてexportする必要があります。

## Database

```bash
honolus db migrate --module ./dist/app.js
honolus db seed \
  --module ./dist/app.js \
  --fixture ./fixtures/items.json
```

DB commandを使うmoduleは`database`もexportしてください。本番migrationはdeploy pipeline内の単発jobとして実行します。
