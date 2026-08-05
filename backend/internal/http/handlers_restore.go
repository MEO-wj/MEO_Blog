package http

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	pathpkg "path"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/meo-blog/backend/internal/config"
)

const (
	restoreOperationTimeout       = 30 * time.Minute
	maxBackupUploadBytes    int64 = 8 << 30
	maxBackupExpandedBytes  int64 = 16 << 30
	maxDatabaseDumpBytes    int64 = 2 << 30
	maxBackupEntryCount           = 100000
)

type receivedRestore struct {
	databasePath string
	uploadsPath  string
	manifest     backupManifest
	uploadFiles  int
}

func adminRestoreBackupHandler(cfg *config.Config, db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		select {
		case backupOperationSlot <- struct{}{}:
			defer func() { <-backupOperationSlot }()
		default:
			RespondError(w, "BACKUP_OPERATION_IN_PROGRESS", "another backup or restore operation is already running", http.StatusConflict)
			return
		}

		controller := http.NewResponseController(w)
		_ = controller.SetReadDeadline(time.Now().Add(restoreOperationTimeout))
		_ = controller.SetWriteDeadline(time.Now().Add(restoreOperationTimeout))

		ctx, cancel := context.WithTimeout(r.Context(), restoreOperationTimeout)
		defer cancel()

		stageDir, err := os.MkdirTemp("", "meo-blog-restore-*")
		if err != nil {
			slog.Error("failed to create restore staging directory", "error", err)
			RespondError(w, "RESTORE_PREPARE_FAILED", "failed to prepare restore", http.StatusInternalServerError)
			return
		}
		defer os.RemoveAll(stageDir)

		r.Body = http.MaxBytesReader(w, r.Body, maxBackupUploadBytes)
		restore, err := receiveRestore(r, stageDir)
		if err != nil {
			slog.Warn("invalid restore upload", "error", err)
			var maxBytesErr *http.MaxBytesError
			if errors.As(err, &maxBytesErr) {
				RespondError(w, "BACKUP_TOO_LARGE", "backup upload is too large", http.StatusRequestEntityTooLarge)
			} else {
				RespondError(w, "INVALID_BACKUP", err.Error(), http.StatusBadRequest)
			}
			return
		}

		if err := validateDatabaseDump(ctx, restore.databasePath); err != nil {
			slog.Warn("invalid database dump", "error", err)
			if errors.Is(err, exec.ErrNotFound) {
				RespondError(w, "PG_RESTORE_UNAVAILABLE", "pg_restore is unavailable; rebuild the backend image", http.StatusInternalServerError)
			} else {
				RespondError(w, "INVALID_DATABASE_DUMP", "database.dump is not a valid PostgreSQL custom backup", http.StatusBadRequest)
			}
			return
		}

		if err := restoreDatabaseDump(ctx, cfg.DatabaseURL, restore.databasePath); err != nil {
			slog.Error("database restore failed", "error", err)
			if errors.Is(err, exec.ErrNotFound) {
				RespondError(w, "PG_RESTORE_UNAVAILABLE", "pg_restore is unavailable; rebuild the backend image", http.StatusInternalServerError)
			} else if ctx.Err() != nil {
				RespondError(w, "DATABASE_RESTORE_TIMEOUT", "database restore timed out", http.StatusGatewayTimeout)
			} else {
				RespondError(w, "DATABASE_RESTORE_FAILED", "database restore failed; current database was rolled back", http.StatusInternalServerError)
			}
			return
		}

		importedFiles, err := importUploadTree(restore.uploadsPath, cfg.UploadDir)
		if err != nil {
			slog.Error("upload restore failed after database restore", "error", err)
			RespondError(w, "UPLOAD_RESTORE_FAILED", "database restored, but some uploaded files could not be restored; check backend logs", http.StatusInternalServerError)
			return
		}

		if db != nil {
			if err := db.Ping(ctx); err != nil {
				slog.Error("database ping failed after restore", "error", err)
				RespondError(w, "RESTORE_VERIFY_FAILED", "restore completed but database verification failed", http.StatusInternalServerError)
				return
			}
		}

		invalidateAllRestoreCaches()
		RespondOK(w, map[string]interface{}{
			"restored":      true,
			"createdAt":     restore.manifest.CreatedAt,
			"uploadedFiles": importedFiles,
		})
	}
}

