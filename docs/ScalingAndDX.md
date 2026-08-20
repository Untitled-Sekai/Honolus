# 大規模設計と DX のロードマップ

> Phase 1・Phase 2 の基盤機能は実装済みです。SQL は PostgreSQL 互換の `SqlExecutor` を注入するアダプターとして提供し、Memory/JSON は開発・テスト用として引き続き利用できます。

Honolus を、小規模な静的サーバーだけでなく、複数人・複数プロセス・大量データを扱うサーバー開発キットへ発展させるための設計方針をまとめます。

この文書でいう「大規模」は、単に 1 台のサーバーを高性能にすることではありません。次の条件を満たし、機能追加や障害対応を続けられる状態を指します。

- アプリケーションを複数プロセス・複数インスタンスで安全に動かせる
- データ量やリクエスト量が増えても、遅い処理が全体を止めない
- 変更を安全にリリースし、失敗時に戻せる
- 障害の原因をログ・メトリクス・トレースから追跡できる
- プロジェクト固有のコードが Honolus の内部実装に強く依存しない

## 現在の土台

すでに次の基盤があります。

- Hono を使った型付きの Sonolus API ルート登録
- `SonolusContext` によるリクエスト情報の集約
- `MemorySonolusDatabase` と原子的な保存を行う JSON DB
- `SonolusRepository` と検索 DSL による DB 実装の差し替え
- pack import、asset store、`.scp` の static mount
- Zod による外部データの検証
- request id、統一エラーレスポンス、`/health/live`・`/health/ready`
- SQL repository、migration、transaction の注入契約
- keyset cursor と検索入力の上限
- `Honolus.close()` による DB の graceful shutdown
- 共有可能な `CacheStore`、`SessionStore`、`LockStore`、`RateLimitStore` 契約と Memory 実装
- rate limit、request timeout、JSON 構造化ログ、メトリクス、trace 契約
- idempotency を持つ Memory job queue と pack import worker
- asset の ETag、条件付き GET、CDN 向け immutable cache header

現在の実装を大規模用途へそのまま拡張する場合、特に次の制約があります。

- JSON DB はプロセス内に全データを読み込み、書き込みごとにファイル全体を更新する
- Memory/JSON のカーソルはオフセットベースで、データ更新が多い環境の安定したページングには向かない
- SQL ドライバー、トランザクション、マイグレーション、接続プールは未提供
- セッション、ユーザー、権限、レート制限の共有ストアがない
- 非同期ジョブ、キャッシュ、分散ロック、ヘルスチェック、メトリクスの標準契約がない
- ハンドラーの依存性注入やアプリケーションのライフサイクル管理がない

したがって、JSON DB の高速化だけではなく、実行モデルと運用モデルを拡張する必要があります。

## 大規模化に必要な追加機能

### 1. SQL データベースアダプター

最優先で `SonolusDatabase` の SQL アダプターを追加します。Honolus 本体は特定の DB 製品に依存せず、PostgreSQL などのアダプターを別パッケージにするのが望ましいです。

必要な機能:

- 接続プールとタイムアウト
- `type, name` の複合一意制約
- 検索・並び替え・ページングを DB 側で実行
- schema migration と migration 状態の管理
- transaction と optimistic concurrency
- read replica を使う場合の read/write 分離
- repository と asset metadata の整合性を保つ仕組み

`payload` を JSON として保持しつつ、検索頻度の高い `name`、`title`、`author`、`time`、`rating`、タグをインデックス列へ昇格できる設計が現実的です。DB 製品の機能を API 契約へ漏らさず、共通契約テストで Memory/JSON/SQL の結果を揃えます。

### 2. ページングと検索の安定化

大量データでは `offset` が深くなるほど遅くなり、更新中の一覧では重複・欠落も起きます。公開 API のカーソルは、並び順と最後に取得したキーを含む keyset pagination を基本にします。

