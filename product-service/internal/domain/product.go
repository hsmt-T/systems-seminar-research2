package domain

import (
	"context"
	"errors"
	"time"
)

var ErrProductNotFound = errors.New("product not found")
var ErrInvalidProductID = errors.New("product ID must be positive")
var ErrInvalidProductInput = errors.New("invalid product input")
var ErrSKUAlreadyExists = errors.New("SKU already exists")

type Page struct {
	Limit  int64
	Offset int64
}

type ProductInput struct {
	SKU   string
	Name  string
	Price int64
	Stock int64
}

type ProductPatch struct {
	SKU   *string
	Name  *string
	Price *int64
	Stock *int64
}

type ProductWriter interface {
	Create(context.Context, int64, ProductInput) (Product, error)
	Update(context.Context, int64, ProductPatch) (Product, error)
	Delete(context.Context, int64) error
}

type Product interface {
	ID() int64
	OwnerID() int64
	Sku() string
	Name() string
	Price() int64
	Stock() int64
	CreatedAt() time.Time
	UpdatedAt() time.Time
}

type product struct {
	id        int64
	ownerID   int64
	sku       string
	name      string
	price     int64
	stock     int64
	createdAt time.Time
	updatedAt time.Time
}

func (p product) ID() int64 { return p.id }

func (p product) OwnerID() int64 { return p.ownerID }

func (p product) Sku() string { return p.sku }

func (p product) Name() string { return p.name }

func (p product) Price() int64 { return p.price }

func (p product) Stock() int64 { return p.stock }

func (p product) CreatedAt() time.Time { return p.createdAt }

func (p product) UpdatedAt() time.Time { return p.updatedAt }

func NewProduct(id, ownerID int64, sku, name string, price, stock int64, createdAt, updatedAt time.Time) Product {
	return &product{
		id:        id,
		ownerID:   ownerID,
		sku:       sku,
		name:      name,
		price:     price,
		stock:     stock,
		createdAt: createdAt,
		updatedAt: updatedAt,
	}
}

type ProductRepository interface {
	FindByID(ctx context.Context, id int64) (Product, error)
	FindAll(ctx context.Context) ([]Product, error)
	List(ctx context.Context, page Page) ([]Product, error)
}
