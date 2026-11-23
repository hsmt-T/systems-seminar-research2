package grpc

import (
	"context"
	"errors"
	"log/slog"

	pb "github.com/hsmt-T/systems-seminar-research2/product-service/gen/product/v1"
	"github.com/hsmt-T/systems-seminar-research2/product-service/internal/domain"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type ProductFinder interface {
	Execute(context.Context, int64) (domain.Product, error)
}

type ProductHandler struct {
	pb.UnimplementedProductServiceServer
	finder ProductFinder
}

func NewProductHandler(finder ProductFinder) *ProductHandler {
	return &ProductHandler{finder: finder}
}

func (h *ProductHandler) GetProduct(ctx context.Context, req *pb.GetProductReq) (*pb.GetProductRes, error) {
	product, err := h.finder.Execute(ctx, req.GetId())
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrInvalidProductID):
			return nil, status.Error(codes.InvalidArgument, "商品IDは正の整数で指定してください")
		case errors.Is(err, domain.ErrProductNotFound):
			return nil, status.Error(codes.NotFound, "商品が見つかりません")
		case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
			return nil, status.FromContextError(err).Err()
		default:
			slog.ErrorContext(ctx, "商品取得に失敗しました", "product_id", req.GetId(), "error", err)
			return nil, status.Error(codes.Internal, "商品取得に失敗しました")
		}
	}

	return &pb.GetProductRes{
		Product: &pb.Product{
			Id:        product.ID(),
			OwnerId:   product.OwnerID(),
			Sku:       product.Sku(),
			Name:      product.Name(),
			Price:     product.Price(),
			Stock:     product.Stock(),
			CreatedAt: timestamppb.New(product.CreatedAt()),
			UpdatedAt: timestamppb.New(product.UpdatedAt()),
		},
	}, nil
}
