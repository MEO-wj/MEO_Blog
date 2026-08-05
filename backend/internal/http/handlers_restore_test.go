package http

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/meo-blog/backend/internal/config"
)

func TestRestoreEndpointRequiresAdmin(t *testing.T) {
	cfg := &config.Config{JWTSecret: "test-secret"}
	request := httptest.NewRequest(http.MethodPost, "/api/v1/admin/backup/restore", nil)
	response := httptest.NewRecorder()

	NewRouter(cfg, nil, nil).ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusUnauthorized)
	}
}

func TestReceiveExtractedRestore(t *testing.T) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	manifestBytes, err := json.Marshal(backupManifest{
		FormatVersion:    1,
		CreatedAt:        time.Date(2026, time.August, 5, 12, 0, 0, 0, time.UTC).Format(time.RFC3339),
		DatabaseFile:     "database.dump",
		DatabaseFormat:   "PostgreSQL custom dump",
		UploadsDirectory: "uploads/",
	})
	if err != nil {
		t.Fatal(err)
	}
	writeMultipartFile(t, writer, "manifest", "manifest.json", manifestBytes)
	writeMultipartFile(t, writer, "database", "database.dump", []byte("dump"))
	writeMultipartFile(t, writer, "upload:images/cover.png", "cover.png", []byte("image"))
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	request := httptest.NewRequest(http.MethodPost, "/api/v1/admin/backup/restore", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	restore, err := receiveRestore(request, t.TempDir())
	if err != nil {
		t.Fatalf("receiveRestore() error = %v", err)
	}

	if got, err := os.ReadFile(restore.databasePath); err != nil || string(got) != "dump" {
		t.Fatalf("database.dump = %q, err = %v", got, err)
	}
	uploadPath := filepath.Join(restore.uploadsPath, "images", "cover.png")
	if got, err := os.ReadFile(uploadPath); err != nil || string(got) != "image" {
		t.Fatalf("uploaded file = %q, err = %v", got, err)
	}
	if restore.uploadFiles != 1 {
		t.Fatalf("uploadFiles = %d, want 1", restore.uploadFiles)
	}
}

func TestExtractRestoreArchiveRejectsTraversal(t *testing.T) {
	tempDir := t.TempDir()
	archivePath := filepath.Join(tempDir, "malicious.tar.gz")
	file, err := os.Create(archivePath)
	if err != nil {
		t.Fatal(err)
	}
	gzipWriter := gzip.NewWriter(file)
	tarWriter := tar.NewWriter(gzipWriter)
	content := []byte("secret")
	if err := tarWriter.WriteHeader(&tar.Header{
		Name: "../outside.txt",
		Mode: 0o600,
		Size: int64(len(content)),
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := tarWriter.Write(content); err != nil {
		t.Fatal(err)
	}
	if err := tarWriter.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gzipWriter.Close(); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}

	if _, err := extractRestoreArchive(archivePath, filepath.Join(tempDir, "stage")); err == nil {
		t.Fatal("traversal archive was accepted")
	}
	if _, err := os.Stat(filepath.Join(tempDir, "outside.txt")); !os.IsNotExist(err) {
		t.Fatal("archive wrote outside the staging directory")
	}
}

func TestExtractRestoreArchiveAcceptsGeneratedBackup(t *testing.T) {
	tempDir := t.TempDir()
	dumpPath := filepath.Join(tempDir, "source.dump")
	uploadsPath := filepath.Join(tempDir, "source-uploads")
	if err := os.MkdirAll(uploadsPath, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(dumpPath, []byte("database"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(uploadsPath, "avatar.png"), []byte("avatar"), 0o600); err != nil {
		t.Fatal(err)
	}

	archivePath := filepath.Join(tempDir, "backup.tar.gz")
	if err := createBackupArchive(archivePath, dumpPath, uploadsPath, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	restore, err := extractRestoreArchive(archivePath, filepath.Join(tempDir, "stage"))
	if err != nil {
		t.Fatalf("extractRestoreArchive() error = %v", err)
	}
	if restore.uploadFiles != 1 {
		t.Fatalf("uploadFiles = %d, want 1", restore.uploadFiles)
	}
}

func TestImportUploadTreeOverwritesAndPreservesOtherFiles(t *testing.T) {
	tempDir := t.TempDir()
	source := filepath.Join(tempDir, "source")
	destination := filepath.Join(tempDir, "destination")
	if err := os.MkdirAll(source, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(destination, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(source, "same.txt"), []byte("new"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(destination, "same.txt"), []byte("old"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(destination, "unrelated.txt"), []byte("keep"), 0o600); err != nil {
		t.Fatal(err)
	}

	count, err := importUploadTree(source, destination)
	if err != nil {
		t.Fatalf("importUploadTree() error = %v", err)
	}
	if count != 1 {
		t.Fatalf("count = %d, want 1", count)
	}
	if got, _ := os.ReadFile(filepath.Join(destination, "same.txt")); string(got) != "new" {
		t.Fatalf("same.txt = %q", got)
	}
	if got, _ := os.ReadFile(filepath.Join(destination, "unrelated.txt")); string(got) != "keep" {
		t.Fatalf("unrelated.txt = %q", got)
	}
}

func writeMultipartFile(t *testing.T, writer *multipart.Writer, field, filename string, content []byte) {
	t.Helper()
	part, err := writer.CreateFormFile(field, filename)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(content); err != nil {
		t.Fatal(err)
	}
}
