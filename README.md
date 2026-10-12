# systems-seminar-research2
後期システムゼミ　研究リポジトリ

## Hono開発環境

APIアプリケーションとDockerの設定は `hono-api` にまとめています。
Docker Engine / Docker DesktopとDocker Composeを用意して実行します。

```sh
cd hono-api
docker compose up --build
```

http://localhost:8787 にアクセスすると `Hello Hono!` が返ります。
開発・デプロイの詳細は [hono-api/README.md](hono-api/README.md) を参照してください。
