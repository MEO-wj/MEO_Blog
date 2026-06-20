package repository

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SitePermissions struct {
	GitHub    bool `json:"github"`
	Resume    bool `json:"resume"`
	Guestbook bool `json:"guestbook"`
	Blog      bool `json:"blog"`
	Favorites bool `json:"favorites"`
}

func DefaultSitePermissions() *SitePermissions {
	return &SitePermissions{
		GitHub:    true,
		Resume:    true,
		Guestbook: true,
		Blog:      true,
		Favorites: true,
	}
}

func ListSitePermissions(ctx context.Context, db *pgxpool.Pool) (*SitePermissions, error) {
	permissions := DefaultSitePermissions()
	rows, err := db.Query(ctx, `SELECT key, enabled FROM site_permissions`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var key string
		var enabled bool
		if err := rows.Scan(&key, &enabled); err != nil {
			return nil, err
		}
		setSitePermissionValue(permissions, key, enabled)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return permissions, nil
}

func UpdateSitePermissions(ctx context.Context, db *pgxpool.Pool, permissions *SitePermissions) (*SitePermissions, error) {
	tx, err := db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	values := map[string]bool{
		"github":    permissions.GitHub,
		"resume":    permissions.Resume,
		"guestbook": permissions.Guestbook,
		"blog":      permissions.Blog,
		"favorites": permissions.Favorites,
	}

	for key, enabled := range values {
		if _, err := tx.Exec(ctx,
			`INSERT INTO site_permissions (key, enabled, updated_at)
			 VALUES ($1, $2, now())
			 ON CONFLICT (key) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()`,
			key, enabled,
		); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return ListSitePermissions(ctx, db)
}

func IsSitePermissionEnabled(ctx context.Context, db *pgxpool.Pool, key string) (bool, error) {
	var enabled bool
	err := db.QueryRow(ctx,
		`SELECT enabled FROM site_permissions WHERE key = $1`,
		key,
	).Scan(&enabled)
	if err == pgx.ErrNoRows {
		return true, nil
	}
	if err != nil {
		return false, err
	}
	return enabled, nil
}

func setSitePermissionValue(permissions *SitePermissions, key string, enabled bool) {
	switch key {
	case "github":
		permissions.GitHub = enabled
	case "resume":
		permissions.Resume = enabled
	case "guestbook":
		permissions.Guestbook = enabled
	case "blog":
		permissions.Blog = enabled
	case "favorites":
		permissions.Favorites = enabled
	}
}
