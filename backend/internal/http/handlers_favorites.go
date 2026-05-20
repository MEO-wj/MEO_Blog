package http

import (
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/meo-blog/backend/internal/config"
	"github.com/meo-blog/backend/internal/repository"
)

// --- Public handlers ---

func listFavoritesHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		favorites, err := repository.ListFavorites(r.Context(), db)
		if err != nil {
			slog.Error("list favorites failed", "error", err)
			RespondError(w, "LIST_FAILED", "failed to list favorites", http.StatusInternalServerError)
			return
		}
		RespondOK(w, favorites)
	}
}

// --- Admin handlers ---

func adminCreateFavoriteHandler(db *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		url, err := handleFileUpload(r, cfg, 10<<20)
		if err != nil {
			RespondError(w, "UPLOAD_FAILED", err.Error(), http.StatusBadRequest)
			return
		}
		title := r.FormValue("title")
		description := r.FormValue("description")
		fav, err := repository.CreateFavorite(r.Context(), db, &repository.FavoriteCreate{
			Title:       title,
			Description: description,
			ImageURL:    url,
		})
		if err != nil {
			slog.Error("create favorite failed", "error", err)
			RespondError(w, "CREATE_FAILED", "failed to create favorite", http.StatusInternalServerError)
			return
		}
		RespondOK(w, fav)
	}
}

func adminDeleteFavoriteHandler(db *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		oldImage, _ := repository.GetFavoriteImageURL(r.Context(), db, id)
		if err := repository.DeleteFavorite(r.Context(), db, id); err != nil {
			slog.Error("delete favorite failed", "error", err, "id", id)
			RespondError(w, "DELETE_FAILED", "failed to delete favorite", http.StatusInternalServerError)
			return
		}
		if oldImage != "" {
			oldFile := strings.TrimPrefix(oldImage, "/uploads/")
			os.Remove(filepath.Join(cfg.UploadDir, oldFile))
		}
		RespondOK(w, map[string]string{"deleted": id})
	}
}
