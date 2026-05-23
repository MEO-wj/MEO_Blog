package http

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/meo-blog/backend/internal/config"
	"github.com/meo-blog/backend/internal/repository"
)

// Guestbook ownership tokens — HMAC-signed, no IP dependency
func guestbookSignToken(secret, messageID string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(messageID + "|" + time.Now().UTC().Format("2006-01-02")))
	return hex.EncodeToString(mac.Sum(nil))
}

func guestbookVerifyToken(secret, messageID, token string) bool {
	if token == "" {
		return false
	}
	// Check today and yesterday to handle timezone edge cases
	for _, day := range []time.Time{time.Now().UTC(), time.Now().UTC().AddDate(0, 0, -1)} {
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write([]byte(messageID + "|" + day.Format("2006-01-02")))
		expected := hex.EncodeToString(mac.Sum(nil))
		if hmac.Equal([]byte(token), []byte(expected)) {
			return true
		}
	}
	return false
}

func clientIP(r *http.Request) string {
	if forwardedFor := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); forwardedFor != "" {
		if ip := strings.TrimSpace(strings.Split(forwardedFor, ",")[0]); ip != "" {
			return ip
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}

// --- Public handlers ---

func listGuestbookMessagesHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip := clientIP(r)
		messages, err := repository.ListGuestbookMessages(r.Context(), db, ip)
		if err != nil {
			slog.Error("list guestbook messages failed", "error", err)
			RespondError(w, "LIST_FAILED", "failed to list messages", http.StatusInternalServerError)
			return
		}
		RespondOK(w, messages)
	}
}

func createGuestbookMessageHandler(db *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
		var c repository.GuestbookMessageCreate
		if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
			RespondError(w, "INVALID_JSON", "invalid request body", http.StatusBadRequest)
			return
		}
		if c.Nickname == "" || c.Content == "" {
			RespondError(w, "VALIDATION_ERROR", "nickname and content are required", http.StatusBadRequest)
			return
		}
		c.Nickname = strings.TrimSpace(c.Nickname)
		c.Content = strings.TrimSpace(c.Content)
		if len(c.Nickname) > 30 {
			RespondError(w, "VALIDATION_ERROR", "nickname too long (max 30)", http.StatusBadRequest)
			return
		}
		if len(c.Content) > 500 {
			RespondError(w, "VALIDATION_ERROR", "content too long (max 500)", http.StatusBadRequest)
			return
		}
		ip := clientIP(r)
		msg, err := repository.CreateGuestbookMessage(r.Context(), db, ip, &c)
		if err != nil {
			slog.Error("create guestbook message failed", "error", err)
			RespondError(w, "CREATE_FAILED", "failed to create message", http.StatusInternalServerError)
			return
		}
		InvalidateETagCache("guestbook")
		token := guestbookSignToken(cfg.JWTSecret, msg.ID)
		RespondOK(w, map[string]any{"message": msg, "ownerToken": token})
	}
}

// Public: user reply to a message
func userReplyGuestbookHandler(db *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		messageID := chi.URLParam(r, "id")
		r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
		var body struct {
			Nickname string `json:"nickname"`
			Content  string `json:"content"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			RespondError(w, "INVALID_JSON", "invalid request body", http.StatusBadRequest)
			return
		}
		body.Nickname = strings.TrimSpace(body.Nickname)
		body.Content = strings.TrimSpace(body.Content)
		if body.Nickname == "" || body.Content == "" {
			RespondError(w, "VALIDATION_ERROR", "nickname and content are required", http.StatusBadRequest)
			return
		}
		if len(body.Nickname) > 30 {
			RespondError(w, "VALIDATION_ERROR", "nickname too long (max 30)", http.StatusBadRequest)
			return
		}
		if len(body.Content) > 500 {
			RespondError(w, "VALIDATION_ERROR", "content too long (max 500)", http.StatusBadRequest)
			return
		}
		ip := clientIP(r)
		reply, err := repository.CreateGuestbookUserReply(r.Context(), db, messageID, body.Nickname, body.Content, ip)
		if err != nil {
			slog.Error("create user reply failed", "error", err, "messageID", messageID)
			RespondError(w, "CREATE_FAILED", "failed to create reply", http.StatusInternalServerError)
			return
		}
		InvalidateETagCache("guestbook")
		RespondOK(w, reply)
	}
}

// Public: user deletes their own message (token verified)
func userDeleteGuestbookMessageHandler(db *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		token := r.URL.Query().Get("token")
		if !guestbookVerifyToken(cfg.JWTSecret, id, token) {
			RespondError(w, "FORBIDDEN", "invalid ownership token", http.StatusForbidden)
			return
		}
		if err := repository.DeleteGuestbookMessage(r.Context(), db, id); err != nil {
			slog.Error("delete own guestbook message failed", "error", err, "id", id)
			RespondError(w, "DELETE_FAILED", "failed to delete message", http.StatusInternalServerError)
			return
		}
		InvalidateETagCache("guestbook")
		RespondOK(w, map[string]string{"deleted": id})
	}
}

// --- Admin handlers ---

func adminReplyGuestbookHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		messageID := chi.URLParam(r, "id")
		r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
		var c repository.GuestbookReplyCreate
		if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
			RespondError(w, "INVALID_JSON", "invalid request body", http.StatusBadRequest)
			return
		}
		if c.Content == "" || c.AdminDisplayName == "" {
			RespondError(w, "VALIDATION_ERROR", "content and adminDisplayName are required", http.StatusBadRequest)
			return
		}
		reply, err := repository.CreateGuestbookReply(r.Context(), db, messageID, &c)
		if err != nil {
			slog.Error("create guestbook reply failed", "error", err, "messageID", messageID)
			RespondError(w, "CREATE_FAILED", "failed to create reply", http.StatusInternalServerError)
			return
		}
		InvalidateETagCache("guestbook")
		RespondOK(w, reply)
	}
}

func adminDeleteGuestbookMessageHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		if err := repository.DeleteGuestbookMessage(r.Context(), db, id); err != nil {
			slog.Error("delete guestbook message failed", "error", err, "id", id)
			RespondError(w, "DELETE_FAILED", "failed to delete message", http.StatusInternalServerError)
			return
		}
		InvalidateETagCache("guestbook")
		RespondOK(w, map[string]string{"deleted": id})
	}
}

func adminDeleteGuestbookReplyHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		if err := repository.DeleteGuestbookReply(r.Context(), db, id); err != nil {
			slog.Error("delete guestbook reply failed", "error", err, "id", id)
			RespondError(w, "DELETE_FAILED", "failed to delete reply", http.StatusInternalServerError)
			return
		}
		InvalidateETagCache("guestbook")
		RespondOK(w, map[string]string{"deleted": id})
	}
}
