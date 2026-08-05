package http

import (
	"archive/tar"
	"compress/gzip"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/meo-blog/backend/internal/config"
)

func TestBackupEndpointRequiresAdmin(t *testing.T) {
	cfg := &config.Config{JWTSecret: "test-secret"}
	request := httptest.NewRequest(http.MethodGet, "/api/v1/admin/backup", nil)
	response := httptest.NewRecorder()

	NewRouter(cfg, nil, nil).ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusUnauthorized)
	}
}

func TestCreateBackupArchive(t *testing.T) {
	tempDir := t.TempDir()
	dumpPath := filepath.Join(tempDir, "database.dump")
	uploadsDir := filepath.Join(tempDir, "uploads")
	if err := os.MkdirAll(filepath.Join(uploadsDir, "images"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(dumpPath, []byte("database contents"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(uploadsDir, "images", "cover.png"), []byte("image contents"), 0o600); err != nil {
		t.Fatal(err)
	}

	archivePath := filepath.Join(tempDir, "backup.tar.gz")
	createdAt := time.Date(2026, time.August, 5, 12, 30, 0, 0, time.UTC)
	if err := createBackupArchive(archivePath, dumpPath, uploadsDir, createdAt); err != nil {
		t.Fatalf("createBackupArchive() error = %v", err)
	}

	entries := readBackupEntries(t, archivePath)
	if got := string(entries["database.dump"]); got != "database contents" {
		t.Fatalf("database.dump = %q", got)
	}
	if got := string(entries["uploads/images/cover.png"]); got != "image contents" {
		t.Fatalf("uploaded file = %q", got)
	}

	var manifest backupManifest
	if err := json.Unmarshal(entries["manifest.json"], &manifest); err != nil {
		t.Fatalf("decode manifest: %v", err)
	}
	if manifest.FormatVersion != 1 {
		t.Fatalf("manifest format version = %d", manifest.FormatVersion)
	}
	if manifest.CreatedAt != createdAt.Format(time.RFC3339) {
		t.Fatalf("manifest createdAt = %q", manifest.CreatedAt)
	}
	if manifest.DatabaseFile != "database.dump" || manifest.UploadsDirectory != "uploads/" {
		t.Fatalf("unexpected manifest: %+v", manifest)
	}
}

func TestCreateBackupArchiveSkipsSymlinks(t *testing.T) {
	tempDir := t.TempDir()
	dumpPath := filepath.Join(tempDir, "database.dump")
	uploadsDir := filepath.Join(tempDir, "uploads")
	if err := os.MkdirAll(uploadsDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(dumpPath, []byte("database contents"), 0o600); err != nil {
		t.Fatal(err)
	}

	outsidePath := filepath.Join(tempDir, "outside-secret.txt")
	if err := os.WriteFile(outsidePath, []byte("must not be archived"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outsidePath, filepath.Join(uploadsDir, "link.txt")); err != nil {
		t.Skipf("symlinks unavailable: %v", err)
	}

	archivePath := filepath.Join(tempDir, "backup.tar.gz")
	if err := createBackupArchive(archivePath, dumpPath, uploadsDir, time.Now().UTC()); err != nil {
		t.Fatalf("createBackupArchive() error = %v", err)
	}

	entries := readBackupEntries(t, archivePath)
	if _, exists := entries["uploads/link.txt"]; exists {
		t.Fatal("symlink was included in backup")
	}
}

func readBackupEntries(t *testing.T, archivePath string) map[string][]byte {
	t.Helper()

	file, err := os.Open(archivePath)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()

	gzipReader, err := gzip.NewReader(file)
	if err != nil {
		t.Fatal(err)
	}
	defer gzipReader.Close()

	entries := make(map[string][]byte)
	tarReader := tar.NewReader(gzipReader)
	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		if header.FileInfo().IsDir() {
			continue
		}
		contents, err := io.ReadAll(tarReader)
		if err != nil {
			t.Fatal(err)
		}
		entries[header.Name] = contents
	}
	return entries
}