func receiveRestore(r *http.Request, stageDir string) (*receivedRestore, error) {
	reader, err := r.MultipartReader()
	if err != nil {
		return nil, fmt.Errorf("request must be multipart form data")
	}

	archivePath := filepath.Join(stageDir, "backup.tar.gz")
	databasePath := filepath.Join(stageDir, "database.dump")
	manifestPath := filepath.Join(stageDir, "manifest.json")
	uploadsPath := filepath.Join(stageDir, "uploads")
	if err := os.MkdirAll(uploadsPath, 0o700); err != nil {
		return nil, err
	}

	var hasArchive, hasDatabase, hasManifest bool
	uploadFiles := 0

	for {
		part, err := reader.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("read backup upload: %w", err)
		}

		field := part.FormName()
		switch {
		case field == "archive":
			if hasArchive {
				part.Close()
				return nil, fmt.Errorf("backup archive was provided more than once")
			}
			if err := saveMultipartPart(part, archivePath, maxBackupUploadBytes); err != nil {
				part.Close()
				return nil, err
			}
			hasArchive = true
		case field == "database":
			if hasDatabase {
				part.Close()
				return nil, fmt.Errorf("database.dump was provided more than once")
			}
			if err := saveMultipartPart(part, databasePath, maxDatabaseDumpBytes); err != nil {
				part.Close()
				return nil, err
			}
			hasDatabase = true
		case field == "manifest":
			if hasManifest {
				part.Close()
				return nil, fmt.Errorf("manifest.json was provided more than once")
			}
			if err := saveMultipartPart(part, manifestPath, 1<<20); err != nil {
				part.Close()
				return nil, err
			}
			hasManifest = true
		case strings.HasPrefix(field, "upload:"):
			relative, err := safeBackupRelativePath(strings.TrimPrefix(field, "upload:"))
			if err != nil || relative == "" {
				part.Close()
				return nil, fmt.Errorf("invalid upload path")
			}
			target := filepath.Join(uploadsPath, filepath.FromSlash(relative))
			if err := saveMultipartPart(part, target, maxBackupExpandedBytes); err != nil {
				part.Close()
				return nil, err
			}
			uploadFiles++
			if uploadFiles > maxBackupEntryCount {
				part.Close()
				return nil, fmt.Errorf("backup contains too many files")
			}
		default:
			part.Close()
			return nil, fmt.Errorf("unexpected backup field %q", field)
		}
		if err := part.Close(); err != nil {
			return nil, err
		}
	}

	if hasArchive {
		if hasDatabase || hasManifest || uploadFiles > 0 {
			return nil, fmt.Errorf("choose either a backup archive or an extracted backup folder")
		}
		return extractRestoreArchive(archivePath, stageDir)
	}
	if !hasDatabase || !hasManifest {
		return nil, fmt.Errorf("extracted backup must contain database.dump and manifest.json")
	}

	manifest, err := readAndValidateManifest(manifestPath)
	if err != nil {
		return nil, err
	}
	return &receivedRestore{
		databasePath: databasePath,
		uploadsPath:  uploadsPath,
		manifest:     manifest,
		uploadFiles:  uploadFiles,
	}, nil
}

func saveMultipartPart(part *multipart.Part, target string, limit int64) error {
	if err := os.MkdirAll(filepath.Dir(target), 0o700); err != nil {
		return err
	}
	file, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_EXCL, 0o600)
	if err != nil {
		return err
	}
	defer file.Close()

	written, err := io.Copy(file, io.LimitReader(part, limit+1))
	if err != nil {
		return err
	}
	if written > limit {
		return fmt.Errorf("backup file is too large")
	}
	return nil
}

