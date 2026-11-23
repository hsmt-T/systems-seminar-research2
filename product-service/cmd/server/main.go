package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"

	pb "github.com/hsmt-T/systems-seminar-research2/product-service/gen/product/v1"
	"github.com/hsmt-T/systems-seminar-research2/product-service/internal/infra/db"
	"github.com/hsmt-T/systems-seminar-research2/product-service/internal/infra/repo"
	presentation "github.com/hsmt-T/systems-seminar-research2/product-service/internal/presentation/grpc"
	"github.com/hsmt-T/systems-seminar-research2/product-service/internal/usecase"
	"google.golang.org/grpc"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	pool, err := db.NewPostgres(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		return fmt.Errorf("DB接続に失敗しました: %w", err)
	}
	defer pool.Close()
	log.Print("商品DBに接続しました")

	listener, err := net.Listen("tcp", ":50051")
	if err != nil {
		return fmt.Errorf("ポートの待ち受けに失敗しました: %w", err)
	}
	defer listener.Close()

	server := grpc.NewServer()
	products := repo.NewGetRepo(pool)
	findProduct := usecase.NewFindByID(products)
	handler := presentation.NewProductHandler(findProduct)
	pb.RegisterProductServiceServer(server, handler)

	log.Printf("ProductServiceをポート50051で起動します")
	if err := server.Serve(listener); err != nil {
		return fmt.Errorf("product-service server stop: %w", err)
	}
	return nil
}
