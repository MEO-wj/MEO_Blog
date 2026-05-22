package http

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/meo-blog/backend/internal/config"
	"github.com/meo-blog/backend/internal/repository"
)

func publicProjectsHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("fields") == "summary" {
			summaries, err := repository.ListProjectSummaries(r.Context(), db)
			if err != nil {
				RespondError(w, "LIST_FAILED", "failed to list projects", http.StatusInternalServerError)
				return
			}
			RespondOK(w, summaries)
			return
		}
		projects, err := repository.ListProjects(r.Context(), db)
		if err != nil {
			RespondError(w, "LIST_FAILED", "failed to list projects", http.StatusInternalServerError)
			return
		}
		RespondOK(w, projects)
	}
}

func getProjectBySlugHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slug := chi.URLParam(r, "slug")
		project, err := repository.GetProjectBySlug(r.Context(), db, slug)
		if err != nil {
			RespondError(w, "NOT_FOUND", "project not found", http.StatusNotFound)
			return
		}
		RespondOK(w, project)
	}
}

func createProjectHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 256<<10)
		var c repository.ProjectCreate
		if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
			RespondError(w, "INVALID_JSON", "invalid request body", http.StatusBadRequest)
			return
		}
		if c.Name == "" || c.Slug == "" {
			RespondError(w, "VALIDATION_ERROR", "name and slug are required", http.StatusBadRequest)
			return
		}
		if !isValidSlug(c.Slug) {
			RespondError(w, "VALIDATION_ERROR", "slug must be lowercase alphanumeric with hyphens", http.StatusBadRequest)
			return
		}
		project, err := repository.CreateProject(r.Context(), db, &c)
		if err != nil {
			RespondError(w, "CREATE_FAILED", "failed to create project", http.StatusInternalServerError)
			return
		}
		RespondOK(w, project)
	}
}

func updateProjectHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		r.Body = http.MaxBytesReader(w, r.Body, 256<<10)
		var u repository.ProjectUpdate
		if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
			RespondError(w, "INVALID_JSON", "invalid request body", http.StatusBadRequest)
			return
		}
		if u.Slug != nil && !isValidSlug(*u.Slug) {
			RespondError(w, "VALIDATION_ERROR", "slug must be lowercase alphanumeric with hyphens", http.StatusBadRequest)
			return
		}
		project, err := repository.UpdateProject(r.Context(), db, id, &u)
		if err != nil {
			RespondError(w, "UPDATE_FAILED", "failed to update project", http.StatusInternalServerError)
			return
		}
		RespondOK(w, project)
	}
}

func adminReorderProjectsHandler(db *pgxpool.Pool) http.HandlerFunc {
	type reorderReq struct {
		IDs []string `json:"ids"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
		var req reorderReq
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			RespondError(w, "INVALID_JSON", "request body must be valid JSON", http.StatusBadRequest)
			return
		}
		if len(req.IDs) == 0 {
			RespondError(w, "VALIDATION_ERROR", "ids array is required", http.StatusBadRequest)
			return
		}
		if err := repository.ReorderProjects(r.Context(), db, req.IDs); err != nil {
			RespondError(w, "REORDER_FAILED", "failed to reorder projects", http.StatusInternalServerError)
			return
		}
		RespondOK(w, map[string]string{"status": "ok"})
	}
}

func deleteProjectHandler(db *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		iconURL, _ := repository.GetProjectIconURL(r.Context(), db, id)
		if err := repository.DeleteProject(r.Context(), db, id); err != nil {
			RespondError(w, "DELETE_FAILED", "failed to delete project", http.StatusInternalServerError)
			return
		}
		if iconURL != "" {
			filename := strings.TrimPrefix(iconURL, "/uploads/")
			os.Remove(filepath.Join(cfg.UploadDir, filename))
		}
		RespondOK(w, map[string]string{"deleted": id})
	}
}