func extractRestoreArchive(archivePath, stageDir string) (*receivedRestore, error) {
	archive, err := os.Open(archivePath)
	if err != nil {
		return nil, fmt.Errorf("open backup archive: %w", err)
	}
	defer archive.Close()

	gzipReader, err := gzip.NewReader(archive)
	if err != nil {
		return nil, fmt.Errorf("backup is not a valid tar.gz archive")
	}
	defer gzipReader.Close()

	databasePath := filepath.Join(stageDir, "database.dump")
	manifestPath := filepath.Join(stageDir, "manifest.json")
	uploadsPath := filepath.Join(stageDir, "uploads")
	tarReader := tar.NewReader(gzipReader)
	seen := make(map[string]struct{})
	var totalBytes int64
	entryCount := 0
	uploadFiles := 0

	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("read backup archive: %w", err)
		}
		entryCount++
		if entryCount > maxBackupEntryCount {
			return nil, fmt.Errorf("backup contains too many entries")
		}

		name, err := safeBackupArchivePath(header.Name)
		if err != nil {
			return nil, err
		}
		if _, exists := seen[name]; exists {
			return nil, fmt.Errorf("backup contains duplicate path %q", name)
		}
		seen[name] = struct{}{}

		switch header.Typeflag {
		case tar.TypeDir:
			if name != "uploads" && !strings.HasPrefix(name, "uploads/") {
				return nil, fmt.Errorf("unexpected directory %q", name)
			}
			if err := os.MkdirAll(filepath.Join(stageDir, filepath.FromSlash(name)), 0o700); err != nil {
				return nil, err
			}
			continue
		case tar.TypeReg, tar.TypeRegA:
		default:
			return nil, fmt.Errorf("backup contains unsupported entry %q", name)
		}

		if header.Size < 0 || header.Size > maxBackupExpandedBytes-totalBytes {
			return nil, fmt.Errorf("expanded backup is too large")
		}
		totalBytes += header.Size

		var target string
		switch {
		case name == "database.dump":
			if header.Size > maxDatabaseDumpBytes {
				return nil, fmt.Errorf("database.dump is too large")
			}
			target = databasePath
		case name == "manifest.json":
			if header.Size > 1<<20 {
				return nil, fmt.Errorf("manifest.json is too large")
			}
			target = manifestPath
		case strings.HasPrefix(name, "uploads/"):
			target = filepath.Join(stageDir, filepath.FromSlash(name))
			uploadFiles++
		default:
			return nil, fmt.Errorf("unexpected backup entry %q", name)
		}

		if err := writeTarRestoreFile(tarReader, target, header.Size); err != nil {
			return nil, err
		}
	}

	manifest, err := readAndValidateManifest(manifestPath)
	if err != nil {
		return nil, err
	}
	if _, err := os.Stat(databasePath); err != nil {
		return nil, fmt.Errorf("backup does not contain database.dump")
	}
	if err := os.MkdirAll(uploadsPath, 0o700); err != nil {
		return nil, err
	}
	return &receivedRestore{
		databasePath: databasePath,
		uploadsPath:  uploadsPath,
		manifest:     manifest,
		uploadFiles:  uploadFiles,
	}, nil
}

func safeBackupArchivePath(name string) (string, error) {
	if strings.Contains(name, "\\") || strings.ContainsRune(name, 0) {
		return "", fmt.Errorf("invalid backup path")
	}
	raw := strings.TrimSuffix(name, "/")
	if raw == "" || pathpkg.IsAbs(raw) {
		return "", fmt.Errorf("invalid backup path")
	}
	cleaned := pathpkg.Clean(raw)
	if cleaned != raw || cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		return "", fmt.Errorf("unsafe backup path %q", name)
	}
	return cleaned, nil
}

func safeBackupRelativePath(name string) (string, error) {
	if strings.Contains(name, "\\") || strings.ContainsRune(name, 0) {
		return "", fmt.Errorf("invalid relative path")
	}
	cleaned := pathpkg.Clean(name)
	if cleaned == "." || cleaned == ".." || pathpkg.IsAbs(cleaned) || cleaned != name || strings.HasPrefix(cleaned, "../") {
		return "", fmt.Errorf("unsafe relative path")
	}
	return cleaned, nil
}

func writeTarRestoreFile(reader io.Reader, target string, size int64) error {
	if err := os.MkdirAll(filepath.Dir(target), 0o700); err != nil {
		return err
	}
	file, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_EXCL, 0o600)
	if err != nil {
		return err
	}
	defer file.Close()

	written, err := io.CopyN(file, reader, size)
	if err != nil {
		return err
	}
	if written != size {
		return fmt.Errorf("backup entry was truncated")
	}
	return nil
}

