package http

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/meo-blog/backend/internal/repository"
)

// --- Public handlers ---

func listBlogCategoriesHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		categories, err := repository.ListBlogCategories(r.Context(), db)
		if err != nil {
			RespondError(w, "LIST_FAILED", "failed to list categories", http.StatusInternalServerError)
			return
		}
		RespondOK(w, categories)
	}
}

func listBlogPostsHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		categorySlug := r.URL.Query().Get("category")
		categoryID := ""
		if categorySlug != "" {
			cats, err := repository.ListBlogCategories(r.Context(), db)
			if err != nil {
				RespondError(w, "LIST_FAILED", "failed to list categories", http.StatusInternalServerError)
				return
			}
			for _, c := range cats {
				if c.Slug == categorySlug {
					categoryID = c.ID
					break
				}
			}
			if categoryID == "" {
				RespondError(w, "CATEGORY_NOT_FOUND", "category not found", http.StatusNotFound)
				return
			}
		}
		posts, err := repository.ListBlogPosts(r.Context(), db, categoryID, false)
		if err != nil {
			slog.Error("list blog posts failed", "error", err, "categoryID", categoryID)
			RespondError(w, "LIST_FAILED", "failed to list posts", http.StatusInternalServerError)
			return
		}
		RespondOK(w, posts)
	}
}

func getBlogPostHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		post, err := repository.GetBlogPost(r.Context(), db, id)
		if err != nil {
			RespondError(w, "POST_NOT_FOUND", "post not found", http.StatusNotFound)
			return
		}
		RespondOK(w, post)
	}
}

func listBlogCommentsHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		postID := chi.URLParam(r, "id")
		comments, err := repository.ListBlogComments(r.Context(), db, postID)
		if err != nil {
			RespondError(w, "LIST_FAILED", "failed to list comments", http.StatusInternalServerError)
			return
		}
		RespondOK(w, comments)
	}
}

func createBlogCommentHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		postID := chi.URLParam(r, "id")
		r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
		var c repository.BlogCommentCreate
		if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
			RespondError(w, "INVALID_JSON", "invalid request body", http.StatusBadRequest)
			return
		}
		c.PostID = postID
		if c.AuthorName == "" || c.Content == "" {
			RespondError(w, "VALIDATION_ERROR", "author name and content are required", http.StatusBadRequest)
			return
		}
		if len(c.AuthorName) > 50 {
			RespondError(w, "VALIDATION_ERROR", "author name too long (max 50)", http.StatusBadRequest)
			return
		}
		if len(c.Content) > 2000 {
			RespondError(w, "VALIDATION_ERROR", "content too long (max 2000)", http.StatusBadRequest)
			return
		}
		comment, err := repository.CreateBlogComment(r.Context(), db, &c)
		if err != nil {
			RespondError(w, "CREATE_FAILED", "failed to create comment", http.StatusInternalServerError)
			return
		}
		RespondOK(w, comment)
	}
}

// --- Admin handlers ---

func adminCreateBlogCategoryHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
		var c repository.BlogCategoryCreate
		if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
			RespondError(w, "INVALID_JSON", "invalid request body", http.StatusBadRequest)
			return
		}
		if c.Name == "" || c.Slug == "" {
			RespondError(w, "VALIDATION_ERROR", "name and slug are required", http.StatusBadRequest)
			return
		}
		if !isValidSlug(c.Slug) {
			RespondError(w, "VALIDATION_ERROR", "slug must be lowercase alphanumeric with hyphens", http.StatusBadRequest)
			return
		}
		category, err := repository.CreateBlogCategory(r.Context(), db, &c)
		if err != nil {
			slog.Error("create blog category failed", "error", err)
			RespondError(w, "CREATE_FAILED", "failed to create category", http.StatusInternalServerError)
			return
		}
		InvalidateETagCache("blog-cats")
		InvalidateETagCache("blog-posts")
		InvalidateETagCache("blog-post-detail")
		RespondOK(w, category)
	}
}

func adminUpdateBlogCategoryHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
		var u repository.BlogCategoryUpdate
		if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
			RespondError(w, "INVALID_JSON", "invalid request body", http.StatusBadRequest)
			return
		}
		if u.Slug != nil && !isValidSlug(*u.Slug) {
			RespondError(w, "VALIDATION_ERROR", "slug must be lowercase alphanumeric with hyphens", http.StatusBadRequest)
			return
		}
		category, err := repository.UpdateBlogCategory(r.Context(), db, id, &u)
		if err != nil {
			RespondError(w, "UPDATE_FAILED", "failed to update category", http.StatusInternalServerError)
			return
		}
		InvalidateETagCache("blog-cats")
		InvalidateETagCache("blog-posts")
		InvalidateETagCache("blog-post-detail")
		RespondOK(w, category)
	}
}

func adminDeleteBlogCategoryHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		if err := repository.DeleteBlogCategory(r.Context(), db, id); err != nil {
			RespondError(w, "DELETE_FAILED", "failed to delete category", http.StatusInternalServerError)
			return
		}
		InvalidateETagCache("blog-cats")
		InvalidateETagCache("blog-posts")
		InvalidateETagCache("blog-post-detail")
		RespondOK(w, map[string]string{"deleted": id})
	}
}

func adminCreateBlogPostHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		var c repository.BlogPostCreate
		if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
			RespondError(w, "INVALID_JSON", "invalid request body", http.StatusBadRequest)
			return
		}
		if c.Title == "" || c.Slug == "" {
			RespondError(w, "VALIDATION_ERROR", "title and slug are required", http.StatusBadRequest)
			return
		}
		if !isValidSlug(c.Slug) {
			RespondError(w, "VALIDATION_ERROR", "slug must be lowercase alphanumeric with hyphens", http.StatusBadRequest)
			return
		}
		post, err := repository.CreateBlogPost(r.Context(), db, &c)
		if err != nil {
			slog.Error("create blog post failed", "error", err)
			RespondError(w, "CREATE_FAILED", "failed to create post", http.StatusInternalServerError)
			return
		}
		InvalidateETagCache("blog-posts")
		InvalidateETagCache("blog-post-detail")
		InvalidateETagCache("blog-cats")
		RespondOK(w, post)
	}
}

func adminUpdateBlogPostHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		var u repository.BlogPostUpdate
		if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
			RespondError(w, "INVALID_JSON", "invalid request body", http.StatusBadRequest)
			return
		}
		if u.Slug != nil && !isValidSlug(*u.Slug) {
			RespondError(w, "VALIDATION_ERROR", "slug must be lowercase alphanumeric with hyphens", http.StatusBadRequest)
			return
		}
		post, err := repository.UpdateBlogPost(r.Context(), db, id, &u)
		if err != nil {
			RespondError(w, "UPDATE_FAILED", "failed to update post", http.StatusInternalServerError)
			return
		}
		InvalidateETagCache("blog-posts")
		InvalidateETagCache("blog-post-detail")
		InvalidateETagCache("blog-cats")
		RespondOK(w, post)
	}
}

func adminDeleteBlogPostHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		if err := repository.DeleteBlogPost(r.Context(), db, id); err != nil {
			RespondError(w, "DELETE_FAILED", "failed to delete post", http.StatusInternalServerError)
			return
		}
		InvalidateETagCache("blog-posts")
		InvalidateETagCache("blog-post-detail")
		InvalidateETagCache("blog-cats")
		RespondOK(w, map[string]string{"deleted": id})
	}
}

func adminListBlogPostsHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		categorySlug := r.URL.Query().Get("category")
		categoryID := ""
		if categorySlug != "" {
			cats, err := repository.ListBlogCategories(r.Context(), db)
			if err != nil {
				slog.Error("admin list blog posts: list categories failed", "error", err)
				RespondError(w, "LIST_FAILED", "failed to list categories", http.StatusInternalServerError)
				return
			}
			for _, c := range cats {
				if c.Slug == categorySlug {
					categoryID = c.ID
					break
				}
			}
		}
		posts, err := repository.ListBlogPosts(r.Context(), db, categoryID, true)
		if err != nil {
			slog.Error("admin list blog posts failed", "error", err, "categoryID", categoryID)
			RespondError(w, "LIST_FAILED", "failed to list posts", http.StatusInternalServerError)
			return
		}
		RespondOK(w, posts)
	}
}

func adminBlogCommentModerationHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		queue, err := repository.GetBlogCommentModerationQueue(r.Context(), db)
		if err != nil {
			slog.Error("list blog comment moderation queue failed", "error", err)
			RespondError(w, "LIST_FAILED", "failed to list comment moderation queue", http.StatusInternalServerError)
			return
		}
		RespondOK(w, queue)
	}
}

func adminPublishBlogCommentHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		comment, err := repository.PublishBlogComment(r.Context(), db, id)
		if err != nil {
			RespondError(w, "UPDATE_FAILED", "failed to publish comment", http.StatusInternalServerError)
			return
		}
		RespondOK(w, comment)
	}
}

func adminDeleteBlogCommentHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		if err := repository.DeleteBlogComment(r.Context(), db, id); err != nil {
			RespondError(w, "DELETE_FAILED", "failed to delete comment", http.StatusInternalServerError)
			return
		}
		RespondOK(w, map[string]string{"deleted": id})
	}
}
