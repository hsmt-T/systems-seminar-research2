# Product Service

PostgreSQLで商品の作成・取得・部分更新・論理削除を行うGo製gRPCサービスです。`hono-api` の商品APIに対応しています。

## RPC

- `ListProducts(ListProductsReq)`: 削除済みの商品を除き、ID昇順で `ListProductsRes.products` に返します。指定なしでは全件取得、商品がない場合は空の一覧です。任意の `limit`（1〜100）、`offset`（0〜1,000,000）でページ指定できます。片方だけ指定した場合の既定値は `limit=50`、`offset=0` です。
- `GetProduct(GetProductReq)`: 指定したIDの商品を取得します。
- `CreateProduct(CreateProductReq)`: `owner_id`、`sku`、`name`、`price`、`stock` を指定して商品を作成します。価格・在庫は0の場合も明示的に指定します。
- `UpdateProduct(UpdateProductReq)`: `id` で特定し、指定した `sku`、`name`、`price`、`stock` のみ更新します。少なくとも1項目が必要です。未指定と0・空文字を区別し、空文字は入力エラーにします。
- `DeleteProduct(DeleteProductReq)`: `id` が一致する商品の `deleted_at` を設定します。

更新・削除は未削除の商品が対象です。対象なし・削除済みはいずれも `NotFound`、SKU重複は `AlreadyExists`、入力不正は `InvalidArgument` を返します。削除済み商品のSKUも再利用できません。

入力制約はHonoと同じく、SKUは1〜64文字、商品名は1〜200文字（JavaScriptの文字列長と同じUTF-16単位）、前後空白を除去し空白のみは禁止、価格は0〜100,000,000、在庫は0〜1,000,000です。作成時の所有者IDと更新・削除時の各IDは1〜2,147,483,647です。

現時点では認証・認可は実装していません。全RPCを認証なしで呼び出せます。更新・削除は商品IDだけで操作します。作成時の `owner_id` は商品データとして保存し、ユーザーの存在確認や認証情報との照合は行いません。

Goクライアントでの呼び出し例（接続済みの `client` と `ctx` を使用）:

```go
created, err := client.CreateProduct(ctx, &productv1.CreateProductReq{
    OwnerId: 1, Sku: "NEW-001", Name: "新商品",
    Price: proto.Int64(2980), Stock: proto.Int64(10),
})
if err != nil { return err }
_, err = client.UpdateProduct(ctx, &productv1.UpdateProductReq{
    Id: created.GetProduct().GetId(), Stock: proto.Int64(0),
})
if err != nil { return err }
_, err = client.DeleteProduct(ctx, &productv1.DeleteProductReq{
    Id: created.GetProduct().GetId(),
})
if err != nil { return err }
```

`productv1` は `gen/product/v1`、`proto` は `google.golang.org/protobuf/proto` のインポート別名です。

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

`localhost:50051` に接続して `ListProducts` で商品を全件取得し、件数と各商品を表示して終了します。
初期サンプルデータがある場合の出力例です。

```text
商品数=8
ID=1 商品名=ワイヤレスマウス 価格=2980円
ID=2 商品名=メカニカルキーボード 価格=8980円
...
```

## 開発時の確認

GitHub Actionsの `Product Service CI` は、各PR・mainへのpush・手動実行で `gofmt` の整形チェックと `go test ./...` を実行します。CIではDBを起動しないため、PostgreSQL結合テストはスキップします。

```shell
go generate ./...
go test ./...
go vet ./...
```

コード生成には `protoc`、`protoc-gen-go`、`protoc-gen-go-grpc` が必要です。

`PRODUCT_TEST_DATABASE_URL` にPostgreSQLの接続URLを設定すると、`go test ./...` でDB結合テストも実行します。一時テーブルを使い、既存の商品データは変更しません。

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
