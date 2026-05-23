package middleware

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/meo-blog/backend/internal/auth"
	"github.com/meo-blog/backend/internal/config"
	"github.com/redis/go-redis/v9"
)

type adminContextKey struct{}

func RequireAdmin(cfg *config.Config, rdb *redis.Client) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie("meo_admin_session")
			if err != nil || !auth.VerifySession(cfg.JWTSecret, cookie.Value) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(map[string]interface{}{
					"error": map[string]string{
						"code":    "UNAUTHORIZED",
						"message": "admin session required",
					},
				})
				return
			}

			// Check if token has been revoked
			if auth.IsTokenBlacklisted(r.Context(), rdb, cookie.Value) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(map[string]interface{}{
					"error": map[string]string{
						"code":    "UNAUTHORIZED",
						"message": "admin session required",
					},
				})
				return
			}

			ctx := context.WithValue(r.Context(), adminContextKey{}, "admin")
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
