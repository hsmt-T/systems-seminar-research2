package usecase_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/hsmt-T/systems-seminar-research2/product-service/internal/domain"
	"github.com/hsmt-T/systems-seminar-research2/product-service/internal/usecase"
)

type writerStub struct {
	create func(context.Context, int64, domain.ProductInput) (domain.Product, error)
	update func(context.Context, int64, domain.ProductPatch) (domain.Product, error)
	delete func(context.Context, int64) error
}

func (r writerStub) Create(ctx context.Context, owner int64, input domain.ProductInput) (domain.Product, error) {
	if r.create == nil {
		return nil, errors.New("unexpected Create call")
	}
	return r.create(ctx, owner, input)
}
func (r writerStub) Update(ctx context.Context, id int64, patch domain.ProductPatch) (domain.Product, error) {
	if r.update == nil {
		return nil, errors.New("unexpected Update call")
	}
	return r.update(ctx, id, patch)
}
func (r writerStub) Delete(ctx context.Context, id int64) error {
	if r.delete == nil {
		return errors.New("unexpected Delete call")
	}
	return r.delete(ctx, id)
}

func TestMutationsRejectInvalidInput(t *testing.T) {
	// Unexpected repository calls return errors distinct from validation errors.
	u := usecase.NewMutations(writerStub{})
	ctx := context.Background()
	for _, tc := range []struct {
		name  string
		owner int64
		input domain.ProductInput
	}{
		{"missing owner", 0, domain.ProductInput{SKU: "SKU", Name: "商品"}},
		{"oversized owner", 2147483648, domain.ProductInput{SKU: "SKU", Name: "商品"}},
		{"blank SKU", 1, domain.ProductInput{SKU: "  ", Name: "商品"}},
		{"long SKU", 1, domain.ProductInput{SKU: strings.Repeat("a", 65), Name: "商品"}},
		{"blank name", 1, domain.ProductInput{SKU: "SKU", Name: " "}},
		{"long name", 1, domain.ProductInput{SKU: "SKU", Name: strings.Repeat("😀", 101)}},
		{"negative price", 1, domain.ProductInput{SKU: "SKU", Name: "商品", Price: -1}},
		{"large price", 1, domain.ProductInput{SKU: "SKU", Name: "商品", Price: 100000001}},
		{"negative stock", 1, domain.ProductInput{SKU: "SKU", Name: "商品", Stock: -1}},
		{"large stock", 1, domain.ProductInput{SKU: "SKU", Name: "商品", Stock: 1000001}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := u.Create(ctx, tc.owner, tc.input); !errors.Is(err, domain.ErrInvalidProductInput) {
				t.Fatalf("expected invalid input: %v", err)
			}
		})
	}
	blank, long := " ", strings.Repeat("a", 65)
	negative, largePrice, largeStock := int64(-1), int64(100000001), int64(1000001)
	for _, patch := range []domain.ProductPatch{
		{}, {SKU: &blank}, {SKU: &long}, {Name: &blank}, {Price: &negative}, {Price: &largePrice}, {Stock: &negative}, {Stock: &largeStock},
	} {
		if _, err := u.Update(ctx, 1, patch); !errors.Is(err, domain.ErrInvalidProductInput) {
			t.Fatalf("expected invalid patch: %v", err)
		}
	}
	for _, id := range []int64{0, -1, 2147483648} {
		if err := u.Delete(ctx, id); !errors.Is(err, domain.ErrInvalidProductInput) {
			t.Fatalf("invalid IDs accepted: %v", err)
		}
	}
}

func TestMutationsNormalizeAndForward(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	want := domain.NewProduct(1, 7, "SKU", "商品", 0, 0, time.Now(), time.Now())
	sentinel := errors.New("storage failure")
	for _, wantErr := range []error{nil, sentinel, context.Canceled} {
		u := usecase.NewMutations(writerStub{
			create: func(gotCtx context.Context, owner int64, input domain.ProductInput) (domain.Product, error) {
				if gotCtx != ctx || owner != 7 || input.SKU != "SKU" || input.Name != "商品" || input.Price != 100000000 || input.Stock != 1000000 {
					t.Fatalf("unexpected create input: %+v", input)
				}
				return want, wantErr
			},
			update: func(gotCtx context.Context, id int64, patch domain.ProductPatch) (domain.Product, error) {
				if gotCtx != ctx || id != 1 || patch.SKU != nil || patch.Stock != nil || patch.Name == nil || *patch.Name != "商品" || patch.Price == nil || *patch.Price != 0 {
					t.Fatalf("unexpected patch: %+v", patch)
				}
				return want, wantErr
			},
			delete: func(gotCtx context.Context, id int64) error {
				if gotCtx != ctx || id != 1 {
					t.Fatal("delete arguments were not forwarded")
				}
				return wantErr
			},
		})
		got, err := u.Create(ctx, 7, domain.ProductInput{SKU: " SKU ", Name: " 商品 ", Price: 100000000, Stock: 1000000})
		if got != want || !errors.Is(err, wantErr) {
			t.Fatalf("create: got=%v, err=%v", got, err)
		}
		name, zero := " 商品 ", int64(0)
		got, err = u.Update(ctx, 1, domain.ProductPatch{Name: &name, Price: &zero})
		if got != want || !errors.Is(err, wantErr) || name != " 商品 " {
			t.Fatalf("update: got=%v, err=%v", got, err)
		}
		if err := u.Delete(ctx, 1); !errors.Is(err, wantErr) {
			t.Fatalf("delete: %v", err)
		}
	}
}
