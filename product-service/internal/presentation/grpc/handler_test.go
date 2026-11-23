package grpc_test

import (
	"context"
	"errors"
	"fmt"
	"net"
	"testing"
	"time"

	pb "github.com/hsmt-T/systems-seminar-research2/product-service/gen/product/v1"
	"github.com/hsmt-T/systems-seminar-research2/product-service/internal/domain"
	presentation "github.com/hsmt-T/systems-seminar-research2/product-service/internal/presentation/grpc"
	"github.com/hsmt-T/systems-seminar-research2/product-service/internal/usecase"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type productRepository struct {
	product domain.Product
}

func (r productRepository) FindByID(_ context.Context, id int64) (domain.Product, error) {
	switch id {
	case 1:
		return r.product, nil
	case 2:
		return nil, fmt.Errorf("lookup: %w", domain.ErrProductNotFound)
	case 3:
		return nil, errors.New("private database error")
	case 4:
		return nil, fmt.Errorf("lookup: %w", context.Canceled)
	case 5:
		return nil, fmt.Errorf("lookup: %w", context.DeadlineExceeded)
	default:
		return nil, domain.ErrProductNotFound
	}
}

func TestGetProductOverGRPC(t *testing.T) {
	created := time.Date(2026, 1, 2, 3, 4, 5, 123000000, time.UTC)
	updated := created.Add(time.Hour)
	product := domain.NewProduct(1, 7, "SAMPLE-001", "マウス", 2980, 0, created, updated)
	listener := bufconn.Listen(1024 * 1024)
	server := grpc.NewServer()
	pb.RegisterProductServiceServer(server, presentation.NewProductHandler(
		usecase.NewFindByID(productRepository{product: product}),
	))
	t.Cleanup(func() {
		server.Stop()
		listener.Close()
	})
	go func() {
		if err := server.Serve(listener); err != nil && !errors.Is(err, grpc.ErrServerStopped) {
			t.Errorf("serve: %v", err)
		}
	}()
	conn, err := grpc.NewClient("passthrough:///product-test",
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) {
			return listener.Dial()
		}),
	)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	client := pb.NewProductServiceClient(conn)

	t.Run("database product becomes protobuf response", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		res, err := client.GetProduct(ctx, &pb.GetProductReq{Id: 1})
		if err != nil {
			t.Fatal(err)
		}
		want := &pb.Product{
			Id: 1, OwnerId: 7, Sku: "SAMPLE-001", Name: "マウス", Price: 2980, Stock: 0,
			CreatedAt: timestamppb.New(created), UpdatedAt: timestamppb.New(updated),
		}
		if !proto.Equal(res.GetProduct(), want) {
			t.Fatalf("got %v; want %v", res.GetProduct(), want)
		}
	})

	for _, tc := range []struct {
		name string
		id   int64
		code codes.Code
	}{
		{"zero ID", 0, codes.InvalidArgument},
		{"negative ID", -1, codes.InvalidArgument},
		{"missing product", 2, codes.NotFound},
		{"database failure", 3, codes.Internal},
		{"canceled query", 4, codes.Canceled},
		{"query timeout", 5, codes.DeadlineExceeded},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_, err := client.GetProduct(ctx, &pb.GetProductReq{Id: tc.id})
			if status.Code(err) != tc.code {
				t.Fatalf("got %v; want %v", err, tc.code)
			}
			if tc.code == codes.Internal && status.Convert(err).Message() != "商品取得に失敗しました" {
				t.Fatalf("database details were exposed: %v", err)
			}
		})
	}
}