- カーソルを署名または暗号化し、改ざんを拒否する
- `orderBy` とフィルターをカーソルに結び付ける
- 常に一意な tie-breaker を持つ
- 上限、最大検索時間、最大 `in` 件数を設定する
- 検索 DSL を AST として検証し、文字列を SQL へ直接連結しない

### 3. トランザクションと整合性

item、asset、import manifest、検索用インデックスを別々に更新すると、中途半端な状態が残ります。DB と asset store が同一トランザクションに参加できない場合も想定し、outbox または補償処理を導入します。

- import は staging → 検証 → commit の段階を持つ
- 失敗した import は再実行可能にする
- 同じ pack や asset hash は冪等に処理する
- バージョン番号や `updatedAt` を持ち、更新競合を検出する
- 長い処理を HTTP リクエストの中で完了させない

### 4. 非同期ジョブ基盤

pack import、asset のハッシュ検証、検索インデックス更新、ランキング集計、通知などはジョブとして実行できるようにします。

最低限必要な契約:

```ts
type JobState = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

interface JobQueue {
    enqueue<T>(name: string, payload: T, options?: { idempotencyKey?: string }): Promise<{ id: string }>
    get(id: string): Promise<{ id: string; state: JobState } | undefined>
}
```

ジョブには retry、指数バックオフ、dead-letter、重複排除、進捗、キャンセル、実行時間上限を持たせます。Memory 実装はテスト用、Redis や DB を使う実装は本番用として差し替え可能にします。

### 5. 認証・認可と共有状態

Sonolus の session や upload key をインスタンスのメモリだけで管理すると、ロードバランサー配下で別インスタンスへ移ったときに使えません。

- session、refresh、upload key、room key の保存契約
- 有効期限、失効、ローテーション
- ユーザー・ロール・リソース単位の認可
- ハンドラーの前処理で使える policy / guard
- 監査ログと管理者操作の記録
- 認証情報や secret をログへ出さない redact 処理

認証と認可はルートごとに散らさず、`before` hook を補助として使いつつ、共通の middleware / policy 層へ集約します。

### 6. キャッシュと負荷保護

`info`、静的 item detail、検索結果、asset metadata はキャッシュ候補です。ただし、認証済みレスポンスと公開レスポンスを混同しないようにします。

- HTTP cache-control、ETag、Last-Modified
- L1 のプロセスメモリキャッシュと L2 の共有キャッシュ
- キーの namespace、TTL、stale-while-revalidate
- cache stampede 防止
- rate limit、concurrency limit、body size limit
- upstream timeout、circuit breaker、bulkhead

asset は hash をキーに immutable として配信しやすいため、CDN 連携も早期に用意できます。

### 7. 観測性と運用 API

大規模運用では「エラーが起きた」だけでなく、「どの route が、どの DB 操作で、どれだけ遅かったか」が必要です。

- 構造化ログ（request id、route、status、duration、user id の安全な識別子）
- OpenTelemetry による trace と span
- route 別の latency、error、throughput メトリクス
- DB query、queue、cache、asset store のメトリクス
- `/health/live` と `/health/ready`
- build version、schema version、依存サービス状態の表示
- エラーコードとユーザー向けメッセージの分離

ログ・メトリクス・トレースの API は、特定のベンダーではなく adapter として公開します。

### 8. スケールアウト可能なライフサイクル

アプリケーション生成時にルート登録、接続確立、終了処理を分離します。`Honolus` のコンストラクターで同期的に重い処理を行うのではなく、`create` / `start` / `close` のライフサイクルを導入します。

- 起動時に設定・migration・依存サービスを検証する
- readiness は依存サービスが利用可能になってから成功させる
- graceful shutdown で新規リクエスト受付を止め、ジョブと DB 接続を閉じる
- worker と web process を分離できる
- 複数プロセスで安全な leader election / distributed lock を提供する

## DX を良くする機能

