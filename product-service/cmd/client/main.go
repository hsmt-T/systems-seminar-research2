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

	res1, err := client.GetProduct(ctx, &pb.GetProductReq{Id: 2})
	if err != nil {
		log.Fatal(err)
	}
	product := res1.GetProduct()
	log.Printf("ID=%d 商品名=%s 価格=%d円", product.GetId(), product.GetName(), product.GetPrice())
}
