package usecase

import (
	"context"
	"fmt"

	"github.com/hsmt-T/systems-seminar-research2/product-service/internal/domain"
)

type FindAll struct {
	products domain.ProductRepository
}

func NewFindAll(products domain.ProductRepository) *FindAll {
	return &FindAll{products: products}
}

func (u *FindAll) Execute(ctx context.Context, page *domain.Page) ([]domain.Product, error) {
	if page != nil {
		if page.Limit < 1 || page.Limit > 100 || page.Offset < 0 || page.Offset > 1000000 {
			return nil, fmt.Errorf("%w: invalid pagination", domain.ErrInvalidProductInput)
		}
		return u.products.List(ctx, *page)
	}
	return u.products.FindAll(ctx)
}