func readAndValidateManifest(path string) (backupManifest, error) {
	var manifest backupManifest
	data, err := os.ReadFile(path)
	if err != nil {
		return manifest, fmt.Errorf("backup does not contain manifest.json")
	}
	if err := json.Unmarshal(data, &manifest); err != nil {
		return manifest, fmt.Errorf("manifest.json is invalid")
	}
	if manifest.FormatVersion != 1 ||
		manifest.DatabaseFile != "database.dump" ||
		manifest.UploadsDirectory != "uploads/" ||
		manifest.DatabaseFormat != "PostgreSQL custom dump" {
		return manifest, fmt.Errorf("backup format is not supported")
	}
	if _, err := time.Parse(time.RFC3339, manifest.CreatedAt); err != nil {
		return manifest, fmt.Errorf("manifest creation time is invalid")
	}
	return manifest, nil
}

func validateDatabaseDump(ctx context.Context, dumpPath string) error {
	cmd := exec.CommandContext(ctx, "pg_restore", "--list", dumpPath)
	var stderr strings.Builder
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("pg_restore validation: %w: %s", err, truncateRestoreError(stderr.String()))
	}
	return nil
}

func restoreDatabaseDump(ctx context.Context, databaseURL, dumpPath string) error {
	parsed, err := url.Parse(databaseURL)
	if err != nil {
		return fmt.Errorf("parse database URL: %w", err)
	}
	if parsed.Scheme != "postgres" && parsed.Scheme != "postgresql" {
		return fmt.Errorf("unsupported database URL scheme")
	}
	if parsed.User == nil || parsed.User.Username() == "" {
		return fmt.Errorf("database URL is missing a username")
	}

	password, _ := parsed.User.Password()
	safeURL := *parsed
	safeURL.User = url.User(parsed.User.Username())

	cmd := exec.CommandContext(
		ctx,
		"pg_restore",
		"--dbname="+safeURL.String(),
		"--clean",
		"--if-exists",
		"--single-transaction",
		"--no-owner",
		"--no-privileges",
		dumpPath,
	)
	cmd.Env = append(os.Environ(), "PGPASSWORD="+password)
	var stderr strings.Builder
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("pg_restore: %w: %s", err, truncateRestoreError(stderr.String()))
	}
	return nil
}

func truncateRestoreError(message string) string {
	message = strings.TrimSpace(message)
	if len(message) > 2000 {
		return message[:2000]
	}
	return message
}

func importUploadTree(sourceRoot, destinationRoot string) (int, error) {
	if err := os.MkdirAll(destinationRoot, 0o755); err != nil {
		return 0, err
	}
	imported := 0
	err := filepath.WalkDir(sourceRoot, func(source string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		relative, err := filepath.Rel(sourceRoot, source)
		if err != nil {
			return err
		}
		if relative == "." {
			return nil
		}
		destination := filepath.Join(destinationRoot, relative)
		if entry.IsDir() {
			return os.MkdirAll(destination, 0o755)
		}
		if !entry.Type().IsRegular() {
			return fmt.Errorf("unsupported upload entry %q", relative)
		}
		if err := copyRestoreFileAtomically(source, destination); err != nil {
			return err
		}
		imported++
		return nil
	})
	return imported, err
}

func copyRestoreFileAtomically(source, destination string) error {
	if err := os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
		return err
	}
	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer input.Close()

	temp, err := os.CreateTemp(filepath.Dir(destination), ".meo-restore-*")
	if err != nil {
		return err
	}
	tempPath := temp.Name()
	defer os.Remove(tempPath)

	if _, err := io.Copy(temp, input); err != nil {
		temp.Close()
		return err
	}
	if err := temp.Chmod(0o644); err != nil {
		temp.Close()
		return err
	}
	if err := temp.Close(); err != nil {
		return err
	}
	return os.Rename(tempPath, destination)
}

func invalidateAllRestoreCaches() {
	etagCacheMu.Lock()
	clear(etagCache)
	etagCacheMu.Unlock()

	favCache.mu.Lock()
	favCache.data = nil
	favCache.mime = ""
	favCache.expiresAt = time.Time{}
	favCache.mu.Unlock()
}
