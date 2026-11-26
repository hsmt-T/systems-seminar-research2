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

type ProductLister interface {
	Execute(context.Context, *domain.Page) ([]domain.Product, error)
}

type ProductCommands interface {
	Create(context.Context, int64, domain.ProductInput) (domain.Product, error)
	Update(context.Context, int64, domain.ProductPatch) (domain.Product, error)
	Delete(context.Context, int64) error
}

type ProductHandler struct {
	pb.UnimplementedProductServiceServer
	finder   ProductFinder
	lister   ProductLister
	commands ProductCommands
}

func NewProductHandler(finder ProductFinder, lister ProductLister, commands ProductCommands) *ProductHandler {
	return &ProductHandler{finder: finder, lister: lister, commands: commands}
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
		Product: toProto(product),
	}, nil
}

func (h *ProductHandler) ListProducts(ctx context.Context, req *pb.ListProductsReq) (*pb.ListProductsRes, error) {
	var page *domain.Page
	if req != nil && (req.Limit != nil || req.Offset != nil) {
		page = &domain.Page{Limit: 50, Offset: req.GetOffset()}
		if req.Limit != nil {
			page.Limit = req.GetLimit()
		}
	}
	products, err := h.lister.Execute(ctx, page)
	if err != nil {
		if errors.Is(err, domain.ErrInvalidProductInput) {
			return nil, status.Error(codes.InvalidArgument, "ページ指定が不正です")
		}
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return nil, status.FromContextError(err).Err()
		}
		slog.ErrorContext(ctx, "商品一覧取得に失敗しました", "error", err)
		return nil, status.Error(codes.Internal, "商品一覧取得に失敗しました")
	}
	res := &pb.ListProductsRes{Products: make([]*pb.Product, 0, len(products))}
	for _, product := range products {
		res.Products = append(res.Products, toProto(product))
	}
	return res, nil
}

func (h *ProductHandler) CreateProduct(ctx context.Context, req *pb.CreateProductReq) (*pb.CreateProductRes, error) {
	if req == nil || req.Price == nil || req.Stock == nil {
		return nil, status.Error(codes.InvalidArgument, "価格と在庫数は必須です")
	}
	product, err := h.commands.Create(ctx, req.GetOwnerId(), domain.ProductInput{
		SKU: req.GetSku(), Name: req.GetName(), Price: req.GetPrice(), Stock: req.GetStock(),
	})
	if err != nil {
		return nil, mutationError(ctx, err)
	}
	return &pb.CreateProductRes{Product: toProto(product)}, nil
}

func (h *ProductHandler) UpdateProduct(ctx context.Context, req *pb.UpdateProductReq) (*pb.UpdateProductRes, error) {
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "商品情報は必須です")
	}
	product, err := h.commands.Update(ctx, req.GetId(), domain.ProductPatch{
		SKU: req.Sku, Name: req.Name, Price: req.Price, Stock: req.Stock,
	})
	if err != nil {
		return nil, mutationError(ctx, err)
	}
	return &pb.UpdateProductRes{Product: toProto(product)}, nil
}

func (h *ProductHandler) DeleteProduct(ctx context.Context, req *pb.DeleteProductReq) (*pb.DeleteProductRes, error) {
	if err := h.commands.Delete(ctx, req.GetId()); err != nil {
		return nil, mutationError(ctx, err)
	}
	return &pb.DeleteProductRes{}, nil
}

func mutationError(ctx context.Context, err error) error {
	switch {
	case errors.Is(err, domain.ErrInvalidProductInput):
		return status.Error(codes.InvalidArgument, "商品情報が不正です")
	case errors.Is(err, domain.ErrProductNotFound):
		return status.Error(codes.NotFound, "商品が見つかりません")
	case errors.Is(err, domain.ErrSKUAlreadyExists):
		return status.Error(codes.AlreadyExists, "SKUは既に登録されています")
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		return status.FromContextError(err).Err()
	default:
		slog.ErrorContext(ctx, "商品変更に失敗しました", "error", err)
		return status.Error(codes.Internal, "商品変更に失敗しました")
	}
}

func toProto(product domain.Product) *pb.Product {
	return &pb.Product{
		Id:        product.ID(),
		OwnerId:   product.OwnerID(),
		Sku:       product.Sku(),
		Name:      product.Name(),
		Price:     product.Price(),
		Stock:     product.Stock(),
		CreatedAt: timestamppb.New(product.CreatedAt()),
		UpdatedAt: timestamppb.New(product.UpdatedAt()),
	}
}
