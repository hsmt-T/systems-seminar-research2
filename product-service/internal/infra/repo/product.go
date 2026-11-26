package repo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/hsmt-T/systems-seminar-research2/product-service/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type getRepo struct {
	db *pgxpool.Pool
}

func NewGetRepo(db *pgxpool.Pool) *getRepo {
	return &getRepo{db: db}
}

func (r *getRepo) FindAll(ctx context.Context) ([]domain.Product, error) {
	return r.list(ctx, nil, 0)
}

func (r *getRepo) List(ctx context.Context, page domain.Page) ([]domain.Product, error) {
	return r.list(ctx, page.Limit, page.Offset)
}

func (r *getRepo) list(ctx context.Context, limit any, offset int64) ([]domain.Product, error) {
	const query = `
		SELECT id, owner_id, sku, name, price, stock, created_at, updated_at
		FROM products
		WHERE deleted_at IS NULL
		ORDER BY id ASC
		LIMIT $1 OFFSET $2
	`
	rows, err := r.db.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("find all products: %w", err)
	}
	defer rows.Close()

	products := make([]domain.Product, 0)
	for rows.Next() {
		var id, ownerID, price, stock int64
		var sku, name string
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &ownerID, &sku, &name, &price, &stock, &createdAt, &updatedAt); err != nil {
			return nil, fmt.Errorf("scan product: %w", err)
		}
		products = append(products, domain.NewProduct(id, ownerID, sku, name, price, stock, createdAt, updatedAt))
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("find all products: %w", err)
	}
	return products, nil
}

const productColumns = "id, owner_id, sku, name, price, stock, created_at, updated_at"

func scanProduct(row pgx.Row) (domain.Product, error) {
	var id, ownerID, price, stock int64
	var sku, name string
	var createdAt, updatedAt time.Time
	err := row.Scan(&id, &ownerID, &sku, &name, &price, &stock, &createdAt, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrProductNotFound
	}
	if err != nil {
		return nil, productError(err)
	}
	return domain.NewProduct(id, ownerID, sku, name, price, stock, createdAt, updatedAt), nil
}

func productError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return fmt.Errorf("%w: %w", domain.ErrSKUAlreadyExists, err)
	}
	return err
}

func (r *getRepo) Create(ctx context.Context, ownerID int64, input domain.ProductInput) (domain.Product, error) {
	return scanProduct(r.db.QueryRow(ctx, `
		INSERT INTO products (owner_id, sku, name, price, stock)
		VALUES ($1, $2, $3, $4, $5) RETURNING `+productColumns,
		ownerID, input.SKU, input.Name, input.Price, input.Stock))
}

func (r *getRepo) Update(ctx context.Context, id int64, patch domain.ProductPatch) (domain.Product, error) {
	return scanProduct(r.db.QueryRow(ctx, `
		UPDATE products SET sku = COALESCE($2, sku), name = COALESCE($3, name),
		price = COALESCE($4, price), stock = COALESCE($5, stock), updated_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND deleted_at IS NULL
		RETURNING `+productColumns, id, patch.SKU, patch.Name, patch.Price, patch.Stock))
}

func (r *getRepo) Delete(ctx context.Context, id int64) error {
	result, err := r.db.Exec(ctx, `
		UPDATE products SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return domain.ErrProductNotFound
	}
	return nil
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
