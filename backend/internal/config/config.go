package config

import "os"

type Config struct {
	AppEnv       string
	ServerAddr   string
	DatabaseURL  string
	RedisAddr    string
	RedisPassword string
	CorsOrigins  string
	JWTSecret    string
	GitHubToken  string
}

func Load() *Config {
	return &Config{
		AppEnv:       getEnv("APP_ENV", "development"),
		ServerAddr:   getEnv("SERVER_ADDR", ":8080"),
		DatabaseURL:  getEnv("DATABASE_URL", "postgres://meo:change_me@localhost:5432/meo_blog?sslmode=disable"),
		RedisAddr:    getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		CorsOrigins:  getEnv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:3000"),
		JWTSecret:    getEnv("JWT_SECRET", "dev-secret-change-me"),
		GitHubToken:  getEnv("GITHUB_TOKEN", ""),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
