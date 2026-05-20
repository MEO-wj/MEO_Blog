package http

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/meo-blog/backend/internal/config"
)

const adminSessionTTL = 2 * time.Hour
const adminSessionCookieName = "meo_admin_session"
const adminMaxLoginFailures = 5
const adminLoginLockout = 10 * time.Minute

type adminLoginRequest struct {
	Password string `json:"password"`
	Sequence string `json:"sequence"`
}

type adminSessionClaims struct {
	Subject string `json:"sub"`
	Issued  int64  `json:"iat"`
	Expires int64  `json:"exp"`
	Nonce   string `json:"nonce"`
}

type adminLoginAttempt struct {
	Failures    int
	LockedUntil time.Time
}

var adminLoginAttempts = struct {
	sync.Mutex
	byIP map[string]adminLoginAttempt
}{
	byIP: map[string]adminLoginAttempt{},
}

func adminLoginHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if strings.TrimSpace(cfg.AdminPassword) == "" || strings.TrimSpace(cfg.AdminSequence) == "" {
			RespondError(w, "ADMIN_AUTH_NOT_CONFIGURED", "admin password is not configured", http.StatusServiceUnavailable)
			return
		}

		clientIP := adminClientIP(r)
		if lockedUntil, locked := adminLoginLocked(clientIP); locked {
			w.Header().Set("Retry-After", time.Until(lockedUntil).Round(time.Second).String())
			RespondError(w, "ADMIN_LOGIN_LOCKED", "too many failed attempts", http.StatusTooManyRequests)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, 2048)
		defer r.Body.Close()

		var req adminLoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			RespondError(w, "INVALID_JSON", "request body must be valid JSON", http.StatusBadRequest)
			return
		}

		if !secretMatches(req.Password, cfg.AdminPassword) || !secretMatches(normalizeAdminSequence(req.Sequence), normalizeAdminSequence(cfg.AdminSequence)) {
			adminRecordLoginFailure(clientIP)
			RespondError(w, "INVALID_CREDENTIALS", "invalid admin credentials", http.StatusUnauthorized)
			return
		}

		adminClearLoginFailures(clientIP)

		expiresAt := time.Now().Add(adminSessionTTL)
		token, err := signAdminSession(cfg.JWTSecret, expiresAt)
		if err != nil {
			RespondError(w, "TOKEN_CREATE_FAILED", "failed to create admin session", http.StatusInternalServerError)
			return
		}

		http.SetCookie(w, &http.Cookie{
			Name:     adminSessionCookieName,
			Value:    token,
			Path:     "/",
			Expires:  expiresAt,
			MaxAge:   int(adminSessionTTL.Seconds()),
			HttpOnly: true,
			SameSite: http.SameSiteStrictMode,
			Secure:   r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https",
		})

		RespondOK(w, map[string]interface{}{
			"expiresAt": expiresAt.UTC().Format(time.RFC3339),
		})
	}
}

func adminSessionHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(adminSessionCookieName)
		if err != nil || !verifyAdminSession(cfg.JWTSecret, cookie.Value) {
			RespondError(w, "ADMIN_SESSION_INVALID", "invalid admin session", http.StatusUnauthorized)
			return
		}

		RespondOK(w, map[string]interface{}{
			"authenticated": true,
		})
	}
}

func secretMatches(input, expected string) bool {
	inputHash := sha256.Sum256([]byte(input))
	expectedHash := sha256.Sum256([]byte(expected))
	return subtle.ConstantTimeCompare(inputHash[:], expectedHash[:]) == 1
}

func normalizeAdminSequence(sequence string) string {
	normalized := strings.ToUpper(strings.TrimSpace(sequence))
	replacer := strings.NewReplacer(
		"ARROWUP", "U",
		"ARROWDOWN", "D",
		"ARROWLEFT", "L",
		"ARROWRIGHT", "R",
		"UP", "U",
		"DOWN", "D",
		"LEFT", "L",
		"RIGHT", "R",
		"上", "U",
		"下", "D",
		"左", "L",
		"右", "R",
		" ", "",
		"\t", "",
		"\r", "",
		"\n", "",
		"-", "",
		"_", "",
		",", "",
		"，", "",
		"/", "",
	)
	return replacer.Replace(normalized)
}

func adminClientIP(r *http.Request) string {
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

func adminLoginLocked(clientIP string) (time.Time, bool) {
	adminLoginAttempts.Lock()
	defer adminLoginAttempts.Unlock()

	attempt := adminLoginAttempts.byIP[clientIP]
	if attempt.LockedUntil.IsZero() || time.Now().After(attempt.LockedUntil) {
		return time.Time{}, false
	}

	return attempt.LockedUntil, true
}

func adminRecordLoginFailure(clientIP string) {
	adminLoginAttempts.Lock()
	defer adminLoginAttempts.Unlock()

	attempt := adminLoginAttempts.byIP[clientIP]
	attempt.Failures++
	if attempt.Failures >= adminMaxLoginFailures {
		attempt.LockedUntil = time.Now().Add(adminLoginLockout)
	}
	adminLoginAttempts.byIP[clientIP] = attempt
}

func adminClearLoginFailures(clientIP string) {
	adminLoginAttempts.Lock()
	defer adminLoginAttempts.Unlock()

	delete(adminLoginAttempts.byIP, clientIP)
}

func signAdminSession(secret string, expiresAt time.Time) (string, error) {
	nonce := make([]byte, 16)
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}

	claims := adminSessionClaims{
		Subject: "admin",
		Issued:  time.Now().Unix(),
		Expires: expiresAt.Unix(),
		Nonce:   base64.RawURLEncoding.EncodeToString(nonce),
	}

	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	encodedPayload := base64.RawURLEncoding.EncodeToString(payload)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(encodedPayload))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	return encodedPayload + "." + signature, nil
}

func verifyAdminSession(secret, token string) bool {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return false
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(parts[0]))
	expectedSignature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if subtle.ConstantTimeCompare([]byte(parts[1]), []byte(expectedSignature)) != 1 {
		return false
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return false
	}

	var claims adminSessionClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return false
	}

	return claims.Subject == "admin" && time.Now().Unix() < claims.Expires
}