大規模機能を増やすほど、利用者が直接扱う概念が増えます。DX の目標は、最初は簡単に始められ、必要になった機能だけ段階的に追加できることです。

### 推奨する開発体験

- `create-honolus` によるプロジェクト生成
- `honolus dev` の watch、型チェック、サンプルデータ読み込み
- `honolus generate` による route、schema、migration の雛形生成
- `honolus db migrate`、`db seed`、`db reset`（reset は明示確認付き）
- `honolus pack import`、`pack validate`、`pack inspect`
- `.env` の schema 検証と、秘密値を隠した設定表示
- ルート一覧、検索フォーム一覧、DB/asset の接続状態を表示する CLI
- OpenAPI または独自の endpoint manifest の自動生成
- エラー時に route id、request id、原因、修正候補を含める
- request/response の fixture 録画と再生
- Memory DB、fake queue、fake clock を標準提供

### 型安全性を保ったまま書きやすくする

現在の class decorator はレスポンス型を検査できるため、この利点を維持します。その上で次を追加すると、型と実装の重複が減ります。

- `defineHandler` による関数形式のハンドラー
- route ごとの request、path parameter、response schema の一体定義
- Zod schema から TypeScript 型と OpenAPI を生成
- item type と repository の対応を自動推論
- `context.session` や `context.user` の認証済み型を guard 後に絞り込む
- pagination、search、error response の共通 helper

class decorator と関数形式はどちらか一方に限定せず、既存コードを壊さずに選べるようにします。

### テストとローカル開発

- 全 DB 実装で共有する repository contract test
- route の handler 単体テスト用 `createTestContext`
- Hono の app を直接叩く integration test helper
- pack fixture を使った import → API → asset の E2E テスト
- property-based test で検索 DSL、cursor、schema を検証
- 負荷試験用の seed generator と再現可能な random seed
- CI で typecheck、unit、integration、migration、pack validation を分離

テスト用 API は本番用 API と同じ型を使い、テストだけでしか成立しない呼び出し方を増やさないことが重要です。

## 実装の優先順位

### Phase 1: 安全な拡張基盤

1. 設定 schema、統一エラー型、request id、health endpoint
2. repository contract test と DB 境界の整理
3. SQL アダプターの最小実装、migration、transaction
4. keyset pagination と query 制限
5. graceful shutdown と `close` の実装整理

### Phase 2: 複数インスタンス運用

1. 共有 session / cache / lock の契約
2. rate limit と timeout の標準 middleware
3. 構造化ログ、メトリクス、trace
4. 非同期 job queue と pack import worker
5. ETag/CDN 対応を含む asset 配信の最適化

### Phase 3: 大規模チーム向け DX

1. CLI とプロジェクト generator
2. schema / route からの manifest・OpenAPI 生成
3. migration、fixture、seed、local stack の標準化
4. 互換性ポリシー、deprecation、upgrade guide
5. サンプルアプリとリファレンス実装の整備

Phase 1 が完了するまでは、JSON DB を production の共有更新ストアとして推奨しません。静的データ、開発、テストには引き続き JSON/Memory を第一級サポートします。

## 完了の判定基準

「大規模対応済み」とするには、機能の存在だけでなく、次を確認します。

- 2 つ以上の web process が同じ DB、session、queue を使って動作する
- 一方の process を停止しても既存の処理が適切に再試行・復旧する
- 大量 item の list/search が DB 側の index を利用し、上限時間内に返る
- import を途中で停止して再実行しても、item と asset が壊れない
- request id から route、DB、queue の処理を追跡できる
- migration を適用前後で検証でき、失敗時の手順がある
- 新しい endpoint を追加する際、型、schema、テスト、ドキュメントの抜け漏れを CLI または CI で検出できる

この順番で実装すると、Honolus は「Sonolus API の薄いラッパー」から、データ、実行、運用、開発体験を一貫して扱えるサーバー開発キットへ段階的に成長できます。
