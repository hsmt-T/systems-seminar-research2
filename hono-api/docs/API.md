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
