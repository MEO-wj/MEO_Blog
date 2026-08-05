package http

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	pathpkg "path"
	"path/filepath"
	"strings"
	"time"

	"github.com/meo-blog/backend/internal/config"
)

const backupGenerationTimeout = 15 * time.Minute

var backupOperationSlot = make(chan struct{}, 1)

type backupManifest struct {
	FormatVersion    int    `json:"formatVersion"`
	CreatedAt        string `json:"createdAt"`
	DatabaseFile     string `json:"databaseFile"`
	DatabaseFormat   string `json:"databaseFormat"`
	UploadsDirectory string `json:"uploadsDirectory"`
}

func adminDownloadBackupHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		select {
		case backupOperationSlot <- struct{}{}:
			defer func() { <-backupOperationSlot }()
		default:
			RespondError(w, "BACKUP_IN_PROGRESS", "another backup or restore operation is already running", http.StatusConflict)
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), backupGenerationTimeout)
		defer cancel()
		_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(backupGenerationTimeout))

		tempDir, err := os.MkdirTemp("", "meo-blog-backup-*")
		if err != nil {
			slog.Error("failed to create backup temp directory", "error", err)
			RespondError(w, "BACKUP_CREATE_FAILED", "failed to prepare backup", http.StatusInternalServerError)
			return
		}
		defer os.RemoveAll(tempDir)

		dumpPath := filepath.Join(tempDir, "database.dump")
		if err := createDatabaseDump(ctx, cfg.DatabaseURL, dumpPath); err != nil {
			slog.Error("database backup failed", "error", err)
			if errors.Is(err, exec.ErrNotFound) {
				RespondError(w, "PG_DUMP_UNAVAILABLE", "pg_dump is unavailable; rebuild the backend image", http.StatusInternalServerError)
			} else if ctx.Err() != nil {
				RespondError(w, "DATABASE_BACKUP_TIMEOUT", "database export timed out", http.StatusGatewayTimeout)
			} else {
				RespondError(w, "DATABASE_BACKUP_FAILED", "database export failed; check backend logs", http.StatusInternalServerError)
			}
			return
		}

		createdAt := time.Now().UTC()
		archivePath := filepath.Join(tempDir, "backup.tar.gz")
		if err := createBackupArchive(archivePath, dumpPath, cfg.UploadDir, createdAt); err != nil {
			slog.Error("backup archive failed", "error", err)
			RespondError(w, "BACKUP_ARCHIVE_FAILED", "failed to package backup", http.StatusInternalServerError)
			return
		}

		archive, err := os.Open(archivePath)
		if err != nil {
			slog.Error("failed to open backup archive", "error", err)
			RespondError(w, "BACKUP_OPEN_FAILED", "failed to open backup", http.StatusInternalServerError)
			return
		}
		defer archive.Close()

		info, err := archive.Stat()
		if err != nil {
			slog.Error("failed to stat backup archive", "error", err)
			RespondError(w, "BACKUP_OPEN_FAILED", "failed to open backup", http.StatusInternalServerError)
			return
		}

		filename := fmt.Sprintf("meo-blog-backup-%s.tar.gz", createdAt.Format("20060102T150405Z"))
		w.Header().Set("Content-Type", "application/gzip")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		http.ServeContent(w, r, filename, info.ModTime(), archive)
	}
}

func createDatabaseDump(ctx context.Context, databaseURL, outputPath string) error {
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
		"pg_dump",
		"--dbname="+safeURL.String(),
		"--format=custom",
		"--no-owner",
		"--no-privileges",
		"--file="+outputPath,
	)
	cmd.Env = append(os.Environ(), "PGPASSWORD="+password)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		message := strings.TrimSpace(stderr.String())
		if len(message) > 800 {
			message = message[:800]
		}
		if message == "" {
			return fmt.Errorf("pg_dump: %w", err)
		}
		return fmt.Errorf("pg_dump: %w: %s", err, message)
	}

	return nil
}

func createBackupArchive(archivePath, dumpPath, uploadsDir string, createdAt time.Time) error {
	archive, err := os.Create(archivePath)
	if err != nil {
		return err
	}

	gzipWriter := gzip.NewWriter(archive)
	tarWriter := tar.NewWriter(gzipWriter)
	closed := false
	defer func() {
		if !closed {
			_ = tarWriter.Close()
			_ = gzipWriter.Close()
			_ = archive.Close()
		}
	}()

	manifestBytes, err := json.MarshalIndent(backupManifest{
		FormatVersion:    1,
		CreatedAt:        createdAt.Format(time.RFC3339),
		DatabaseFile:     "database.dump",
		DatabaseFormat:   "PostgreSQL custom dump",
		UploadsDirectory: "uploads/",
	}, "", "  ")
	if err != nil {
		return err
	}
	manifestBytes = append(manifestBytes, '\n')
	if err := writeTarBytes(tarWriter, "manifest.json", manifestBytes, createdAt); err != nil {
		return err
	}

	if err := writeTarFile(tarWriter, dumpPath, "database.dump"); err != nil {
		return err
	}
	if err := writeTarTree(tarWriter, uploadsDir, "uploads"); err != nil {
		return err
	}

	if err := tarWriter.Close(); err != nil {
		return err
	}
	if err := gzipWriter.Close(); err != nil {
		return err
	}
	if err := archive.Close(); err != nil {
		return err
	}
	closed = true
	return nil
}

func writeTarBytes(writer *tar.Writer, name string, contents []byte, modTime time.Time) error {
	header := &tar.Header{
		Name:    name,
		Mode:    0o600,
		Size:    int64(len(contents)),
		ModTime: modTime,
	}
	if err := writer.WriteHeader(header); err != nil {
		return err
	}
	_, err := writer.Write(contents)
	return err
}

func writeTarFile(writer *tar.Writer, sourcePath, archiveName string) error {
	info, err := os.Stat(sourcePath)
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() {
		return fmt.Errorf("backup source is not a regular file: %s", sourcePath)
	}

	header, err := tar.FileInfoHeader(info, "")
	if err != nil {
		return err
	}
	header.Name = archiveName
	header.Mode = 0o600
	header.Uid = 0
	header.Gid = 0
	if err := writer.WriteHeader(header); err != nil {
		return err
	}

	file, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer file.Close()
	_, err = io.Copy(writer, file)
	return err
}

func writeTarTree(writer *tar.Writer, root, archiveRoot string) error {
	return filepath.WalkDir(root, func(currentPath string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return nil
		}

		info, err := entry.Info()
		if err != nil {
			return err
		}
		if !info.IsDir() && !info.Mode().IsRegular() {
			return nil
		}

		relative, err := filepath.Rel(root, currentPath)
		if err != nil {
			return err
		}
		archiveName := archiveRoot
		if relative != "." {
			archiveName = pathpkg.Join(archiveRoot, filepath.ToSlash(relative))
		}

		if info.IsDir() {
			header, err := tar.FileInfoHeader(info, "")
			if err != nil {
				return err
			}
			header.Name = archiveName + "/"
			header.Uid = 0
			header.Gid = 0
			return writer.WriteHeader(header)
		}

		return writeTarFile(writer, currentPath, archiveName)
	})
}
