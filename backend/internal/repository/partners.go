package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Partner struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	AvatarURL  string `json:"avatarUrl"`
	WebsiteURL string `json:"websiteUrl"`
	SortOrder  int    `json:"sortOrder"`
	CreatedAt  string `json:"createdAt"`
	UpdatedAt  string `json:"updatedAt"`
}

type PartnerCreate struct {
	Name       string `json:"name"`
	AvatarURL  string `json:"avatarUrl"`
	WebsiteURL string `json:"websiteUrl"`
}

type PartnerUpdate struct {
	Name       *string `json:"name"`
	WebsiteURL *string `json:"websiteUrl"`
}

const partnerSelectCols = `id, name, avatar_url, coalesce(website_url,''), sort_order, created_at, updated_at`

func scanPartner(row pgx.Row) (*Partner, error) {
	var p Partner
	var createdAt, updatedAt time.Time
	err := row.Scan(&p.ID, &p.Name, &p.AvatarURL, &p.WebsiteURL, &p.SortOrder, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}
	p.CreatedAt = createdAt.Format(time.RFC3339)
	p.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &p, nil
}

func ListPartners(ctx context.Context, db *pgxpool.Pool) ([]Partner, error) {
	rows, err := db.Query(ctx,
		`SELECT `+partnerSelectCols+`
		 FROM partners
		 ORDER BY sort_order ASC, created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var partners []Partner
	for rows.Next() {
		p, err := scanPartner(rows)
		if err != nil {
			return nil, err
		}
		partners = append(partners, *p)
	}
	if partners == nil {
		partners = []Partner{}
	}
	return partners, rows.Err()
}

func CreatePartner(ctx context.Context, db *pgxpool.Pool, c *PartnerCreate) (*Partner, error) {
	return scanPartner(db.QueryRow(ctx,
		`INSERT INTO partners (name, avatar_url, website_url, sort_order)
		 VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM partners))
		 RETURNING `+partnerSelectCols,
		c.Name, c.AvatarURL, c.WebsiteURL,
	))
}

func UpdatePartner(ctx context.Context, db *pgxpool.Pool, id string, u *PartnerUpdate) (*Partner, error) {
	return scanPartner(db.QueryRow(ctx,
		`UPDATE partners SET
			name = coalesce($1, name),
			website_url = coalesce($2, website_url),
			updated_at = now()
		 WHERE id = $3
		 RETURNING `+partnerSelectCols,
		u.Name, u.WebsiteURL, id,
	))
}

func UpdatePartnerAvatarURL(ctx context.Context, db *pgxpool.Pool, id string, avatarURL string) error {
	_, err := db.Exec(ctx,
		`UPDATE partners SET avatar_url = $1, updated_at = now() WHERE id = $2`,
		avatarURL, id,
	)
	return err
}

func DeletePartner(ctx context.Context, db *pgxpool.Pool, id string) error {
	_, err := db.Exec(ctx, `DELETE FROM partners WHERE id = $1`, id)
	return err
}

func GetPartnerAvatarURL(ctx context.Context, db *pgxpool.Pool, id string) (string, error) {
	var url string
	err := db.QueryRow(ctx, `SELECT coalesce(avatar_url,'') FROM partners WHERE id = $1`, id).Scan(&url)
	return url, err
}
