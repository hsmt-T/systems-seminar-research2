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
	product  domain.Product
	products []domain.Product
	listErr  error
}

func (r productRepository) List(context.Context, domain.Page) ([]domain.Product, error) {
	return r.products, r.listErr
}

func (r productRepository) Create(context.Context, int64, domain.ProductInput) (domain.Product, error) {
	return r.product, r.listErr
}

func (r productRepository) Update(context.Context, int64, domain.ProductPatch) (domain.Product, error) {
	return r.product, r.listErr
}

func (r productRepository) Delete(context.Context, int64) error {
	return r.listErr
}

func (r productRepository) FindAll(context.Context) ([]domain.Product, error) {
	return r.products, r.listErr
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

func newProductClient(t *testing.T, repository productRepository) pb.ProductServiceClient {
	t.Helper()
	listener := bufconn.Listen(1024 * 1024)
	server := grpc.NewServer()
	pb.RegisterProductServiceServer(server, presentation.NewProductHandler(
		usecase.NewFindByID(repository),
		usecase.NewFindAll(repository),
		usecase.NewMutations(repository),
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
	return pb.NewProductServiceClient(conn)
}

func TestGetProductOverGRPC(t *testing.T) {
	created := time.Date(2026, 1, 2, 3, 4, 5, 123000000, time.UTC)
	updated := created.Add(time.Hour)
	product := domain.NewProduct(1, 7, "SAMPLE-001", "マウス", 2980, 0, created, updated)
	client := newProductClient(t, productRepository{product: product})

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

func TestListProductsOverGRPC(t *testing.T) {
	created := time.Date(2026, 1, 2, 3, 4, 5, 123000000, time.UTC)
	updated := created.Add(time.Hour)
	products := []domain.Product{
		domain.NewProduct(1, 7, "SAMPLE-001", "マウス", 2980, 0, created, updated),
		domain.NewProduct(8, 9, "SAMPLE-008", "デスクマット", 1980, 50, created, updated),
	}
	want := &pb.ListProductsRes{Products: []*pb.Product{
		{Id: 1, OwnerId: 7, Sku: "SAMPLE-001", Name: "マウス", Price: 2980, Stock: 0,
			CreatedAt: timestamppb.New(created), UpdatedAt: timestamppb.New(updated)},
		{Id: 8, OwnerId: 9, Sku: "SAMPLE-008", Name: "デスクマット", Price: 1980, Stock: 50,
			CreatedAt: timestamppb.New(created), UpdatedAt: timestamppb.New(updated)},
	}}
	for _, tc := range []struct {
		name     string
		products []domain.Product
		err      error
		code     codes.Code
		want     *pb.ListProductsRes
	}{
		{name: "all products with every field", products: products, want: want},
		{name: "empty catalog", want: &pb.ListProductsRes{}},
		{name: "database failure", err: errors.New("private database error"), code: codes.Internal},
		{name: "canceled query", err: fmt.Errorf("query: %w", context.Canceled), code: codes.Canceled},
		{name: "query timeout", err: fmt.Errorf("query: %w", context.DeadlineExceeded), code: codes.DeadlineExceeded},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := newProductClient(t, productRepository{products: tc.products, listErr: tc.err})
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			res, err := client.ListProducts(ctx, &pb.ListProductsReq{})
			if status.Code(err) != tc.code {
				t.Fatalf("got %v; want %v", err, tc.code)
			}
			if tc.code == codes.OK && !proto.Equal(res, tc.want) {
				t.Fatalf("got %v; want %v", res, tc.want)
			}
			if tc.code == codes.Internal && status.Convert(err).Message() != "商品一覧取得に失敗しました" {
				t.Fatalf("database details were exposed: %v", err)
			}
		})
	}
}

func TestMutationsOverGRPC(t *testing.T) {
	created := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	product := domain.NewProduct(1, 7, "SKU", "商品", 0, 0, created, created)
	zero := int64(0)
	want := &pb.Product{Id: 1, OwnerId: 7, Sku: "SKU", Name: "商品",
		CreatedAt: timestamppb.New(created), UpdatedAt: timestamppb.New(created)}
	client := newProductClient(t, productRepository{product: product})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	createdRes, err := client.CreateProduct(ctx, &pb.CreateProductReq{OwnerId: 7, Sku: "SKU", Name: "商品", Price: &zero, Stock: &zero})
	if err != nil || !proto.Equal(createdRes.GetProduct(), want) {
		t.Fatalf("create: %v, %v", createdRes, err)
	}
	updatedRes, err := client.UpdateProduct(ctx, &pb.UpdateProductReq{Id: 1, Stock: &zero})
	if err != nil || !proto.Equal(updatedRes.GetProduct(), want) {
		t.Fatalf("update: %v, %v", updatedRes, err)
	}
	if _, err := client.DeleteProduct(ctx, &pb.DeleteProductReq{Id: 1}); err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		name string
		err  error
		code codes.Code
	}{
		{"not found", domain.ErrProductNotFound, codes.NotFound},
		{"duplicate SKU", fmt.Errorf("write: %w", domain.ErrSKUAlreadyExists), codes.AlreadyExists},
		{"internal", errors.New("private database details"), codes.Internal},
		{"canceled", fmt.Errorf("write: %w", context.Canceled), codes.Canceled},
		{"deadline", fmt.Errorf("write: %w", context.DeadlineExceeded), codes.DeadlineExceeded},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := newProductClient(t, productRepository{listErr: tc.err})
			_, createErr := client.CreateProduct(ctx, &pb.CreateProductReq{OwnerId: 7, Sku: "SKU", Name: "商品", Price: &zero, Stock: &zero})
			_, updateErr := client.UpdateProduct(ctx, &pb.UpdateProductReq{Id: 1, Stock: &zero})
			_, deleteErr := client.DeleteProduct(ctx, &pb.DeleteProductReq{Id: 1})
			for _, err := range []error{createErr, updateErr, deleteErr} {
				if status.Code(err) != tc.code {
					t.Fatalf("got %v; want %v", err, tc.code)
				}
				if tc.code == codes.Internal && status.Convert(err).Message() != "商品変更に失敗しました" {
					t.Fatalf("database error was exposed: %v", err)
				}
			}
		})
	}
}

