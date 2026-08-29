# Honolusとは

Honolusは、SonolusサーバーをTypeScriptで構築するためのフレームワークです。Sonolus APIのルーティング、アイテムDB、検索、Pack import、アセット配信、非同期ジョブ、運用middlewareを一つの公開APIで扱います。

小さな検証ではMemory DBから始め、同じアプリケーションコードのままJSONやPostgreSQLへ移行できます。静的な`.scp`配信にも、複数インスタンスで動く動的サーバーにも対応します。

## 向いている用途

- 独自のレベル、スキン、エンジンを提供するSonolusサーバー
- 検索、投稿、ランキングなどを持つ動的サービス
- Packを取り込み、CDN経由でアセットを配信するサービス
- 型安全な独自ハンドラーを段階的に追加したいプロジェクト

次は[クイックスタート](/guide/getting-started)で最小サーバーを起動します。
