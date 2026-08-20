# 互換性ポリシー

Honolus の公開 API は、次の層に分けて互換性を管理します。

- `Honolus`、`SonolusContext`、`SonolusDatabase`、route decorator は安定 API
- `src/*` の内部実装は直接 import せず、公開 export を利用する
- route manifest の `version` は manifest 形式のバージョン
- `HONOLUS_COMPATIBILITY_VERSION` は公開契約の世代を表す

非推奨 API には、代替 API、非推奨になったバージョン、削除予定バージョンを記録します。

```ts
warnDeprecated({
    name: 'server_info',
    replacement: 'info',
    since: '1.1.0',
    removeIn: '2.0.0',
}, logger)
```

メジャーバージョンでは削除・破壊的変更を行えます。マイナーバージョンでは既存の route、DB 契約、レスポンス形式を壊さず、変更がある場合は migration と upgrade guide を提供します。
