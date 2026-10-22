# Hono API

Cloudflare Workers向けのHono APIです。Prisma ORM 7でDockerのPostgreSQLに接続します。
以下のコマンドは、リポジトリ直下から `cd hono-api` した後に実行してください。

## Dockerで起動・接続確認

Docker Engine / Docker DesktopとDocker Composeが必要です。
初回のみ、Git管理対象外のDocker用設定ファイルを作成します。
既存のファイルがある場合は上書きせず内容を確認してください。

```sh
printf '%s\n' 'DATABASE_URL="postgresql://user:hono@postgres:5432/hono-db"' > .dev.vars.docker
```

```sh
# 初回起動・依存関係やスキーマ変更後の再ビルド
docker compose up --build -d

# 作成済みマイグレーションをDBに適用
docker compose run --rm hono-api pnpm db:deploy

# コンテナの状態・APIログを確認
docker compose ps
docker compose logs --tail 100 -f hono-api
```

ログの追跡は `Ctrl+C` で終了します。コンテナは稼働したままです。

```sh
# APIの応答確認
curl --fail-with-body http://localhost:8787/

# APIのヘルスチェック
curl --fail-with-body http://localhost:8787/health

# Prisma経由のDB接続確認（SELECT 1）
curl --fail-with-body http://localhost:8787/health/db
```

`/` は `Hello Hono!`、`/health` は `{"status":"ok"}` を返します。
`/health/db` は接続成功時にHTTP 200と `{"status":"ok","database":"ok"}`、
失敗時にHTTP 503と `{"status":"error","database":"unavailable"}` を返します。

```sh
# コンテナを停止
docker compose stop

# 停止したコンテナを起動
docker compose start

# コンテナ・ネットワークを削除（DBのボリュームは保持）
docker compose down
```

APIは http://localhost:8787 で公開します。`src` の変更はWranglerが検知します。
DockerはNode.js 24とpnpm 10.24.0を使用します。API自体はWorkersのランタイムで動作します。

## PostgreSQLを直接確認

```sh
# psqlを起動
docker compose exec postgres psql -U user -d hono-db
```

psql内で実行するコマンドです。終了は `\q` です。

```sql
\dt
\d "User"
SELECT 1;
SELECT id, email, name, "createdAt" FROM "User" LIMIT 10;
\q
```

| 項目               | 値               |
| ------------------ | ---------------- |
| Docker内の接続先   | `postgres:5432`  |
| ホストからの接続先 | `localhost:5433` |
| DB名               | `hono-db`        |
| 開発用ユーザー     | `user`           |
| 開発用パスワード   | `hono`           |

Dockerでは `.dev.vars.docker` を `/app/.dev.vars` にマウントしてWranglerに渡し、
Prisma CLIにはComposeの `environment.DATABASE_URL` を渡します。

## Prismaの操作

スキーマは `prisma/schema.prisma`、マイグレーションは `prisma/migrations` です。
`User`・`Product`・`Order`・`OrderItem`・`Favorite` モデルを定義しています。
商品・在庫・注文・お気に入りの仕様は [docs/API.md](docs/API.md) を参照してください。
生成クライアント `generated/prisma` はGit管理対象外です。

```sh
# スキーマを検証
docker compose run --rm hono-api pnpm db:validate

# スキーマ編集後にマイグレーションを作成・適用（名前は変更内容に合わせる）
docker compose run --rm hono-api pnpm db:migrate --name add_user_field

# クライアントを再生成したイメージでAPIを起動
docker compose up --build -d

# 作成済みマイグレーションを適用
docker compose run --rm hono-api pnpm db:deploy

# 適用状況を確認
docker compose run --rm hono-api pnpm exec prisma migrate status
```

`db:migrate` は開発用です。既存DBのリセットを求められた場合は、実行前に内容を確認してください。

## ホスト側で開発・Prisma Studioを使う

