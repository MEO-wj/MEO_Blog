package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/meo-blog/backend/internal/config"
	"github.com/meo-blog/backend/internal/middleware"
	"github.com/redis/go-redis/v9"
)

func NewRouter(cfg *config.Config, db *pgxpool.Pool, rdb *redis.Client) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.CORS(cfg))
	r.Use(middleware.Logger)
	r.Use(middleware.Recovery)

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/health", healthHandler)
		r.Get("/favicon", faviconHandler(db, cfg))
		r.Post("/admin/login", adminLoginHandler(cfg))
		r.Get("/admin/session", adminSessionHandler(cfg, rdb))
		r.Post("/admin/logout", adminLogoutHandler(cfg, rdb))
		r.With(ETagMiddleware(computePermissionsETag, db, "permissions")).Get("/permissions", publicPermissionsHandler(db))

		r.Get("/projects/summary", publicProjectSummariesHandler(db))
		r.Get("/project-icons/{id}", projectIconHandler(db))
		r.With(ETagMiddleware(computeProjectsETag, db, "projects")).Get("/projects", publicProjectsHandler(db))
		r.With(ETagMiddleware(computeProjectDetailETag, db, "project-detail")).Get("/projects/{slug}", getProjectBySlugHandler(db))
		r.With(ETagMiddleware(computeProfileETag, db, "profile")).Get("/profile", publicProfileHandler(db))

		r.With(requirePublicPermission(cfg, db, rdb, "blog"), ETagMiddleware(computeBlogCategoriesETag, db, "blog-cats")).Get("/blog/categories", listBlogCategoriesHandler(db))
		r.With(requirePublicPermission(cfg, db, rdb, "blog"), ETagMiddleware(computeBlogPostsETag, db, "blog-posts")).Get("/blog/posts", listBlogPostsHandler(db))
		r.With(requirePublicPermission(cfg, db, rdb, "blog"), ETagMiddleware(computeBlogPostDetailETag, db, "blog-post-detail")).Get("/blog/posts/{id}", getBlogPostHandler(db))
		r.With(requirePublicPermission(cfg, db, rdb, "blog")).Get("/blog/posts/{id}/comments", listBlogCommentsHandler(db))
		r.With(requirePublicPermission(cfg, db, rdb, "blog"), middleware.RateLimit(2, 10)).Post("/blog/posts/{id}/comments", createBlogCommentHandler(db))

		r.With(requirePublicPermission(cfg, db, rdb, "guestbook"), ETagMiddleware(computeGuestbookETag, db, "guestbook")).Get("/guestbook/messages", listGuestbookMessagesHandler(db))
		r.With(requirePublicPermission(cfg, db, rdb, "guestbook"), middleware.RateLimit(2, 10)).Post("/guestbook/messages", createGuestbookMessageHandler(db, cfg))
		r.With(requirePublicPermission(cfg, db, rdb, "guestbook"), middleware.RateLimit(2, 10)).Post("/guestbook/messages/{id}/replies", userReplyGuestbookHandler(db, cfg))
		r.With(requirePublicPermission(cfg, db, rdb, "guestbook"), middleware.RateLimit(2, 10)).Delete("/guestbook/messages/{id}", userDeleteGuestbookMessageHandler(db, cfg))

		r.With(requirePublicPermission(cfg, db, rdb, "resume"), ETagMiddleware(computeResumeETag, db, "resume")).Get("/resume", getResumeHandler(db))
		r.With(requirePublicPermission(cfg, db, rdb, "favorites"), ETagMiddleware(computeFavoritesETag, db, "favorites")).Get("/favorites", listFavoritesHandler(db))
		r.With(ETagMiddleware(computePartnersETag, db, "partners")).Get("/partners", listPartnersHandler(db))

		r.With(requirePublicPermission(cfg, db, rdb, "github")).Get("/github/{username}", githubUserHandler(cfg))
		r.With(requirePublicPermission(cfg, db, rdb, "github")).Get("/github/{username}/contributions", githubContributionsHandler(cfg))

		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAdmin(cfg, rdb))

			r.Put("/admin/permissions", adminUpdatePermissionsHandler(db))

			r.Get("/admin/profile", getProfileHandler(db))
			r.Put("/admin/profile", updateProfileHandler(db))
			r.Post("/admin/avatar", uploadAvatarHandler(db, cfg))
			r.Post("/admin/resume", uploadResumeHandler(db, cfg))

			r.Post("/admin/favorites", adminCreateFavoriteHandler(db, cfg))
			r.Patch("/admin/favorites/{id}/position", adminUpdateFavoritePositionHandler(db))
			r.Delete("/admin/favorites/{id}", adminDeleteFavoriteHandler(db, cfg))

			r.Post("/admin/partners", adminCreatePartnerHandler(db, cfg))
			r.Put("/admin/partners/{id}", adminUpdatePartnerHandler(db))
			r.Post("/admin/partners/{id}/avatar", adminUploadPartnerAvatarHandler(db, cfg))
			r.Delete("/admin/partners/{id}", adminDeletePartnerHandler(db, cfg))

			r.Post("/admin/projects", createProjectHandler(db))
			r.Put("/admin/projects/reorder", adminReorderProjectsHandler(db))
			r.Put("/admin/projects/{id}", updateProjectHandler(db))
			r.Delete("/admin/projects/{id}", deleteProjectHandler(db, cfg))
			r.Post("/admin/projects/{id}/icon", uploadProjectIconHandler(db, cfg))

			r.Get("/admin/blog/posts", adminListBlogPostsHandler(db))
			r.Post("/admin/blog/categories", adminCreateBlogCategoryHandler(db))
			r.Put("/admin/blog/categories/{id}", adminUpdateBlogCategoryHandler(db))
			r.Delete("/admin/blog/categories/{id}", adminDeleteBlogCategoryHandler(db))
			r.Post("/admin/blog/posts", adminCreateBlogPostHandler(db))
			r.Put("/admin/blog/posts/{id}", adminUpdateBlogPostHandler(db))
			r.Delete("/admin/blog/posts/{id}", adminDeleteBlogPostHandler(db))
			r.Get("/admin/blog/comments/moderation", adminBlogCommentModerationHandler(db))
			r.Post("/admin/blog/comments/{id}/publish", adminPublishBlogCommentHandler(db))
			r.Delete("/admin/blog/comments/{id}", adminDeleteBlogCommentHandler(db))

			r.Get("/admin/guestbook/moderation", adminGuestbookModerationHandler(db))
			r.Post("/admin/guestbook/messages/{id}/publish", adminPublishGuestbookMessageHandler(db))
			r.Post("/admin/guestbook/messages/{id}/replies", adminReplyGuestbookHandler(db))
			r.Delete("/admin/guestbook/messages/{id}", adminDeleteGuestbookMessageHandler(db))
			r.Delete("/admin/guestbook/replies/{id}", adminDeleteGuestbookReplyHandler(db))
		})
	})

	r.Get("/uploads/*", serveUploadHandler(cfg))

	return r
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	RespondOK(w, map[string]string{"status": "ok"})
}
