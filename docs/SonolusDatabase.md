# SonolusDatabase

`SonolusDatabase` は、Sonolus サーバーが返すアイテムを保存・検索するための共通データ層です。
HTTP ルートや `SonolusContext` からデータベース製品を直接参照せず、同じ TypeScript の契約に対して
メモリ、JSON ファイル、SQL などの実装を差し替えられるようにします。

この文書は実装仕様の目処です。ここに記載する API 名は、実装時に大きく意味を変えない範囲で調整できます。

## 設計上の結論

- 保存するアイテムの型は `@sonolus/core` の `Database*Item` を使用する。
- アイテムの一意キーは `{ type, name }` とする。`name` だけでは種類をまたいで衝突するため、種類を必ずキーに含める。
- アプリケーションは `SonolusRepository` だけを利用し、バックエンド固有の SQL やファイル形式を知らない。
- 検索条件は文字列を直接 SQL に変換するのではなく、型付きの検索 DSL として表現する。
- メモリ実装を第一級の実装として用意し、テストでは高速なシード、差し替え、リセットができるようにする。
- JSON 実装は小規模サーバー・静的データ・開発用途向け、SQL 実装は大量データ・更新・複雑な検索向けとする。
- 保存時と読み出し時にランタイムバリデーションを行い、`@sonolus/core` の TypeScript 型だけに安全性を依存しない。

## `@sonolus/core` の型との対応

`@sonolus/core` には、サーバーの list/detail レスポンスに含める表示用アイテムと、データベースに保存するアイテムが別々に定義されています。
保存層では後者を使います。

| `SonolusItemType` | 保存する型 |
| --- | --- |
| `post` | `DatabasePostItem` |
| `playlist` | `DatabasePlaylistItem` |
| `level` | `DatabaseLevelItem` |
| `skin` | `DatabaseSkinItem` |
| `background` | `DatabaseBackgroundItem` |
| `effect` | `DatabaseEffectItem` |
| `particle` | `DatabaseParticleItem` |
| `engine` | `DatabaseEngineItem` |
| `replay` | `DatabaseReplayItem` |

`room` や `user` も将来追加できるようにマップ型は拡張可能にします。ただし、それらに対応する `Database*Item` が `@sonolus/core` にない場合、暫定的な独自モデルを保存層へ混ぜず、別のリポジトリとして設計します。

```ts
import type {
    DatabaseBackgroundItem,
    DatabaseEffectItem,
    DatabaseEngineItem,
    DatabaseLevelItem,
    DatabaseParticleItem,
    DatabasePlaylistItem,
    DatabasePostItem,
    DatabaseReplayItem,
    DatabaseSkinItem,
} from '@sonolus/core'

export type SonolusItemMap = {
    post: DatabasePostItem
    playlist: DatabasePlaylistItem
    level: DatabaseLevelItem
    skin: DatabaseSkinItem
    background: DatabaseBackgroundItem
    effect: DatabaseEffectItem
    particle: DatabaseParticleItem
    engine: DatabaseEngineItem
    replay: DatabaseReplayItem
}

export type SonolusItemType = keyof SonolusItemMap
export type SonolusItem<T extends SonolusItemType = SonolusItemType> = SonolusItemMap[T]
```

## 公開する契約

バックエンドの違いを吸収する最小単位は、種類ごとの `repository(type)` です。
ジェネリック引数により、`level` のリポジトリへ `DatabaseSkinItem` を保存する誤りをコンパイル時に検出します。

```ts
export type ItemKey<T extends SonolusItemType = SonolusItemType> = {
    type: T
    name: string
}

export type Page = {
    limit: number
    cursor?: string
}

export type PageResult<T> = {
    items: T[]
    nextCursor?: string
    totalCount?: number
}

export interface SonolusRepository<T extends SonolusItemType> {
    get(name: string): Promise<SonolusItemMap[T] | undefined>
    list(query?: SonolusQuery<T>): Promise<PageResult<SonolusItemMap[T]>>
    put(item: SonolusItemMap[T]): Promise<void>
    delete(name: string): Promise<boolean>
    count(query?: SonolusQuery<T>): Promise<number>
}

export interface SonolusDatabase {
    repository<T extends SonolusItemType>(type: T): SonolusRepository<T>
    transaction?<T>(fn: (database: SonolusDatabase) => Promise<T>): Promise<T>
    close?(): Promise<void>
}
```

