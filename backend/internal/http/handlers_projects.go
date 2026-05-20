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
		projects, err := repository.ListProjects(r.Context(), db)
		if err != nil {
			RespondError(w, "LIST_FAILED", "failed to list projects", http.StatusInternalServerError)
			return
		}
		RespondOK(w, projects)
	}
}

func createProjectHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var c repository.ProjectCreate
		if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
			RespondError(w, "INVALID_JSON", "invalid request body", http.StatusBadRequest)
			return
		}
		if c.Name == "" || c.Slug == "" {
			RespondError(w, "VALIDATION_ERROR", "name and slug are required", http.StatusBadRequest)
			return
		}
		project, err := repository.CreateProject(r.Context(), db, &c)
		if err != nil {
			RespondError(w, "CREATE_FAILED", "failed to create project: "+err.Error(), http.StatusInternalServerError)
			return
		}
		RespondOK(w, project)
	}
}

func updateProjectHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		var u repository.ProjectUpdate
		if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
			RespondError(w, "INVALID_JSON", "invalid request body", http.StatusBadRequest)
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
