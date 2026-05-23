package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// SessionClaims represents the decoded claims from an admin session token.
type SessionClaims struct {
	Subject string `json:"sub"`
	Issued  int64  `json:"iat"`
	Expires int64  `json:"exp"`
	Nonce   string `json:"nonce"`
}

// VerifySession checks the HMAC signature and expiry of a session token.
func VerifySession(secret, token string) bool {
	encodedPayload, signature, ok := splitToken(token)
	if !ok {
		return false
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(encodedPayload))
	expectedSignature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if subtle.ConstantTimeCompare([]byte(signature), []byte(expectedSignature)) != 1 {
		return false
	}

	payload, err := base64.RawURLEncoding.DecodeString(encodedPayload)
	if err != nil {
		return false
	}
	var claims SessionClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return false
	}

	return claims.Subject == "admin" && time.Now().Unix() < claims.Expires
}

// DecodeSessionClaims decodes the payload portion of a session token without
// verifying the signature. Use VerifySession for full validation.
func DecodeSessionClaims(token string) (*SessionClaims, error) {
	encodedPayload, _, ok := splitToken(token)
	if !ok {
		return nil, ErrInvalidToken
	}
	payload, err := base64.RawURLEncoding.DecodeString(encodedPayload)
	if err != nil {
		return nil, err
	}
	var claims SessionClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, err
	}
	return &claims, nil
}

func splitToken(token string) (encodedPayload, signature string, ok bool) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return "", "", false
	}
	return parts[0], parts[1], true
}

// TokenHash returns a hex-encoded SHA256 hash of the token, used as Redis key.
func TokenHash(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

// IsTokenBlacklisted checks Redis for a revoked token. Returns false if Redis
// is unavailable (fail-open) to avoid locking out admins during Redis outages.
func IsTokenBlacklisted(ctx context.Context, rdb *redis.Client, token string) bool {
	if rdb == nil {
		return false
	}
	key := "admin:blacklist:" + TokenHash(token)
	exists, err := rdb.Exists(ctx, key).Result()
	return err == nil && exists > 0
}

// ErrInvalidToken is returned when a token has an invalid format.
var ErrInvalidToken = errInvalidToken{}

type errInvalidToken struct{}

func (errInvalidToken) Error() string { return "invalid token format" }
