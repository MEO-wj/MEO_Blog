package http

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/meo-blog/backend/internal/config"
	"github.com/meo-blog/backend/internal/repository"
)

func listPartnersHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		partners, err := repository.ListPartners(r.Context(), db)
		if err != nil {
			slog.Error("list partners failed", "error", err)
			RespondError(w, "LIST_FAILED", "failed to list partners", http.StatusInternalServerError)
			return
		}
		RespondOK(w, partners)
	}
}

func adminCreatePartnerHandler(db *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		url, err := handleFileUploadWithOptions(r, cfg, uploadOptions{
			maxBytes:     5 << 20,
			maxDimension: 640,
			jpegQuality:  82,
		})
		if err != nil {
			RespondError(w, "UPLOAD_FAILED", err.Error(), http.StatusBadRequest)
			return
		}

		name := strings.TrimSpace(r.FormValue("name"))
		if name == "" {
			removeUploadedFile(cfg, url)
			RespondError(w, "VALIDATION_ERROR", "name is required", http.StatusBadRequest)
			return
		}
		websiteURL, ok := normalizePartnerWebsiteURL(r.FormValue("websiteUrl"))
		if !ok {
			removeUploadedFile(cfg, url)
			RespondError(w, "VALIDATION_ERROR", "websiteUrl must be a valid http(s) URL", http.StatusBadRequest)
			return
		}

		partner, err := repository.CreatePartner(r.Context(), db, &repository.PartnerCreate{
			Name:       name,
			AvatarURL:  url,
			WebsiteURL: websiteURL,
		})
		if err != nil {
			removeUploadedFile(cfg, url)
			slog.Error("create partner failed", "error", err)
			RespondError(w, "CREATE_FAILED", "failed to create partner", http.StatusInternalServerError)
			return
		}
		InvalidateETagCache("partners")
		RespondOK(w, partner)
	}
}

func adminUpdatePartnerHandler(db *pgxpool.Pool) http.HandlerFunc {
	type updateReq struct {
		Name       *string `json:"name"`
		WebsiteURL *string `json:"websiteUrl"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
		var req updateReq
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			RespondError(w, "INVALID_JSON", "invalid request body", http.StatusBadRequest)
			return
		}

		var name *string
		if req.Name != nil {
			trimmed := strings.TrimSpace(*req.Name)
			if trimmed == "" {
				RespondError(w, "VALIDATION_ERROR", "name is required", http.StatusBadRequest)
				return
			}
			name = &trimmed
		}

		var websiteURL *string
		if req.WebsiteURL != nil {
			normalized, ok := normalizePartnerWebsiteURL(*req.WebsiteURL)
			if !ok {
				RespondError(w, "VALIDATION_ERROR", "websiteUrl must be a valid http(s) URL", http.StatusBadRequest)
				return
			}
			websiteURL = &normalized
		}

		partner, err := repository.UpdatePartner(r.Context(), db, id, &repository.PartnerUpdate{
			Name:       name,
			WebsiteURL: websiteURL,
		})
		if err != nil {
			slog.Error("update partner failed", "error", err, "id", id)
			RespondError(w, "UPDATE_FAILED", "failed to update partner", http.StatusInternalServerError)
			return
		}
		InvalidateETagCache("partners")
		RespondOK(w, partner)
	}
}

func adminUploadPartnerAvatarHandler(db *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		newURL, err := handleFileUploadWithOptions(r, cfg, uploadOptions{
			maxBytes:     5 << 20,
			maxDimension: 640,
			jpegQuality:  82,
		})
		if err != nil {
			RespondError(w, "UPLOAD_FAILED", err.Error(), http.StatusBadRequest)
			return
		}
		oldURL, _ := repository.GetPartnerAvatarURL(r.Context(), db, id)
		if err := repository.UpdatePartnerAvatarURL(r.Context(), db, id, newURL); err != nil {
			removeUploadedFile(cfg, newURL)
			slog.Error("update partner avatar failed", "error", err, "id", id)
			RespondError(w, "UPDATE_FAILED", "failed to update partner avatar", http.StatusInternalServerError)
			return
		}
		removeUploadedFile(cfg, oldURL)
		InvalidateETagCache("partners")
		RespondOK(w, map[string]string{"url": newURL})
	}
}

func adminDeletePartnerHandler(db *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		oldURL, _ := repository.GetPartnerAvatarURL(r.Context(), db, id)
		if err := repository.DeletePartner(r.Context(), db, id); err != nil {
			slog.Error("delete partner failed", "error", err, "id", id)
			RespondError(w, "DELETE_FAILED", "failed to delete partner", http.StatusInternalServerError)
			return
		}
		removeUploadedFile(cfg, oldURL)
		InvalidateETagCache("partners")
		RespondOK(w, map[string]string{"deleted": id})
	}
}

func normalizePartnerWebsiteURL(raw string) (string, bool) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return "", true
	}
	if !strings.Contains(value, "://") {
		value = "https://" + value
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.Host == "" {
		return "", false
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", false
	}
	return parsed.String(), true
}

func removeUploadedFile(cfg *config.Config, fileURL string) {
	if !strings.HasPrefix(fileURL, "/uploads/") {
		return
	}
	filename := strings.TrimPrefix(fileURL, "/uploads/")
	if filename == "" || strings.Contains(filename, "..") {
		return
	}
	_ = os.Remove(filepath.Join(cfg.UploadDir, filename))
}
