# Hono API

Cloudflare Workers向けのHonoアプリケーションです。
APIの機能をこのアプリケーションにまとめ、単一のWorkerとしてデプロイします。

## Dockerでの開発

Docker Engine / Docker DesktopとDocker Composeを用意して、このディレクトリで実行します。

```sh
docker compose up --build
```

http://localhost:8787 にアクセスすると `Hello Hono!` が返ります。
`src` の変更はWranglerが検知して反映します。停止は `Ctrl+C`、コンテナの削除は `docker compose down` です。
依存関係を変更した場合は、もう一度 `docker compose up --build` を実行してください。

DockerfileはNode.js 24とpnpm 10.24.0を使用し、ロックファイルに従って依存関係をインストールします。
Node.jsはWranglerを実行するために使い、Hono自体はWorkersのランタイム（workerd）で動作します。

## DockerからCloudflare Workersへのデプロイ

CloudflareのAPIトークン（Workersの編集権限）とアカウントIDを、シェルの環境変数
`CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` に設定して、このディレクトリで実行します。

```sh
docker compose build
docker compose run --rm \
  --env CLOUDFLARE_API_TOKEN \
  --env CLOUDFLARE_ACCOUNT_ID \
  hono-api pnpm deploy
```

Dockerは開発・デプロイ用ツールの実行環境です。Cloudflare WorkersにはWranglerでアプリケーションをデプロイします。
認証情報をファイルに保存する場合はGitに追加しないでください。

## ローカル開発

Node.js 24とpnpm 10.24.0を用意して、このディレクトリで実行します。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

http://localhost:8787 にアクセスすると `Hello Hono!` が返ります。

## デプロイ

Cloudflareにログインしてデプロイします。

```sh
pnpm exec wrangler login
pnpm deploy
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```sh
pnpm cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiating `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```
