# SonolusPack

`SonolusPack` は、Sonolus のアイテム定義と repository asset を Honolus へ取り込むための仕組みです。

結論として、`@sonolus/free-pack` の `pack` を正規のインポート元として扱い、`.scp` は配布・静的配信用のアーカイブとして扱います。両方を受け付けられるようにしますが、`.scp` をそのままデータベースの正規データにする設計にはしません。

現在の実装状況では、directory source の import、filesystem asset store、SHA-1 検証、冪等 import、競合処理までを実装済みです。`.scp` の static mount と ZIP source は、同じ source 契約へ接続する次の実装段階です。

## なぜ `pack` と `.scp` を分けるのか

`@sonolus/free-pack` には、役割の異なる二つのディレクトリがあります。

| パス | 内容 | Honolus での扱い |
| --- | --- | --- |
| `pack` | `db.json`、アイテムの `Database*Item`、`repository/<hash>` | データベース・asset store へのインポート元 |
| `static` | `/sonolus/info`、`list`、`detail` 等の完成済み API レスポンス | 静的サーバーとして配信できる生成物 |

`.scp` は拡張子が `.scp` になっている ZIP で、今回の `FreePack.scp` は `sonolus/info`、各アイテムの `list` / detail、`sonolus/repository/<hash>` を含む static pack です。

つまり `.scp` の中身は、クライアントがそのまま取得して利用できる「完成済みの静的サーバー」です。一方、static の list/detail JSON は `ServerItem` であり、`SonolusDatabase` が保存する `Database*Item` そのものではありません。例えば localized text が表示用の文字列へ変換されていたり、DB 側に必要なフィールドが endpoint に現れなかったりします。

そのため、static JSON から `Database*Item` を推測して保存するのを標準動作にはしません。情報の欠落や変換不能を黙って許すと、後で detail、検索、asset の整合性が壊れます。

## 推奨する三つの利用モード

### 1. `pack` import mode（標準）

サーバー起動時または明示的な import コマンドで、`pack/db.json` と `pack/repository` を読み込みます。

```ts
const database = createSonolusDatabase({
    driver: 'json',
    path: './data/sonolus.json',
})

await importSonolusPack({
    source: { type: 'directory', path: freePack.packPath },
    database,
    assets: createFileAssetStore('./data/repository'),
    publicRepositoryPath: '/sonolus/repository',
    conflict: 'replace',
})
```

`@sonolus/free-pack` の `packPath` は package の `index.js` から取得できます。

```ts
import { packPath } from '@sonolus/free-pack'
```

import は次の処理を行います。

1. `db.json` の version と各 item を検証する。
2. item の種類と name を確認し、`SonolusDatabase.repository(type).put(item)` で upsert する。
3. `repository/<hash>` を asset store へコピーまたはリンクする。
4. `Srl.hash` と実ファイルの SHA-1 を確認する。
5. `Srl.url` は保存時の外部 URLとして信頼せず、Honolus が設定した repository URLへ正規化する。
6. import の manifest を保存し、同じ pack を再度読み込んでも不要な更新をしない。

この方式なら `@sonolus/free-pack` と通常の `SonolusDatabase` を同じデータ層で利用できます。list/detail のレスポンスは、DB から現在の設定・検索・ページングに従って Honolus が生成します。

### 2. `scp` static mount mode

`.scp` を展開せず、ZIP entry を読み出して `/sonolus/*` と `/sonolus/repository/*` にマウントします。

```ts
const sonolus = new Honolus({
    pack: {
        type: 'scp',
        path: './docs/sample_assets/FreePack.scp',
        mode: 'static',
    },
})
```

このモードは、配布された static pack をそのまま再現する場合に最適です。DB の初期化や item の変換が不要で、`FreePack.scp` のようなファイルを配置するだけで利用できます。

ただし、このモードの JSON は固定スナップショットです。Honolus の検索 DSL、ユーザーごとの表示、item の追加・更新、動的な `pageCount` は利用しません。動的なデータベースとして使う場合は import mode を使用します。

### 3. `scp` import mode

`.scp` の `sonolus/repository/<hash>` を asset store へ取り込み、static の list/detail を読み込んで初期データを作るモードです。

これは互換性のために提供できますが、既定にはしません。static response は表示用モデルなので、`Database*Item` を完全に復元できない item はエラーにします。推測による補完や空フィールドの追加は行いません。

```ts
await importSonolusPack({
    source: { type: 'scp', path: './FreePack.scp' },
    database,
    assets,
    conflict: 'skip',
    staticImport: 'strict',
})
```

将来、`.scp` に `pack/db.json` 相当の manifest が含まれる形式をサポートする場合は、それを優先します。manifest がない既存 static pack は、完全な DB backup ではなく「静的 snapshot」と明示して扱います。

## Pack 抽象化

入力形式を直接 DB 実装へ渡さず、Pack source と importer を分離します。

