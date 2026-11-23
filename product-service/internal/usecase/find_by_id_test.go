package usecase_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/hsmt-T/systems-seminar-research2/product-service/internal/domain"
	"github.com/hsmt-T/systems-seminar-research2/product-service/internal/usecase"
)

type repositoryFunc func(context.Context, int64) (domain.Product, error)

func (f repositoryFunc) FindByID(ctx context.Context, id int64) (domain.Product, error) {
	return f(ctx, id)
}

func TestFindByIDRejectsInvalidID(t *testing.T) {
	u := usecase.NewFindByID(repositoryFunc(func(context.Context, int64) (domain.Product, error) {
		t.Fatal("repository must not be called for invalid ID")
		return nil, nil
	}))
	for _, id := range []int64{0, -1} {
		product, err := u.Execute(context.Background(), id)
		if product != nil || !errors.Is(err, domain.ErrInvalidProductID) {
			t.Fatalf("ID %d: product=%v, error=%v", id, product, err)
		}
	}
}

func TestFindByIDPassesContextAndResult(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	want := domain.NewProduct(42, 1, "SKU-42", "商品", 1000, 0, time.Now(), time.Now())
	for _, wantErr := range []error{nil, domain.ErrProductNotFound, context.Canceled} {
		u := usecase.NewFindByID(repositoryFunc(func(gotCtx context.Context, id int64) (domain.Product, error) {
			if gotCtx != ctx || id != 42 {
				t.Fatal("context or product ID was not forwarded")
			}
			if wantErr != nil {
				return nil, wantErr
			}
			return want, nil
		}))
		got, err := u.Execute(ctx, 42)
		if !errors.Is(err, wantErr) || (wantErr == nil && got != want) || (wantErr != nil && got != nil) {
			t.Fatalf("product=%v, error=%v; expected error=%v", got, err, wantErr)
		}
	}
}
