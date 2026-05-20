package http

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

const adminSessionKey = "admin:session"
const adminSessionStoreTTL = 7 * 24 * time.Hour

type adminSessionStore struct {
	rdb *redis.Client
}

func newAdminSessionStore(rdb *redis.Client) *adminSessionStore {
	return &adminSessionStore{rdb: rdb}
}

func (s *adminSessionStore) Get(ctx context.Context) (string, bool, error) {
	val, err := s.rdb.Get(ctx, adminSessionKey).Result()
	if err == redis.Nil {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return val, true, nil
}

func (s *adminSessionStore) Set(ctx context.Context, token string) error {
	return s.rdb.Set(ctx, adminSessionKey, token, adminSessionStoreTTL).Err()
}

func (s *adminSessionStore) Delete(ctx context.Context) error {
	return s.rdb.Del(ctx, adminSessionKey).Err()
}

func (s *adminSessionStore) Matches(ctx context.Context, token string) (bool, error) {
	stored, exists, err := s.Get(ctx)
	if err != nil || !exists {
		return false, err
	}
	return stored == token, nil
}
