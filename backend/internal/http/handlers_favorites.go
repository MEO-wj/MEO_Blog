package http

import (
	"encoding/json"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
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

		// Detect image dimensions
		var imgW, imgH int
		filePath := filepath.Join(cfg.UploadDir, strings.TrimPrefix(url, "/uploads/"))
		if f, ferr := os.Open(filePath); ferr == nil {
			cfg, _, _ := image.DecodeConfig(f)
			imgW, imgH = cfg.Width, cfg.Height
			f.Close()
		}

		title := r.FormValue("title")
		description := r.FormValue("description")
		fav, err := repository.CreateFavorite(r.Context(), db, &repository.FavoriteCreate{
			Title:       title,
			Description: description,
			ImageURL:    url,
			Width:       imgW,
			Height:      imgH,
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

func adminUpdateFavoritePositionHandler(db *pgxpool.Pool) http.HandlerFunc {
	type positionReq struct {
		PosX *int `json:"posX"`
		PosY *int `json:"posY"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		var req positionReq
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			RespondError(w, "INVALID_JSON", "request body must be valid JSON", http.StatusBadRequest)
			return
		}
		if err := repository.UpdateFavoritePosition(r.Context(), db, id, req.PosX, req.PosY); err != nil {
			slog.Error("update favorite position failed", "error", err, "id", id)
			RespondError(w, "UPDATE_FAILED", "failed to update position", http.StatusInternalServerError)
			return
		}
		RespondOK(w, map[string]string{"updated": id})
	}
}
