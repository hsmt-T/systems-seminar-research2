package usecase

import (
	"context"

	"github.com/hsmt-T/systems-seminar-research2/product-service/internal/domain"
)

type FindByID struct {
	products domain.ProductRepository
}

func NewFindByID(products domain.ProductRepository) *FindByID {
	return &FindByID{products: products}
}

func (u *FindByID) Execute(ctx context.Context, id int64) (domain.Product, error) {
	if id <= 0 {
		return nil, domain.ErrInvalidProductID
	}
	return u.products.FindByID(ctx, id)
}
