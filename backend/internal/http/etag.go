package http

import (
	"context"
	"fmt"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

type etagFn func(ctx context.Context, db *pgxpool.Pool) (string, error)

// ETagMiddleware computes an ETag from the provided function and returns 304
// when the client's If-None-Match header matches.
func ETagMiddleware(fn etagFn, db *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			etag, err := fn(r.Context(), db)
			if err != nil {
				// If ETag computation fails, just serve normally
				next.ServeHTTP(w, r)
				return
			}

			w.Header().Set("ETag", etag)
			w.Header().Set("Cache-Control", "private, max-age=0, must-revalidate")

			if match := r.Header.Get("If-None-Match"); match == etag {
				w.WriteHeader(http.StatusNotModified)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func computeProjectsETag(ctx context.Context, db *pgxpool.Pool) (string, error) {
	var ts int64
	err := db.QueryRow(ctx,
		`SELECT COALESCE(EXTRACT(EPOCH FROM max(updated_at))::bigint, 0) FROM projects`,
	).Scan(&ts)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`W/"projects-%d"`, ts), nil
}

func computeProjectDetailETag(ctx context.Context, db *pgxpool.Pool) (string, error) {
	var ts int64
	err := db.QueryRow(ctx,
		`SELECT COALESCE(EXTRACT(EPOCH FROM max(updated_at))::bigint, 0) FROM projects`,
	).Scan(&ts)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`W/"project-detail-%d"`, ts), nil
}

func computeProfileETag(ctx context.Context, db *pgxpool.Pool) (string, error) {
	var ts int64
	err := db.QueryRow(ctx,
		`SELECT COALESCE(EXTRACT(EPOCH FROM updated_at)::bigint, 0) FROM admin_profile LIMIT 1`,
	).Scan(&ts)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`W/"profile-%d"`, ts), nil
}

func computeFavoritesETag(ctx context.Context, db *pgxpool.Pool) (string, error) {
	var ts int64
	err := db.QueryRow(ctx,
		`SELECT COALESCE(EXTRACT(EPOCH FROM max(created_at))::bigint, 0) FROM favorites`,
	).Scan(&ts)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`W/"favorites-%d"`, ts), nil
}

func computeBlogCategoriesETag(ctx context.Context, db *pgxpool.Pool) (string, error) {
	var ts int64
	err := db.QueryRow(ctx,
		`SELECT COALESCE(EXTRACT(EPOCH FROM max(updated_at))::bigint, 0) FROM blog_categories`,
	).Scan(&ts)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`W/"blog-cats-%d"`, ts), nil
}

func computeBlogPostsETag(ctx context.Context, db *pgxpool.Pool) (string, error) {
	var ts int64
	err := db.QueryRow(ctx,
		`SELECT COALESCE(EXTRACT(EPOCH FROM max(updated_at))::bigint, 0) FROM posts`,
	).Scan(&ts)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`W/"blog-posts-%d"`, ts), nil
}

func computeGuestbookETag(ctx context.Context, db *pgxpool.Pool) (string, error) {
	var ts int64
	err := db.QueryRow(ctx,
		`SELECT COALESCE(EXTRACT(EPOCH FROM max(created_at))::bigint, 0) FROM guestbook_messages`,
	).Scan(&ts)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`W/"guestbook-%d"`, ts), nil
}

func computeResumeETag(ctx context.Context, db *pgxpool.Pool) (string, error) {
	var ts int64
	err := db.QueryRow(ctx,
		`SELECT COALESCE(EXTRACT(EPOCH FROM updated_at)::bigint, 0) FROM admin_profile LIMIT 1`,
	).Scan(&ts)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`W/"resume-%d"`, ts), nil
}