`put` は同じ `{ type, name }` の既存アイテムを置き換える upsert とします。新規作成だけを要求する用途や、競合検出が必要な用途は、後から `create` や `put(..., { expectedVersion })` を追加できる拡張点として残します。

## 検索 DSL

Sonolus の検索フォームは URL の値を解釈する層であり、DB 層は URL や `ServerForm` に依存しません。ルート側で `context.search()` の結果を DSL に変換してから repository へ渡します。

まず必要な条件は、各アイテムに共通する `name`、タイトル、作者、タグ、説明、時刻または評価です。
フィールドの実体が `LocalizationText` などの構造化値であるため、バックエンド間で意味が変わりやすい任意のドットパス検索は公開 API にしません。

```ts
export type SonolusQuery<T extends SonolusItemType> = {
    where?: SonolusWhere<T>
    search?: string
    tags?: { name: string; value?: string }[]
    orderBy?: SonolusOrder<T>[]
    page?: Page
}

export type SonolusOrder<T extends SonolusItemType> = {
    field: 'name' | 'title' | 'author' | 'time' | 'rating'
    direction?: 'asc' | 'desc'
}

export type SonolusWhere<T extends SonolusItemType> = {
    name?: { equals?: string; startsWith?: string; in?: string[] }
    title?: { contains?: string }
    author?: { contains?: string }
    rating?: { min?: number; max?: number }
}
```

実装時には `T` ごとに使用可能なフィールドを狭めます。例えば `rating` は `level` にだけ許可し、`time` が存在しないアイテムでは並び替えを拒否します。検索結果の順序は常に安定させ、指定された `orderBy` の末尾に `{ field: 'name', direction: 'asc' }` を暗黙に加えます。これによりページング中の重複や欠落を避けます。

`search` の意味は全バックエンドで統一します。初期仕様では、名前・タイトル・作者・説明を大文字小文字を区別せず検索します。SQL の全文検索など、より高度な検索は各アダプターの最適化にして、結果の意味はこの仕様から逸脱させません。

## バックエンド

### Memory

```ts
const database = createSonolusDatabase({
    driver: 'memory',
    seed: {
        level: [levelA, levelB],
        skin: [skinA],
    },
})
```

内部は `Map<type, Map<name, item>>` を基本とします。テストでの予測可能性を優先し、`list` は入力配列の順番ではなく query の `orderBy` と安定した name tie-breaker に従います。

### JSON

```ts
const database = createSonolusDatabase({
    driver: 'json',
    path: './data/sonolus.json',
    mode: 'readwrite',
})
```

ファイル形式は、種類をキーにした配列形式を正準とします。

```json
{
  "version": 1,
  "items": {
    "level": [],
    "skin": []
  }
}
```

読み込み時に全体を検証し、書き込みは一時ファイルへ出力してから rename する原子的な更新にします。`readonly` モードも用意し、テストフィクスチャやデプロイ済み静的データを安全に提供できるようにします。大量データではファイル全体を毎回読み書きしないため、JSON は規模の目安をドキュメントで明記します。

### SQL

SQL は Honolus 本体へ特定の SQL ドライバーを直依存させず、アダプターとして提供します。

```ts
const database = createSonolusDatabase({
    driver: createSqlSonolusDriver({
        url: process.env.SONOLUS_DATABASE_URL!,
    }),
})
```

URL の解析、接続プール、マイグレーション、ドライバー固有のプレースホルダーは SQL アダプターの責務です。共通テストを通して memory / JSON / SQL が同じ結果を返すことを保証します。

テーブルは少なくとも `sonolus_items(type, name, payload, ...)` を持ち、`(type, name)` に複合一意制約を置きます。`payload` は最初は JSON として保持し、検索頻度の高い `title`、`author`、`time`、`rating`、タグなどはインデックス用の列または関連テーブルへ昇格できます。これにより保存モデルを変えずに SQL 検索を最適化できます。

## バリデーションと変換

