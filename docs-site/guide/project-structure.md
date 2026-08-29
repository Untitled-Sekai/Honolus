# プロジェクト構成

中規模以上では、HTTP、domain、infrastructureを分けると変更しやすくなります。

```text
src/
├─ app.ts                 # Honolusの組み立て
├─ routes/                # Sonolus route handler
├─ domain/                # ユースケースと変換処理
├─ infrastructure/
│  ├─ database.ts         # PostgreSQL poolとDB
│  ├─ jobs.ts             # queueとworker登録
│  └─ assets.ts           # asset store
└─ server.ts              # runtime adapterとsignal処理
```

`app.ts`は依存関係の組み立てに限定します。ハンドラー内で接続プールを生成せず、databaseやserviceをモジュール単位で共有してください。

終了シグナルを受けたら、HTTPの新規受付を止めた後に`await sonolus.close()`を呼びます。Honolusはjob queueを停止してからDBを閉じます。
