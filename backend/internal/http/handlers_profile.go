package http

import (
	"encoding/json"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

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
		InvalidateETagCache("profile")
		InvalidateETagCache("resume")
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

// faviconCache holds the cached favicon data
type faviconCache struct {
	mu        sync.RWMutex
	data      []byte
	mime      string
	expiresAt time.Time
}

var favCache = &faviconCache{}

const faviconCacheTTL = 30 * time.Second

// Public: serve favicon — reads admin avatar from disk or returns default SVG
func faviconHandler(db *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	defaultSVG := `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#05070d"/><path d="M8 21V9h4l4 6 4-6h4v12h-4v-6l-4 6-4-6v6H8Z" fill="#63e6be"/></svg>`
	defaultBytes := []byte(defaultSVG)

	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Pragma", "no-cache")

		// Check cache
		favCache.mu.RLock()
		if time.Now().Before(favCache.expiresAt) && favCache.data != nil {
			data, mime := favCache.data, favCache.mime
			favCache.mu.RUnlock()
			w.Header().Set("Content-Type", mime)
			w.Write(data)
			return
		}
		favCache.mu.RUnlock()

		// Cache miss — read from DB + disk
		profile, err := repository.GetProfile(r.Context(), db)
		if err == nil && profile.AvatarURL != "" {
			filePath := filepath.Join(cfg.UploadDir, strings.TrimPrefix(profile.AvatarURL, "/uploads/"))
			// Guard against path traversal — resolved path must stay within UploadDir
			absUpload, _ := filepath.Abs(cfg.UploadDir)
			absFile, _ := filepath.Abs(filePath)
			if !strings.HasPrefix(absFile, absUpload+string(filepath.Separator)) {
				filePath = ""
			}
			if filePath != "" {
				data, ferr := os.ReadFile(filePath)
				if ferr == nil {
					ct := detectImageContentType(filePath, data)
					favCache.mu.Lock()
					favCache.data = data
					favCache.mime = ct
					favCache.expiresAt = time.Now().Add(faviconCacheTTL)
					favCache.mu.Unlock()
					w.Header().Set("Content-Type", ct)
					w.Write(data)
					return
				}
			}
		}

		// Default SVG fallback
		favCache.mu.Lock()
		favCache.data = defaultBytes
		favCache.mime = "image/svg+xml"
		favCache.expiresAt = time.Now().Add(faviconCacheTTL)
		favCache.mu.Unlock()
		w.Header().Set("Content-Type", "image/svg+xml")
		w.Write(defaultBytes)
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
		url, err := handleFileUploadWithOptions(r, cfg, uploadOptions{
			maxBytes:     10 << 20,
			maxDimension: 1600,
			jpegQuality:  82,
		})
		if err != nil {
			RespondError(w, "UPLOAD_FAILED", err.Error(), http.StatusBadRequest)
			return
		}
		if err := repository.UpdateResumeURL(r.Context(), db, url); err != nil {
			RespondError(w, "UPDATE_FAILED", "failed to update resume", http.StatusInternalServerError)
			return
		}
		InvalidateETagCache("profile")
		InvalidateETagCache("resume")
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
