package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// --- Favorite ---

type Favorite struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	ImageURL    string `json:"imageUrl"`
	SortOrder   int    `json:"sortOrder"`
	CreatedAt   string `json:"createdAt"`
}

type FavoriteCreate struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	ImageURL    string `json:"imageUrl"`
	SortOrder   int    `json:"sortOrder"`
}

const favoriteSelectCols = `id, coalesce(title,''), coalesce(description,''), image_url, sort_order, created_at`

func scanFavorite(row pgx.Row) (*Favorite, error) {
	var f Favorite
	var createdAt time.Time
	err := row.Scan(&f.ID, &f.Title, &f.Description, &f.ImageURL, &f.SortOrder, &createdAt)
	if err != nil {
		return nil, err
	}
	f.CreatedAt = createdAt.Format(time.RFC3339)
	return &f, nil
}

func ListFavorites(ctx context.Context, db *pgxpool.Pool) ([]Favorite, error) {
	rows, err := db.Query(ctx,
		`SELECT `+favoriteSelectCols+`
		 FROM favorites
		 ORDER BY sort_order ASC, created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var favorites []Favorite
	for rows.Next() {
		f, err := scanFavorite(rows)
		if err != nil {
			return nil, err
		}
		favorites = append(favorites, *f)
	}
	if favorites == nil {
		favorites = []Favorite{}
	}
	return favorites, rows.Err()
}

func CreateFavorite(ctx context.Context, db *pgxpool.Pool, c *FavoriteCreate) (*Favorite, error) {
	return scanFavorite(db.QueryRow(ctx,
		`INSERT INTO favorites (title, description, image_url, sort_order)
		 VALUES ($1, $2, $3, $4)
		 RETURNING `+favoriteSelectCols,
		c.Title, c.Description, c.ImageURL, c.SortOrder,
	))
}

func DeleteFavorite(ctx context.Context, db *pgxpool.Pool, id string) error {
	_, err := db.Exec(ctx, `DELETE FROM favorites WHERE id = $1`, id)
	return err
}

func GetFavoriteImageURL(ctx context.Context, db *pgxpool.Pool, id string) (string, error) {
	var url string
	err := db.QueryRow(ctx, `SELECT image_url FROM favorites WHERE id = $1`, id).Scan(&url)
	return url, err
}
