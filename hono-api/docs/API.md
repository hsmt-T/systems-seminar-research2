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
