# EC API

出典: [Notion ECサイト](https://app.notion.com/p/3fadfe8ca821806fba05eaad08f869d3)。
TODOに詳細仕様がないため、下記を実装上の仕様として定義する。

## 設計

- domain: エンティティ、リポジトリのインターフェース、業務エラー。Hono/Prismaに依存しない。
- application: ユースケースと外部サービスのポート。domainだけに依存する。
- infrastructure: Prismaリポジトリと暗号処理。内側のインターフェースを実装する。
- presentation: Honoルート、入力検証、HTTPへの変換。
- src/index.ts: 各層を接続する構成ルート。Prismaはリクエストごとに作成・切断する。
- 内側からHono/Prismaを参照しない。ルートからPrismaを直接操作しない。

## POST /auth/register

```sh
curl -i http://localhost:8787/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"a-long-password","name":"Alice"}'
```

201で `{ "user": { "id", "email", "name", "createdAt" } }` を返す。
メールは小文字に正規化する。パスワードは12〜128文字、名前は任意で1〜100文字。
重複メールは409、不正な入力は400。パスワードはソルト付きscryptで保存し、レスポンスには含めない。
既存の平文パスワードをログイン用に受け入れることはしない。

## 検証

`pnpm check` はPrisma・Lint・整形・型チェックと `pnpm test` を実行する。
テストではHono/DBから独立したユースケースを依存注入し、HTTPと暗号処理を確認する。

統合テストは専用DB `ec_api_test` を作成してマイグレーションを適用し、
`.dev.vars` の `DATABASE_URL` をそのDBに向けて実行する。開発DBには実行しない。

```sh
node scripts/check-api.mjs tests/integration/register.jsonl
```

Hono CLIのworkerdランタイムで検証し、毎回異なるテストアカウントを作成する。

## POST /auth/login

入力: `{ "email": "alice@example.com", "password": "a-long-password" }`。
成功時は200で `{ user, accessToken, tokenType: "Bearer", expiresIn: 3600 }` を返す。
未登録・パスワード不一致はいずれも401。同じアカウントで登録後に利用する。
JWTはHS256、issuer `hono-ec-api`、audience `ec-client`、有効期間1時間。
`Authorization: Bearer <accessToken>` を認証が必要なAPIに付ける。

起動前に32文字以上のランダムな `JWT_SECRET` を設定する。
Dockerでは `.dev.vars.docker`、ホストでは `.dev.vars` に次の出力を追記する。
既存のキーは上書きせず、既存の値を漏えいしないよう扱う。

```sh
node -e 'console.log("JWT_SECRET=" + require("node:crypto").randomBytes(32).toString("hex"))'
# 本番Workersのシークレット登録
pnpm exec wrangler secret put JWT_SECRET
```

平文の既存 `User.pass` はログインに利用できない。パスワードを再登録する運用が必要。

## GET /auth/me

Bearer JWTが必要。200で `{ user }` を返す。認証ヘッダーなし、署名不正、有効期限切れ、削除済みユーザーは401。
ユーザーIDはJWTから取得し、リクエストボディ等による他人のID指定を受け付けない。

## 商品・在庫

金額は日本円の整数。SKUは1〜64文字で全商品を通して一意（削除後も再利用不可）、
商品名は1〜200文字、価格は0〜100,000,000円、設定する在庫数は0〜1,000,000。
SKUと名前の前後空白は除去する。

| メソッド | パス            | 認証・動作                                              |
| -------- | --------------- | ------------------------------------------------------- |
| GET      | `/products`     | 公開商品一覧 `{ products }`                             |
| GET      | `/products/:id` | 公開商品詳細 `{ product }`                              |
| POST     | `/products`     | ログイン必須。`{ sku, name, price, stock }` を作成し201 |
| PATCH    | `/products/:id` | 作成者のみ。上記フィールドの一部を変更し200             |
| DELETE   | `/products/:id` | 作成者のみ。論理削除し204                               |

商品一覧・注文一覧・お気に入り一覧は `?limit=50&offset=0` に対応する。
limitは1〜100、offsetは0〜1,000,000。商品・お気に入りは商品ID昇順、注文はID降順。
在庫数は販売可能な残数。PATCHでstockを指定すると、その時点の残数を置き換える。
認証なしは401、他人の商品への変更・存在しない商品は404、SKU重複は409、入力不正は400。
削除した商品は一覧・詳細・お気に入りから非表示になり、新規注文できなくなる。
各ユーザーは自分が登録した商品を管理する。管理者権限や決済・配送は今回の実装範囲に含めない。

## 注文

すべてBearer認証必須。ユーザーIDはトークンから取得し、本人の注文だけを操作する。

| メソッド | パス          | 動作                                          |
| -------- | ------------- | --------------------------------------------- |
| GET      | `/orders`     | 本人の注文一覧 `{ orders }`（取消済みも含む） |
| GET      | `/orders/:id` | 本人の注文詳細 `{ order }`                    |
| POST     | `/orders`     | 注文と在庫減算を同時に実行し201               |
| PUT      | `/orders/:id` | 未取消の注文の明細全体を置換し200             |
| DELETE   | `/orders/:id` | 取消と在庫返却を同時に実行し204               |

作成・置換の入力は `{ "items": [{ "productId": 1, "quantity": 2 }] }`。
1〜50種類、数量は各1〜1,000。同じ商品IDの重複は400。
価格・商品名・SKUはサーバー上の現在の商品から取得して明細に保存する。
合計金額の上限は2,147,483,647円。クライアント指定の価格やuserIdは採用しない。
注文は `PLACED`、取消後は `CANCELLED`。取消は何度実行しても在庫を一度だけ返す。
PUTは旧数量を返却した後に新数量を確保し、その時点の価格で明細を再計算する。
失敗時は旧注文と在庫を維持する。削除済みの商品を含む注文も取消できる。

複数商品の注文、置換、取消はSerializableトランザクションと条件付き在庫更新で実行する。
競合時はトランザクション全体を最大3回再試行する。
在庫不足・取消済み注文の変更・再試行上限は409、商品不明・他人の注文は404。
商品を編集・削除しても、保存済み注文の金額・商品名は変わらない。
注文の削除は履歴を残す論理的な取消とし、物理削除は公開しない。

## お気に入り

すべてBearer認証必須。本人のデータだけを操作する。

| メソッド | パス                    | 動作                                              |
| -------- | ----------------------- | ------------------------------------------------- |
| GET      | `/favorites`            | 本人のお気に入り商品の一覧 `{ products }`         |
| PUT      | `/favorites/:productId` | 商品を登録し204。同じ商品を再登録しても重複しない |
| DELETE   | `/favorites/:productId` | 解除し204。未登録でも204                          |

存在しない商品・削除済み商品への登録は404。別ユーザーのお気に入りには影響しない。

## 実DB・Workers統合テスト

`pnpm check` に加え、PostgreSQLでロールバック・残り1点への同時注文・二重取消・
注文の所有権・お気に入り重複を検証する。Hono CLIではWorkersランタイムで
登録→ログイン→商品操作→注文→変更→取消→お気に入り→商品削除まで検証する。
CIでも専用のPostgreSQLサービスを起動して両方を実行する。

専用DB `ec_api_test` を用意し、環境変数 `DATABASE_URL` と `.dev.vars` の接続先を
そのDBに設定する。`.dev.vars` には32文字以上のランダムな `JWT_SECRET` も設定する。
次のコマンドはマイグレーションを適用し、専用DB以外を拒否するテストを実行する。
開発DBや本番DBの接続情報を指定しないこと。

```sh
pnpm test:integration
```

リポジトリ検証は同じスキーマからNode用クライアントを `.wrangler/prisma-node` に生成し、
HTTP検証は本番と同じWorkers用クライアントを使う。DB検証は自分が作成したデータだけを削除する。
CLI検証は毎回異なるアカウント・SKUを使い、専用DB内に検証履歴を残す。
