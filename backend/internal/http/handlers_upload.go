package http

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/meo-blog/backend/internal/config"
	"github.com/meo-blog/backend/internal/repository"
)

var allowedMimeTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
	"image/svg+xml": ".svg",
}

func uploadAvatarHandler(db *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		url, err := handleFileUpload(r, cfg, 5<<20)
		if err != nil {
			RespondError(w, "UPLOAD_FAILED", err.Error(), http.StatusBadRequest)
			return
		}
		if err := repository.UpdateAvatarURL(r.Context(), db, url); err != nil {
			RespondError(w, "UPDATE_FAILED", "failed to update avatar", http.StatusInternalServerError)
			return
		}
		RespondOK(w, map[string]string{"url": url})
	}
}

func uploadProjectIconHandler(db *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		url, err := handleFileUpload(r, cfg, 2<<20)
		if err != nil {
			RespondError(w, "UPLOAD_FAILED", err.Error(), http.StatusBadRequest)
			return
		}
		oldIcon, _ := repository.GetProjectIconURL(r.Context(), db, id)
		if err := repository.UpdateProjectIcon(r.Context(), db, id, url); err != nil {
			RespondError(w, "UPDATE_FAILED", "failed to update project icon", http.StatusInternalServerError)
			return
		}
		if oldIcon != "" {
			oldFile := strings.TrimPrefix(oldIcon, "/uploads/")
			os.Remove(filepath.Join(cfg.UploadDir, oldFile))
		}
		RespondOK(w, map[string]string{"url": url})
	}
}

func handleFileUpload(r *http.Request, cfg *config.Config, maxSize int64) (string, error) {
	r.Body = http.MaxBytesReader(nil, r.Body, maxSize)
	if err := r.ParseMultipartForm(maxSize); err != nil {
		return "", fmt.Errorf("file too large or invalid form")
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		return "", fmt.Errorf("missing file field")
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext == "" {
		ct := header.Header.Get("Content-Type")
		if e, ok := allowedMimeTypes[ct]; ok {
			ext = e
		} else {
			ext = ".bin"
		}
	}

	filename := uuid.New().String() + ext
	destPath := filepath.Join(cfg.UploadDir, filename)

	dst, err := os.Create(destPath)
	if err != nil {
		return "", fmt.Errorf("failed to save file")
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		return "", fmt.Errorf("failed to write file")
	}

	return "/uploads/" + filename, nil
}

func serveUploadHandler(cfg *config.Config) http.HandlerFunc {
	fs := http.StripPrefix("/uploads/", http.FileServer(http.Dir(cfg.UploadDir)))
	return func(w http.ResponseWriter, r *http.Request) {
		fs.ServeHTTP(w, r)
	}
}
