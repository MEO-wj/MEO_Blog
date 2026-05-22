package http

import (
	"encoding/json"
	"fmt"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/meo-blog/backend/internal/config"
	"github.com/meo-blog/backend/internal/repository"
)

func getProfileHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		profile, err := repository.GetProfile(r.Context(), db)
		if err != nil {
			RespondError(w, "PROFILE_NOT_FOUND", "profile not found", http.StatusNotFound)
			return
		}
		RespondOK(w, profile)
	}
}

func updateProfileHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 256<<10)
		var u repository.ProfileUpdate
		if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
			RespondError(w, "INVALID_JSON", "invalid request body", http.StatusBadRequest)
			return
		}
		if err := repository.UpdateProfile(r.Context(), db, &u); err != nil {
			RespondError(w, "UPDATE_FAILED", "failed to update profile", http.StatusInternalServerError)
			return
		}
		profile, err := repository.GetProfile(r.Context(), db)
		if err != nil {
			RespondError(w, "PROFILE_NOT_FOUND", "profile not found", http.StatusNotFound)
			return
		}
		RespondOK(w, profile)
	}
}

// Public: get profile (read-only, no auth required)
func publicProfileHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		profile, err := repository.GetProfile(r.Context(), db)
		if err != nil {
			RespondError(w, "PROFILE_NOT_FOUND", "profile not found", http.StatusNotFound)
			return
		}
		RespondOK(w, profile)
	}
}

// Public: serve favicon — reads admin avatar from disk or returns default SVG
func faviconHandler(db *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	defaultSVG := `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#05070d"/><path d="M8 21V9h4l4 6 4-6h4v12h-4v-6l-4 6-4-6v6H8Z" fill="#63e6be"/></svg>`
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Pragma", "no-cache")

		profile, err := repository.GetProfile(r.Context(), db)
		if err == nil && profile.AvatarURL != "" {
			filePath := filepath.Join(cfg.UploadDir, strings.TrimPrefix(profile.AvatarURL, "/uploads/"))
			data, ferr := os.ReadFile(filePath)
			if ferr == nil {
				w.Header().Set("Content-Type", detectImageContentType(filePath, data))
				w.Write(data)
				return
			}
		}
		w.Header().Set("Content-Type", "image/svg+xml")
		fmt.Fprint(w, defaultSVG)
	}
}

// Public: get resume URL
func getResumeHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		url, err := repository.GetResumeURL(r.Context(), db)
		if err != nil {
			RespondError(w, "GET_FAILED", "failed to get resume", http.StatusInternalServerError)
			return
		}
		RespondOK(w, map[string]string{"url": url})
	}
}

// Admin: upload resume image
func uploadResumeHandler(db *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		url, err := handleFileUpload(r, cfg, 10<<20)
		if err != nil {
			RespondError(w, "UPLOAD_FAILED", err.Error(), http.StatusBadRequest)
			return
		}
		if err := repository.UpdateResumeURL(r.Context(), db, url); err != nil {
			RespondError(w, "UPDATE_FAILED", "failed to update resume", http.StatusInternalServerError)
			return
		}
		RespondOK(w, map[string]string{"url": url})
	}
}

func detectImageContentType(filePath string, data []byte) string {
	ext := strings.ToLower(filepath.Ext(filePath))
	if ct := mime.TypeByExtension(ext); ct != "" {
		return ct
	}
	ct := http.DetectContentType(data)
	if ct == "application/octet-stream" {
		return "image/jpeg"
	}
	return ct
}
