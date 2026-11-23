# Product Service

PostgreSQLから商品をID検索するGo製gRPCサービスです。

## 前提

- Go 1.27.4以上
- Docker Desktop（Linuxコンテナ）が起動済み
- 以下のコマンドはすべて `product-service` ディレクトリで実行

## サーバー起動

PowerShellでは、1つ目のターミナルで実行します。

```powershell
docker compose up -d --wait postgres
$env:DATABASE_URL = 'postgresql://product:product@localhost:5434/product-service?sslmode=disable'
go run ./cmd/server
```

Bash / WSLの場合は、次のコマンドを使います。

```bash
docker compose up -d --wait postgres
export DATABASE_URL='postgresql://product:product@localhost:5434/product-service?sslmode=disable'
go run ./cmd/server
```

Goは `.env` を自動では読み込みません。上記では環境変数を直接設定しています。
接続情報はローカル開発用のCompose設定に対応しています。

次のログが出たら、ターミナルを開いたままクライアントを起動します。

```text
商品DBに接続しました
ProductServiceをポート50051で起動します
```

## クライアント起動

別のターミナルでも `product-service` ディレクトリへ移動し、実行します。
PowerShell / Bash共通です。クライアント側に `DATABASE_URL` の設定は不要です。

```shell
go run ./cmd/client
```

`localhost:50051` に接続して商品ID `1` を取得し、結果を表示して終了します。
初期サンプルデータがある場合の出力例です。

```text
ID=1 商品名=ワイヤレスマウス 価格=2980円
```

## サンプルデータ

新規DBの初回起動時に `db/init/` のSQLを順番に実行し、商品テーブルとサンプル商品8件を作成します。
既存のDBボリュームには初期化SQLが再実行されません。

起動済みDBにサンプルを追加する場合は、次のコマンドを実行します。
同じSKUがある場合はスキップします。

```shell
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U product -d product-service -f /docker-entrypoint-initdb.d/002_sample_products.sql
```

## 停止

サーバーを起動したターミナルで `Ctrl+C` を押します。DBは別途停止します。

```shell
docker compose stop postgres
```
