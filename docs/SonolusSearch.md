# SonolusSearch

Sonolusの検索フォームは、登録した `ServerForm` の `type` と各 `ServerOption.query` からリクエストの型を完全に推論できます。

## 登録

検索フォームをアイテム種類ごとの関数へ渡します。戻り値は、その定義の型情報を保持した登録オブジェクトです。

```ts
import type { SearchForms } from '@untitledsekai/honolus'

const sonolus = new Honolus()

const levelForms = [
    {
        type: 'advanced',
        title: 'Advanced',
        requireConfirmation: false,
        options: [
            {
                query: 'keywords',
                name: 'Keywords',
                required: false,
                type: 'text',
                def: '',
                placeholder: 'Keywords',
                limit: 20,
                shortcuts: [],
            },
            {
                query: 'minRating',
                name: 'Minimum Rating',
                required: false,
                type: 'slider',
                def: 0,
                min: 0,
                max: 100,
                step: 1,
            },
            {
                query: 'genre',
                name: 'Genre',
                required: false,
                type: 'select',
                def: 'pop',
                values: [
                    { name: 'pop', title: 'Pop' },
                    { name: 'rock', title: 'Rock' },
                ],
            },
        ],
    },
] as const satisfies SearchForms

const levelSearch = sonolus.search.level(levelForms)
```

同様に `post`, `playlist`, `level`, `skin`, `background`, `effect`, `particle`, `engine`, `replay`, `room` へ登録できます。

配列を直接 `sonolus.search.level([...])` へ渡す場合、const type parameterにより `as const` を省略してもリテラル型が保持されます。先に変数へ格納する場合は、上の例のように `as const satisfies SearchForms` を使用してください。通常の `ServerForm[]` も登録できますが、`query` が単なる `string` へ広がるため、プロパティ名の完全な推論は利用できません。

## listハンドラーで取得

登録時の戻り値を `context.search()` に渡すだけで、明示的な型指定なしに検索値を取得できます。

```ts
@sonolus.route.server.level.list
class LevelListHandler {
    async handle(context: SonolusContext): Promise<ServerItemList<LevelItem>> {
        const search = context.search(levelSearch)

        if (search.type === 'advanced') {
            search.options.keywords   // string
            search.options.minRating  // number
            search.options.genre      // 'pop' | 'rock'

            search.rawOptions.minRating // number | undefined
        } else {
            // Sonolus標準のquick search
            search.type             // 'quick'
            search.options.keywords // string
        }

        return {
            pageCount: 0,
            items: [],
        }
    }
}
```

`context.search()` を引数なしで呼ぶこともできます。この場合は現在のURLに対応する登録が自動選択されますが、コンパイル時の戻り値は汎用型になります。完全な型推論が必要な場合は `context.search(levelSearch)` を使用してください。

## レスポンスへの自動追加

登録したフォームは、対応する `info` と `list` ハンドラーのレスポンスへ `searches` として自動追加されます。

```ts
return {
    pageCount: 1,
    items: levels,
    // searchesは自動追加されるため省略可能
}
```

ハンドラーが `searches` を明示的に返した場合は、その値が優先されます。現在のルートへ登録されているフォームは `context.searchForms` からも取得できます。

## 取得結果

```ts
{
    type: 'advanced',
    options: {
        // 全option。未送信または不正な値にはdefが適用される
    },
    rawOptions: {
        // リクエストに含まれ、正常に変換できたoptionのみ
    },
}
```

存在しないフォームtypeが指定された場合は、空のquick searchとして扱われます。`quick` は予約済みのフォームtypeです。また、同じフォームtypeや同じフォーム内の重複query、option queryとしての `type` は登録エラーになります。

## ServerOptionの推論型

| ServerOption.type | 推論される値 |
| --- | --- |
| `text`, `textArea`, `file` | `string` |
| `slider` | `number` |
| `toggle` | `boolean` |
| `select` | `values[].name` の文字列リテラルunion |
| `multi` | `values[].name` をキー、`boolean` を値に持つオブジェクト |
| `serverItem` | `Sil \| null` |
| `serverItems` | `Sil[]` |
| `collectionItem` | `itemType` に対応する `PostItem`, `LevelItem` など、または `undefined` |

`slider` の範囲、文字列と配列の `limit`、selectの候補値も検証されます。JSON形式の値を使用する `serverItem`, `serverItems`, `collectionItem` は自動的にJSONデコードされます。
