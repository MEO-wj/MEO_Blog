package http

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type etagFn func(ctx context.Context, db *pgxpool.Pool) (string, error)

// etagCacheEntry holds a cached ETag value with expiry.
type etagCacheEntry struct {
	etag    string
	expires time.Time
}

var (
	etagCache   = make(map[string]*etagCacheEntry)
	etagCacheMu sync.RWMutex
)

const etagCacheTTL = 5 * time.Second

func getCachedETag(key string) (string, bool) {
	etagCacheMu.RLock()
	defer etagCacheMu.RUnlock()
	if e, ok := etagCache[key]; ok && time.Now().Before(e.expires) {
		return e.etag, true
	}
	return "", false
}

func setCachedETag(key, etag string) {
	etagCacheMu.Lock()
	defer etagCacheMu.Unlock()
	etagCache[key] = &etagCacheEntry{etag: etag, expires: time.Now().Add(etagCacheTTL)}
}

// ETagMiddleware computes an ETag from the provided function and returns 304
// when the client's If-None-Match header matches. Results are cached for a
// few seconds to avoid hitting the database on every request.
func ETagMiddleware(fn etagFn, db *pgxpool.Pool, cacheKey string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			etag, ok := getCachedETag(cacheKey)
			if !ok {
				var err error
				etag, err = fn(r.Context(), db)
				if err != nil {
					next.ServeHTTP(w, r)
					return
				}
				setCachedETag(cacheKey, etag)
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
	var count, ts int64
	err := db.QueryRow(ctx,
		`SELECT count(*), COALESCE(EXTRACT(EPOCH FROM max(updated_at))::bigint, 0) FROM projects`,
	).Scan(&count, &ts)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`W/"projects-%d-%d"`, count, ts), nil
}

func computeProjectDetailETag(ctx context.Context, db *pgxpool.Pool) (string, error) {
	var count, ts int64
	err := db.QueryRow(ctx,
		`SELECT count(*), COALESCE(EXTRACT(EPOCH FROM max(updated_at))::bigint, 0) FROM projects`,
	).Scan(&count, &ts)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`W/"project-detail-%d-%d"`, count, ts), nil
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

func computePermissionsETag(ctx context.Context, db *pgxpool.Pool) (string, error) {
	var fingerprint string
	err := db.QueryRow(ctx,
		`SELECT COALESCE(md5(string_agg(key || ':' || enabled::text || ':' || EXTRACT(EPOCH FROM updated_at)::bigint::text, ',' ORDER BY key)), '')
		 FROM site_permissions`,
	).Scan(&fingerprint)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`W/"permissions-%s"`, fingerprint), nil
}

func computeFavoritesETag(ctx context.Context, db *pgxpool.Pool) (string, error) {
	var count, ts int64
	var fingerprint string
	err := db.QueryRow(ctx,
		`SELECT count(*),
			COALESCE(EXTRACT(EPOCH FROM max(created_at))::bigint, 0),
			COALESCE(md5(string_agg(id::text || ':' || COALESCE(pos_x::text, '') || ':' || COALESCE(pos_y::text, ''), ',' ORDER BY id)), '')
		 FROM favorites`,
	).Scan(&count, &ts, &fingerprint)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`W/"favorites-%d-%d-%s"`, count, ts, fingerprint), nil
}

func computePartnersETag(ctx context.Context, db *pgxpool.Pool) (string, error) {
	var count, ts int64
	err := db.QueryRow(ctx,
		`SELECT count(*), COALESCE(EXTRACT(EPOCH FROM max(updated_at))::bigint, 0) FROM partners`,
	).Scan(&count, &ts)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`W/"partners-%d-%d"`, count, ts), nil
}

func computeBlogCategoriesETag(ctx context.Context, db *pgxpool.Pool) (string, error) {
	var count, ts int64
	err := db.QueryRow(ctx,
		`SELECT count(*), COALESCE(EXTRACT(EPOCH FROM max(updated_at))::bigint, 0) FROM blog_categories`,
	).Scan(&count, &ts)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`W/"blog-cats-%d-%d"`, count, ts), nil
}

func computeBlogPostsETag(ctx context.Context, db *pgxpool.Pool) (string, error) {
	var count, ts int64
	err := db.QueryRow(ctx,
		`SELECT count(*), COALESCE(EXTRACT(EPOCH FROM max(updated_at))::bigint, 0) FROM posts`,
	).Scan(&count, &ts)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`W/"blog-posts-%d-%d"`, count, ts), nil
}

func computeBlogPostDetailETag(ctx context.Context, db *pgxpool.Pool) (string, error) {
	// Detail uses same global ETag as list — both invalidate when any post changes.
	// Separate cache key ensures they don't collide in the 5s in-memory cache.
	return computeBlogPostsETag(ctx, db)
}

func computeGuestbookETag(ctx context.Context, db *pgxpool.Pool) (string, error) {
	var count, ts int64
	err := db.QueryRow(ctx,
		`SELECT count(*), COALESCE(EXTRACT(EPOCH FROM max(created_at))::bigint, 0) FROM guestbook_messages`,
	).Scan(&count, &ts)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`W/"guestbook-%d-%d"`, count, ts), nil
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

// InvalidateETagCache forces re-computation of a specific ETag on next request.
func InvalidateETagCache(key string) {
	etagCacheMu.Lock()
	defer etagCacheMu.Unlock()
	delete(etagCache, key)
}
