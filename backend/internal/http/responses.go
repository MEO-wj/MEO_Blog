package http

import (
	"encoding/json"
	"net/http"
	"regexp"
)

type APIResponse struct {
	Data  interface{} `json:"data"`
	Meta  *Meta       `json:"meta,omitempty"`
	Error *APIError   `json:"error,omitempty"`
}

type Meta struct {
	RequestID string `json:"requestId"`
	Cached    bool   `json:"cached,omitempty"`
	Page      int    `json:"page,omitempty"`
	PageSize  int    `json:"pageSize,omitempty"`
	Total     int    `json:"total,omitempty"`
	HasNext   bool   `json:"hasNext,omitempty"`
}

type APIError struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
}

func RespondJSON(w http.ResponseWriter, status int, resp APIResponse) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(resp)
}

func RespondOK(w http.ResponseWriter, data interface{}) {
	RespondJSON(w, http.StatusOK, APIResponse{Data: data})
}

func RespondError(w http.ResponseWriter, code string, message string, status int) {
	RespondJSON(w, status, APIResponse{
		Error: &APIError{Code: code, Message: message},
	})
}

var slugRegex = regexp.MustCompile(`^[a-z0-9\p{Han}]+(?:-[a-z0-9\p{Han}]+)*$`)

func isValidSlug(slug string) bool {
	return len(slug) > 0 && len(slug) <= 100 && slugRegex.MatchString(slug)
}

func RespondPaginated(w http.ResponseWriter, data interface{}, page, pageSize, total int) {
	RespondJSON(w, http.StatusOK, APIResponse{
		Data: data,
		Meta: &Meta{
			Page:     page,
			PageSize: pageSize,
			Total:    total,
			HasNext:  page*pageSize < total,
		},
	})
}
