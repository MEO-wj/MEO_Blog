package http

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
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
	"golang.org/x/image/draw"
)

var allowedMimeTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

func uploadAvatarHandler(db *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		url, err := handleFileUploadWithOptions(r, cfg, uploadOptions{
			maxBytes:     5 << 20,
			maxDimension: 512,
			jpegQuality:  82,
		})
		if err != nil {
			RespondError(w, "UPLOAD_FAILED", err.Error(), http.StatusBadRequest)
			return
		}
		if err := repository.UpdateAvatarURL(r.Context(), db, url); err != nil {
			RespondError(w, "UPDATE_FAILED", "failed to update avatar", http.StatusInternalServerError)
			return
		}
		InvalidateETagCache("profile")
		InvalidateETagCache("resume")
		RespondOK(w, map[string]string{"url": url})
	}
}

func uploadProjectIconHandler(db *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		url, err := handleFileUploadWithOptions(r, cfg, uploadOptions{
			maxBytes:     2 << 20,
			maxDimension: 640,
			jpegQuality:  82,
		})
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
		InvalidateETagCache("projects")
		InvalidateETagCache("project-detail")
		RespondOK(w, map[string]string{"url": url})
	}
}

type uploadOptions struct {
	maxBytes     int64
	maxDimension int
	jpegQuality  int
}

func handleFileUpload(r *http.Request, cfg *config.Config, maxSize int64) (string, error) {
	return handleFileUploadWithOptions(r, cfg, uploadOptions{
		maxBytes:     maxSize,
		maxDimension: 2048,
		jpegQuality:  80,
	})
}

func handleFileUploadWithOptions(r *http.Request, cfg *config.Config, opts uploadOptions) (string, error) {
	if opts.maxDimension <= 0 {
		opts.maxDimension = 2048
	}
	if opts.jpegQuality <= 0 {
		opts.jpegQuality = 80
	}

	r.Body = http.MaxBytesReader(nil, r.Body, opts.maxBytes)
	if err := r.ParseMultipartForm(opts.maxBytes); err != nil {
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

	// Compress raster images (skip SVG and GIF animations)
	if ext != ".svg" && ext != ".gif" {
		data, err := io.ReadAll(file)
		if err != nil {
			return "", fmt.Errorf("failed to read file")
		}
		compressed, newExt, err := compressImage(data, ext, opts.maxDimension, opts.jpegQuality)
		if err == nil && len(compressed) < len(data) {
			// Use compressed version if smaller
			oldPath := destPath
			filename = uuid.New().String() + newExt
			destPath = filepath.Join(cfg.UploadDir, filename)
			os.Remove(oldPath)
			return "/uploads/" + filename, os.WriteFile(destPath, compressed, 0644)
		}
		// Fallback: write original
		return "/uploads/" + filename, os.WriteFile(destPath, data, 0644)
	}

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

// compressImage decodes a raster image, resizes if too large, and re-encodes as JPEG.
func compressImage(data []byte, ext string, maxDimension int, jpegQuality int) ([]byte, string, error) {
	src, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, "", err
	}

	bounds := src.Bounds()
	w, h := bounds.Dx(), bounds.Dy()

	// Resize if either dimension exceeds limit
	if w > maxDimension || h > maxDimension {
		ratio := float64(maxDimension) / float64(w)
		if h > w {
			ratio = float64(maxDimension) / float64(h)
		}
		nw := int(float64(w) * ratio)
		nh := int(float64(h) * ratio)
		dst := image.NewRGBA(image.Rect(0, 0, nw, nh))
		draw.CatmullRom.Scale(dst, dst.Bounds(), src, bounds, draw.Over, nil)
		src = dst
	}

	// PNG with transparency → re-encode as compressed PNG
	if ext == ".png" {
		if imageHasAlpha(src) {
			var buf bytes.Buffer
			enc := png.Encoder{CompressionLevel: png.BestCompression}
			if err := enc.Encode(&buf, src); err != nil {
				return nil, "", err
			}
			return buf.Bytes(), ".png", nil
		}
		// PNG without transparency → JPEG
		ext = ".jpg"
	}

	// Default: JPEG with quality 80
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, src, &jpeg.Options{Quality: 80}); err != nil {
		return nil, "", err
	}
	return buf.Bytes(), ext, nil
}

// imageHasAlpha checks if an image has meaningful alpha channel (sampled).
func imageHasAlpha(img image.Image) bool {
	b := img.Bounds()
	for y := b.Min.Y; y < b.Max.Y; y += 4 {
		for x := b.Min.X; x < b.Max.X; x += 4 {
			_, _, _, a := img.At(x, y).RGBA()
			if a < 0xFFFF {
				return true
			}
		}
	}
	return false
}

func serveUploadHandler(cfg *config.Config) http.HandlerFunc {
	fs := http.StripPrefix("/uploads/", http.FileServer(http.Dir(cfg.UploadDir)))
	return func(w http.ResponseWriter, r *http.Request) {
		fs.ServeHTTP(w, r)
	}
}
