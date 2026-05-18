package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/meo-blog/backend/internal/config"
	"github.com/meo-blog/backend/internal/middleware"
)

func NewRouter(cfg *config.Config) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.CORS(cfg))
	r.Use(middleware.Logger)
	r.Use(middleware.Recovery)

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/health", healthHandler)
	})

	return r
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	RespondOK(w, map[string]string{"status": "ok"})
}
