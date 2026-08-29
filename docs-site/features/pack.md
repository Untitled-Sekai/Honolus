# Packとアセット

## Directory Packを取り込む

```ts
import {
    FileSonolusAssetStore,
    importSonolusPack,
} from '@untitledsekai/honolus'

const assets = new FileSonolusAssetStore('./data/repository')

const result = await importSonolusPack({
    source: { type: 'directory', path: './pack' },
    database,
    assets,
    conflict: 'replace',
    publicRepositoryPath: '/sonolus/repository',
})
```

importは全resource hashを検証し、content-addressed assetを先に原子的に保存してから、itemをDB transactionで反映します。同じ内容の再importはskipされます。

競合方針は次の3種類です。

| 値 | 動作 |
| --- | --- |
| `error` | 同名で内容が違うitemがあれば失敗 |
| `skip` | 既存itemを維持 |
| `replace` | 既存itemを更新 |

## `.scp`を静的配信する

```ts
const sonolus = new Honolus({
    pack: {
        type: 'scp',
        path: './packs/server.scp',
        mode: 'static',
    },
})
```

静的mountは完成済みレスポンスをそのまま配信します。動的検索や更新が必要ならDirectory PackをDBへimportしてください。

asset endpointはhashをETagに使い、`immutable`な1年cache headerを返します。Productionでは同じURLをCDNへcacheさせる構成が適しています。

## S3互換ストレージ

`S3SonolusAssetStore`は大きなassetのmultipart upload、stagingからの原子的な公開、presigned upload、古いstaging objectのGCに対応します。公開前に内容のSHA-1とSonolus resource hashが一致することを検証します。
