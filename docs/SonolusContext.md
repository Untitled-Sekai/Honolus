# SonolusContext

## 機能

honoのContextに、`sonolus`を拡張し、そこから使えます。`c.sonolus.`を拡張します。

|コマンド|機能|型|
|--|--|--|
|version|バージョンを取得|string|
|localization|言語の取得|string|
|pagination|ページ、オフセット、カーソル、リミットの取得|```{page: number, offset: number, cursor?: string, limit: number};```|
|session|ヘッダの`Sonolus-Session`からセッションの取得|string/null|
|signature|ヘッダの`Sonolus-Signature`の取得|string/null|
|upload_key|アップロードキーの取得|string/null|
|error|エラーを投げる|-|
|utils|ユーティリティ関数|-|
