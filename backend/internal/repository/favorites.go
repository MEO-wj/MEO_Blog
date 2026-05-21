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
	Width       int    `json:"width"`
	Height      int    `json:"height"`
	PosX        *int   `json:"posX"`
	PosY        *int   `json:"posY"`
	SortOrder   int    `json:"sortOrder"`
	CreatedAt   string `json:"createdAt"`
}

type FavoriteCreate struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	ImageURL    string `json:"imageUrl"`
	Width       int    `json:"width"`
	Height      int    `json:"height"`
	SortOrder   int    `json:"sortOrder"`
}

const favoriteSelectCols = `id, coalesce(title,''), coalesce(description,''), image_url, width, height, pos_x, pos_y, sort_order, created_at`

func scanFavorite(row pgx.Row) (*Favorite, error) {
	var f Favorite
	var createdAt time.Time
	err := row.Scan(&f.ID, &f.Title, &f.Description, &f.ImageURL, &f.Width, &f.Height, &f.PosX, &f.PosY, &f.SortOrder, &createdAt)
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
		`INSERT INTO favorites (title, description, image_url, width, height, sort_order)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING `+favoriteSelectCols,
		c.Title, c.Description, c.ImageURL, c.Width, c.Height, c.SortOrder,
	))
}

func DeleteFavorite(ctx context.Context, db *pgxpool.Pool, id string) error {
	_, err := db.Exec(ctx, `DELETE FROM favorites WHERE id = $1`, id)
	return err
}

func UpdateFavoritePosition(ctx context.Context, db *pgxpool.Pool, id string, posX, posY *int) error {
	_, err := db.Exec(ctx, `UPDATE favorites SET pos_x = $2, pos_y = $3 WHERE id = $1`, id, posX, posY)
	return err
}

func GetFavoriteImageURL(ctx context.Context, db *pgxpool.Pool, id string) (string, error) {
	var url string
	err := db.QueryRow(ctx, `SELECT image_url FROM favorites WHERE id = $1`, id).Scan(&url)
	return url, err
}