```ts
export type SonolusPackSource =
    | { type: 'directory'; path: string }
    | { type: 'scp'; path: string }
    | { type: 'npm'; packageName: string }

export type SonolusPackConflict = 'error' | 'skip' | 'replace'

export type ImportSonolusPackOptions = {
    source: SonolusPackSource
    database: SonolusDatabase
    assets: SonolusAssetStore
    conflict?: SonolusPackConflict
    publicRepositoryPath?: string
    staticImport?: 'disabled' | 'strict'
}

export interface SonolusAssetStore {
    has(hash: string): Promise<boolean>
    put(hash: string, data: Uint8Array): Promise<void>
    open(hash: string): Promise<ReadableStream<Uint8Array>>
}

export type SonolusPackManifest = {
    source: string
    importedAt: number
    itemCounts: Partial<Record<SonolusItemType, number>>
    repositoryHashes: string[]
}
```

`SonolusPackSource` は ZIP ライブラリや filesystem API を外へ漏らしません。directory source は `pack/db.json` と `pack/repository`、npm source は package の `packPath`、scp source は ZIP entry を同じ importer 入力へ変換します。

## URL と asset の扱い

DB item に含まれる次の値は、asset の識別子として `hash` を正とします。

```json
{
  "hash": "b130ca64e3f...",
  "url": "/sonolus/repository/b130ca64e3f..."
}
```

import 時に `url` が外部サーバーを指していても、その URL から無断でダウンロードしません。pack 内の `repository/<hash>` を優先し、hash と内容を検証します。外部 URL を取得する機能が必要な場合は、明示的な `allowRemoteAssets` と host allowlist を持つ別機能にします。

asset endpoint は hash を受け取り、asset store から stream で返します。

```text
GET /sonolus/repository/:hash
```

hash は hex 形式など許可した文字だけに制限し、path traversal と任意ファイル読み込みを防止します。ファイル名を hash と一致させ、実体は `repository/<hash>` のように保存します。

## import の冪等性と競合

同じ pack を複数回読み込んでも結果は同じでなければなりません。

- item のキーは `{ type, name }`
- asset のキーは `hash`
- 同じ hash の内容が一致すればコピーを省略
- hash が同じで内容が異なる場合は破損として失敗
- item の同名競合は `error` / `skip` / `replace` で明示する
- import の途中で失敗した場合、可能なら DB と asset manifest を transaction 単位で確定する

最初の実装では、memory database へ import して検証してから JSON database へ commit する staging 方式が扱いやすいです。SQL database では item と import manifest を transaction に含めます。

## セキュリティ

`.scp` は ZIP なので、信頼できないファイルを直接展開しません。

- `../`、絶対パス、Windows drive path を拒否する。
- entry path は `sonolus/` 配下だけ許可する。
- 展開後の総サイズと entry 数に上限を設ける。
- symlink entry を許可しない。
- JSON は parse 後に schema 検証する。
- repository の hash と内容を検証する。
- temp directory へ展開し、成功後にだけ asset store へ取り込む。

ZIP entry を逐次 stream で読む実装では、展開先を作らずに同じ path policy とサイズ上限を適用します。

## テスト方針

`@sonolus/free-pack` と `FreePack.scp` を fixture として、次を確認します。

1. directory source から skin / background / effect / particle が import できる。
2. `pack/db.json` の item 数と repository hash 数が一致する。
3. import 後に database の item が runtime schema を通る。
4. asset endpoint で hash に対応する bytes が取得できる。
5. 同じ pack の二回目の import が冪等である。
6. `.scp` の static mount が `/sonolus/skins/list` と repository をそのまま返す。
7. path traversal、破損 ZIP、hash 不一致、不正 JSON が拒否される。
8. static response から DB を復元できない場合、strict import が曖昧なデータを保存せず失敗する。

## 実装順序

1. `src/pack/type.ts` に source、asset store、import options を追加する。
2. `src/pack/directory.ts` で `pack/db.json` と `pack/repository` を読む。
3. `src/pack/importer.ts` で database と asset store へ冪等に取り込む。
4. `src/pack/file-assets.ts` で filesystem asset store を実装する。
5. `src/api/server/item` と repository endpoint を database / asset store に接続する。
6. ZIP reader を追加し、`.scp` static mount を実装する。
7. `@sonolus/free-pack` の `packPath` / `staticPath` を利用する npm source を追加する。
8. 必要になった時点で strict な static-to-database converter を追加する。

## 採用方針

Honolus では、次の二つを両立させます。

- アプリケーションの初期データとしては `@sonolus/free-pack` の `pack` を import する。
- 配布された `.scp` は、展開せず static mount できる入力としてサポートする。

これにより、`FreePack.scp` を置くだけで既存の static server として利用でき、将来検索・更新・認証などの動的機能が必要になった場合は、同じ内容を正規 pack または manifest 付き pack として `SonolusDatabase` へ取り込めます。
