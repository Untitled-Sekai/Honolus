# SonolusContext

## 機能

honoのContextに、`sonolus`を拡張し、そこから使えます。`c.sonolus.`を拡張します。

|コマンド|機能|型|
|--|--|--|
|version|バージョンを取得|string|
|localization|言語の取得|string|
|query(name)|クエリパラメーターの先頭の値を取得|string/undefined|
|queries(name)|同名のクエリパラメーターをすべて取得|string[]|
|queryParams|全クエリパラメーターを取得|URLSearchParams|
|search(registration)|登録定義から型推論して検索値を取得|SearchValue&lt;T&gt;|
|search()|現在のアイテム種類に登録された検索値を取得|AnySearchValue/undefined|
|searchForms|現在のアイテム種類に登録されたフォームを取得|ServerForm[]/undefined|
|params|動的ルートパラメーターをすべて取得|Record<string, string>|
|param(name)|指定した動的ルートパラメーターを取得|string/undefined|
|itemName|detailルートのアイテム名を取得|string/undefined|
|json&lt;T&gt;()|JSONリクエスト本文を取得|Promise&lt;T&gt;|
|formData()|multipart/form-data本文を取得|Promise&lt;FormData&gt;|
|header(name)|任意のリクエストヘッダーを取得|string/undefined|
|pagination|ページ、オフセット、カーソル、リミットの取得|```{page: number, offset: number, cursor?: string, limit: number};```|
|session|ヘッダの`Sonolus-Session`からセッションの取得|string/null|
|signature|ヘッダの`Sonolus-Signature`の取得|string/null|
|upload_key|アップロードキーの取得|string/null|
|room_key|ルーム作成キーの取得|string/null|
|error|エラーを投げる|-|
|utils|ユーティリティ関数|-|
