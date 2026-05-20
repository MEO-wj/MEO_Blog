package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/meo-blog/backend/internal/config"
	"github.com/meo-blog/backend/internal/middleware"
)

func NewRouter(cfg *config.Config, db *pgxpool.Pool) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.CORS(cfg))
	r.Use(middleware.Logger)
	r.Use(middleware.Recovery)

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/health", healthHandler)
		r.Post("/admin/login", adminLoginHandler(cfg))
		r.Get("/admin/session", adminSessionHandler(cfg))

		r.Get("/projects", publicProjectsHandler(db))

		r.Get("/github/{username}", githubUserHandler(cfg))
		r.Get("/github/{username}/contributions", githubContributionsHandler(cfg))

		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAdmin(cfg))

			r.Get("/admin/profile", getProfileHandler(db))
			r.Put("/admin/profile", updateProfileHandler(db))
			r.Post("/admin/avatar", uploadAvatarHandler(db, cfg))

			r.Post("/admin/projects", createProjectHandler(db))
			r.Put("/admin/projects/{id}", updateProjectHandler(db))
			r.Delete("/admin/projects/{id}", deleteProjectHandler(db, cfg))
			r.Post("/admin/projects/{id}/icon", uploadProjectIconHandler(db, cfg))
		})
	})

	r.Get("/uploads/*", serveUploadHandler(cfg))

	return r
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	RespondOK(w, map[string]string{"status": "ok"})
}