func TestInvalidRequestsOverGRPC(t *testing.T) {
	client := newProductClient(t, productRepository{})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	zero, negative, largeOffset := int64(0), int64(-1), int64(1000001)
	_, missingPrice := client.CreateProduct(ctx, &pb.CreateProductReq{OwnerId: 7, Sku: "SKU", Name: "商品", Stock: &zero})
	_, missingStock := client.CreateProduct(ctx, &pb.CreateProductReq{OwnerId: 7, Sku: "SKU", Name: "商品", Price: &zero})
	_, missingOwner := client.CreateProduct(ctx, &pb.CreateProductReq{Sku: "SKU", Name: "商品", Price: &zero, Stock: &zero})
	_, emptyPatch := client.UpdateProduct(ctx, &pb.UpdateProductReq{Id: 1})
	_, invalidID := client.DeleteProduct(ctx, &pb.DeleteProductReq{})
	_, zeroLimit := client.ListProducts(ctx, &pb.ListProductsReq{Limit: &zero})
	_, negativeOffset := client.ListProducts(ctx, &pb.ListProductsReq{Offset: &negative})
	_, oversizedOffset := client.ListProducts(ctx, &pb.ListProductsReq{Offset: &largeOffset})
	for _, err := range []error{missingPrice, missingStock, missingOwner, emptyPatch, invalidID, zeroLimit, negativeOffset, oversizedOffset} {
		if status.Code(err) != codes.InvalidArgument {
			t.Fatalf("got %v; want InvalidArgument", err)
		}
	}
}
