package main

import (
	"context"
	"log"
	"net"

	pb "github.com/hsmt-T/systems-seminar-research2/product-service/gen/product/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type productServer struct {
	pb.UnimplementedProductServiceServer
}

func main() {
	listener, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatalf("ポートの待ち受けに失敗しました: %v", err)
	}
	defer listener.Close()

	server := grpc.NewServer()
	pb.RegisterProductServiceServer(server, &productServer{})

	log.Printf("ProductServiceをポート50051で起動します")
	if err := server.Serve(listener); err != nil {
		log.Fatalf("gRPCサーバーが停止しました: %v", err)
	}
}

func (s *productServer) GetProduct(
	ctx context.Context,
	req *pb.GetProductReq,
) (*pb.GetProductRes, error) {
	if req.GetId() <= 0 {
		return nil, status.Error(codes.InvalidArgument, "商品IDが必要です")
	}

	now := timestamppb.Now()

	return &pb.GetProductRes{
		Product: &pb.Product{
			Id:        123,
			OwnerId:   1,
			Sku:       "SKU-001",
			Name:      "name",
			Price:     1000,
			Stock:     6,
			CreatedAt: now,
			UpdatedAt: now,
		},
	}, nil
}
