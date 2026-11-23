package repo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/hsmt-T/systems-seminar-research2/product-service/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type getRepo struct {
	db *pgxpool.Pool
}

func NewGetRepo(db *pgxpool.Pool) domain.ProductRepository {
	return &getRepo{db: db}
}

func (r *getRepo) FindByID(ctx context.Context, id int64) (domain.Product, error) {
	const query = `
		SELECT id, owner_id, sku, name, price, stock, created_at, updated_at
		FROM products
		WHERE id = $1 AND deleted_at IS NULL
	`

	var productID, ownerID, price, stock int64
	var sku, name string
	var createdAt, updatedAt time.Time

	err := r.db.QueryRow(ctx, query, id).Scan(
		&productID,
		&ownerID,
		&sku,
		&name,
		&price,
		&stock,
		&createdAt,
		&updatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("product %d: %w", id, domain.ErrProductNotFound)
	}
	if err != nil {
		return nil, fmt.Errorf("find product %d: %w", id, err)
	}

	return domain.NewProduct(productID, ownerID, sku, name, price, stock, createdAt, updatedAt), nil
}
