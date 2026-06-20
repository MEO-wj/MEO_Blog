package http

import (
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/meo-blog/backend/internal/auth"
	"github.com/meo-blog/backend/internal/config"
	"github.com/meo-blog/backend/internal/repository"
	"github.com/redis/go-redis/v9"
)

func publicPermissionsHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		permissions, err := repository.ListSitePermissions(r.Context(), db)
		if err != nil {
			RespondError(w, "LIST_FAILED", "failed to list permissions", http.StatusInternalServerError)
			return
		}
		RespondOK(w, permissions)
	}
}

func adminUpdatePermissionsHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
		var permissions repository.SitePermissions
		if err := json.NewDecoder(r.Body).Decode(&permissions); err != nil {
			RespondError(w, "INVALID_JSON", "invalid request body", http.StatusBadRequest)
			return
		}
		updated, err := repository.UpdateSitePermissions(r.Context(), db, &permissions)
		if err != nil {
			RespondError(w, "UPDATE_FAILED", "failed to update permissions", http.StatusInternalServerError)
			return
		}
		InvalidateETagCache("permissions")
		InvalidateETagCache("github")
		InvalidateETagCache("resume")
		InvalidateETagCache("guestbook")
		InvalidateETagCache("blog-cats")
		InvalidateETagCache("blog-posts")
		InvalidateETagCache("blog-post-detail")
		InvalidateETagCache("favorites")
		RespondOK(w, updated)
	}
}

func requirePublicPermission(cfg *config.Config, db *pgxpool.Pool, rdb *redis.Client, key string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			enabled, err := repository.IsSitePermissionEnabled(r.Context(), db, key)
			if err != nil {
				RespondError(w, "PERMISSION_CHECK_FAILED", "failed to check permission", http.StatusInternalServerError)
				return
			}
			if !enabled && !isAdminRequest(cfg, rdb, r) {
				RespondError(w, "ENTRY_CLOSED", "this entry is currently closed", http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func isAdminRequest(cfg *config.Config, rdb *redis.Client, r *http.Request) bool {
	cookie, err := r.Cookie("meo_admin_session")
	if err != nil || !auth.VerifySession(cfg.JWTSecret, cookie.Value) {
		return false
	}
	return !auth.IsTokenBlacklisted(r.Context(), rdb, cookie.Value)
}
