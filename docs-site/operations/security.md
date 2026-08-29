# セキュリティ

## 必須設定

- `cursorSecret`には十分長いランダム値を使い、全instanceで共有する
- DB認証情報をログやroute manifestへ含めない
- reverse proxyを管理できる場合だけ`trustProxy`を有効にする
- Packとrepository hashを信頼境界で検証する
- request bodyとupload sizeはruntime/proxyでも制限する

## Timeoutとキャンセル

timeout middlewareは期限超過時に`requestAbortSignal`をabortします。独自ハンドラーから利用する場合は、signalを対応するDB・fetch・SDKへ渡してください。

```ts
async handle(context: SonolusContext) {
    return fetch(upstream, {
        signal: context.abortSignal,
    })
}
```

Promiseをtimeoutレスポンスと競争させるだけでは、背後のDB queryやHTTP requestは停止しません。利用するdriver側にもstatement timeoutを設定してください。

## Rate limit

Memory storeは単一process専用です。複数instanceではRedis等の共有`RateLimitStore`を使用し、sessionや認証済みuserを優先したkeyを設計してください。