Node.js 24とpnpm 10.24.0が必要です。
Wranglerは `.dev.vars`、現在の `prisma.config.ts` は `.env` を読み込みます。
次のコピーは初回のみ実行し、既存の設定ファイルがある場合は内容を確認して編集してください。

```sh
pnpm install --frozen-lockfile
printf '%s\n' 'DATABASE_URL="postgresql://user:hono@localhost:5433/hono-db"' > .dev.vars
cp .dev.vars .env

# DBだけDockerで起動
docker compose up -d postgres

# 作成済みマイグレーションを適用
pnpm db:deploy

# 型定義・Prismaクライアントを生成してAPIを起動
pnpm dev
```

ホストから接続する両ファイルの `DATABASE_URL` は、開発用DBでは次の値です。

```dotenv
DATABASE_URL="postgresql://user:hono@localhost:5433/hono-db"
```

`.env`、`.dev.vars`、`.dev.vars.docker` はGit管理対象外です。
DockerのAPIが8787番ポートで起動中の場合は、`docker compose stop hono-api` で停止してから `pnpm dev` を実行してください。

```sh
pnpm db:generate                       # Prismaクライアントを生成
pnpm db:validate                       # スキーマを検証
pnpm db:migrate --name add_user_field   # 開発用マイグレーションの作成・適用
pnpm db:deploy                         # 作成済みマイグレーションの適用
pnpm exec prisma migrate status        # 適用状況を確認
pnpm db:studio                         # DBをブラウザーで閲覧・編集
```

Prisma StudioはCLIに表示されるURLをブラウザーで開きます。終了は `Ctrl+C` です。

## Lint・整形・型チェック

```sh
pnpm check         # Prisma生成・スキーマ検証・Lint・整形チェック・型チェック
pnpm lint          # Lint
pnpm lint:fix      # 修正可能なLint指摘を修正
pnpm format        # フォーマットを適用
pnpm format:check  # フォーマットを検査
pnpm typecheck     # Workersの型を生成して型チェック
pnpm cf-typegen    # Workersの型定義のみ再生成
```

Dockerで検査する場合は次のコマンドを使います。

```sh
docker compose build
docker compose run --rm hono-api pnpm check
```

ESLintは型情報を使って検査します。Prettierはシングルクォート・セミコロンなし・2スペース・LF改行です。
GitHub ActionsはPRの作成・更新、`main` へのpush、手動実行で `pnpm check` を実行します。

## DATABASE_URLの型エラーが出た場合

ホスト側のエディターで `CloudflareBindings` に `DATABASE_URL` が存在しない場合は、ホスト側で実行します。

```sh
pnpm cf-typegen
pnpm typecheck
```

`worker-configuration.d.ts` は `wrangler.jsonc` の `secrets.required` から生成します。
Docker内の型生成はホスト側には反映されません。`pnpm dev` は起動時に型も生成します。
エラーが残る場合は、エディターのTypeScriptサーバーを再起動してください。

## Cloudflare Workersへのデプロイ

本番Workersから到達可能なPostgreSQLを用意し、そのURLをシークレットに登録します。
Dockerの開発用DBには、本番Workersから直接接続できません。

```sh
pnpm exec wrangler login
pnpm exec wrangler secret put DATABASE_URL
pnpm deploy
```

`secret put` の入力待ちで本番DBの接続URLを入力します。
本番DBへのマイグレーションは、本番の `DATABASE_URL` を設定した環境で `pnpm db:deploy` を実行します。

Dockerからデプロイする場合は、シェルの環境変数に `CLOUDFLARE_API_TOKEN` と
`CLOUDFLARE_ACCOUNT_ID` を設定して実行します。

```sh
docker compose build
docker compose run --rm \
  --env CLOUDFLARE_API_TOKEN \
  --env CLOUDFLARE_ACCOUNT_ID \
  hono-api pnpm deploy
```

## EC API

エンドポイント、入力・出力、オニオンアーキテクチャの構成は [docs/API.md](docs/API.md) を参照してください。
`pnpm test` でAPIとユースケースのテストを実行します。
