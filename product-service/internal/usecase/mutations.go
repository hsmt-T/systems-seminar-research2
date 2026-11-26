package usecase

import (
	"context"
	"fmt"
	"strings"
	"unicode/utf16"

	"github.com/hsmt-T/systems-seminar-research2/product-service/internal/domain"
)

type Mutations struct {
	products domain.ProductWriter
}

func NewMutations(products domain.ProductWriter) *Mutations {
	return &Mutations{products: products}
}

func validID(id int64) bool { return id > 0 && id <= 2147483647 }

func normalizeText(value string, max int) (string, error) {
	if len(utf16.Encode([]rune(value))) > max || strings.TrimSpace(value) == "" {
		return "", fmt.Errorf("%w: invalid SKU or name", domain.ErrInvalidProductInput)
	}
	return strings.TrimSpace(value), nil
}

func (u *Mutations) Create(ctx context.Context, ownerID int64, input domain.ProductInput) (domain.Product, error) {
	if !validID(ownerID) || input.Price < 0 || input.Price > 100000000 || input.Stock < 0 || input.Stock > 1000000 {
		return nil, domain.ErrInvalidProductInput
	}
	var err error
	input.SKU, err = normalizeText(input.SKU, 64)
	if err != nil {
		return nil, err
	}
	input.Name, err = normalizeText(input.Name, 200)
	if err != nil {
		return nil, err
	}
	return u.products.Create(ctx, ownerID, input)
}

func (u *Mutations) Update(ctx context.Context, id int64, patch domain.ProductPatch) (domain.Product, error) {
	if !validID(id) ||
		(patch.SKU == nil && patch.Name == nil && patch.Price == nil && patch.Stock == nil) ||
		(patch.Price != nil && (*patch.Price < 0 || *patch.Price > 100000000)) ||
		(patch.Stock != nil && (*patch.Stock < 0 || *patch.Stock > 1000000)) {
		return nil, domain.ErrInvalidProductInput
	}
	for _, field := range []struct {
		value **string
		max   int
	}{{&patch.SKU, 64}, {&patch.Name, 200}} {
		if *field.value != nil {
			value, err := normalizeText(**field.value, field.max)
			if err != nil {
				return nil, err
			}
			*field.value = &value
		}
	}
	return u.products.Update(ctx, id, patch)
}

func (u *Mutations) Delete(ctx context.Context, id int64) error {
	if !validID(id) {
		return domain.ErrInvalidProductInput
	}
	return u.products.Delete(ctx, id)
}