`@sonolus/core` の型はコンパイル時の契約であり、JSON・SQL・外部入力を信頼する境界の検証には使えません。種類ごとの Zod schema を `src/db/schema` に置き、次の境界で検証します。

1. `put` に渡されたアイテム
2. JSON ファイルの読み込み結果
3. SQL の `payload` のデコード結果
4. DB から HTTP レスポンスへ変換する直前（必要な場合）

検証エラーには `type`、`name`、失敗したフィールドを含めます。読み込み時に壊れたデータを黙って除外せず、初期化または該当操作を失敗させます。

## HTTP ルートとの接続

ルートハンドラーは、検索の解釈と Sonolus レスポンスへの変換だけを担当します。

```ts
const levels = database.repository('level')

@sonolus.route.server.level.list
class LevelListHandler {
    async handle(context: SonolusContext): Promise<ServerItemList<LevelItem>> {
        const search = context.search(levelSearch)
        const result = await levels.list(toLevelQuery(search, context.pagination))

        return {
            pageCount: calculatePageCount(result.totalCount, context.pagination),
            items: result.items.map(toLevelItem),
        }
    }
}
```

`DatabaseLevelItem` と `LevelItem` は同一ではないため、変換関数を明示します。DB の `payload` をそのまま返すショートカットは、API のバージョン差分や内部フィールド漏洩を招くため採用しません。

## テスト方針

### 共通契約テスト

`createRepositoryContractTests(createDatabase)` を作り、次を memory / JSON / SQL 全てで実行します。

- `{ type, name }` の一意性と upsert
- 存在しないアイテムの `get` / `delete`
- `search`、タグ、範囲、`in` 条件
- 複数の `orderBy` と name tie-breaker
- cursor pagination の重複・欠落防止
- 不正な payload の拒否
- transaction の commit / rollback（対応する実装のみ）

### テスト用 API

テストでは `memory` を明示的に生成し、時刻や ID を注入可能にします。

```ts
const database = createSonolusDatabase({
    driver: 'memory',
    seed: [levelA, levelB],
})

await database.repository('level').put(levelC)
await database.repository('level').list({
    where: { rating: { min: 10 } },
})
```

JSON のテストでは一時ディレクトリを使い、SQL のテストでは外部サービスを必須にしません。利用可能な場合だけ SQLite などの一時 DB を使い、同じ契約テストを流します。これにより通常の unit test は高速に保ちつつ、SQL 変換の検証もできます。

## 実装順序

1. `src/db/type.ts` に `SonolusItemMap`、キー、ページ、query の型を追加する。
2. `src/db/schema` に種類ごとの runtime schema と共通の schema map を追加する。
3. `src/db/memory.ts` と `createSonolusDatabase({ driver: 'memory' })` を実装する。
4. memory を使った repository 契約テストを先に固定する。
5. `src/db/json.ts` を追加し、原子的書き込みと readonly を実装する。
6. query compiler と SQL adapter のインターフェースを追加する。SQL ドライバーは別パッケージまたは peer dependency とする。
7. item list/detail のルートから repository を利用する変換関数を追加する。
8. README と各 endpoint docs に、database の生成と依存性注入の方法を追記する。

最初の実装では、SQL の全機能を先に作らず、memory と JSON で repository 契約を完成させるのが安全です。API の型、検索の意味、バリデーション、ページングを先に固定でき、後から SQL を追加してもルート側の変更を最小限にできます。

## 採用しない案

- **各ルートが SQLAlchemy 相当の ORM を直接呼ぶ方式**: ルート、テスト、DB 製品が強く結合する。
- **全アイテムを `unknown` または `Record<string, unknown>` で保存する方式**: 種類別の型安全性と schema 検証を失う。
- **JSON 文字列だけを検索する方式**: バックエンド間で検索結果が一致せず、インデックスも利用できない。
- **クエリ文字列をそのまま SQL に渡す方式**: SQL injection、方言差、型検証不足を招く。

この構成なら、以前の「`type` と `name` をキーに JSON を保存し、読み出して検証する」方式を memory / JSON の簡単な実装として維持しつつ、型付き検索、ページング、トランザクション、SQL の最適化へ段階的に拡張できます。
