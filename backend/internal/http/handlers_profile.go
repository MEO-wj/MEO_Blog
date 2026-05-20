package http

import (
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
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
