package main

import (
	"context"
	"log"
	"time"

	pb "github.com/hsmt-T/systems-seminar-research2/product-service/gen/product/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func main() {
	conn, err := grpc.NewClient(
		"localhost:50051",
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		log.Fatal(err)
	}

	defer conn.Close()

	client := pb.NewProductServiceClient(conn)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	res, err := client.ListProducts(ctx, &pb.ListProductsReq{})
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("商品数=%d", len(res.GetProducts()))
	for _, product := range res.GetProducts() {
		log.Printf("ID=%d 商品名=%s 価格=%d円", product.GetId(), product.GetName(), product.GetPrice())
	}
}
